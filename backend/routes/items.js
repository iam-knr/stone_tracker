import express from 'express';
import { readSheet, appendRow, updateRowById } from '../services/supabase.js';
import { verifyToken, requireInvoiceAccess } from '../middleware/auth.js';

const router = express.Router();

function sanitizeItemBody(body) {
  const clean = { ...body };
  delete clean.id;
  delete clean.createdBy;
  delete clean.createdAt;
  delete clean.deletedat;
  delete clean.deletedby;
  if (!clean.description || typeof clean.description !== 'string' || !clean.description.trim()) {
    throw new Error('Item description is required.');
  }
  if (Object.prototype.hasOwnProperty.call(clean, 'rate')) clean.rate = Number(clean.rate) || 0;
  if (Object.prototype.hasOwnProperty.call(clean, 'taxPercent')) {
    clean.taxPercent = clean.taxPercent === '' || clean.taxPercent === null ? null : Number(clean.taxPercent);
  }
  return clean;
}

router.get('/items', verifyToken, requireInvoiceAccess, async (req, res) => {
  try {
    const items = await readSheet('Items');
    res.json(items.filter((i) => !i.deletedat));
  } catch (err) {
    console.error('GET /items failed:', err);
    res.status(500).json({ error: 'Could not load items.' });
  }
});

router.post('/items', verifyToken, requireInvoiceAccess, async (req, res) => {
  try {
    const clean = sanitizeItemBody(req.body);
    const item = {
      id: Date.now().toString(),
      createdBy: req.user?.username || 'unknown',
      createdAt: new Date().toISOString(),
      ...clean,
    };
    await appendRow('Items', item);
    res.json({ success: true, id: item.id });
  } catch (err) {
    console.error('POST /items failed:', err);
    res.status(err.message?.includes('required') ? 400 : 500).json({ error: err.message || 'Could not create item.' });
  }
});

router.put('/items/:id', verifyToken, requireInvoiceAccess, async (req, res) => {
  try {
    const clean = sanitizeItemBody(req.body);
    await updateRowById('Items', 0, req.params.id, clean);
    res.json({ success: true });
  } catch (err) {
    console.error('PUT /items/:id failed:', err);
    res.status(err.message?.includes('required') ? 400 : 500).json({ error: err.message || 'Could not update item.' });
  }
});

router.delete('/items/:id', verifyToken, requireInvoiceAccess, async (req, res) => {
  try {
    await updateRowById('Items', 0, req.params.id, {
      deletedat: new Date().toISOString(),
      deletedby: req.user?.username || 'unknown',
    });
    res.json({ success: true });
  } catch (err) {
    console.error('DELETE /items/:id failed:', err);
    res.status(500).json({ error: 'Could not delete item.' });
  }
});

export default router;
