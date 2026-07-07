import express from 'express';
import { readSheet, appendRow, updateRowById } from '../services/googleSheets.js';
import { verifyToken } from '../middleware/auth.js';

const router = express.Router();
const TASK_HEADERS = ['id','projectId','taskName','description','assignee','taskOwner','priority','status','startDate','dueDate','notes'];
const PROJECT_HEADERS = ['id','name','client','startDate','deadline','status'];

router.get('/projects', verifyToken, async (req, res) => {
  res.json(await readSheet('Projects'));
});

router.post('/projects', verifyToken, async (req, res) => {
  const project = { id: Date.now().toString(), ...req.body };
  await appendRow('Projects', project, PROJECT_HEADERS);
  res.json({ success: true, id: project.id });
});

router.get('/tasks', verifyToken, async (req, res) => {
  const tasks = await readSheet('Tasks');
  const { projectId } = req.query;
  res.json(projectId ? tasks.filter(t => t.projectId === projectId) : tasks);
});

router.post('/tasks', verifyToken, async (req, res) => {
  const task = { id: Date.now().toString(), ...req.body };
  await appendRow('Tasks', task, TASK_HEADERS);
  res.json({ success: true, id: task.id });
});

router.put('/tasks/:id', verifyToken, async (req, res) => {
  await updateRowById('Tasks', 0, req.params.id, req.body, TASK_HEADERS);
  res.json({ success: true });
});

export default router;
