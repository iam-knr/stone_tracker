import express from 'express';
import { readSheet, appendRow, updateRowById, deleteRowById } from '../services/supabase.js';
import { verifyToken, requireAdmin, requireInvoiceAccess } from '../middleware/auth.js';
import { renderInvoicePdf } from '../services/invoicePdf.js';
import { sendInvoiceEmail } from '../services/mailer.js';

const router = express.Router();

const DEFAULT_SETTINGS = {
  id: 'default',
  companyName: '',
  companyEmail: '',
  companyPhone: '',
  companyAddress: '',
  companyGstin: '',
  companyLogo: '',
  bankAccountName: '',
  bankAccountNumber: '',
  bankIfsc: '',
  currencySymbol: '$',
  nextInvoiceNumber: 1,
};

async function getSettings() {
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

function sanitizeInvoiceBody(body) {
  const clean = { ...body };
  if (Object.prototype.hasOwnProperty.call(clean, 'lineItems')) clean.lineItems = sanitizeLineItems(clean.lineItems);
  if (Object.prototype.hasOwnProperty.call(clean, 'taxPercent')) clean.taxPercent = Number(clean.taxPercent) || 0;
  if (Object.prototype.hasOwnProperty.call(clean, 'discountPercent')) clean.discountPercent = Number(clean.discountPercent) || 0;
  for (const dateField of ['issueDate', 'dueDate']) {
    if (clean[dateField] === '') clean[dateField] = null;
  }
  return clean;
}

// Accepts either an array of email strings or a single comma/semicolon
// separated string (the send-invoice CC field posts a free-text string),
// and returns a clean, deduped array with anything that isn't a plausible
// email address dropped rather than rejected outright — CC is optional and
// best-effort, not a field we want to hard-fail an entire send over.
function sanitizeCcEmails(raw) {
  if (!raw) return [];
  const list = Array.isArray(raw) ? raw : String(raw).split(/[,;]/);
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return [...new Set(list.map((e) => String(e).trim()).filter((e) => EMAIL_RE.test(e)))];
}

// --- Company profile (Invoice Settings): admin only ---

router.get('/invoices/settings', verifyToken, requireInvoiceAccess, async (req, res) => {
  try {
    res.json(await getSettings());
  } catch (err) {
    console.error('GET /invoices/settings failed:', err);
    res.status(500).json({ error: 'Could not load invoice settings.' });
  }
});

router.put('/invoices/settings', verifyToken, requireAdmin, async (req, res) => {
  try {
    const {
      companyName, companyEmail, companyPhone, companyAddress, companyGstin, companyLogo,
      bankAccountName, bankAccountNumber, bankIfsc, currencySymbol,
    } = req.body;
    const rows = await readSheet('InvoiceSettings');
    const existing = rows.find((r) => r.id === 'default');
    const updates = {
      companyName, companyEmail, companyPhone, companyAddress, companyGstin, companyLogo,
      bankAccountName, bankAccountNumber, bankIfsc, currencySymbol,
    };
    // Don't let an empty/omitted logo in the request wipe out a previously
    // uploaded one — the modal always sends the current logo back, but this
    // guards against any client sending a blank string by mistake.
    if (updates.companyLogo === undefined) delete updates.companyLogo;
    if (existing) {
      await updateRowById('InvoiceSettings', 0, 'default', updates);
    } else {
      await appendRow('InvoiceSettings', { ...DEFAULT_SETTINGS, ...updates });
    }
    res.json({ success: true });
  } catch (err) {
    console.error('PUT /invoices/settings failed:', err);
    res.status(500).json({ error: 'Could not save invoice settings.' });
  }
});

// --- Invoices CRUD ---

router.get('/invoices', verifyToken, requireInvoiceAccess, async (req, res) => {
  try {
    const invoices = await readSheet('Invoices');
    res.json(invoices.filter((inv) => !inv.deletedat));
  } catch (err) {
    console.error('GET /invoices failed:', err);
    res.status(500).json({ error: 'Could not load invoices.' });
  }
});

router.get('/invoices/:id', verifyToken, requireInvoiceAccess, async (req, res) => {
  try {
    const invoices = await readSheet('Invoices');
    const invoice = invoices.find((i) => i.id === req.params.id && !i.deletedat);
    if (!invoice) return res.status(404).json({ error: 'Invoice not found.' });
    res.json(invoice);
  } catch (err) {
    console.error('GET /invoices/:id failed:', err);
    res.status(500).json({ error: 'Could not load invoice.' });
  }
});

router.post('/invoices', verifyToken, requireInvoiceAccess, async (req, res) => {
  try {
    const { clientName } = req.body;
    if (!clientName || typeof clientName !== 'string' || !clientName.trim()) {
      return res.status(400).json({ error: 'Client name is required.' });
    }
    const settings = await getSettings();
    const nextNumber = Number(settings.nextInvoiceNumber) || 1;
    const invoiceNumber = req.body.invoiceNumber?.trim() || `INV-${String(nextNumber).padStart(4, '0')}`;

    const now = new Date().toISOString();
    const invoice = {
      id: Date.now().toString(),
      status: 'Draft',
      createdBy: req.user?.username || 'unknown',
      createdAt: now,
      invoiceNumber,
      ...sanitizeInvoiceBody(req.body),
    };
    await appendRow('Invoices', invoice);

    // Only auto-increment the running invoice number when we actually used
    // the auto-generated one (an operator-supplied number shouldn't burn a
    // sequence slot).
    if (!req.body.invoiceNumber?.trim()) {
      const rows = await readSheet('InvoiceSettings');
      const existing = rows.find((r) => r.id === 'default');
      const updates = { nextInvoiceNumber: nextNumber + 1 };
      if (existing) await updateRowById('InvoiceSettings', 0, 'default', updates);
      else await appendRow('InvoiceSettings', { ...DEFAULT_SETTINGS, ...updates });
    }

    res.json({ success: true, id: invoice.id, invoiceNumber });
  } catch (err) {
    console.error('POST /invoices failed:', err);
    res.status(500).json({ error: 'Could not create invoice.' });
  }
});

router.put('/invoices/:id', verifyToken, requireInvoiceAccess, async (req, res) => {
  try {
    const updates = sanitizeInvoiceBody(req.body);
    await updateRowById('Invoices', 0, req.params.id, updates);
    res.json({ success: true });
  } catch (err) {
    console.error('PUT /invoices/:id failed:', err);
    res.status(500).json({ error: 'Could not update invoice.' });
  }
});

// Soft delete — consistent with how projects/tasks are deleted elsewhere
// in the app (recoverable, not wired into the same Trash UI since invoices
// are a fully separate area, but kept non-destructive by default).
router.delete('/invoices/:id', verifyToken, requireInvoiceAccess, async (req, res) => {
  try {
    await updateRowById('Invoices', 0, req.params.id, {
      deletedat: new Date().toISOString(),
      deletedby: req.user?.username || 'unknown',
    });
    res.json({ success: true });
  } catch (err) {
    console.error('DELETE /invoices/:id failed:', err);
    res.status(500).json({ error: 'Could not delete invoice.' });
  }
});

// Renders and returns the invoice PDF directly (for a "Download PDF"
// button) without emailing anything.
router.get('/invoices/:id/pdf', verifyToken, requireInvoiceAccess, async (req, res) => {
  try {
    const invoices = await readSheet('Invoices');
    const invoice = invoices.find((i) => i.id === req.params.id && !i.deletedat);
    if (!invoice) return res.status(404).json({ error: 'Invoice not found.' });
    const settings = await getSettings();
    const pdfBuffer = await renderInvoicePdf(invoice, settings);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${invoice.invoiceNumber || 'invoice'}.pdf"`);
    res.send(pdfBuffer);
  } catch (err) {
    console.error('GET /invoices/:id/pdf failed:', err);
    res.status(500).json({ error: 'Could not generate PDF.' });
  }
});

// Emails the invoice (as a PDF attachment) directly to the client. Unlike
// password-reset emails, this reports failures back to the caller — the
// person clicking "Send" needs to know whether it actually went out.
// Accepts an optional `ccEmails` field (array or comma-separated string) —
// entirely optional, never blocks the send if it's missing or malformed.
router.post('/invoices/:id/send', verifyToken, requireInvoiceAccess, async (req, res) => {
  try {
    const invoices = await readSheet('Invoices');
    const invoice = invoices.find((i) => i.id === req.params.id && !i.deletedat);
    if (!invoice) return res.status(404).json({ error: 'Invoice not found.' });
    if (!invoice.clientEmail) {
      return res.status(400).json({ error: 'This invoice has no client email address. Add one before sending.' });
    }
    const ccEmails = sanitizeCcEmails(req.body?.ccEmails);
    const settings = await getSettings();
    const pdfBuffer = await renderInvoicePdf(invoice, settings);
    await sendInvoiceEmail({ toEmail: invoice.clientEmail, ccEmails, invoice, companySettings: settings, pdfBuffer });

    const now = new Date().toISOString();
    await updateRowById('Invoices', 0, invoice.id, { status: 'Sent', sentAt: now });
    res.json({ success: true, sentAt: now, ccEmails });
  } catch (err) {
    console.error('POST /invoices/:id/send failed:', err);
    res.status(500).json({ error: err.message || 'Could not send invoice.' });
  }
});

// Mark an invoice Paid/Sent/Draft manually — the "essentials" version of
// payment tracking (no gateway integration, just a status the team sets
// themselves once a client has actually paid).
router.patch('/invoices/:id/status', verifyToken, requireInvoiceAccess, async (req, res) => {
  try {
    const { status } = req.body;
    if (!['Draft', 'Sent', 'Paid', 'Overdue'].includes(status)) {
      return res.status(400).json({ error: 'Status must be one of: Draft, Sent, Paid, Overdue.' });
    }
    await updateRowById('Invoices', 0, req.params.id, { status });
    res.json({ success: true });
  } catch (err) {
    console.error('PATCH /invoices/:id/status failed:', err);
    res.status(500).json({ error: 'Could not update status.' });
  }
});

export default router;
