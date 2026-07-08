import { useEffect, useState } from 'react';
import api from '../api.js';
import DashboardShell from '../components/DashboardShell.jsx';
import ProjectCard from '../components/ProjectCard.jsx';
import Preloader from '../components/Preloader.jsx';

export default function Projects() {
  const role = localStorage.getItem('st_role');
  const canCreateProject = role === 'admin' || role === 'task_owner';
  const canDeleteProject = role === 'admin' || role === 'task_owner';
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', client: '', startDate: '', deadline: '', status: 'Not Started' });

  async function load() {
    const { data } = await api.get('/projects');
    setProjects(data);
  }
  useEffect(() => { setLoading(true); load().finally(() => setLoading(false)); }, []);

  async function handleAdd(e) {
    e.preventDefault();
    const payload = { ...form, startDate: form.startDate || null, deadline: form.deadline || null };
    await api.post('/projects', payload);
    setShowModal(false);
    setForm({ name: '', client: '', startDate: '', deadline: '', status: 'Not Started' });
    load();
  }

  async function handleDelete(id) {
    try {
      await api.delete(`/projects/${id}`);
      load();
    } catch (err) {
      alert(err?.response?.data?.error || 'Could not delete project.');
    }
  }

  return (
    <DashboardShell
      title="Projects"
      subtitle={role === 'task_assignee' ? 'Projects with tasks assigned to you.' : 'Every project you have access to.'}
      actions={
        canCreateProject && (
          <button onClick={() => setShowModal(true)} className="bg-indigo-600 text-white text-sm font-medium px-4 py-2.5 rounded-full shadow-card btn-modern flex items-center gap-2">
            <span className="text-lg leading-none">+</span> New Project
          </button>
        )
      }
    >
      {loading ? (
        <Preloader label="Loading projects…" />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 animate-stagger">
          {projects.map((p) => (
            <ProjectCard key={p.id} project={p} canDelete={canDeleteProject} onDelete={handleDelete} />
          ))}
          {projects.length === 0 && (
            <p className="text-gray-400 col-span-full text-center mt-10">
              {role === 'task_assignee' ? 'No tasks have been assigned to you yet.' : 'No projects yet. Tap + New Project to add one.'}
            </p>
          )}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-20 animate-fade-in">
          <form onSubmit={handleAdd} className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md p-6">
            <h2 className="text-lg font-medium mb-4">New Project</h2>
            {['name', 'client'].map((f) => (
              <input key={f} required placeholder={f[0].toUpperCase() + f.slice(1)} value={form[f]}
                onChange={(e) => setForm({ ...form, [f]: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 mb-3 text-sm focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition" />
            ))}
            <div className="flex gap-3 mb-3">
              <input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                className="w-1/2 border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              <input type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })}
                className="w-1/2 border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 mb-4 text-sm">
              {['Not Started', 'In Progress', 'On Hold', 'Completed'].map((s) => <option key={s}>{s}</option>)}
            </select>
            <div className="flex gap-3">
              <button type="button" onClick={() => setShowModal(false)} className="w-1/2 py-2 rounded-full border border-gray-300 text-gray-600 hover-lift">Cancel</button>
              <button className="w-1/2 py-2 rounded-full bg-indigo-600 text-white font-medium btn-modern">Create</button>
            </div>
          </form>
        </div>
      )}
    </DashboardShell>
  );
}
