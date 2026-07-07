import express from 'express';
import { readSheet } from '../services/supabase.js';
import { sendDailyDigestEmail, sendMidnightSummaryEmail } from '../services/mailer.js';

const router = express.Router();

// Vercel Cron automatically sends `Authorization: Bearer <CRON_SECRET>` when
// invoking a scheduled job, as long as the CRON_SECRET env var is set on the
// project. This guards these endpoints from being triggered by anyone else,
// since they're otherwise unauthenticated (Vercel Cron doesn't support
// custom headers, only this convention).
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

function daysBetween(dateStr, today) {
  const due = new Date(dateStr);
  const diffMs = due.setHours(0, 0, 0, 0) - today.setHours(0, 0, 0, 0);
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

async function getTaskOwnerEmails() {
  const users = await readSheet('Users');
  return users.filter((u) => u.role === 'task_owner' && u.email).map((u) => u.email);
}

// Twice-daily (8am & 8pm IST) digest to all task owners: overdue tasks and
// tasks due within the next 7 days.
router.get('/digest', verifyCron, async (req, res) => {
  try {
    const [tasks, projects, ownerEmails] = await Promise.all([
      readSheet('Tasks'),
      readSheet('Projects'),
      getTaskOwnerEmails(),
    ]);
    const projectByName = Object.fromEntries(projects.map((p) => [p.id, p.name]));
    const today = new Date();
    const overdueTasks = tasks.filter((t) => t.dueDate && t.status !== 'Done' && daysBetween(t.dueDate, new Date()) < 0);
    const upcomingTasks = tasks.filter((t) => t.dueDate && t.status !== 'Done' && daysBetween(t.dueDate, new Date()) >= 0 && daysBetween(t.dueDate, new Date()) <= 7);

    if (ownerEmails.length > 0) {
      await sendDailyDigestEmail(ownerEmails, { overdueTasks, upcomingTasks, projectByName });
    }
    res.json({ success: true, recipients: ownerEmails.length, overdue: overdueTasks.length, upcoming: upcomingTasks.length });
  } catch (err) {
    console.error('GET /cron/digest failed:', err);
    res.status(500).json({ error: 'Digest failed.' });
  }
});

// Nightly (midnight IST) full summary to all task owners + super admin.
router.get('/midnight-summary', verifyCron, async (req, res) => {
  try {
    const [tasks, projects, ownerEmails] = await Promise.all([
      readSheet('Tasks'),
      readSheet('Projects'),
      getTaskOwnerEmails(),
    ]);
    const recipients = [...ownerEmails];
    if (process.env.ADMIN_NOTIFY_EMAIL) recipients.push(process.env.ADMIN_NOTIFY_EMAIL);

    if (recipients.length > 0) {
      await sendMidnightSummaryEmail(recipients, { projects, tasks });
    }
    res.json({ success: true, recipients: recipients.length });
  } catch (err) {
    console.error('GET /cron/midnight-summary failed:', err);
    res.status(500).json({ error: 'Summary failed.' });
  }
});

export default router;
