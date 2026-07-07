import express from 'express';
import { readSheet, appendRow, updateRowById } from '../services/supabase.js';
import { verifyToken } from '../middleware/auth.js';

const router = express.Router();
const TASK_HEADERS = ['id','projectId','taskName','description','assignee','taskOwner','priority','status','startDate','dueDate','notes'];
const PROJECT_HEADERS = ['id','name','client','startDate','deadline','status'];

const VALID_PRIORITIES = ['High', 'Medium', 'Low'];
const VALID_TASK_STATUSES = ['To Do', 'In Progress', 'Review', 'Done'];
const VALID_PROJECT_STATUSES = ['Not Started', 'In Progress', 'On Hold', 'Completed'];

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
    console.error('GET /projects failed:', err);
    res.status(500).json({ error: 'Could not load projects.' });
  }
});

router.post('/projects', verifyToken, async (req, res) => {
  try {
    const { name, client, status } = req.body;
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'Project name is required.' });
    }
    if (!client || typeof client !== 'string' || !client.trim()) {
      return res.status(400).json({ error: 'Client is required.' });
    }
    if (status && !VALID_PROJECT_STATUSES.includes(status)) {
      return res.status(400).json({ error: `Status must be one of: ${VALID_PROJECT_STATUSES.join(', ')}` });
    }
    const project = { id: Date.now().toString(), ...sanitizeDates(req.body, ['startDate', 'deadline']) };
    await appendRow('Projects', project, PROJECT_HEADERS);
    res.json({ success: true, id: project.id });
  } catch (err) {
    console.error('POST /projects failed:', err);
    res.status(500).json({ error: 'Could not create project.' });
  }
});

router.get('/tasks', verifyToken, async (req, res) => {
  try {
    const tasks = await readSheet('Tasks');
    const { projectId } = req.query;
    res.json(projectId ? tasks.filter(t => t.projectId === projectId) : tasks);
  } catch (err) {
    console.error('GET /tasks failed:', err);
    res.status(500).json({ error: 'Could not load tasks.' });
  }
});

// Tasks can be created by any authenticated user (Task Owners and Task Assignees,
// as well as the Super Admin), per the project's role hierarchy.
router.post('/tasks', verifyToken, async (req, res) => {
  try {
    const { projectId, taskName, priority, status } = req.body;
    if (!projectId) {
      return res.status(400).json({ error: 'projectId is required.' });
    }
    if (!taskName || typeof taskName !== 'string' || !taskName.trim()) {
      return res.status(400).json({ error: 'Task name is required.' });
    }
    if (priority && !VALID_PRIORITIES.includes(priority)) {
      return res.status(400).json({ error: `Priority must be one of: ${VALID_PRIORITIES.join(', ')}` });
    }
    if (status && !VALID_TASK_STATUSES.includes(status)) {
      return res.status(400).json({ error: `Status must be one of: ${VALID_TASK_STATUSES.join(', ')}` });
    }
    const task = { id: Date.now().toString(), ...sanitizeDates(req.body, ['startDate', 'dueDate']) };
    await appendRow('Tasks', task, TASK_HEADERS);
    res.json({ success: true, id: task.id });
  } catch (err) {
    console.error('POST /tasks failed:', err);
    res.status(500).json({ error: 'Could not create task.' });
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
    if (req.body.priority && !VALID_PRIORITIES.includes(req.body.priority)) {
      return res.status(400).json({ error: `Priority must be one of: ${VALID_PRIORITIES.join(', ')}` });
    }
    if (req.body.status && !VALID_TASK_STATUSES.includes(req.body.status)) {
      return res.status(400).json({ error: `Status must be one of: ${VALID_TASK_STATUSES.join(', ')}` });
    }
    const updates = sanitizeDates(req.body, ['startDate', 'dueDate']);
    await updateRowById('Tasks', 0, req.params.id, updates, TASK_HEADERS);
    res.json({ success: true });
  } catch (err) {
    console.error('PUT /tasks/:id failed:', err);
    res.status(500).json({ error: 'Could not update task.' });
  }
});

export default router;
