import express from 'express';
import { readSheet, appendRow, updateRowById, deleteRowById } from '../services/supabase.js';
import { verifyToken, requireAdmin } from '../middleware/auth.js';
import { sendItemDeletedEmail } from '../services/mailer.js';

const router = express.Router();
const TASK_HEADERS = ['id','projectId','taskName','description','assignee','taskOwner','priority','status','startDate','dueDate','notes','checklist'];
const PROJECT_HEADERS = ['id','name','client','startDate','deadline','status','archived','sortorder','description'];

const VALID_PRIORITIES = ['High', 'Medium', 'Low'];
const VALID_TASK_STATUSES = ['To Do', 'In Progress', 'Review', 'Done'];
const VALID_PROJECT_STATUSES = ['Not Started', 'In Progress', 'On Hold', 'Completed'];
const TRASH_RETENTION_DAYS = 30;

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

// A task's assignee/taskOwner are now lists of usernames (multi-assign).
// Accepts an array, a single legacy string, or nothing, and always returns
// a clean array of non-empty strings so the DB column (text[]) gets a
// consistent shape either way.
function toUserList(value) {
  if (Array.isArray(value)) return [...new Set(value.map((v) => String(v).trim()).filter(Boolean))];
  if (typeof value === 'string' && value.trim()) return [value.trim()];
  return [];
}

// Normalizes assignee/taskOwner on a request body, only touching keys that
// were actually sent (so partial updates, e.g. just changing status, don't
// accidentally wipe these fields).
function normalizePeopleFields(body) {
  const clean = { ...body };
  if (Object.prototype.hasOwnProperty.call(clean, 'assignee')) clean.assignee = toUserList(clean.assignee);
  if (Object.prototype.hasOwnProperty.call(clean, 'taskOwner')) clean.taskOwner = toUserList(clean.taskOwner);
  return clean;
}

function notifyAdminOfDeletion(payload) {
  if (!process.env.ADMIN_NOTIFY_EMAIL) return;
  sendItemDeletedEmail(process.env.ADMIN_NOTIFY_EMAIL, payload).catch((err) => {
    console.error('sendItemDeletedEmail failed:', err);
  });
}

router.get('/projects', verifyToken, async (req, res) => {
  try {
    const projects = await readSheet('Projects');
    res.json(projects.filter((p) => !p.deletedat));
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
    const project = { id: Date.now().toString(), createdat: new Date().toISOString(), ...sanitizeDates(req.body, ['startDate', 'deadline']) };
    await appendRow('Projects', project, PROJECT_HEADERS);
    res.json({ success: true, id: project.id });
  } catch (err) {
    console.error('POST /projects failed:', err);
    res.status(500).json({ error: 'Could not create project.' });
  }
});

// Edit a project's core fields (name, client, description, status, dates).
// Restricted the same way as delete/archive — Super Admin or Task Owner.
router.put('/projects/:id', verifyToken, async (req, res) => {
  try {
    if (req.user?.role !== 'admin' && req.user?.role !== 'task_owner') {
      return res.status(403).json({ error: 'Only a Super Admin or Task Owner can edit projects.' });
    }
    const { id } = req.params;
    const projects = await readSheet('Projects');
    const project = projects.find((p) => p.id === id);
    if (!project || project.deletedat) return res.status(404).json({ error: 'Project not found.' });

    if (req.body.status && !VALID_PROJECT_STATUSES.includes(req.body.status)) {
      return res.status(400).json({ error: `Status must be one of: ${VALID_PROJECT_STATUSES.join(', ')}` });
    }
    const updates = sanitizeDates(req.body, ['startDate', 'deadline']);
    await updateRowById('Projects', 0, id, updates, PROJECT_HEADERS);
    res.json({ success: true });
  } catch (err) {
    console.error('PUT /projects/:id failed:', err);
    res.status(500).json({ error: 'Could not update project.' });
  }
});

