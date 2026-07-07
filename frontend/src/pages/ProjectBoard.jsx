import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api.js';
import TopBar from '../components/TopBar.jsx';
import PriorityBadge from '../components/PriorityBadge.jsx';
import Preloader from '../components/Preloader.jsx';

const COLUMNS = ['To Do', 'In Progress', 'Review', 'Done'];
const COLUMN_ACCENTS = {
  'To Do': 'bg-gray-300',
  'In Progress': 'bg-google-blue',
  'Review': 'bg-google-yellow',
  'Done': 'bg-google-green',
};
const COLUMN_ACCENT_HEX = {
  'To Do': '#dadce0',
  'In Progress': '#1a73e8',
  'Review': '#fbbc04',
  'Done': '#34a853',
};
const EMPTY_FORM = { taskName: '', description: '', assignee: '', taskOwner: '', priority: 'Medium', status: 'To Do', startDate: '', dueDate: '' };

export default function ProjectBoard() {
  const { id } = useParams();
  const navigate = useNavigate();
  const role = localStorage.getItem('st_role');
  const isAdmin = role === 'admin';
  const [tasks, setTasks] = useState([]);
  const [users, setUsers] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [transferTaskId, setTransferTaskId] = useState(null);
  const [loading, setLoading] = useState(true);

  const owners = users.filter((u) => u.role === 'task_owner' || u.role === 'admin');
  const assignees = users.filter((u) => u.role === 'task_assignee' || u.role === 'admin');

  async function load() {
    const { data } = await api.get(`/tasks?projectId=${id}`);
    setTasks(data);
  }
  async function loadUsers() {
    const { data } = await api.get('/users/list');
    setUsers(data);
  }
  useEffect(() => {
    setLoading(true);
    Promise.all([load(), loadUsers()]).finally(() => setLoading(false));
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

  return (
    <div className="min-h-screen bg-google-grey pb-8">
      <TopBar title="Project Board" onAdd={() => setShowModal(true)} addLabel="+ New Task" />
      <button onClick={() => navigate('/')} className="text-sm text-google-blue px-4 pt-3 inline-block link-underline">&larr; Back to projects</button>

      {loading ? (
        <Preloader label="Loading board…" />
      ) : (
      <div className="p-4 flex gap-4 overflow-x-auto animate-fade-in">
        {COLUMNS.map((col) => (
          <div key={col} className="min-w-[270px] flex-1">
            <div className="flex items-center gap-2 mb-3">
              <span className={`w-2 h-2 rounded-full ${COLUMN_ACCENTS[col]}`} />
              <h3 className="text-sm font-semibold text-gray-600 tracking-wide">{col}</h3>
              <span className="text-xs text-gray-400 bg-gray-100 rounded-full px-2 py-0.5">{tasks.filter(t => t.status === col).length}</span>
            </div>
            <div className="space-y-3 animate-stagger">
              {tasks.filter(t => t.status === col).map((t) => (
                <div key={t.id} className="bg-white rounded-xl shadow-card p-3 hover-lift border-l-4" style={{ borderLeftColor: COLUMN_ACCENT_HEX[col] }}>
                  <div className="flex justify-between items-start mb-1">
                    <p className="font-medium text-sm text-gray-800">{t.taskName}</p>
                    <PriorityBadge priority={t.priority} />
                  </div>
                  {t.description && <p className="text-xs text-gray-500 mb-1">{t.description}</p>}
                  <p className="text-xs text-gray-500">Assignee: {t.assignee}</p>
                  <p className="text-xs text-gray-500">Owner: {t.taskOwner}</p>
                  {t.startDate && <p className="text-xs text-gray-400">Start: {t.startDate}</p>}
                  <p className="text-xs text-gray-400 mb-2">Due: {t.dueDate || '—'}</p>
                  <select value={t.status} onChange={(e) => moveTask(t.id, e.target.value)}
                    className="w-full text-xs border border-gray-200 rounded-md px-2 py-1 mb-2 transition focus:ring-2 focus:ring-google-blue/30 focus:border-google-blue">
                    {COLUMNS.map(c => <option key={c}>{c}</option>)}
                  </select>
                  {isAdmin && (
                    transferTaskId === t.id ? (
                      <div className="flex flex-col gap-1">
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
                      <button onClick={() => setTransferTaskId(t.id)} className="text-xs text-google-blue font-medium link-underline">Transfer ownership/assignee</button>
                    )
                  )}
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
              className="w-full border border-gray-300 rounded-lg px-3 py-2 mb-3 text-sm focus:ring-2 focus:ring-google-blue/30 focus:border-google-blue transition" />

            <label className="block text-xs text-gray-500 mb-1">Description</label>
            <textarea placeholder="Description" value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 mb-3 text-sm" rows={2} />

            <label className="block text-xs text-gray-500 mb-1">Assignee</label>
            <select required value={form.assignee} onChange={(e) => setForm({ ...form, assignee: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 mb-3 text-sm">
              <option value="">Select assignee...</option>
              {assignees.map((u) => <option key={u.id} value={u.username}>{u.username}</option>)}
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
              <button className="w-1/2 py-2 rounded-full bg-google-blue text-white font-medium btn-modern">Create</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
