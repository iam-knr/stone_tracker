import express from 'express';
import { readSheet, appendRow, updateRowById } from '../services/supabase.js';
import { verifyToken, requireInvoiceAccess } from '../middleware/auth.js';
import { renderQuotePdf } from '../services/quotePdf.js';
import { sendQuoteEmail } from '../services/mailer.js';

const router = express.Router();

const DEFAULT_SETTINGS = {
  id: 'default',
  companyName: '',
  companyEmail: '',
  companyPhone: '',
  companyAddress: '',
  companyGstin: '',
  companyLogo: '',
  currencySymbol: '$',
  nextQuoteNumber: 1,
};

async function getInvoiceSettings() {
  const rows = await readSheet('InvoiceSettings');
  const existing = rows.find((r) => r.id === 'default');
  return existing || DEFAULT_SETTINGS;
}

function sanitizeLineItems(lineItems) {
  if (!Array.isArray(lineItems)) return [];
  return lineItems
    .map((li) => ({
      description: String(li?.description || '').trim(),
      qty: Number(li?.qty) || 0,
      rate: Number(li?.rate) || 0,
    }))
    .filter((li) => li.description || li.qty || li.rate);
}

function sanitizeQuoteBody(body) {
  const clean = { ...body };
  delete clean.id;
  delete clean.createdBy;
  delete clean.createdAt;
  delete clean.deletedat;
  delete clean.deletedby;
  delete clean.convertedInvoiceId;
  if (Object.prototype.hasOwnProperty.call(clean, 'lineItems')) clean.lineItems = sanitizeLineItems(clean.lineItems);
  if (Object.prototype.hasOwnProperty.call(clean, 'taxPercent')) clean.taxPercent = Number(clean.taxPercent) || 0;
  if (Object.prototype.hasOwnProperty.call(clean, 'discountPercent')) clean.discountPercent = Number(clean.discountPercent) || 0;
  for (const dateField of ['issueDate', 'expiryDate']) {
    if (clean[dateField] === '') clean[dateField] = null;
  }
  return clean;
}

router.get('/quotes', verifyToken, requireInvoiceAccess, async (req, res) => {
  try {
    const quotes = await readSheet('Quotes');
    res.json(quotes.filter((q) => !q.deletedat));
  } catch (err) {
    console.error('GET /quotes failed:', err);
    res.status(500).json({ error: 'Could not load quotes.' });
  }
});

router.get('/quotes/:id', verifyToken, requireInvoiceAccess, async (req, res) => {
  try {
    const quotes = await readSheet('Quotes');
    const quote = quotes.find((q) => q.id === req.params.id && !q.deletedat);
    if (!quote) return res.status(404).json({ error: 'Quote not found.' });
    res.json(quote);
  } catch (err) {
    console.error('GET /quotes/:id failed:', err);
    res.status(500).json({ error: 'Could not load quote.' });
  }
});

router.post('/quotes', verifyToken, requireInvoiceAccess, async (req, res) => {
  try {
    const { clientName } = req.body;
    if (!clientName || typeof clientName !== 'string' || !clientName.trim()) {
      return res.status(400).json({ error: 'Client name is required.' });
    }
    const quotes = await readSheet('Quotes');
    const nextNumber = quotes.length
      ? Math.max(0, ...quotes.map((q) => {
        const m = /QUO-(\d+)/.exec(q.quoteNumber || '');
        return m ? Number(m[1]) : 0;
      })) + 1
      : 1;
    const quoteNumber = req.body.quoteNumber?.trim() || `QUO-${String(nextNumber).padStart(4, '0')}`;

    const quote = {
      id: Date.now().toString(),
      status: 'Draft',
      createdBy: req.user?.username || 'unknown',
      createdAt: new Date().toISOString(),
      quoteNumber,
      ...sanitizeQuoteBody(req.body),
    };
    await appendRow('Quotes', quote);
    res.json({ success: true, id: quote.id, quoteNumber });
  } catch (err) {
    console.error('POST /quotes failed:', err);
    res.status(500).json({ error: 'Could not create quote.' });
  }
});

router.put('/quotes/:id', verifyToken, requireInvoiceAccess, async (req, res) => {
  try {
    const updates = sanitizeQuoteBody(req.body);
    await updateRowById('Quotes', 0, req.params.id, updates);
    res.json({ success: true });
  } catch (err) {
    console.error('PUT /quotes/:id failed:', err);
    res.status(500).json({ error: 'Could not update quote.' });
  }
});

router.delete('/quotes/:id', verifyToken, requireInvoiceAccess, async (req, res) => {
  try {
    await updateRowById('Quotes', 0, req.params.id, {
      deletedat: new Date().toISOString(),
      deletedby: req.user?.username || 'unknown',
    });
    res.json({ success: true });
  } catch (err) {
    console.error('DELETE /quotes/:id failed:', err);
    res.status(500).json({ error: 'Could not delete quote.' });
  }
});

