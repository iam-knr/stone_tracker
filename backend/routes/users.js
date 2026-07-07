import express from 'express';
import bcrypt from 'bcryptjs';
import { readSheet, appendRow, updateRowById, deleteRowById } from '../services/supabase.js';
import { verifyToken, requireAdmin } from '../middleware/auth.js';

const router = express.Router();
const HEADERS = ['id', 'username', 'passwordHash', 'role', 'createdAt'];
const VALID_ROLES = ['admin', 'task_owner', 'task_assignee'];

// Any authenticated user: lightweight list for populating assignee/owner dropdowns
// (no password hashes, safe to expose to any logged-in user)
router.get('/list', verifyToken, async (req, res) => {
  const users = await readSheet('Users');
  res.json(users.map(({ id, username, role }) => ({ id, username, role })));
});

// Admin (Super Admin): list all users
router.get('/', verifyToken, requireAdmin, async (req, res) => {
  const users = await readSheet('Users');
  res.json(users.map(({ passwordHash, ...rest }) => rest));
});

// Admin (Super Admin): create new user
router.post('/', verifyToken, requireAdmin, async (req, res) => {
  const { username, password, role } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }
  if (role && !VALID_ROLES.includes(role)) {
    return res.status(400).json({ error: `Role must be one of: ${VALID_ROLES.join(', ')}` });
  }
  const passwordHash = await bcrypt.hash(password, 10);
  const newUser = {
    id: Date.now().toString(),
    username,
    passwordHash,
    role: role || 'task_assignee',
    createdAt: new Date().toISOString(),
  };
  await appendRow('Users', newUser, HEADERS);
  res.json({ success: true, id: newUser.id });
});

// Admin (Super Admin): change a user's role
router.put('/:id/role', verifyToken, requireAdmin, async (req, res) => {
  const { role } = req.body;
  if (!VALID_ROLES.includes(role)) {
    return res.status(400).json({ error: `Role must be one of: ${VALID_ROLES.join(', ')}` });
  }
  await updateRowById('Users', 0, req.params.id, { role }, HEADERS);
  res.json({ success: true });
});

// Admin (Super Admin): reset/change a user's password
router.put('/:id/password', verifyToken, requireAdmin, async (req, res) => {
  const { password } = req.body;
  const passwordHash = await bcrypt.hash(password, 10);
  await updateRowById('Users', 0, req.params.id, { passwordHash }, HEADERS);
  res.json({ success: true });
});

// Admin (Super Admin): delete a user
router.delete('/:id', verifyToken, requireAdmin, async (req, res) => {
  await deleteRowById('Users', 0, req.params.id);
  res.json({ success: true });
});

export default router;
