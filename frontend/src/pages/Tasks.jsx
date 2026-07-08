import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api.js';
import DashboardShell from '../components/DashboardShell.jsx';
import PriorityBadge from '../components/PriorityBadge.jsx';
import Preloader from '../components/Preloader.jsx';

const STATUS_COLORS = {
  'To Do': 'bg-gray-100 text-gray-600',
  'In Progress': 'bg-indigo-100 text-indigo-700',
  'Review': 'bg-yellow-100 text-yellow-700',
  'Done': 'bg-green-100 text-google-green',
};

export default function Tasks() {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState([]);
  const [projects, setProjects] = useState([]);
  const [statusFilter, setStatusFilter] = useState('All');
  const [loading, setLoading] = useState(true);

  async function load() {
    const [{ data: t }, { data: p }] = await Promise.all([api.get('/tasks'), api.get('/projects')]);
    setTasks(t);
    setProjects(p);
  }
  useEffect(() => { setLoading(true); load().finally(() => setLoading(false)); }, []);

  const projectByName = Object.fromEntries(projects.map((p) => [p.id, p.name]));
  const visible = statusFilter === 'All' ? tasks : tasks.filter((t) => t.status === statusFilter);

  return (
    <DashboardShell title="Tasks" subtitle="Every task you have access to, across all projects.">
      {loading ? (
        <Preloader label="Loading tasks…" />
      ) : (
        <div className="bg-white rounded-2xl shadow-card overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100 overflow-x-auto">
            {['All', 'To Do', 'In Progress', 'Review', 'Done'].map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`text-xs font-medium px-3 py-1.5 rounded-full whitespace-nowrap transition-colors ${
                  statusFilter === s ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-gray-400 border-b border-gray-100">
                  <th className="px-5 py-3 font-medium">Task</th>
                  <th className="px-5 py-3 font-medium">Project</th>
                  <th className="px-5 py-3 font-medium">Assignee</th>
                  <th className="px-5 py-3 font-medium">Owner</th>
                  <th className="px-5 py-3 font-medium">Priority</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Due</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 animate-stagger">
                {visible.map((t) => (
                  <tr
                    key={t.id}
                    onClick={() => navigate(`/project/${t.projectId}`)}
                    className="cursor-pointer hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-5 py-3 font-medium text-gray-800">{t.taskName}</td>
                    <td className="px-5 py-3 text-gray-500">{projectByName[t.projectId] || '—'}</td>
                    <td className="px-5 py-3 text-gray-500">{t.assignee}</td>
                    <td className="px-5 py-3 text-gray-500">{t.taskOwner}</td>
                    <td className="px-5 py-3"><PriorityBadge priority={t.priority} /></td>
                    <td className="px-5 py-3">
                      <span className={`text-xs font-medium px-2 py-1 rounded-full ${STATUS_COLORS[t.status] || 'bg-gray-100'}`}>{t.status}</span>
                    </td>
                    <td className="px-5 py-3 text-gray-500">{t.dueDate || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {visible.length === 0 && <p className="text-gray-400 text-sm text-center py-10">No tasks to show.</p>}
          </div>
        </div>
      )}
    </DashboardShell>
  );
}