// Only the Super Admin and Task Owners can delete a project — task
// assignees have no delete access. Deleting is a SOFT delete: the project
// (and every task that belongs to it) is marked with deletedat/deletedby
// instead of being physically removed, so it can be recovered from
// Admin > Deleted Items within 30 days. The Super Admin also gets an email
// notification whenever anything is deleted.
router.delete('/projects/:id', verifyToken, async (req, res) => {
  try {
    if (req.user?.role !== 'admin' && req.user?.role !== 'task_owner') {
      return res.status(403).json({ error: 'Only a Super Admin or Task Owner can delete projects.' });
    }
    const { id } = req.params;
    const [projects, tasks] = await Promise.all([readSheet('Projects'), readSheet('Tasks')]);
    const project = projects.find((p) => p.id === id);
    if (!project) return res.status(404).json({ error: 'Project not found.' });

    const now = new Date().toISOString();
    const actor = req.user?.username || 'unknown';
    const projectTasks = tasks.filter((t) => t.projectId === id && !t.deletedat);
    await Promise.all(projectTasks.map((t) => updateRowById('Tasks', 0, t.id, { deletedat: now, deletedby: actor }, TASK_HEADERS)));
    await updateRowById('Projects', 0, id, { deletedat: now, deletedby: actor }, PROJECT_HEADERS);

    notifyAdminOfDeletion({ type: 'project', name: project.name, deletedBy: actor });

    res.json({ success: true, tasksDeleted: projectTasks.length });
  } catch (err) {
    console.error('DELETE /projects/:id failed:', err);
    res.status(500).json({ error: 'Could not delete project.' });
  }
});

// Archive/unarchive a project. Restricted the same way as delete — only
// the Super Admin and Task Owners can do it, task assignees cannot.
// Archiving a project doesn't touch its tasks; it just hides the project
// from the default (non-archived) project list.
router.patch('/projects/:id/archive', verifyToken, async (req, res) => {
  try {
    if (req.user?.role !== 'admin' && req.user?.role !== 'task_owner') {
      return res.status(403).json({ error: 'Only a Super Admin or Task Owner can archive projects.' });
    }
    const { id } = req.params;
    const { archived } = req.body;
    if (typeof archived !== 'boolean') {
      return res.status(400).json({ error: '"archived" must be true or false.' });
    }
    const projects = await readSheet('Projects');
    const project = projects.find((p) => p.id === id);
    if (!project) return res.status(404).json({ error: 'Project not found.' });

    await updateRowById('Projects', 0, id, { archived }, PROJECT_HEADERS);
    res.json({ success: true, archived });
  } catch (err) {
    console.error('PATCH /projects/:id/archive failed:', err);
    res.status(500).json({ error: 'Could not update archive status.' });
  }
});

// Persists a manual drag-and-drop reorder of the project cards. Any
// authenticated user who can see the projects list can reorder it (it's a
// shared display preference, not a destructive action) — accepts the full
// list of project ids in their new display order and assigns each one a
// sequential sortorder value.
router.post('/projects/reorder', verifyToken, async (req, res) => {
  try {
    const { orderedIds } = req.body;
    if (!Array.isArray(orderedIds) || orderedIds.some((id) => typeof id !== 'string')) {
      return res.status(400).json({ error: '"orderedIds" must be an array of project ids.' });
    }
    await Promise.all(orderedIds.map((id, index) => updateRowById('Projects', 0, id, { sortorder: index }, PROJECT_HEADERS)));
    res.json({ success: true });
  } catch (err) {
    console.error('POST /projects/reorder failed:', err);
    res.status(500).json({ error: 'Could not save the new order.' });
  }
});

