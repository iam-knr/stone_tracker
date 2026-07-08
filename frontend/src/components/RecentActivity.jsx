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

const STATUS_DOT = {
  'Done': 'bg-google-green',
  'In Progress': 'bg-indigo-600',
  'Review': 'bg-google-yellow',
  'To Do': 'bg-gray-300',
};

// Recent Activity feed derived from existing task/project data (no separate
// audit log table). Super Admin sees activity across everything; Task
// Owners and Task Assignees only see activity tied to tasks where they are
// the assignee or task owner, and the projects those tasks belong to.
export default function RecentActivity({ projects, tasks }) {
  const role = localStorage.getItem('st_role');
  const username = localStorage.getItem('st_username');

  const scopedTasks = role === 'admin'
    ? tasks
    : tasks.filter((t) => t.assignee === username || t.taskOwner === username);
  const scopedProjectIds = new Set(scopedTasks.map((t) => t.projectId));
  const scopedProjects = role === 'admin'
    ? projects
    : projects.filter((p) => scopedProjectIds.has(p.id));

  const projectByName = Object.fromEntries(projects.map((p) => [p.id, p.name]));

  const taskEvents = scopedTasks.map((t) => ({
    id: `task-${t.id}`,
    ts: Number(t.id) || 0,
    dot: STATUS_DOT[t.status] || 'bg-gray-300',
    title: t.taskName,
    detail: `${t.status === 'Done' ? 'Completed' : t.status} · ${projectByName[t.projectId] || 'Unknown project'}`,
    who: t.assignee || t.taskOwner || 'Unassigned',
  }));

  const projectEvents = scopedProjects.map((p) => ({
    id: `project-${p.id}`,
    ts: Number(p.id) || 0,
    dot: 'bg-purple-400',
    title: p.name,
    detail: p.archived ? 'Project archived' : 'Project created',
    who: p.client || '—',
  }));

  const events = [...taskEvents, ...projectEvents]
    .filter((e) => e.ts > 0)
    .sort((a, b) => b.ts - a.ts)
    .slice(0, 6);

  return (
    <div className="bg-white rounded-2xl shadow-card p-5 hover-lift">
      <p className="text-sm font-semibold text-gray-800 mb-4">Recent Activity</p>
      {events.length === 0 ? (
        <p className="text-sm text-gray-400">No recent activity yet.</p>
      ) : (
        <div className="space-y-4">
          {events.map((e) => (
            <div key={e.id} className="flex items-start gap-3">
              <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${e.dot}`} />
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
  );
}
