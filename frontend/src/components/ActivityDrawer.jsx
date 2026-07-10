import { useEffect, useState } from 'react';
import api from '../api.js';
import { ActivityIcon, TrashIcon } from './Icons.jsx';
import { formatList, includesUser } from '../utils/people.js';

function timeAgo(ms) {
  const diff = Date.now() - ms;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min${mins !== 1 ? 's' : ''} ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs !== 1 ? 's' : ''} ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days} day${days !== 1 ? 's' : ''} ago`;
  return new Date(ms).toLocaleDateString();
}

// Best-effort timestamp: prefer a real DB timestamp column, fall back to
// the id itself when it's an epoch-ms string (Date.now().toString()).
function resolveTs(row, tsField) {
  if (row[tsField]) {
    const t = new Date(row[tsField]).getTime();
    if (!Number.isNaN(t)) return t;
  }
  const n = Number(row.id);
  return Number.isFinite(n) && n > 1e12 ? n : 0;
}

const STATUS_DOT = {
  'Done': 'bg-google-green',
  'In Progress': 'bg-indigo-600',
  'Review': 'bg-google-yellow',
  'To Do': 'bg-gray-300',
};

// Global "Recent Activity" pill — a small tab fixed to the right edge of
// every page (mounted once in DashboardShell). Clicking it slides out a
// panel with recent create/update/delete events across tasks and projects.
// Super Admin sees everything; Task Owners/Assignees only see events tied
// to tasks they own or are assigned to (deletions of a whole project are
// admin-only in this feed — a non-admin still sees their own tasks getting
// deleted when a project cascades).
export default function ActivityDrawer() {
  const role = localStorage.getItem('st_role');
  const username = localStorage.getItem('st_username');
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [trash, setTrash] = useState([]);

  async function load() {
    const [{ data: p }, { data: t }, { data: tr }] = await Promise.all([
      api.get('/projects'),
      api.get('/tasks'),
      api.get('/trash'),
    ]);
    setProjects(p);
    setTasks(t);
    setTrash(tr);
    setLoaded(true);
  }

  useEffect(() => {
    if (open && !loaded) load();
  }, [open]);

  const scopedTasks = role === 'admin' ? tasks : tasks.filter((t) => includesUser(t.assignee, username) || includesUser(t.taskOwner, username));
  const scopedProjectIds = new Set(scopedTasks.map((t) => t.projectId));
  const scopedProjects = role === 'admin' ? projects : projects.filter((p) => scopedProjectIds.has(p.id));
  const projectByName = Object.fromEntries(projects.map((p) => [p.id, p.name]));

  const taskEvents = scopedTasks.map((t) => ({
    id: `task-${t.id}`,
    ts: resolveTs(t, 'updatedat'),
    dot: STATUS_DOT[t.status] || 'bg-gray-300',
    title: t.taskName,
    detail: `${t.status === 'Done' ? 'Completed' : t.status} · ${projectByName[t.projectId] || 'Unknown project'}`,
    who: formatList(t.assignee) !== '—' ? formatList(t.assignee) : (formatList(t.taskOwner) !== '—' ? formatList(t.taskOwner) : 'Unassigned'),
  }));

  const projectEvents = scopedProjects.map((p) => ({
    id: `project-${p.id}`,
    ts: resolveTs(p, 'createdat'),
    dot: 'bg-purple-400',
    title: p.name,
    detail: p.archived ? 'Project archived' : 'Project created',
    who: p.client || '—',
  }));

  const deletionEvents = trash
    .filter((item) => role === 'admin' || (item.type === 'task' && (includesUser(item.assignee, username) || includesUser(item.taskOwner, username))))
    .map((item) => ({
      id: `deleted-${item.type}-${item.id}`,
      ts: new Date(item.deletedat).getTime(),
      dot: 'bg-google-red',
      title: item.name,
      detail: `${item.type === 'project' ? 'Project' : 'Task'} deleted by ${item.deletedby || 'unknown'}${item.projectName ? ` · ${item.projectName}` : ''}`,
      who: item.deletedby || 'Unknown',
      icon: true,
    }));

  const events = [...taskEvents, ...projectEvents, ...deletionEvents]
    .filter((e) => e.ts > 0)
    .sort((a, b) => b.ts - a.ts)
    .slice(0, 12);

  return (
    <>
      {open && (
        <div className="fixed inset-0 bg-black/20 z-30 animate-fade-in" onClick={() => setOpen(false)} />
      )}

      <div
        className={`fixed top-0 right-0 h-screen w-full sm:w-96 bg-white shadow-2xl z-40 transition-transform duration-300 flex flex-col ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <p className="text-sm font-semibold text-gray-800">Recent Activity</p>
          <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-700 text-sm px-2 py-1">✕</button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {!loaded ? (
            <p className="text-sm text-gray-400">Loading…</p>
          ) : events.length === 0 ? (
            <p className="text-sm text-gray-400">No recent activity yet.</p>
          ) : (
            <div className="space-y-4">
              {events.map((e) => (
                <div key={e.id} className="flex items-start gap-3">
                  {e.icon ? (
                    <span className="w-4 h-4 rounded-full bg-red-50 flex items-center justify-center mt-0.5 shrink-0">
                      <TrashIcon className="w-2.5 h-2.5 text-google-red" />
                    </span>
                  ) : (
                    <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${e.dot}`} />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-gray-800 truncate">
                      <span className="font-medium">{e.who}</span> · {e.title}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">{e.detail} · {timeAgo(e.ts)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <button
        onClick={() => setOpen((o) => !o)}
        title="Recent Activity"
        className={`fixed top-1/2 -translate-y-1/2 right-0 z-30 flex items-center gap-1.5 bg-indigo-600 text-white text-xs font-medium pl-3 pr-2.5 py-2.5 rounded-l-full shadow-card hover:bg-indigo-700 transition-all ${
          open ? 'translate-x-full opacity-0 pointer-events-none' : 'translate-x-0'
        }`}
        style={{ writingMode: 'horizontal-tb' }}
      >
        <ActivityIcon className="w-4 h-4" />
        <span className="hidden sm:inline">Activity</span>
      </button>
    </>
  );
}
