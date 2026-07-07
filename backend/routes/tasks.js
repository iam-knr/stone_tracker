import express from 'express';
import { readSheet, appendRow, updateRowById } from '../services/supabase.js';
import { verifyToken } from '../middleware/auth.js';

const router = express.Router();
const TASK_HEADERS = ['id','projectId','taskName','description','assignee','taskOwner','priority','status','startDate','dueDate','notes'];
const PROJECT_HEADERS = ['id','name','client','startDate','deadline','status'];

// Postgres `date` columns reject empty strings ("" is not a valid date), which
// previously caused an unhandled promise rejection and made the request hang
// until Vercel's timeout. Convert any blank date-like fields to null instead.
function sanitizeDates(body, dateFields) {
  const clean = { ...body };
  for (const field of dateFields) {
    if (clean[field] === '') clean[field] = null;
  }
  return clean;
}

router.get('/projects', verifyToken, async (req, res) => {
  try {
    res.json(await readSheet('Projects'));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/projects', verifyToken, async (req, res) => {
  try {
    const project = { id: Date.now().toString(), ...sanitizeDates(req.body, ['startDate', 'deadline']) };
    await appendRow('Projects', project, PROJECT_HEADERS);
    res.json({ success: true, id: project.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/tasks', verifyToken, async (req, res) => {
  try {
    const tasks = await readSheet('Tasks');
    const { projectId } = req.query;
    res.json(projectId ? tasks.filter(t => t.projectId === projectId) : tasks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Tasks can be created by any authenticated user (Task Owners and Task Assignees,
// as well as the Super Admin), per the project's role hierarchy.
router.post('/tasks', verifyToken, async (req, res) => {
  try {
    const task = { id: Date.now().toString(), ...sanitizeDates(req.body, ['startDate', 'dueDate']) };
    await appendRow('Tasks', task, TASK_HEADERS);
    res.json({ success: true, id: task.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Status/notes/etc. can be updated by any authenticated user, but only the
// Super Admin can transfer a task's ownership or assignee to someone else.
router.put('/tasks/:id', verifyToken, async (req, res) => {
  try {
    const isTransfer = Object.prototype.hasOwnProperty.call(req.body, 'assignee') ||
                        Object.prototype.hasOwnProperty.call(req.body, 'taskOwner');
    if (isTransfer && req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Only a Super Admin can transfer task ownership or assignee' });
    }
    const updates = sanitizeDates(req.body, ['startDate', 'dueDate']);
    await updateRowById('Tasks', 0, req.params.id, updates, TASK_HEADERS);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
