import express from 'express';
import { readSheet, appendRow, updateRowById } from '../services/supabase.js';
import { verifyToken, requireInvoiceAccess } from '../middleware/auth.js';

const router = express.Router();

const FREQUENCIES = ['Weekly', 'Monthly', 'Quarterly', 'Yearly'];
const STATUSES = ['Active', 'Paused', 'Cancelled'];

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

// Advances a YYYY-MM-DD date string forward by one billing cycle. Always
// steps from the *previous* nextRunDate (not "today") so the cadence stays
// fixed to the original anchor date rather than drifting if a run is late.
function advanceDate(dateStr, frequency) {
  const d = new Date(dateStr);
  switch (frequency) {
    case 'Weekly': d.setDate(d.getDate() + 7); break;
    case 'Monthly': d.setMonth(d.getMonth() + 1); break;
    case 'Quarterly': d.setMonth(d.getMonth() + 3); break;
    case 'Yearly': d.setFullYear(d.getFullYear() + 1); break;
    default: d.setMonth(d.getMonth() + 1);
  }
  return d.toISOString().slice(0, 10);
}

function addDays(dateStr, days) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + Number(days || 0));
  return d.toISOString().slice(0, 10);
}

function sanitizeBody(body) {
  const clean = { ...body };
  if (Object.prototype.hasOwnProperty.call(clean, 'lineItems')) clean.lineItems = sanitizeLineItems(clean.lineItems);
  if (Object.prototype.hasOwnProperty.call(clean, 'taxPercent')) clean.taxPercent = Number(clean.taxPercent) || 0;
  if (Object.prototype.hasOwnProperty.call(clean, 'discountPercent')) clean.discountPercent = Number(clean.discountPercent) || 0;
  if (Object.prototype.hasOwnProperty.call(clean, 'dueInDays')) clean.dueInDays = Number(clean.dueInDays) || 15;
  return clean;
}

// --- Recurring Invoices CRUD ---

router.get('/recurring-invoices', verifyToken, requireInvoiceAccess, async (req, res) => {
  try {
    const rows = await readSheet('RecurringInvoices');
    res.json(rows.filter((r) => !r.deletedat));
  } catch (err) {
    console.error('GET /recurring-invoices failed:', err);
    res.status(500).json({ error: 'Could not load recurring invoices.' });
  }
});

router.get('/recurring-invoices/:id', verifyToken, requireInvoiceAccess, async (req, res) => {
  try {
    const rows = await readSheet('RecurringInvoices');
    const row = rows.find((r) => r.id === req.params.id && !r.deletedat);
    if (!row) return res.status(404).json({ error: 'Recurring invoice not found.' });
    res.json(row);
  } catch (err) {
    console.error('GET /recurring-invoices/:id failed:', err);
    res.status(500).json({ error: 'Could not load recurring invoice.' });
  }
});

router.post('/recurring-invoices', verifyToken, requireInvoiceAccess, async (req, res) => {
  try {
    const { clientName, frequency, startDate } = req.body;
    if (!clientName || typeof clientName !== 'string' || !clientName.trim()) {
      return res.status(400).json({ error: 'Client name is required.' });
    }
    if (!FREQUENCIES.includes(frequency)) {
      return res.status(400).json({ error: `Frequency must be one of: ${FREQUENCIES.join(', ')}` });
    }
    if (!startDate) {
      return res.status(400).json({ error: 'Start date is required.' });
    }
    const now = new Date().toISOString();
    const row = {
      id: Date.now().toString(),
      status: 'Active',
      createdBy: req.user?.username || 'unknown',
      createdAt: now,
      nextRunDate: startDate,
      ...sanitizeBody(req.body),
    };
    await appendRow('RecurringInvoices', row);
    res.json({ success: true, id: row.id });
  } catch (err) {
    console.error('POST /recurring-invoices failed:', err);
    res.status(500).json({ error: 'Could not create recurring invoice.' });
  }
});

router.put('/recurring-invoices/:id', verifyToken, requireInvoiceAccess, async (req, res) => {
  try {
    const updates = sanitizeBody(req.body);
    delete updates.status; // status changes go through the dedicated endpoint below
    delete updates.nextRunDate; // don't let a template edit silently reschedule the series
    await updateRowById('RecurringInvoices', 0, req.params.id, updates);
    res.json({ success: true });
  } catch (err) {
    console.error('PUT /recurring-invoices/:id failed:', err);
    res.status(500).json({ error: 'Could not update recurring invoice.' });
  }
});

