import express from 'express';
import { readSheet, appendRow, updateRowById } from '../services/supabase.js';
import { verifyToken } from '../middleware/auth.js';
import { sendTaskCreatedEmail, sendTaskStatusChangedEmail } from '../services/mailer.js';

const router = express.Router();

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

async function getTaskOwnerEmails() {
  const users = await readSheet('Users');
  return users.filter((u) => u.role === 'task_owner' && u.email).map((u) => u.email);
}

async function getEmailForUsername(username) {
  if (!username) return null;
  const users = await readSheet('Users');
  const u = users.find((x) => x.username === username);
  return u?.email || null;
}

router.get('/projects', verifyToken, async (req, res) => {
  try {
    const projects = await readSheet('Projects');
    // Task assignees only ever see projects that contain a task assigned to them.
    if (req.user?.role === 'task_assignee') {
      const tasks = await readSheet('Tasks');
      const myProjectIds = new Set(
        tasks.filter((t) => t.assignee === req.user.username).map((t) => t.projectId)
      );
      return res.json(projects.filter((p) => myProjectIds.has(p.id)));
    }
    res.json(projects);
  } catch (err) {
    console.error('GET /projects failed:', err);
    res.status(500).json({ error: 'Could not load projects.' });
  }
});

// Only Task Owners and the Super Admin can create new projects.
router.post('/projects', verifyToken, async (req, res) => {
  try {
    if (req.user?.role !== 'admin' && req.user?.role !== 'task_owner') {
      return res.status(403).json({ error: 'Only task owners and the super admin can create projects.' });
    }
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
    await appendRow('Projects', project);
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
    let scoped = projectId ? tasks.filter((t) => t.projectId === projectId) : tasks;
    // Task assignees only see their own tasks.
    if (req.user?.role === 'task_assignee') {
      scoped = scoped.filter((t) => t.assignee === req.user.username);
    }
    res.json(scoped);
  } catch (err) {
    console.error('GET /tasks failed:', err);
    res.status(500).json({ error: 'Could not load tasks.' });
  }
});

// Tasks can be created by any authenticated user (Task Owners and Task Assignees,
// as well as the Super Admin), per the project's role hierarchy. Projects cannot
// be created by task assignees (enforced above on POST /projects).
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
    await appendRow('Tasks', task);
    res.json({ success: true, id: task.id });

    // Fire-and-forget notification: every task owner + the assigned assignee.
    (async () => {
      try {
        const [ownerEmails, assigneeEmail, projects] = await Promise.all([
          getTaskOwnerEmails(),
          getEmailForUsername(task.assignee),
          readSheet('Projects'),
        ]);
        const project = projects.find((p) => p.id === task.projectId);
        await sendTaskCreatedEmail([...ownerEmails, assigneeEmail], task, project?.name);
      } catch (e) {
        console.error('Task-created email failed:', e.message);
      }
    })();
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

    const tasksBefore = await readSheet('Tasks');
    const before = tasksBefore.find((t) => t.id === req.params.id);

    const updates = sanitizeDates(req.body, ['startDate', 'dueDate']);
    await updateRowById('Tasks', 0, req.params.id, updates);
    res.json({ success: true });

    // Fire-and-forget: notify owner + assignee when status changes.
    if (before && updates.status && updates.status !== before.status) {
      (async () => {
        try {
          const [ownerEmail, assigneeEmail, projects] = await Promise.all([
            getEmailForUsername(before.taskOwner),
            getEmailForUsername(before.assignee),
            readSheet('Projects'),
          ]);
          const project = projects.find((p) => p.id === before.projectId);
          await sendTaskStatusChangedEmail([ownerEmail, assigneeEmail], before, project?.name, before.status, updates.status);
        } catch (e) {
          console.error('Task-status email failed:', e.message);
        }
      })();
    }
  } catch (err) {
    console.error('PUT /tasks/:id failed:', err);
    res.status(500).json({ error: 'Could not update task.' });
  }
});

export default router;