router.get('/tasks', verifyToken, async (req, res) => {
  try {
    const tasks = await readSheet('Tasks');
    const visible = tasks.filter((t) => !t.deletedat);
    const { projectId } = req.query;
    res.json(projectId ? visible.filter(t => t.projectId === projectId) : visible);
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
    const now = new Date().toISOString();
    const task = {
      id: Date.now().toString(),
      createdat: now,
      updatedat: now,
      checklist: [],
      ...normalizePeopleFields(sanitizeDates(req.body, ['startDate', 'dueDate'])),
    };
    await appendRow('Tasks', task, TASK_HEADERS);
    res.json({ success: true, id: task.id });
  } catch (err) {
    console.error('POST /tasks failed:', err);
    res.status(500).json({ error: 'Could not create task.' });
  }
});

// Status/notes/description/checklist/etc. can be updated by any authenticated
// user. Transferring a task's ownership or assignee(s) is restricted to the
// Super Admin, or a Task Owner who is currently one of the task's owners
// (mirrors the delete-task rule: you can only reassign work you actually own).
router.put('/tasks/:id', verifyToken, async (req, res) => {
  try {
    const isTransfer = Object.prototype.hasOwnProperty.call(req.body, 'assignee') ||
                        Object.prototype.hasOwnProperty.call(req.body, 'taskOwner');
    if (isTransfer) {
      const isAdmin = req.user?.role === 'admin';
      let isOwningTaskOwner = false;
      if (!isAdmin && req.user?.role === 'task_owner') {
        const tasks = await readSheet('Tasks');
        const task = tasks.find((t) => t.id === req.params.id);
        const currentOwners = toUserList(task?.taskOwner);
        isOwningTaskOwner = currentOwners.includes(req.user?.username);
      }
      if (!isAdmin && !isOwningTaskOwner) {
        return res.status(403).json({ error: 'Only a Super Admin, or this task\'s Task Owner, can transfer task ownership or assignee(s).' });
      }
    }
    if (req.body.priority && !VALID_PRIORITIES.includes(req.body.priority)) {
      return res.status(400).json({ error: `Priority must be one of: ${VALID_PRIORITIES.join(', ')}` });
    }
    if (req.body.status && !VALID_TASK_STATUSES.includes(req.body.status)) {
      return res.status(400).json({ error: `Status must be one of: ${VALID_TASK_STATUSES.join(', ')}` });
    }
    if (req.body.checklist && !Array.isArray(req.body.checklist)) {
      return res.status(400).json({ error: '"checklist" must be an array.' });
    }
    const updates = { ...normalizePeopleFields(sanitizeDates(req.body, ['startDate', 'dueDate'])), updatedat: new Date().toISOString() };
    await updateRowById('Tasks', 0, req.params.id, updates, TASK_HEADERS);
    res.json({ success: true });
  } catch (err) {
    console.error('PUT /tasks/:id failed:', err);
    res.status(500).json({ error: 'Could not update task.' });
  }
});

// Only the Super Admin can delete any task. A Task Owner can delete a task
// only if they are the taskOwner on that task — this mirrors the existing
// rule that only the owning Task Owner (or the Super Admin) manages a
// task's lifecycle. Task assignees cannot delete tasks. Like project
// deletion, this is a SOFT delete (recoverable for 30 days) with an email
// notification to the Super Admin.
router.delete('/tasks/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const [tasks, projects] = await Promise.all([readSheet('Tasks'), readSheet('Projects')]);
    const task = tasks.find((t) => t.id === id);
    if (!task) return res.status(404).json({ error: 'Task not found.' });

    const isAdmin = req.user?.role === 'admin';
    const isOwningTaskOwner = req.user?.role === 'task_owner' && toUserList(task.taskOwner).includes(req.user?.username);
    if (!isAdmin && !isOwningTaskOwner) {
      return res.status(403).json({ error: 'Only a Super Admin or this task\'s Task Owner can delete it.' });
    }

    const actor = req.user?.username || 'unknown';
    await updateRowById('Tasks', 0, id, { deletedat: new Date().toISOString(), deletedby: actor }, TASK_HEADERS);

    const project = projects.find((p) => p.id === task.projectId);
    notifyAdminOfDeletion({ type: 'task', name: task.taskName, projectName: project?.name, deletedBy: actor });

    res.json({ success: true });
  } catch (err) {
    console.error('DELETE /tasks/:id failed:', err);
    res.status(500).json({ error: 'Could not delete task.' });
  }
});

