import express from 'express';
import { readSheet } from '../services/supabase.js';
import { verifyToken, requireBusinessHealthAccess } from '../middleware/auth.js';
import { computeInvoiceTotals } from '../services/invoicePdf.js';

const router = express.Router();

function toUserList(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value === 'string' && value.trim()) return [value.trim()];
  return [];
}

function monthKeyOf(dateStr) {
  return (dateStr || '').slice(0, 7); // YYYY-MM
}

// Last N calendar months (including the current one), oldest first, as
// YYYY-MM keys — used so the revenue trend always shows a fixed window
// with zero-filled gaps rather than only the months that happen to have
// invoices.
function lastNMonthKeys(n) {
  const keys = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return keys;
}

// A single combined "Business Health" view pulling from Invoices, Quotes,
// Projects, Tasks, and Contacts — every number here is computed live from
// those existing tables, so nothing can drift out of sync with what the
// Invoices/Quotes/Projects pages already show.
router.get('/business-health/summary', verifyToken, requireBusinessHealthAccess, async (req, res) => {
  try {
    const [invoicesRaw, quotesRaw, projectsRaw, tasksRaw, contactsRaw] = await Promise.all([
      readSheet('Invoices'),
      readSheet('Quotes'),
      readSheet('Projects'),
      readSheet('Tasks'),
      readSheet('Contacts'),
    ]);

    const invoices = invoicesRaw.filter((inv) => !inv.deletedat);
    const quotes = quotesRaw.filter((q) => !q.deletedat);
    const projects = projectsRaw.filter((p) => !p.deletedat);
    const tasks = tasksRaw.filter((t) => !t.deletedat);
    const contacts = contactsRaw;

    const today = new Date();
    const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();

    // --- Revenue & cash flow ---
    let totalBilled = 0;
    let totalPaid = 0;
    let totalOverdue = 0;
    const monthTotals = {};
    const clientTotals = {};
    const clientOverdue = {};

    for (const inv of invoices) {
      const { total } = computeInvoiceTotals(inv);
      totalBilled += total;
      if (inv.status === 'Paid') {
        totalPaid += total;
      } else {
        const due = inv.dueDate ? new Date(inv.dueDate) : null;
        if (due && due.getTime() < todayMidnight) {
          totalOverdue += total;
          const clientKey = inv.clientName || inv.clientEmail || 'Unknown';
          clientOverdue[clientKey] = (clientOverdue[clientKey] || 0) + total;
        }
      }
      const monthKey = monthKeyOf(inv.issueDate || inv.createdAt);
      if (monthKey) monthTotals[monthKey] = (monthTotals[monthKey] || 0) + total;
      const clientKey = inv.clientName || inv.clientEmail || 'Unknown';
      clientTotals[clientKey] = (clientTotals[clientKey] || 0) + total;
    }

    const revenueByMonth = lastNMonthKeys(6).map((month) => ({
      month,
      total: Math.round((monthTotals[month] || 0) * 100) / 100,
    }));

    const revenueByClient = Object.entries(clientTotals)
      .map(([clientName, total]) => ({ clientName, total: Math.round(total * 100) / 100 }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);

    const clientsWithOverdueInvoices = Object.entries(clientOverdue)
      .map(([clientName, total]) => ({ clientName, total: Math.round(total * 100) / 100 }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);

    const revenue = {
      totalBilled: Math.round(totalBilled * 100) / 100,
      totalPaid: Math.round(totalPaid * 100) / 100,
      totalOutstanding: Math.round((totalBilled - totalPaid) * 100) / 100,
      totalOverdue: Math.round(totalOverdue * 100) / 100,
      revenueByMonth,
      invoiceCount: invoices.length,
    };

    // --- Quote pipeline ---
    const QUOTE_STATUSES = ['Draft', 'Sent', 'Accepted', 'Rejected', 'Expired'];
    const quoteCounts = Object.fromEntries(QUOTE_STATUSES.map((s) => [s, 0]));
    const quoteValues = Object.fromEntries(QUOTE_STATUSES.map((s) => [s, 0]));
    for (const q of quotes) {
      const status = QUOTE_STATUSES.includes(q.status) ? q.status : 'Draft';
      const { total } = computeInvoiceTotals(q);
      quoteCounts[status] += 1;
      quoteValues[status] = Math.round((quoteValues[status] + total) * 100) / 100;
    }
    const decidedCount = quoteCounts.Accepted + quoteCounts.Rejected + quoteCounts.Expired;
    const conversionRate = decidedCount > 0 ? Math.round((quoteCounts.Accepted / decidedCount) * 1000) / 10 : null;

    const quotePipeline = {
      counts: quoteCounts,
      values: quoteValues,
      openPipelineValue: quoteValues.Sent,
      conversionRate, // percentage (0-100) or null if no decided quotes yet
      totalQuotes: quotes.length,
    };

    // --- Project & task delivery health ---
    const PROJECT_STATUSES = ['Not Started', 'In Progress', 'On Hold', 'Completed'];
    const activeProjects = projects.filter((p) => !p.archived);
    const projectStatusCounts = Object.fromEntries(PROJECT_STATUSES.map((s) => [s, 0]));
    let overdueProjects = 0;
    for (const p of activeProjects) {
      const status = PROJECT_STATUSES.includes(p.status) ? p.status : 'Not Started';
      projectStatusCounts[status] += 1;
      if (p.deadline && status !== 'Completed') {
        const deadline = new Date(p.deadline);
        if (deadline.getTime() < todayMidnight) overdueProjects += 1;
      }
    }

    const TASK_STATUSES = ['To Do', 'In Progress', 'Review', 'Done'];
    const taskStatusCounts = Object.fromEntries(TASK_STATUSES.map((s) => [s, 0]));
    let overdueTasks = 0;
    const workload = {};
    for (const t of tasks) {
      const status = TASK_STATUSES.includes(t.status) ? t.status : 'To Do';
      taskStatusCounts[status] += 1;
      const isOpen = status !== 'Done';
      if (isOpen && t.dueDate && new Date(t.dueDate).getTime() < todayMidnight) overdueTasks += 1;
      if (isOpen) {
        for (const person of toUserList(t.assignee)) {
          workload[person] = (workload[person] || 0) + 1;
        }
      }
    }
    const topWorkload = Object.entries(workload)
      .map(([username, openTasks]) => ({ username, openTasks }))
      .sort((a, b) => b.openTasks - a.openTasks)
      .slice(0, 5);

    const delivery = {
      projectStatusCounts,
      overdueProjects,
      activeProjectCount: activeProjects.length,
      taskStatusCounts,
      overdueTasks,
      openTaskCount: tasks.filter((t) => t.status !== 'Done').length,
      topWorkload,
    };

    // --- Client health ---
    const portalEnabledCount = contacts.filter((c) => c.portalEnabled === true).length;
    const commentsEnabledCount = contacts.filter((c) => c.commentsEnabled === true).length;

    const clientHealth = {
      revenueByClient,
      clientsWithOverdueInvoices,
      totalContacts: contacts.length,
      portalEnabledCount,
      commentsEnabledCount,
    };

    res.json({ revenue, quotePipeline, delivery, clientHealth });
  } catch (err) {
    console.error('GET /business-health/summary failed:', err);
    res.status(500).json({ error: 'Could not load business health summary.' });
  }
});

export default router;
