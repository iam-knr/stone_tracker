import express from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { readSheet, appendRow, updateRowById } from '../services/supabase.js';
import { verifyToken, requirePortalClient } from '../middleware/auth.js';
import { sendPortalMagicLinkEmail } from '../services/mailer.js';
import { renderInvoicePdf } from '../services/invoicePdf.js';
import { renderQuotePdf } from '../services/quotePdf.js';

const router = express.Router();

const LINK_TTL_MS = 15 * 60 * 1000; // 15 minutes
const SESSION_TTL = '7d';

async function getSettings() {
  const rows = await readSheet('InvoiceSettings');
  return rows.find((r) => r.id === 'default') || {};
}

// --- Public: request + verify a magic link (no auth) ---

// Always responds with the same generic message regardless of whether the
// email matches a portal-enabled contact, and regardless of whether the
// send itself succeeds — mirrors the anti-enumeration pattern used by the
// internal /auth/forgot-password flow, just applied to contacts instead of
// Users.
router.post('/portal/request-link', async (req, res) => {
  const GENERIC = { message: 'If that email has portal access, a sign-in link has been sent.' };
  try {
    const { email } = req.body;
    if (!email || typeof email !== 'string') return res.json(GENERIC);

    const contacts = await readSheet('Contacts');
    const emailLower = email.trim().toLowerCase();
    const contact = contacts.find((c) => c.portalEnabled === true && c.email && c.email.toLowerCase() === emailLower);
    if (!contact) return res.json(GENERIC);

    const token = crypto.randomBytes(32).toString('hex');
    const link = {
      id: Date.now().toString(),
      contactId: contact.id,
      token,
      expiresAt: new Date(Date.now() + LINK_TTL_MS).toISOString(),
      usedAt: null,
      createdAt: new Date().toISOString(),
    };
    await appendRow('PortalMagicLinks', link);

    const settings = await getSettings();
    const baseUrl = process.env.FRONTEND_URL || `${req.protocol}://${req.get('host')}`;
    const signInLink = `${baseUrl}/portal/verify?token=${token}`;
    await sendPortalMagicLinkEmail(contact.email, { contactName: contact.name, link: signInLink, companyName: settings.companyName });

    res.json(GENERIC);
  } catch (err) {
    console.error('POST /portal/request-link failed:', err);
    // Same reasoning as forgot-password: never leak whether something broke
    // for a specific address.
    res.json(GENERIC);
  }
});

router.post('/portal/verify', async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: 'Missing token.' });

    const links = await readSheet('PortalMagicLinks');
    const link = links.find((l) => l.token === token);
    if (!link) return res.status(400).json({ error: 'This sign-in link is invalid or has already been used.' });
    if (link.usedAt) return res.status(400).json({ error: 'This sign-in link has already been used. Request a new one.' });
    if (new Date(link.expiresAt).getTime() < Date.now()) {
      return res.status(400).json({ error: 'This sign-in link has expired. Request a new one.' });
    }

    const contacts = await readSheet('Contacts');
    const contact = contacts.find((c) => c.id === link.contactId);
    if (!contact || contact.portalEnabled !== true) {
      return res.status(403).json({ error: 'Portal access is no longer available for this account.' });
    }

    await updateRowById('PortalMagicLinks', 0, link.id, { usedAt: new Date().toISOString() });

    const sessionToken = jwt.sign(
      { contactId: contact.id, role: 'portal_client', canComment: contact.commentsEnabled === true },
      process.env.JWT_SECRET,
      { expiresIn: SESSION_TTL }
    );
    res.json({ token: sessionToken, contact: { name: contact.name, email: contact.email, canComment: contact.commentsEnabled === true } });
  } catch (err) {
    console.error('POST /portal/verify failed:', err);
    res.status(500).json({ error: 'Could not verify sign-in link.' });
  }
});

// --- Protected: everything below requires a portal_client session ---