router.get('/quotes/:id/pdf', verifyToken, requireInvoiceAccess, async (req, res) => {
  try {
    const quotes = await readSheet('Quotes');
    const quote = quotes.find((q) => q.id === req.params.id && !q.deletedat);
    if (!quote) return res.status(404).json({ error: 'Quote not found.' });
    const settings = await getInvoiceSettings();
    const pdfBuffer = await renderQuotePdf(quote, settings);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${quote.quoteNumber || 'quote'}.pdf"`);
    res.send(pdfBuffer);
  } catch (err) {
    console.error('GET /quotes/:id/pdf failed:', err);
    res.status(500).json({ error: 'Could not generate PDF.' });
  }
});

router.post('/quotes/:id/send', verifyToken, requireInvoiceAccess, async (req, res) => {
  try {
    const quotes = await readSheet('Quotes');
    const quote = quotes.find((q) => q.id === req.params.id && !q.deletedat);
    if (!quote) return res.status(404).json({ error: 'Quote not found.' });
    if (!quote.clientEmail) {
      return res.status(400).json({ error: 'This quote has no client email address. Add one before sending.' });
    }
    const settings = await getInvoiceSettings();
    const pdfBuffer = await renderQuotePdf(quote, settings);
    await sendQuoteEmail({ toEmail: quote.clientEmail, quote, companySettings: settings, pdfBuffer });

    const now = new Date().toISOString();
    await updateRowById('Quotes', 0, quote.id, { status: 'Sent', sentAt: now });
    res.json({ success: true, sentAt: now });
  } catch (err) {
    console.error('POST /quotes/:id/send failed:', err);
    res.status(500).json({ error: err.message || 'Could not send quote.' });
  }
});

router.patch('/quotes/:id/status', verifyToken, requireInvoiceAccess, async (req, res) => {
  try {
    const { status } = req.body;
    if (!['Draft', 'Sent', 'Accepted', 'Rejected', 'Expired'].includes(status)) {
      return res.status(400).json({ error: 'Status must be one of: Draft, Sent, Accepted, Rejected, Expired.' });
    }
    await updateRowById('Quotes', 0, req.params.id, { status });
    res.json({ success: true });
  } catch (err) {
    console.error('PATCH /quotes/:id/status failed:', err);
    res.status(500).json({ error: 'Could not update status.' });
  }
});

// One-click conversion into an invoice: copies the client snapshot + line
// items + tax/discount across, marks the quote Accepted and links it to
// the new invoice, and burns the next real invoice number exactly like a
// normal "New Invoice" would.
router.post('/quotes/:id/convert', verifyToken, requireInvoiceAccess, async (req, res) => {
  try {
    const quotes = await readSheet('Quotes');
    const quote = quotes.find((q) => q.id === req.params.id && !q.deletedat);
    if (!quote) return res.status(404).json({ error: 'Quote not found.' });
    if (quote.convertedInvoiceId) {
      return res.status(400).json({ error: 'This quote has already been converted to an invoice.', invoiceId: quote.convertedInvoiceId });
    }

    const settings = await getInvoiceSettings();
    const nextNumber = Number(settings.nextInvoiceNumber) || 1;
    const invoiceNumber = `INV-${String(nextNumber).padStart(4, '0')}`;
    const now = new Date().toISOString();
    const invoice = {
      id: Date.now().toString(),
      status: 'Draft',
      createdBy: req.user?.username || 'unknown',
      createdAt: now,
      invoiceNumber,
      contactId: quote.contactId || '',
      clientName: quote.clientName,
      clientEmail: quote.clientEmail,
      clientAddress: quote.clientAddress,
      clientGstin: quote.clientGstin,
      issueDate: new Date().toISOString().slice(0, 10),
      lineItems: quote.lineItems || [],
      taxPercent: quote.taxPercent || 0,
      discountPercent: quote.discountPercent || 0,
      notes: quote.notes,
      terms: quote.terms,
    };
    await appendRow('Invoices', invoice);

    const settingsRows = await readSheet('InvoiceSettings');
    const existingSettings = settingsRows.find((r) => r.id === 'default');
    const settingsUpdates = { nextInvoiceNumber: nextNumber + 1 };
    if (existingSettings) await updateRowById('InvoiceSettings', 0, 'default', settingsUpdates);

    await updateRowById('Quotes', 0, quote.id, { status: 'Accepted', convertedInvoiceId: invoice.id });

    res.json({ success: true, invoiceId: invoice.id, invoiceNumber });
  } catch (err) {
    console.error('POST /quotes/:id/convert failed:', err);
    res.status(500).json({ error: 'Could not convert quote to invoice.' });
  }
});

export default router;
