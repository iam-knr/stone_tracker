import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { readSheet, appendRow, updateRowById } from '../services/supabase.js';
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
    const dbUser = findUserByIdentifier(users, identifier);

    // Primary path: DB-backed auth. Covers task owners/assignees, and the
    // Super Admin once its row has been synced (see fallback below) — so
    // password resets, self-service password changes, and admin-managed
    // password/email edits all work consistently for every account,
    // including the Super Admin. Users can sign in with either their
    // username or their email.
    if (dbUser) {
      const match = await bcrypt.compare(password, dbUser.passwordHash);
      if (match) {
        const role = dbUser.role || 'task_assignee';
        const token = jwt.sign({ username: dbUser.username, role, id: dbUser.id }, process.env.JWT_SECRET, { expiresIn: '8h' });
        return res.json({ token, role, username: dbUser.username });
      }
    }

    // Fallback: legacy env-var Super Admin auth (ADMIN_USERNAME /
    // ADMIN_PASSWORD_HASH). Matches by the configured username OR by the
    // email/username of the Users-table row that mirrors the Super Admin
    // account, so the Super Admin can sign in with their email too. On a
    // successful match, syncs (or creates) the Users row with the current
    // password so that every subsequent login, "Change Password", and
    // password-reset flow for the Super Admin goes through the same
    // DB-backed path above.
    const isAdminIdentifier = identifier === process.env.ADMIN_USERNAME || (dbUser && dbUser.username === process.env.ADMIN_USERNAME);
    if (isAdminIdentifier) {
      const envMatch = await bcrypt.compare(password, process.env.ADMIN_PASSWORD_HASH);
      if (!envMatch) return res.status(401).json({ error: 'Invalid credentials' });

      const passwordHash = await bcrypt.hash(password, 10);
      const adminUsername = process.env.ADMIN_USERNAME;
      let adminId = dbUser?.id;
      if (dbUser) {
        await updateRowById('Users', 0, dbUser.id, { passwordHash, role: 'admin' }, HEADERS);
      } else {
        adminId = 'u_admin';
        await appendRow('Users', {
          id: adminId,
          username: adminUsername,
          passwordHash,
          email: null,
          role: 'admin',
          createdAt: new Date().toISOString(),
        }, HEADERS);
      }

      const token = jwt.sign({ username: adminUsername, role: 'admin', id: adminId }, process.env.JWT_SECRET, { expiresIn: '8h' });
      return res.json({ token, role: 'admin', username: adminUsername });
    }

    return res.status(401).json({ error: 'Invalid credentials' });
  } catch (err) {
    console.error('POST /auth/login failed:', err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

// Request a password-reset email. Works for any account that has an email
// on file in the Users table — including the Super Admin, once its row has
// been synced by a successful login (see /login above). Accepts either the
// username or the email as the identifier.
// Always responds with the same generic message so this endpoint can't be
// used to enumerate which usernames/emails exist in the system.
router.post('/forgot-password', async (req, res) => {
  const GENERIC = { message: 'If an account with that username or email exists and has an email on file, a reset link has been sent.' };
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
