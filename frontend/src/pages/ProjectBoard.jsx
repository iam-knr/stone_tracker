import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api.js';
import DashboardShell from '../components/DashboardShell.jsx';
import PriorityBadge from '../components/PriorityBadge.jsx';
import Preloader from '../components/Preloader.jsx';
import TaskDetailModal from '../components/TaskDetailModal.jsx';
import ProjectDetailModal from '../components/ProjectDetailModal.jsx';
import { ArchiveBoxIcon, TrashIcon, ExpandIcon } from '../components/Icons.jsx';

const COLUMNS = ['To Do', 'In Progress', 'Review', 'Done'];
const COLUMN_ACCENTS = {
  'To Do': 'bg-gray-300',
  'In Progress': 'bg-indigo-600',
  'Review': 'bg-google-yellow',
  'Done': 'bg-google-green',
};
const COLUMN_ACCENT_HEX = {
  'To Do': '#dadce0',
  'In Progress': '#4f46e5',
  'Review': '#fbbc04',
  'Done': '#34a853',
};
const EMPTY_FORM = { taskName: '', description: '', assignee: '', taskOwner: '', priority: 'Medium', status: 'To Do', startDate: '', dueDate: '' };

export default function ProjectBoard() {
  const { id } = useParams();
  const navigate = useNavigate();
  const role = localStorage.getItem('st_role');
  const username = localStorage.getItem('st_username');
  const isAdmin = role === 'admin';
  const isTaskOwner = role === 'task_owner';
  const isTaskAssignee = role === 'task_assignee';
  const canDeleteProject = isAdmin || isTaskOwner;
  const canEditProject = isAdmin || isTaskOwner;
  const [tasks, setTasks] = useState([]);
  const [users, setUsers] = useState([]);
  const [project, setProject] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [showProjectInfo, setShowProjectInfo] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [transferTaskId, setTransferTaskId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [deletingProject, setDeletingProject] = useState(false);
  const [archiving, setArchiving] = useState(false);

  const owners = users.filter((u) => u.role === 'task_owner' || u.role === 'admin');
  // Assignees are strictly task_assignee accounts — admins should never show up
  // as an assignable person in this dropdown (used by the admin-only Transfer flow).
  const assignees = users.filter((u) => u.role === 'task_assignee');
  // When a Task Owner (or admin) creates a task, they can assign it to any
  // task_assignee OR to a task owner (including themselves) — just never to admin.
  // A Task Assignee creating a task can only ever assign it to themselves.
  const assigneeOptions = isTaskAssignee
    ? users.filter((u) => u.username === username)
    : users.filter((u) => u.role === 'task_assignee' || u.role === 'task_owner');

  async function load() {
    const { data } = await api.get(`/tasks?projectId=${id}`);
    setTasks(data);
  }
  async function loadUsers() {
    const { data } = await api.get('/users/list');
    setUsers(data);
  }
  async function loadProject() {
    const { data } = await api.get('/projects');
    setProject(data.find((p) => p.id === id) || null);
  }
  useEffect(() => {
    setLoading(true);
    Promise.all([load(), loadUsers(), loadProject()]).finally(() => setLoading(false));
  }, [id]);

  async function handleAdd(e) {
    e.preventDefault();
    const payload = { ...form, projectId: id, startDate: form.startDate || null, dueDate: form.dueDate || null };
    await api.post('/tasks', payload);
    setShowModal(false);
    setForm(EMPTY_FORM);
    load();
  }

  async function moveTask(taskId, newStatus) {
    await api.put(`/tasks/${taskId}`, { status: newStatus });
    load();
  }

  async function transferTask(taskId, field, value) {
    await api.put(`/tasks/${taskId}`, { [field]: value });
    setTransferTaskId(null);
    load();
  }

  function canDeleteTask(t) {
    return isAdmin || (isTaskOwner && t.taskOwner === username);
  }

  async function deleteTask(taskId, taskName) {
    if (!window.confirm(`Delete task "${taskName}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/tasks/${taskId}`);
      load();
    } catch (err) {
      alert(err?.response?.data?.error || 'Could not delete task.');
    }
  }

  async function deleteProject() {
    if (!window.confirm('Delete this entire project? This will also delete all of its tasks. This cannot be undone.')) return;
    setDeletingProject(true);
    try {
      await api.delete(`/projects/${id}`);
      navigate('/projects');
    } catch (err) {
      alert(err?.response?.data?.error || 'Could not delete project.');
    } finally {
      setDeletingProject(false);
    }
  }

  async function toggleArchive() {
    const willArchive = !project?.archived;
    if (willArchive && !window.confirm('Archive this project? It will be hidden from the active projects list until you unarchive it.')) return;
    setArchiving(true);
    try {
      await api.patch(`/projects/${id}/archive`, { archived: willArchive });
      await loadProject();
    } catch (err) {
      alert(err?.response?.data?.error || 'Could not update archive status.');
    } finally {
      setArchiving(false);
    }
  }

  return (
    <DashboardShell
      title="Project Board"
      fullWidth
      subtitle={
        <div className="flex items-center gap-2">
          <button onClick={() => navigate('/projects')} className="text-indigo-600 link-underline">&larr; Back to projects</button>
          {project?.archived && (
            <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 bg-gray-100 rounded-full px-2 py-0.5">Archived</span>
          )}
          {project && (
            <button
              onClick={() => setShowProjectInfo(true)}
              title="View project details"
              className="w-6 h-6 rounded-full flex items-center justify-center text-gray-300 hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
            >
              <ExpandIcon className="w-[14px] h-[14px]" />
            </button>
          )}
        </div>
      }
      actions={
        <div className="flex items-center gap-2">
          {canDeleteProject && (
            <button
              onClick={toggleArchive}
              disabled={archiving}
              className="flex items-center gap-1.5 text-sm font-medium text-gray-500 border border-gray-200 px-3.5 py-2 rounded-full hover:border-indigo-200 hover:text-indigo-600 hover:bg-indigo-50/50 transition-colors disabled:opacity-60"
            >
              <ArchiveBoxIcon className="w-[15px] h-[15px]" />
              {archiving ? 'Updating…' : project?.archived ? 'Unarchive' : 'Archive'}
            </button>
          )}
          {canDeleteProject && (
            <button
              onClick={deleteProject}
              disabled={deletingProject}
              className="flex items-center gap-1.5 text-sm font-medium text-gray-500 border border-gray-200 px-3.5 py-2 rounded-full hover:border-red-200 hover:text-google-red hover:bg-red-50/50 transition-colors disabled:opacity-60"
            >
              <TrashIcon className="w-[15px] h-[15px]" />
              {deletingProject ? 'Deleting…' : 'Delete'}
            </button>
          )}
          <button onClick={() => { if (isTaskAssignee) setForm((f) => ({ ...f, assignee: username })); setShowModal(true); }} className="bg-indigo-600 text-white text-sm font-medium px-4 py-2.5 rounded-full shadow-card btn-modern flex items-center gap-2">
            <span className="text-lg leading-none">+</span> New Task
          </button>
        </div>
      }
    >
      {loading ? (
        <Preloader label="Loading board…" />
      ) : (
      <div className="flex gap-4 overflow-x-auto animate-fade-in pb-2">
        {COLUMNS.map((col) => (
          <div key={col} className="min-w-[240px] flex-1">
            <div className="flex items-center gap-2 mb-3">
              <span className={`w-2 h-2 rounded-full ${COLUMN_ACCENTS[col]}`} />
              <h3 className="text-sm font-semibold text-gray-600 tracking-wide">{col}</h3>
              <span className="text-xs text-gray-400 bg-gray-100 rounded-full px-2 py-0.5">{tasks.filter(t => t.status === col).length}</span>
            </div>
            <div className="space-y-3 animate-stagger">
              {tasks.filter(t => t.status === col).map((t) => (
                <div
                  key={t.id}
                  onClick={() => setSelectedTask(t)}
                  className="group bg-white rounded-xl shadow-card p-3 hover-lift border-l-4 cursor-pointer"
                  style={{ borderLeftColor: COLUMN_ACCENT_HEX[col] }}
                >
                  <div className="flex justify-between items-start mb-1 gap-2">
                    <p className="font-medium text-sm text-gray-800">{t.taskName}</p>
                    <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                      <PriorityBadge priority={t.priority} />
                      {canDeleteTask(t) && (
                        <button
                          onClick={() => deleteTask(t.id, t.taskName)}
                          title="Delete task"
                          className="w-6 h-6 rounded-full flex items-center justify-center text-gray-300 hover:bg-red-50 hover:text-google-red transition-colors"
                        >
                          <TrashIcon className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                  {t.description && <p className="text-xs text-gray-500 mb-1 line-clamp-2">{t.description.split('\n')[0]}</p>}
                  {Array.isArray(t.checklist) && t.checklist.length > 0 && (
                    <p className="text-xs text-gray-400 mb-1">
                      ☑ {t.checklist.filter((c) => c.done).length}/{t.checklist.length} subtasks
                    </p>
                  )}
                  <p className="text-xs text-gray-500">Assignee: {t.assignee}</p>
                  <p className="text-xs text-gray-500">Owner: {t.taskOwner}</p>
                  {t.startDate && <p className="text-xs text-gray-400">Start: {t.startDate}</p>}
                  <p className="text-xs text-gray-400 mb-2">Due: {t.dueDate || '—'}</p>
                  <div onClick={(e) => e.stopPropagation()}>
                    <select value={t.status} onChange={(e) => moveTask(t.id, e.target.value)}
                      className="w-full text-xs border border-gray-200 rounded-md px-2 py-1 mb-2 transition focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500">
                      {COLUMNS.map(c => <option key={c}>{c}</option>)}
                    </select>
                    {isAdmin && (
                      transferTaskId === t.id ? (
                        <div className="flex flex-col gap-1 mb-2">
                          <select defaultValue={t.taskOwner} onChange={(e) => transferTask(t.id, 'taskOwner', e.target.value)} className="w-full text-xs border border-gray-200 rounded-md px-2 py-1">
                            <option value="">Reassign owner...</option>
                            {owners.map((u) => <option key={u.id} value={u.username}>{u.username}</option>)}
                          </select>
                          <select defaultValue={t.assignee} onChange={(e) => transferTask(t.id, 'assignee', e.target.value)} className="w-full text-xs border border-gray-200 rounded-md px-2 py-1">
                            <option value="">Reassign assignee...</option>
                            {assignees.map((u) => <option key={u.id} value={u.username}>{u.username}</option>)}
                          </select>
                          <button onClick={() => setTransferTaskId(null)} className="text-xs text-gray-400">Done</button>
                        </div>
                      ) : (
                        <button onClick={() => setTransferTaskId(t.id)} className="text-xs text-indigo-600 font-medium link-underline block mb-1">Transfer ownership/assignee</button>
                      )
                    )}
                  </div>
                </div>
              ))}
              {tasks.filter(t => t.status === col).length === 0 && (
                <div className="text-xs text-gray-300 text-center py-6 border border-dashed border-gray-200 rounded-xl">No tasks</div>
              )}
            </div>
          </div>
        ))}
      </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-20 animate-fade-in">
          <form onSubmit={handleAdd} className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-medium mb-4">New Task</h2>

            <label className="block text-xs text-gray-500 mb-1">Task Name</label>
            <input required placeholder="Task name" value={form.taskName}
              onChange={(e) => setForm({ ...form, taskName: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 mb-3 text-sm focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition" />

            <label className="block text-xs text-gray-500 mb-1">Description</label>
            <textarea placeholder="Description" value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 mb-3 text-sm" rows={2} />

            <label className="block text-xs text-gray-500 mb-1">Assignee</label>
            <select required disabled={isTaskAssignee} value={form.assignee} onChange={(e) => setForm({ ...form, assignee: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 mb-3 text-sm disabled:bg-gray-100 disabled:text-gray-500">
              <option value="">Select assignee...</option>
              {assigneeOptions.map((u) => <option key={u.id} value={u.username}>{u.username}</option>)}
            </select>

            <label className="block text-xs text-gray-500 mb-1">Task Owner</label>
            <select required value={form.taskOwner} onChange={(e) => setForm({ ...form, taskOwner: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 mb-3 text-sm">
              <option value="">Select task owner...</option>
              {owners.map((u) => <option key={u.id} value={u.username}>{u.username}</option>)}
            </select>

            <div className="flex gap-3 mb-3">
              <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}
                className="w-1/2 border border-gray-300 rounded-lg px-3 py-2 text-sm">
                {['High', 'Medium', 'Low'].map(p => <option key={p}>{p}</option>)}
              </select>
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}
                className="w-1/2 border border-gray-300 rounded-lg px-3 py-2 text-sm">
                {COLUMNS.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>

            <div className="flex gap-3 mb-3">
              <div className="w-1/2">
                <label className="block text-xs text-gray-500 mb-1">Start Date</label>
                <input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div className="w-1/2">
                <label className="block text-xs text-gray-500 mb-1">Due Date</label>
                <input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
            </div>

            <div className="flex gap-3">
              <button type="button" onClick={() => setShowModal(false)} className="w-1/2 py-2 rounded-full border border-gray-300 text-gray-600 hover-lift">Cancel</button>
              <button className="w-1/2 py-2 rounded-full bg-indigo-600 text-white font-medium btn-modern">Create</button>
            </div>
          </form>
        </div>
      )}

      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
          onSaved={load}
        />
      )}

      {showProjectInfo && project && (
        <ProjectDetailModal
          project={project}
          onClose={() => setShowProjectInfo(false)}
          onSaved={loadProject}
          canEdit={canEditProject}
        />
      )}
    </DashboardShell>
  );
}
