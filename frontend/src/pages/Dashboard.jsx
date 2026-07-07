import { useEffect, useState } from 'react';
import api from '../api.js';
import TopBar from '../components/TopBar.jsx';
import ProjectCard from '../components/ProjectCard.jsx';

export default function Dashboard() {
  const [projects, setProjects] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', client: '', startDate: '', deadline: '', status: 'Not Started' });

  async function load() {
    const { data } = await api.get('/projects');
    setProjects(data);
  }
  useEffect(() => { load(); }, []);

  async function handleAdd(e) {
    e.preventDefault();
    await api.post('/projects', form);
    setShowModal(false);
    setForm({ name: '', client: '', startDate: '', deadline: '', status: 'Not Started' });
    load();
  }

  return (
    <div className="min-h-screen bg-google-grey pb-8">
      <TopBar title="Stone Tracker" onAdd={() => setShowModal(true)} addLabel="+ New Project" />
      <div className="max-w-5xl mx-auto p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {projects.map((p) => <ProjectCard key={p.id} project={p} />)}
        {projects.length === 0 && <p className="text-gray-400 col-span-full text-center mt-10">No projects yet. Tap + New Project to add one.</p>}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-20">
          <form onSubmit={handleAdd} className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md p-6">
            <h2 className="text-lg font-medium mb-4">New Project</h2>
            {['name','client'].map((f) => (
              <input key={f} required placeholder={f[0].toUpperCase()+f.slice(1)} value={form[f]}
                onChange={(e) => setForm({ ...form, [f]: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 mb-3 text-sm" />
            ))}
            <div className="flex gap-3 mb-3">
              <input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                className="w-1/2 border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              <input type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })}
                className="w-1/2 border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 mb-4 text-sm">
              {['Not Started','In Progress','On Hold','Completed'].map(s => <option key={s}>{s}</option>)}
            </select>
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
