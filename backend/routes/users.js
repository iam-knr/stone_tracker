import express from 'express';
import bcrypt from 'bcryptjs';
import { readSheet, appendRow, updateRowById, deleteRowById } from '../services/supabase.js';
import { verifyToken, requireAdmin } from '../middleware/auth.js';

const router = express.Router();
const VALID_ROLES = ['admin', 'task_owner', 'task_assignee'];
const MIN_PASSWORD_LENGTH = 8;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidPassword(password) {
  return typeof password === 'string' && password.length >= MIN_PASSWORD_LENGTH;
}

function isValidUsername(username) {
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

// Any authenticated user (including the Super Admin, once its Users-table
// row has been synced by a successful login via /auth/login): change their
// own password.
router.put('/me/password', verifyToken, async (req, res) => {
  try {
    if (!req.user?.id) {
      return res.status(400).json({ error: 'Please log in again before changing your password.' });
    }
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current and new password are required.' });
    }
    if (!isValidPassword(newPassword)) {
      return res.status(400).json({ error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` });
    }
    const users = await readSheet('Users');
    const user = users.find((u) => u.id === req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found.' });
    const match = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!match) return res.status(401).json({ error: 'Current password is incorrect.' });
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await updateRowById('Users', 0, user.id, { passwordHash });
    res.json({ success: true });
  } catch (err) {
    console.error('PUT /users/me/password failed:', err);
    res.status(500).json({ error: 'Could not change password.' });
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
    if (email && !EMAIL_RE.test(email)) {
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
    await appendRow('Users', newUser);
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
    const users = await readSheet('Users');
    const target = users.find((u) => u.id === req.params.id);
    if (target && target.username === process.env.ADMIN_USERNAME && role !== 'admin') {
      return res.status(400).json({ error: 'The Super Admin account must keep the Super Admin role.' });
    }
    await updateRowById('Users', 0, req.params.id, { role });
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
    await updateRowById('Users', 0, req.params.id, { passwordHash });
    res.json({ success: true });
  } catch (err) {
    console.error('PUT /users/:id/password failed:', err);
    res.status(500).json({ error: 'Could not reset password.' });
  }
});

// Admin (Super Admin): change a user's email address
router.put('/:id/email', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { email } = req.body;
    if (email && !EMAIL_RE.test(email)) {
      return res.status(400).json({ error: 'That does not look like a valid email address.' });
    }
    await updateRowById('Users', 0, req.params.id, { email: email || null });
    res.json({ success: true });
  } catch (err) {
    console.error('PUT /users/:id/email failed:', err);
    res.status(500).json({ error: 'Could not update email.' });
  }
});

// Admin (Super Admin): bulk-transfer a user's work to another user.
// Reassigns every task where they're the taskOwner and/or assignee to the
// target user. This is how you offboard/replace a task owner or assignee
// without losing task history.
router.post('/transfer', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { fromUsername, toUsername } = req.body;
    if (!fromUsername || !toUsername) {
      return res.status(400).json({ error: 'fromUsername and toUsername are required.' });
    }
    if (fromUsername === toUsername) {
      return res.status(400).json({ error: 'Source and destination user must be different.' });
    }
    const tasks = await readSheet('Tasks');
    const asOwner = tasks.filter((t) => t.taskOwner === fromUsername);
    const asAssignee = tasks.filter((t) => t.assignee === fromUsername);

    await Promise.all([
      ...asOwner.map((t) => updateRowById('Tasks', 0, t.id, { taskOwner: toUsername })),
      ...asAssignee.map((t) => updateRowById('Tasks', 0, t.id, { assignee: toUsername })),
    ]);

    res.json({ success: true, ownedTasksMoved: asOwner.length, assignedTasksMoved: asAssignee.length });
  } catch (err) {
    console.error('POST /users/transfer failed:', err);
    res.status(500).json({ error: 'Could not transfer tasks.' });
  }
});

// Admin (Super Admin): delete a user
router.delete('/:id', verifyToken, requireAdmin, async (req, res) => {
  try {
    const users = await readSheet('Users');
    const target = users.find((u) => u.id === req.params.id);
    if (target && target.username === process.env.ADMIN_USERNAME) {
      return res.status(400).json({ error: 'The Super Admin account cannot be deleted.' });
    }
    await deleteRowById('Users', 0, req.params.id);
    res.json({ success: true });
  } catch (err) {
    console.error('DELETE /users/:id failed:', err);
    res.status(500).json({ error: 'Could not delete user.' });
  }
});

export default router;
