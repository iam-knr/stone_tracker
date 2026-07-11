import { useEffect, useState } from 'react';
import api from '../api.js';
import DashboardShell from '../components/DashboardShell.jsx';
import ProjectCard from '../components/ProjectCard.jsx';
import ProjectDetailModal from '../components/ProjectDetailModal.jsx';
import Preloader from '../components/Preloader.jsx';

export default function Projects() {
  const role = localStorage.getItem('st_role');
  const canCreateProject = role === 'admin' || role === 'task_owner';
  const canDeleteProject = role === 'admin' || role === 'task_owner';
  const canArchiveProject = role === 'admin' || role === 'task_owner';
  const [projects, setProjects] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [expandedProject, setExpandedProject] = useState(null);
  const [view, setView] = useState('active'); // 'active' | 'archived'
  const [form, setForm] = useState({ name: '', client: '', startDate: '', deadline: '', status: 'Not Started' });
  const [dragId, setDragId] = useState(null);
  const [overId, setOverId] = useState(null);

  async function load() {
    const { data } = await api.get('/projects');
    setProjects(data);
    try { const { data: contactData } = await api.get('/contacts'); setContacts(contactData || []); } catch (e) { setContacts([]); }
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

  async function handleArchiveToggle(id, archived) {
    try {
      await api.patch(`/projects/${id}/archive`, { archived });
      load();
    } catch (err) {
      alert(err?.response?.data?.error || 'Could not update archive status.');
    }
  }

  // Manual drag-and-drop reordering — only meaningful in the Active view.
  // The dragged card is swapped to sit just before/after the card it's
  // dropped on, then the whole visible order is persisted as sequential
  // `sortorder` values via a single reorder call.
  function handleDragStart(id) {
    setDragId(id);
  }
  function handleDragOver(e, id) {
    e.preventDefault();
    if (id !== overId) setOverId(id);
  }
  function handleDragEnd() {
    setDragId(null);
    setOverId(null);
  }
  async function handleDrop(targetId) {
    const currentDragId = dragId;
    setDragId(null);
    setOverId(null);
    if (!currentDragId || currentDragId === targetId) return;

    const activeIds = sortedProjects.filter((p) => !p.archived).map((p) => p.id);
    const from = activeIds.indexOf(currentDragId);
    const to = activeIds.indexOf(targetId);
    if (from === -1 || to === -1) return;

    const reordered = [...activeIds];
    reordered.splice(from, 1);
    reordered.splice(to, 0, currentDragId);

    setProjects((prev) => prev.map((p) => {
      const idx = reordered.indexOf(p.id);
      return idx === -1 ? p : { ...p, sortorder: idx };
    }));

    try {
      await api.post('/projects/reorder', { orderedIds: reordered });
    } catch (err) {
      load();
    }
  }

  const sortedProjects = [...projects].sort((a, b) => {
    const av = a.sortorder ?? Number.MAX_SAFE_INTEGER;
    const bv = b.sortorder ?? Number.MAX_SAFE_INTEGER;
    return av - bv;
  });
  const visibleProjects = sortedProjects.filter((p) => (view === 'archived' ? !!p.archived : !p.archived));
  const archivedCount = projects.filter((p) => p.archived).length;
  const canReorder = view === 'active';

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
      {canArchiveProject && (
        <div className="flex items-center gap-2 mb-5">
          <button
            onClick={() => setView('active')}
            className={`text-sm font-medium px-3 py-1.5 rounded-full transition ${view === 'active' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
          >
            Active
          </button>
          <button
            onClick={() => setView('archived')}
            className={`text-sm font-medium px-3 py-1.5 rounded-full transition ${view === 'archived' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
          >
            Archived{archivedCount > 0 ? ` (${archivedCount})` : ''}
          </button>
        </div>
      )}

      {loading ? (
        <Preloader label="Loading projects…" />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 animate-stagger">
          {visibleProjects.map((p) => (
            <ProjectCard
              key={p.id}
              project={p}
              canDelete={canDeleteProject}
              onDelete={handleDelete}
              canArchive={canArchiveProject}
              onArchiveToggle={handleArchiveToggle}
              onExpand={setExpandedProject}
              draggable={canReorder}
              isDragging={dragId === p.id}
              isDragOver={canReorder && overId === p.id && dragId !== p.id}
              onDragStart={() => handleDragStart(p.id)}
              onDragOver={(e) => handleDragOver(e, p.id)}
              onDrop={() => handleDrop(p.id)}
              onDragEnd={handleDragEnd}
            />
          ))}
          {visibleProjects.length === 0 && (
            <p className="text-gray-400 col-span-full text-center mt-10">
              {view === 'archived'
                ? 'No archived projects.'
                : role === 'task_assignee' ? 'No tasks have been assigned to you yet.' : 'No projects yet. Tap + New Project to add one.'}
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
            <select value={form.clientContactId || ''} onChange={(e) => setForm({ ...form, clientContactId: e.target.value || null })} className="w-full border border-gray-300 rounded-lg px-3 py-2 mb-4 text-sm">
            <option value="">No client contact</option>
              {contacts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
            <div className="flex gap-3">
              <button type="button" onClick={() => setShowModal(false)} className="w-1/2 py-2 rounded-full border border-gray-300 text-gray-600 hover-lift">Cancel</button>
              <button className="w-1/2 py-2 rounded-full bg-indigo-600 text-white font-medium btn-modern">Create</button>
            </div>
          </form>
        </div>
      )}

      {expandedProject && (
        <ProjectDetailModal
          project={expandedProject}
          onClose={() => setExpandedProject(null)}
          onSaved={load}
          canEdit={canCreateProject}
        />
      )}
    </DashboardShell>
  );
}