router.get('/portal/me', verifyToken, requirePortalClient, async (req, res) => {
  try {
    const contacts = await readSheet('Contacts');
    const contact = contacts.find((c) => c.id === req.user.contactId);
    if (!contact) return res.status(404).json({ error: 'Account not found.' });
    res.json({ name: contact.name, email: contact.email, canComment: contact.commentsEnabled === true });
  } catch (err) {
    console.error('GET /portal/me failed:', err);
    res.status(500).json({ error: 'Could not load account.' });
  }
});

router.get('/portal/projects', verifyToken, requirePortalClient, async (req, res) => {
  try {
    const projects = await readSheet('Projects');
    const mine = projects.filter((p) => p.clientContactId === req.user.contactId && !p.deletedat);
    res.json(mine);
  } catch (err) {
    console.error('GET /portal/projects failed:', err);
    res.status(500).json({ error: 'Could not load projects.' });
  }
});

async function loadOwnedProject(req) {
  const projects = await readSheet('Projects');
  const project = projects.find((p) => p.id === req.params.id && !p.deletedat);
  if (!project || project.clientContactId !== req.user.contactId) return null;
  return project;
}

router.get('/portal/projects/:id', verifyToken, requirePortalClient, async (req, res) => {
  try {
    const project = await loadOwnedProject(req);
    if (!project) return res.status(404).json({ error: 'Project not found.' });
    const tasks = await readSheet('Tasks');
    const projectTasks = tasks.filter((t) => t.projectId === project.id && !t.deletedat);
    res.json({ project, tasks: projectTasks });
  } catch (err) {
    console.error('GET /portal/projects/:id failed:', err);
    res.status(500).json({ error: 'Could not load project.' });
  }
});

// Confirms a task belongs to one of this contact's projects before any
// task-level read/write (comments) is allowed.
async function loadOwnedTask(req) {
  const tasks = await readSheet('Tasks');
  const task = tasks.find((t) => t.id === req.params.id && !t.deletedat);
  if (!task) return null;
  const projects = await readSheet('Projects');
  const project = projects.find((p) => p.id === task.projectId && !p.deletedat);
  if (!project || project.clientContactId !== req.user.contactId) return null;
  return task;
}

router.get('/portal/tasks/:id/comments', verifyToken, requirePortalClient, async (req, res) => {
  try {
    const task = await loadOwnedTask(req);
    if (!task) return res.status(404).json({ error: 'Task not found.' });
    const comments = await readSheet('TaskComments');
    const taskComments = comments
      .filter((c) => c.taskId === task.id)
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    res.json(taskComments);
  } catch (err) {
    console.error('GET /portal/tasks/:id/comments failed:', err);
    res.status(500).json({ error: 'Could not load comments.' });
  }
});

router.post('/portal/tasks/:id/comments', verifyToken, requirePortalClient, async (req, res) => {
  try {
    if (!req.user.canComment) {
      return res.status(403).json({ error: 'Commenting is not enabled for your account. Ask your project contact to enable it.' });
    }
    const body = String(req.body?.body || '').trim();
    if (!body) return res.status(400).json({ error: 'Comment cannot be empty.' });

    const task = await loadOwnedTask(req);
    if (!task) return res.status(404).json({ error: 'Task not found.' });

    const contacts = await readSheet('Contacts');
    const contact = contacts.find((c) => c.id === req.user.contactId);

    const comment = {
      id: Date.now().toString(),
      taskId: task.id,
      authorType: 'portal',
      authorName: contact?.name || 'Client',
      contactId: req.user.contactId,
      body,
      createdAt: new Date().toISOString(),
    };
    await appendRow('TaskComments', comment);
    res.json({ success: true, comment });
  } catch (err) {
    console.error('POST /portal/tasks/:id/comments failed:', err);
    res.status(500).json({ error: 'Could not post comment.' });
  }
});

// --- Invoices & Quotes: bifurcated into paid / upcoming / due ---

