import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api.js';
import TopBar from '../components/TopBar.jsx';
import PriorityBadge from '../components/PriorityBadge.jsx';

const COLUMNS = ['To Do', 'In Progress', 'Review', 'Done'];

export default function ProjectBoard() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ taskName:'', assignee:'', taskOwner:'', priority:'Medium', status:'To Do', dueDate:'' });

  async function load() {
    const { data } = await api.get(`/tasks?projectId=${id}`);
    setTasks(data);
  }
  useEffect(() => { load(); }, [id]);

  async function handleAdd(e) {
    e.preventDefault();
    await api.post('/tasks', { ...form, projectId: id });
    setShowModal(false);
    setForm({ taskName:'', assignee:'', taskOwner:'', priority:'Medium', status:'To Do', dueDate:'' });
    load();
  }

  async function moveTask(taskId, newStatus) {
    await api.put(`/tasks/${taskId}`, { status: newStatus });
    load();
  }

  return (
    <div className="min-h-screen bg-google-grey pb-8">
      <TopBar title="Project Board" onAdd={() => setShowModal(true)} addLabel="+ New Task" />
      <button onClick={() => navigate('/')} className="text-sm text-google-blue px-4 pt-3 inline-block">&larr; Back to projects</button>

      <div className="p-4 flex gap-4 overflow-x-auto">
        {COLUMNS.map((col) => (
          <div key={col} className="min-w-[260px] flex-1">
            <h3 className="text-sm font-medium text-gray-600 mb-2">{col} ({tasks.filter(t=>t.status===col).length})</h3>
            <div className="space-y-3">
              {tasks.filter(t => t.status === col).map((t) => (
                <div key={t.id} className="bg-white rounded-xl shadow-card p-3">
                  <div className="flex justify-between items-start mb-1">
                    <p className="font-medium text-sm text-gray-800">{t.taskName}</p>
                    <PriorityBadge priority={t.priority} />
                  </div>
                  <p className="text-xs text-gray-500">Assignee: {t.assignee}</p>
                  <p className="text-xs text-gray-500">Owner: {t.taskOwner}</p>
                  <p className="text-xs text-gray-400 mb-2">Due: {t.dueDate}</p>
                  <select value={t.status} onChange={(e) => moveTask(t.id, e.target.value)}
                    className="w-full text-xs border border-gray-200 rounded-md px-2 py-1">
                    {COLUMNS.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-20">
          <form onSubmit={handleAdd} className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md p-6">
            <h2 className="text-lg font-medium mb-4">New Task</h2>
            {['taskName','assignee','taskOwner'].map((f) => (
              <input key={f} required placeholder={f} value={form[f]}
                onChange={(e) => setForm({ ...form, [f]: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 mb-3 text-sm" />
            ))}
            <div className="flex gap-3 mb-3">
              <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}
                className="w-1/2 border border-gray-300 rounded-lg px-3 py-2 text-sm">
                {['High','Medium','Low'].map(p => <option key={p}>{p}</option>)}
              </select>
              <input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                className="w-1/2 border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={() => setShowModal(false)} className="w-1/2 py-2 rounded-full border border-gray-300 text-gray-600">Cancel</button>
              <button className="w-1/2 py-2 rounded-full bg-google-blue text-white font-medium">Create</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