// Pause / resume / cancel a series. Cancelled is terminal (use DELETE to
// soft-delete it out of the list entirely); Paused simply stops the cron
// generator from picking it up until it's set back to Active.
router.patch('/recurring-invoices/:id/status', verifyToken, requireInvoiceAccess, async (req, res) => {
  try {
    const { status } = req.body;
    if (!STATUSES.includes(status)) {
      return res.status(400).json({ error: `Status must be one of: ${STATUSES.join(', ')}` });
    }
    await updateRowById('RecurringInvoices', 0, req.params.id, { status });
    res.json({ success: true });
  } catch (err) {
    console.error('PATCH /recurring-invoices/:id/status failed:', err);
    res.status(500).json({ error: 'Could not update status.' });
  }
});

router.delete('/recurring-invoices/:id', verifyToken, requireInvoiceAccess, async (req, res) => {
  try {
    await updateRowById('RecurringInvoices', 0, req.params.id, {
      deletedat: new Date().toISOString(),
      deletedby: req.user?.username || 'unknown',
    });
    res.json({ success: true });
  } catch (err) {
    console.error('DELETE /recurring-invoices/:id failed:', err);
    res.status(500).json({ error: 'Could not delete recurring invoice.' });
  }
});

// --- Cron: generate due invoices ---
// Vercel Cron sends `Authorization: Bearer <CRON_SECRET>` when invoking a
// scheduled job (same convention as backend/routes/cron.js). Kept as its
// own check here (rather than importing from cron.js) so this file has no
// dependency on that one.
function verifyCron(req, res, next) {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    console.error('CRON_SECRET not set — refusing to run scheduled job.');
    return res.status(500).json({ error: 'Cron not configured.' });
  }
  if (req.headers.authorization !== `Bearer ${expected}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// Runs daily. For every Active recurring series whose nextRunDate has
// arrived, creates a new Draft invoice (never auto-sends) and advances the
// series to its next due date. Advancing nextRunDate immediately makes this
// safe to re-run the same day without double-generating.
router.get('/cron/recurring-invoices', verifyCron, async (req, res) => {
  try {
    const [series, invoiceSettingsRows] = await Promise.all([
      readSheet('RecurringInvoices'),
      readSheet('InvoiceSettings'),
    ]);
    const todayKey = new Date().toISOString().slice(0, 10);
    const due = series.filter((s) => !s.deletedat && s.status === 'Active' && s.nextRunDate && s.nextRunDate <= todayKey);

    let settings = invoiceSettingsRows.find((r) => r.id === 'default') || { nextInvoiceNumber: 1 };
    let nextNumber = Number(settings.nextInvoiceNumber) || 1;

    let generated = 0;
    const failures = [];
    for (const s of due) {
      try {
        const issueDate = todayKey;
        const dueDate = addDays(issueDate, s.dueInDays ?? 15);
        const invoiceNumber = `INV-${String(nextNumber).padStart(4, '0')}`;
        const invoice = {
          id: (Date.now() + generated).toString(),
          status: 'Draft',
          createdBy: 'recurring-invoices-cron',
          createdAt: new Date().toISOString(),
          invoiceNumber,
          contactId: s.contactId || null,
          clientName: s.clientName,
          clientEmail: s.clientEmail || '',
          clientAddress: s.clientAddress || '',
          clientGstin: s.clientGstin || '',
          issueDate,
          dueDate,
          lineItems: s.lineItems || [],
          taxPercent: s.taxPercent || 0,
          discountPercent: s.discountPercent || 0,
          notes: s.notes || '',
          terms: s.terms || '',
          recurringInvoiceId: s.id,
        };
        await appendRow('Invoices', invoice);
        nextNumber += 1;

        await updateRowById('RecurringInvoices', 0, s.id, {
          nextRunDate: advanceDate(s.nextRunDate, s.frequency),
          lastGeneratedInvoiceId: invoice.id,
          lastGeneratedAt: new Date().toISOString(),
        });
        generated += 1;
      } catch (err) {
        console.error(`Recurring invoice generation failed for series ${s.id}:`, err.message);
        failures.push(s.id);
      }
    }

    if (generated > 0) {
      const existingSettings = invoiceSettingsRows.find((r) => r.id === 'default');
      if (existingSettings) {
        await updateRowById('InvoiceSettings', 0, 'default', { nextInvoiceNumber: nextNumber });
      } else {
        await appendRow('InvoiceSettings', { id: 'default', currencySymbol: '$', nextInvoiceNumber: nextNumber });
      }
    }

    res.json({ success: true, checked: series.length, due: due.length, generated, failed: failures.length });
  } catch (err) {
    console.error('GET /cron/recurring-invoices failed:', err);
    res.status(500).json({ error: 'Recurring invoice generation failed.' });
  }
});

export default router;