// Invoices don't have a contactId column (unlike Quotes) - they only store a
// plain clientEmail string. So ownership here is matched by email against
// the logged-in contact's own email address rather than by a foreign key.
async function getOwnContactEmail(req) {
  const contacts = await readSheet('Contacts');
  const contact = contacts.find((c) => c.id === req.user.contactId);
  return contact?.email ? contact.email.toLowerCase() : null;
}

router.get('/portal/invoices', verifyToken, requirePortalClient, async (req, res) => {
  try {
    const myEmail = await getOwnContactEmail(req);
    const invoices = await readSheet('Invoices');
    const mine = myEmail
      ? invoices.filter((inv) => inv.clientEmail && inv.clientEmail.toLowerCase() === myEmail && !inv.deletedat)
      : [];
    const today = new Date().setHours(0, 0, 0, 0);

    const paid = [];
    const due = [];
    const upcoming = [];
    for (const inv of mine) {
      if (inv.status === 'Paid') {
        paid.push(inv);
      } else if (inv.dueDate && new Date(inv.dueDate).setHours(0, 0, 0, 0) < today) {
        due.push(inv);
      } else {
        upcoming.push(inv);
      }
    }
    res.json({ paid, upcoming, due });
  } catch (err) {
    console.error('GET /portal/invoices failed:', err);
    res.status(500).json({ error: 'Could not load invoices.' });
  }
});

router.get('/portal/invoices/:id/pdf', verifyToken, requirePortalClient, async (req, res) => {
  try {
    const myEmail = await getOwnContactEmail(req);
    const invoices = await readSheet('Invoices');
    const invoice = invoices.find(
      (i) => i.id === req.params.id && !i.deletedat && myEmail && i.clientEmail && i.clientEmail.toLowerCase() === myEmail
    );
    if (!invoice) return res.status(404).json({ error: 'Invoice not found.' });
    const settings = await getSettings();
    const pdfBuffer = await renderInvoicePdf(invoice, settings);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${invoice.invoiceNumber || 'invoice'}.pdf"`);
    res.send(pdfBuffer);
  } catch (err) {
    console.error('GET /portal/invoices/:id/pdf failed:', err);
    res.status(500).json({ error: 'Could not generate PDF.' });
  }
});

// Quotes don't have a literal "paid" state, so this bucket is interpreted
// as: paid = Accepted (deal done), due = still open but past its expiry
// date (needs the client's attention), upcoming = still open and not yet
// expired.
router.get('/portal/quotes', verifyToken, requirePortalClient, async (req, res) => {
  try {
    const quotes = await readSheet('Quotes');
    const mine = quotes.filter((q) => q.contactId === req.user.contactId && !q.deletedat);
    const today = new Date().setHours(0, 0, 0, 0);

    const paid = [];
    const due = [];
    const upcoming = [];
    for (const q of mine) {
      if (q.status === 'Accepted') {
        paid.push(q);
      } else if (['Rejected', 'Expired'].includes(q.status)) {
        due.push(q);
      } else if (q.expiryDate && new Date(q.expiryDate).setHours(0, 0, 0, 0) < today) {
        due.push(q);
      } else {
        upcoming.push(q);
      }
    }
    res.json({ paid, upcoming, due });
  } catch (err) {
    console.error('GET /portal/quotes failed:', err);
    res.status(500).json({ error: 'Could not load quotes.' });
  }
});

router.get('/portal/quotes/:id/pdf', verifyToken, requirePortalClient, async (req, res) => {
  try {
    const quotes = await readSheet('Quotes');
    const quote = quotes.find((q) => q.id === req.params.id && !q.deletedat && q.contactId === req.user.contactId);
    if (!quote) return res.status(404).json({ error: 'Quote not found.' });
    const settings = await getSettings();
    const pdfBuffer = await renderQuotePdf(quote, settings);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${quote.quoteNumber || 'quote'}.pdf"`);
    res.send(pdfBuffer);
  } catch (err) {
    console.error('GET /portal/quotes/:id/pdf failed:', err);
    res.status(500).json({ error: 'Could not generate PDF.' });
  }
});

export default router;
