import express from 'express';
import { readSheet } from '../services/supabase.js';
import { verifyToken, requireInvoiceAccess } from '../middleware/auth.js';
import { computeInvoiceTotals } from '../services/invoicePdf.js';

const router = express.Router();

function daysBetween(a, b) {
  return Math.floor((a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24));
}

// Everything here is computed on the fly from the live `invoices` rows —
// no separate reports table, so numbers can never drift from the actual
// invoice data (same pattern as the Contacts statement endpoint).
router.get('/reports/summary', verifyToken, requireInvoiceAccess, async (req, res) => {
  try {
    const invoices = (await readSheet('Invoices')).filter((inv) => !inv.deletedat);
    const today = new Date();

    let totalBilled = 0;
    let totalPaid = 0;
    const aging = { current: 0, '1-30': 0, '31-60': 0, '61-90': 0, '90+': 0 };
    const byClient = {};
    const byMonth = {};

    for (const inv of invoices) {
      const { total } = computeInvoiceTotals(inv);
      totalBilled += total;
      if (inv.status === 'Paid') {
        totalPaid += total;
      } else {
        // Outstanding — bucket by how overdue it is (or "current" if not
        // yet due / no due date set).
        const due = inv.dueDate ? new Date(inv.dueDate) : null;
        const overdueDays = due ? daysBetween(today, due) : -1;
        if (overdueDays <= 0) aging.current += total;
        else if (overdueDays <= 30) aging['1-30'] += total;
        else if (overdueDays <= 60) aging['31-60'] += total;
        else if (overdueDays <= 90) aging['61-90'] += total;
        else aging['90+'] += total;
      }

      const clientKey = inv.clientName || 'Unknown';
      byClient[clientKey] = (byClient[clientKey] || 0) + total;

      const monthKey = (inv.issueDate || inv.createdAt || '').slice(0, 7); // YYYY-MM
      if (monthKey) byMonth[monthKey] = (byMonth[monthKey] || 0) + total;
    }

    const revenueByClient = Object.entries(byClient)
      .map(([clientName, total]) => ({ clientName, total: Math.round(total * 100) / 100 }))
      .sort((a, b) => b.total - a.total);
    const revenueByMonth = Object.entries(byMonth)
      .map(([month, total]) => ({ month, total: Math.round(total * 100) / 100 }))
      .sort((a, b) => a.month.localeCompare(b.month));

    res.json({
      totalBilled: Math.round(totalBilled * 100) / 100,
      totalPaid: Math.round(totalPaid * 100) / 100,
      totalOutstanding: Math.round((totalBilled - totalPaid) * 100) / 100,
      aging,
      revenueByClient,
      revenueByMonth,
      invoiceCount: invoices.length,
    });
  } catch (err) {
    console.error('GET /reports/summary failed:', err);
    res.status(500).json({ error: 'Could not load report summary.' });
  }
});

function csvEscape(value) {
  const s = String(value ?? '');
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

// Invoice register export — invoice #, dates, client, GSTIN, taxable
// value, tax amount, total, status. This is the flat list a bookkeeper or
// CA typically wants when preparing GST returns (GSTR-1 outward supplies,
// or just reconciling payments received for the period).
router.get('/reports/invoice-register.csv', verifyToken, requireInvoiceAccess, async (req, res) => {
  try {
    const invoices = (await readSheet('Invoices'))
      .filter((inv) => !inv.deletedat)
      .sort((a, b) => Number(a.id) - Number(b.id));

    const header = [
      'Invoice #', 'Issue Date', 'Due Date', 'Client Name', 'Client GSTIN',
      'Taxable Value', 'Tax %', 'Tax Amount', 'Total', 'Status', 'Sent At',
    ];
    const rows = invoices.map((inv) => {
      const { subtotal, discountAmount, taxAmount, total } = computeInvoiceTotals(inv);
      const taxableValue = subtotal - discountAmount;
      return [
        inv.invoiceNumber || '',
        inv.issueDate || '',
        inv.dueDate || '',
        inv.clientName || '',
        inv.clientGstin || '',
        taxableValue.toFixed(2),
        inv.taxPercent || 0,
        taxAmount.toFixed(2),
        total.toFixed(2),
        inv.status || 'Draft',
        inv.sentAt || '',
      ];
    });

    const csv = [header, ...rows].map((r) => r.map(csvEscape).join(',')).join('\r\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="invoice-register.csv"');
    res.send(csv);
  } catch (err) {
    console.error('GET /reports/invoice-register.csv failed:', err);
    res.status(500).json({ error: 'Could not generate invoice register export.' });
  }
});

export default router;
