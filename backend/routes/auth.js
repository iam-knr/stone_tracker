import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { readSheet, updateRowById } from '../services/supabase.js';
import { sendPasswordResetEmail } from '../services/mailer.js';

const router = express.Router();
const HEADERS = ['id', 'username', 'passwordHash', 'email', 'role', 'createdAt', 'resetTokenHash', 'resetTokenExpiry'];
const MIN_PASSWORD_LENGTH = 8;
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

// Looks up a user by exact username match OR case-insensitive email match,
// so people can sign in with whichever they remember.
function findUserByIdentifier(users, identifier) {
  const id = identifier.trim();
  const idLower = id.toLowerCase();
  return users.find((u) => u.username === id || (u.email && u.email.toLowerCase() === idLower));
}

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username/email and password are required' });
    }

    const identifier = String(username).trim();
    const users = await readSheet('Users');
    const user = findUserByIdentifier(users, identifier);

    // Super Admin: matched either by the configured env username directly,
    // or by looking up their email/username in the Users table row that
    // mirrors the Super Admin account. Password is still verified against
    // the env-configured hash (the DB row's hash is a non-functional
    // placeholder for display purposes only).
    const isAdminIdentifier = identifier === process.env.ADMIN_USERNAME || (user && user.username === process.env.ADMIN_USERNAME);
    if (isAdminIdentifier) {
      const match = await bcrypt.compare(password, process.env.ADMIN_PASSWORD_HASH);
      if (!match) return res.status(401).json({ error: 'Invalid credentials' });
      const token = jwt.sign({ username: process.env.ADMIN_USERNAME, role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '8h' });
      return res.json({ token, role: 'admin', username: process.env.ADMIN_USERNAME });
    }

    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign({ username: user.username, role: user.role || 'task_assignee', id: user.id }, process.env.JWT_SECRET, { expiresIn: '8h' });
    res.json({ token, role: user.role || 'task_assignee', username: user.username });
  } catch (err) {
    console.error('POST /auth/login failed:', err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

// Request a password-reset email. Only works for regular users created via
// Manage Users (with an email on file) — the Super Admin account is
// env-var based and isn't in the users table, so it's reset manually in
// Vercel's environment variables, as documented in the README.
// Always responds with the same generic message so this endpoint can't be
// used to enumerate which usernames/emails exist in the system.
router.post('/forgot-password', async (req, res) => {
  const GENERIC = { message: 'If an account with that username exists and has an email on file, a reset link has been sent.' };
  try {
    const { username } = req.body;
    if (!username || typeof username !== 'string') return res.json(GENERIC);

    const users = await readSheet('Users');
    const user = findUserByIdentifier(users, username);
    if (!user || !user.email) return res.json(GENERIC);

    const rawToken = crypto.randomBytes(32).toString('hex');
    const resetTokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const resetTokenExpiry = new Date(Date.now() + RESET_TOKEN_TTL_MS).toISOString();
    await updateRowById('Users', 0, user.id, { resetTokenHash, resetTokenExpiry }, HEADERS);

    const baseUrl = process.env.FRONTEND_URL || `${req.protocol}://${req.get('host')}`;
    const resetUrl = `${baseUrl}/reset-password?id=${encodeURIComponent(user.id)}&token=${rawToken}`;
    await sendPasswordResetEmail(user.email, resetUrl);

    res.json(GENERIC);
  } catch (err) {
    console.error('POST /auth/forgot-password failed:', err);
    // Still return the generic message — never leak whether something broke
    // for a specific account.
    res.json(GENERIC);
  }
});

router.post('/reset-password', async (req, res) => {
  try {
    const { id, token, newPassword } = req.body;
    if (!id || !token || !newPassword) {
      return res.status(400).json({ error: 'Missing required fields.' });
    }
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      return res.status(400).json({ error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` });
    }

    const users = await readSheet('Users');
    const user = users.find((u) => u.id === id);
    if (!user || !user.resetTokenHash || !user.resetTokenExpiry) {
      return res.status(400).json({ error: 'This reset link is invalid or has expired.' });
    }
    if (new Date(user.resetTokenExpiry).getTime() < Date.now()) {
      return res.status(400).json({ error: 'This reset link has expired. Please request a new one.' });
    }
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    if (tokenHash !== user.resetTokenHash) {
      return res.status(400).json({ error: 'This reset link is invalid or has expired.' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await updateRowById('Users', 0, user.id, { passwordHash, resetTokenHash: null, resetTokenExpiry: null }, HEADERS);
    res.json({ success: true });
  } catch (err) {
    console.error('POST /auth/reset-password failed:', err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

export default router;