// Lists everything currently in the trash (soft-deleted, not yet purged).
// Readable by any authenticated user so the Recent Activity feed can show
// "X deleted Y" events scoped to their own tasks — but restoring is
// Super-Admin only (see POST /trash/restore below). Anything past the
// 30-day retention window is opportunistically hard-deleted here.
router.get('/trash', verifyToken, async (req, res) => {
  try {
    const [projects, tasks] = await Promise.all([readSheet('Projects'), readSheet('Tasks')]);
    const cutoff = Date.now() - TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000;

    const expiredProjects = projects.filter((p) => p.deletedat && new Date(p.deletedat).getTime() < cutoff);
    const expiredTasks = tasks.filter((t) => t.deletedat && new Date(t.deletedat).getTime() < cutoff);
    await Promise.all([
      ...expiredProjects.map((p) => deleteRowById('Projects', 0, p.id, PROJECT_HEADERS)),
      ...expiredTasks.map((t) => deleteRowById('Tasks', 0, t.id, TASK_HEADERS)),
    ]);

    const projectByName = Object.fromEntries(projects.map((p) => [p.id, p.name]));
    const items = [
      ...projects.filter((p) => p.deletedat && new Date(p.deletedat).getTime() >= cutoff).map((p) => ({
        type: 'project', id: p.id, name: p.name, projectName: null,
        deletedat: p.deletedat, deletedby: p.deletedby,
      })),
      ...tasks.filter((t) => t.deletedat && new Date(t.deletedat).getTime() >= cutoff).map((t) => ({
        type: 'task', id: t.id, name: t.taskName, projectId: t.projectId, projectName: projectByName[t.projectId] || 'Unknown project',
        assignee: t.assignee, taskOwner: t.taskOwner,
        deletedat: t.deletedat, deletedby: t.deletedby,
      })),
    ].sort((a, b) => new Date(b.deletedat) - new Date(a.deletedat));

    res.json(items);
  } catch (err) {
    console.error('GET /trash failed:', err);
    res.status(500).json({ error: 'Could not load deleted items.' });
  }
});

// Restore a soft-deleted project or task. Super Admin only. Restoring a
// project also restores every task that was cascade-deleted along with it.
// Restoring an individual task also restores its parent project if that
// project is itself still in the trash (so the task isn't left orphaned).
router.post('/trash/restore', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { type, id } = req.body;
    if (type !== 'project' && type !== 'task') {
      return res.status(400).json({ error: '"type" must be "project" or "task".' });
    }
    if (type === 'project') {
      const tasks = await readSheet('Tasks');
      const projectTasks = tasks.filter((t) => t.projectId === id && t.deletedat);
      await Promise.all(projectTasks.map((t) => updateRowById('Tasks', 0, t.id, { deletedat: null, deletedby: null }, TASK_HEADERS)));
      await updateRowById('Projects', 0, id, { deletedat: null, deletedby: null }, PROJECT_HEADERS);
    } else {
      const [tasks, projects] = await Promise.all([readSheet('Tasks'), readSheet('Projects')]);
      const task = tasks.find((t) => t.id === id);
      if (!task) return res.status(404).json({ error: 'Task not found.' });
      const parentProject = projects.find((p) => p.id === task.projectId);
      if (parentProject?.deletedat) {
        await updateRowById('Projects', 0, parentProject.id, { deletedat: null, deletedby: null }, PROJECT_HEADERS);
      }
      await updateRowById('Tasks', 0, id, { deletedat: null, deletedby: null }, TASK_HEADERS);
    }
    res.json({ success: true });
  } catch (err) {
    console.error('POST /trash/restore failed:', err);
    res.status(500).json({ error: 'Could not restore item.' });
  }
});

export default router;
