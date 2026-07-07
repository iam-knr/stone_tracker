import express from 'express';
import bcrypt from 'bcryptjs';
import { readSheet, appendRow, updateRowById } from '../services/supabase.js';
import { verifyToken, requireAdmin } from '../middleware/auth.js';

const router = express.Router();
const HEADERS = ['id', 'username', 'passwordHash', 'role', 'createdAt'];

// Admin: list all users
router.get('/', verifyToken, requireAdmin, async (req, res) => {
  const users = await readSheet('Users');
  res.json(users.map(({ passwordHash, ...rest }) => rest));
});

// Admin: create new user
router.post('/', verifyToken, requireAdmin, async (req, res) => {
  const { username, password, role } = req.body;
  const passwordHash = await bcrypt.hash(password, 10);
  const newUser = {
    id: Date.now().toString(),
    username,
    passwordHash,
    role: role || 'user',
    createdAt: new Date().toISOString(),
  };
  await appendRow('Users', newUser, HEADERS);
  res.json({ success: true, id: newUser.id });
});

// Admin: reset/change a user's password (ONLY admin can call this)
router.put('/:id/password', verifyToken, requireAdmin, async (req, res) => {
  const { password } = req.body;
  const passwordHash = await bcrypt.hash(password, 10);
  await updateRowById('Users', 0, req.params.id, { passwordHash }, HEADERS);
  res.json({ success: true });
});

export default router;
