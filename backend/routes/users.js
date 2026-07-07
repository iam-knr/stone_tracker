import express from 'express';
import bcrypt from 'bcryptjs';
import { readSheet, appendRow, updateRowById, deleteRowById } from '../services/supabase.js';
import { verifyToken, requireAdmin } from '../middleware/auth.js';

const router = express.Router();
const HEADERS = ['id', 'username', 'passwordHash', 'email', 'role', 'createdAt', 'resetTokenHash', 'resetTokenExpiry'];
const VALID_ROLES = ['admin', 'task_owner', 'task_assignee'];
const MIN_PASSWORD_LENGTH = 8;

function isValidPassword(password) {
  return typeof password === 'string' && password.length >= MIN_PASSWORD_LENGTH;
}

function isValidUsername(username) {
  // Letters, numbers, dots, underscores, hyphens; 3-32 chars. Keeps things
  // predictable for display and avoids stray whitespace/control characters.
  return typeof username === 'string' && /^[a-zA-Z0-9._-]{3,32}$/.test(username);
}

// Any authenticated user: lightweight list for populating assignee/owner dropdowns
// (no password hashes, safe to expose to any logged-in user)
router.get('/list', verifyToken, async (req, res) => {
  try {
    const users = await readSheet('Users');
    res.json(users.map(({ id, username, role }) => ({ id, username, role })));
  } catch (err) {
    console.error('GET /users/list failed:', err);
    res.status(500).json({ error: 'Could not load users.' });
  }
});

// Admin (Super Admin): list all users
router.get('/', verifyToken, requireAdmin, async (req, res) => {
  try {
    const users = await readSheet('Users');
    res.json(users.map(({ passwordHash, ...rest }) => rest));
  } catch (err) {
    console.error('GET /users failed:', err);
    res.status(500).json({ error: 'Could not load users.' });
  }
});

// Admin (Super Admin): create new user
router.post('/', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { username, password, email, role } = req.body;
    if (!isValidUsername(username)) {
      return res.status(400).json({ error: 'Username must be 3-32 characters (letters, numbers, ., _, -).' });
    }
    if (!isValidPassword(password)) {
      return res.status(400).json({ error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` });
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'That does not look like a valid email address.' });
    }
    if (role && !VALID_ROLES.includes(role)) {
      return res.status(400).json({ error: `Role must be one of: ${VALID_ROLES.join(', ')}` });
    }
    const existing = await readSheet('Users');
    if (existing.some((u) => u.username === username)) {
      return res.status(409).json({ error: 'That username is already taken' });
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const newUser = {
      id: Date.now().toString(),
      username,
      passwordHash,
      email: email || null,
      role: role || 'task_assignee',
      createdAt: new Date().toISOString(),
    };
    await appendRow('Users', newUser, HEADERS);
    res.json({ success: true, id: newUser.id });
  } catch (err) {
    console.error('POST /users failed:', err);
    res.status(500).json({ error: 'Could not create user.' });
  }
});

// Admin (Super Admin): change a user's role
router.put('/:id/role', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { role } = req.body;
    if (!VALID_ROLES.includes(role)) {
      return res.status(400).json({ error: `Role must be one of: ${VALID_ROLES.join(', ')}` });
    }
    await updateRowById('Users', 0, req.params.id, { role }, HEADERS);
    res.json({ success: true });
  } catch (err) {
    console.error('PUT /users/:id/role failed:', err);
    res.status(500).json({ error: 'Could not update role.' });
  }
});

// Admin (Super Admin): reset/change a user's password
router.put('/:id/password', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { password } = req.body;
    if (!isValidPassword(password)) {
      return res.status(400).json({ error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` });
    }
    const passwordHash = await bcrypt.hash(password, 10);
    await updateRowById('Users', 0, req.params.id, { passwordHash }, HEADERS);
    res.json({ success: true });
  } catch (err) {
    console.error('PUT /users/:id/password failed:', err);
    res.status(500).json({ error: 'Could not reset password.' });
  }
});

// Admin (Super Admin): delete a user
router.delete('/:id', verifyToken, requireAdmin, async (req, res) => {
  try {
    await deleteRowById('Users', 0, req.params.id);
    res.json({ success: true });
  } catch (err) {
    console.error('DELETE /users/:id failed:', err);
    res.status(500).json({ error: 'Could not delete user.' });
  }
});

export default router;
