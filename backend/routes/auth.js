import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { readSheet } from '../services/supabase.js';

const router = express.Router();

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (username === process.env.ADMIN_USERNAME) {
      const match = await bcrypt.compare(password, process.env.ADMIN_PASSWORD_HASH);
      if (!match) return res.status(401).json({ error: 'Invalid credentials' });
      const token = jwt.sign({ username, role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '8h' });
      return res.json({ token, role: 'admin', username });
    }

    const users = await readSheet('Users');
    const user = users.find((u) => u.username === username);
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign({ username, role: user.role || 'task_assignee', id: user.id }, process.env.JWT_SECRET, { expiresIn: '8h' });
    res.json({ token, role: user.role || 'task_assignee', username });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
