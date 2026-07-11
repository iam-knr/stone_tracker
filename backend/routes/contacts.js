import express from 'express';
import { readSheet, appendRow, updateRowById } from '../services/supabase.js';
import { verifyToken, requireInvoiceAccess } from '../middleware/auth.js';
import { computeInvoiceTotals } from '../services/invoicePdf.js';

const router = express.Router();

function sanitizeContactBody(body) {
  const clean = { ...body };
  delete clean.id;
  delete clean.createdBy;
  delete clean.createdAt;
  delete clean.deletedat;
  delete clean.deletedby;
  if (!clean.name || typeof clean.name !== 'string' || !clean.name.trim()) {
    throw new Error('Contact name is required.');
  }
  return clean;
}

router.get('/contacts', verifyToken, requireInvoiceAccess, async (req, res) => {
  try {
    const contacts = await readSheet('Contacts');
    res.json(contacts.filter((c) => !c.deletedat));
  } catch (err) {
    console.error('GET /contacts failed:', err);
    res.status(500).json({ error: 'Could not load contacts.' });
  }
});

router.get('/contacts/:id', verifyToken, requireInvoiceAccess, async (req, res) => {
  try {
    const contacts = await readSheet('Contacts');
    const contact = contacts.find((c) => c.id === req.params.id && !c.deletedat);
    if (!contact) return res.status(404).json({ error: 'Contact not found.' });
    res.json(contact);
  } catch (err) {
    console.error('GET /contacts/:id failed:', err);
    res.status(500).json({ error: 'Could not load contact.' });
  }
});

// A "statement" is just this contact's invoices, aggregated — no separate
// table, computed on the fly so it can never drift from the real invoices.
router.get('/contacts/:id/statement', verifyToken, requireInvoiceAccess, async (req, res) => {
  try {
    const [contacts, invoices] = await Promise.all([readSheet('Contacts'), readSheet('Invoices')]);
    const contact = contacts.find((c) => c.id === req.params.id && !c.deletedat);
    if (!contact) return res.status(404).json({ error: 'Contact not found.' });

    const contactInvoices = invoices
      .filter((inv) => inv.contactId === req.params.id && !inv.deletedat)
      .sort((a, b) => Number(b.id) - Number(a.id));

    let billed = 0;
    let paid = 0;
    const rows = contactInvoices.map((inv) => {
      const { total } = computeInvoiceTotals(inv);
      billed += total;
      if (inv.status === 'Paid') paid += total;
      return {
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        issueDate: inv.issueDate,
        dueDate: inv.dueDate,
        status: inv.status,
        total,
      };
    });

    res.json({
      contact,
      invoices: rows,
      totals: { billed, paid, outstanding: billed - paid },
    });
  } catch (err) {
    console.error('GET /contacts/:id/statement failed:', err);
    res.status(500).json({ error: 'Could not load statement.' });
  }
});

router.post('/contacts', verifyToken, requireInvoiceAccess, async (req, res) => {
  try {
    const clean = sanitizeContactBody(req.body);
    const contact = {
      id: Date.now().toString(),
      createdBy: req.user?.username || 'unknown',
      createdAt: new Date().toISOString(),
      ...clean,
    };
    await appendRow('Contacts', contact);
    res.json({ success: true, id: contact.id });
  } catch (err) {
    console.error('POST /contacts failed:', err);
    res.status(err.message?.includes('required') ? 400 : 500).json({ error: err.message || 'Could not create contact.' });
  }
});

router.put('/contacts/:id', verifyToken, requireInvoiceAccess, async (req, res) => {
  try {
    const clean = sanitizeContactBody(req.body);
    await updateRowById('Contacts', 0, req.params.id, clean);
    res.json({ success: true });
  } catch (err) {
    console.error('PUT /contacts/:id failed:', err);
    res.status(err.message?.includes('required') ? 400 : 500).json({ error: err.message || 'Could not update contact.' });
  }
});

router.delete('/contacts/:id', verifyToken, requireInvoiceAccess, async (req, res) => {
  try {
    await updateRowById('Contacts', 0, req.params.id, {
      deletedat: new Date().toISOString(),
      deletedby: req.user?.username || 'unknown',
    });
    res.json({ success: true });
  } catch (err) {
    console.error('DELETE /contacts/:id failed:', err);
    res.status(500).json({ error: 'Could not delete contact.' });
  }
});

export default router;
