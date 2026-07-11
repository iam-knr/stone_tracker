import express from 'express';
import { readSheet, appendRow, updateRowById, deleteRowById } from '../services/supabase.js';
import { verifyToken, requireAdmin, requireInvoiceAccess } from '../middleware/auth.js';

const router = express.Router();

const VALID_APPLIES_TO = ['invoice', 'contact', 'quote'];
const VALID_FIELD_TYPES = ['text', 'number', 'date'];

function sanitizeDefBody(body) {
  const clean = { ...body };
  delete clean.id;
  delete clean.createdAt;
  if (!clean.label || typeof clean.label !== 'string' || !clean.label.trim()) {
    throw new Error('Field label is required.');
  }
  if (!VALID_APPLIES_TO.includes(clean.appliesTo)) {
    throw new Error(`appliesTo must be one of: ${VALID_APPLIES_TO.join(', ')}`);
  }
  clean.fieldType = VALID_FIELD_TYPES.includes(clean.fieldType) ? clean.fieldType : 'text';
  clean.required = !!clean.required;
  clean.sortOrder = Number(clean.sortOrder) || 0;
  return clean;
}

// Readable by anyone with invoice access — the Invoice/Quote/Contact forms
// need this schema to know which extra fields to render, same as admin.
router.get('/custom-field-defs', verifyToken, requireInvoiceAccess, async (req, res) => {
  try {
    const defs = await readSheet('CustomFieldDefs');
    res.json(defs.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)));
  } catch (err) {
    console.error('GET /custom-field-defs failed:', err);
    res.status(500).json({ error: 'Could not load custom field definitions.' });
  }
});

// Defining/changing the schema itself is admin-only — this is a structural
// change that affects every invoice/quote/contact form, not per-record data.
router.post('/custom-field-defs', verifyToken, requireAdmin, async (req, res) => {
  try {
    const clean = sanitizeDefBody(req.body);
    const def = {
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
      ...clean,
    };
    await appendRow('CustomFieldDefs', def);
    res.json({ success: true, id: def.id });
  } catch (err) {
    console.error('POST /custom-field-defs failed:', err);
    res.status(err.message?.includes('required') || err.message?.includes('must be') ? 400 : 500).json({ error: err.message || 'Could not create field.' });
  }
});

router.put('/custom-field-defs/:id', verifyToken, requireAdmin, async (req, res) => {
  try {
    const clean = sanitizeDefBody(req.body);
    await updateRowById('CustomFieldDefs', 0, req.params.id, clean);
    res.json({ success: true });
  } catch (err) {
    console.error('PUT /custom-field-defs/:id failed:', err);
    res.status(err.message?.includes('required') || err.message?.includes('must be') ? 400 : 500).json({ error: err.message || 'Could not update field.' });
  }
});

router.delete('/custom-field-defs/:id', verifyToken, requireAdmin, async (req, res) => {
  try {
    await deleteRowById('CustomFieldDefs', 0, req.params.id);
    res.json({ success: true });
  } catch (err) {
    console.error('DELETE /custom-field-defs/:id failed:', err);
    res.status(500).json({ error: 'Could not delete field.' });
  }
});

export default router;
