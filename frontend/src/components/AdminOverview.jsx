import { Link } from 'react-router-dom';
import StatCard from './StatCard.jsx';
import { FolderIcon, ChecklistIcon, WarningIcon } from './Icons.jsx';

const STATUS_ORDER = ['To Do', 'In Progress', 'Review', 'Done'];
const STATUS_COLORS = {
  'To Do': '#d1d5db',
  'In Progress': '#4f46e5',
  'Review': '#fbbc04',
  'Done': '#34a853',
};

function daysBetween(dateStr, today) {
  const due = new Date(dateStr);
  const diffMs = due.setHours(0, 0, 0, 0) - today.setHours(0, 0, 0, 0);
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

// Modern donut/pie chart for the task status breakdown, built with a plain
// CSS conic-gradient (no charting library needed) plus a legend.
function StatusDonut({ statusCounts, total }) {
  let cumulative = 0;
  const stops = STATUS_ORDER.map((s) => {
    const pct = total ? (statusCounts[s] / total) * 100 : 0;
    const start = cumulative;
    cumulative += pct;
    return `${STATUS_COLORS[s]} ${start}% ${cumulative}%`;
  }).join(', ');
  const gradient = total ? `conic-gradient(${stops})` : '#f3f4f6';

  return (
    <div className="flex items-center gap-6">
      <div className="relative w-28 h-28 shrink-0 rounded-full" style={{ background: gradient }}>
        <div className="absolute inset-[11px] bg-white rounded-full flex flex-col items-center justify-center">
          <span className="text-xl font-semibold text-gray-900">{total}</span>
          <span className="text-[10px] text-gray-400 uppercase tracking-wide">Tasks</span>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        {STATUS_ORDER.map((s) => (
          <span key={s} className="flex items-center gap-2 text-xs text-gray-500 whitespace-nowrap">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: STATUS_COLORS[s] }} />
            {s} ({statusCounts[s]})
          </span>
        ))}
      </div>
    </div>
  );
}

export default function AdminOverview({ projects, tasks }) {
  const today = new Date();

  const activeProjects = projects.filter((p) => !p.archived).length;
  const totalTasks = tasks.length;
  const doneTasks = tasks.filter((t) => t.status === 'Done').length;
  const overallProgress = totalTasks ? Math.round((doneTasks / totalTasks) * 100) : 0;
  const projectsRing = projects.length ? Math.round((activeProjects / projects.length) * 100) : 0;

  const statusCounts = STATUS_ORDER.reduce((acc, s) => {
    acc[s] = tasks.filter((t) => t.status === s).length;
    return acc;
  }, {});

  const delayedTasks = tasks
    .filter((t) => t.dueDate && t.status !== 'Done' && daysBetween(t.dueDate, new Date()) < 0)
    .map((t) => ({ ...t, daysOverdue: -daysBetween(t.dueDate, new Date()) }))
    .sort((a, b) => b.daysOverdue - a.daysOverdue);

  const upcomingTasks = tasks
    .filter((t) => t.dueDate && t.status !== 'Done' && daysBetween(t.dueDate, new Date()) >= 0 && daysBetween(t.dueDate, new Date()) <= 7)
    .map((t) => ({ ...t, daysLeft: daysBetween(t.dueDate, new Date()) }))
    .sort((a, b) => a.daysLeft - b.daysLeft);

  const projectStats = projects.map((p) => {
    const projTasks = tasks.filter((t) => t.projectId === p.id);
    const projDone = projTasks.filter((t) => t.status === 'Done').length;
    const progress = projTasks.length ? Math.round((projDone / projTasks.length) * 100) : 0;
    const deadlinePassed = p.deadline && daysBetween(p.deadline, new Date()) < 0 && progress < 100;
    return { ...p, taskCount: projTasks.length, progress, deadlinePassed };
  });

  const projectByName = Object.fromEntries(projects.map((p) => [p.id, p.name]));

  const criticalItems = [
    ...delayedTasks.map((t) => ({ ...t, kind: 'overdue' })),
    ...upcomingTasks.map((t) => ({ ...t, kind: 'upcoming' })),
  ].slice(0, 4);

  return (
    <div className="space-y-5 animate-stagger">
      {/* Critical Action Center + Task status breakdown — one row on desktop/tablet */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-stretch">
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-card p-5 hover-lift">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-semibold text-gray-800">Critical Action Center</p>
            <Link to="/projects" className="text-xs font-medium text-indigo-600 link-underline whitespace-nowrap ml-3">
              View Projects →
            </Link>
          </div>
          {criticalItems.length === 0 ? (
            <p className="text-sm text-gray-400">All caught up — nothing overdue or due soon.</p>
          ) : (
            <div className="space-y-2">
              {criticalItems.map((t) => (
                <div
                  key={`${t.kind}-${t.id}`}
                  className={`flex justify-between items-center text-sm rounded-xl px-3 py-2.5 border-l-4 ${
                    t.kind === 'overdue' ? 'border-google-red bg-red-50/60' : 'border-google-yellow bg-yellow-50/60'
                  }`}
                >
                  <div className="min-w-0">
                    <p className="text-gray-800 font-medium truncate">{t.taskName}</p>
                    <p className="text-xs text-gray-400 truncate">{projectByName[t.projectId] || 'Unknown project'} · {t.assignee}</p>
                  </div>
                  <span className={`text-xs font-medium whitespace-nowrap ml-2 ${t.kind === 'overdue' ? 'text-google-red' : 'text-yellow-700'}`}>
                    {t.kind === 'overdue'
                      ? `${t.daysOverdue} day${t.daysOverdue !== 1 ? 's' : ''} overdue`
                      : (t.daysLeft === 0 ? 'Due today' : `${t.daysLeft} day${t.daysLeft !== 1 ? 's' : ''} left`)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl shadow-card p-5 hover-lift flex flex-col">
          <p className="text-sm font-semibold text-gray-800 mb-4">Task status breakdown</p>
          <div className="flex-1 flex items-center">
            <StatusDonut statusCounts={statusCounts} total={totalTasks} />
          </div>
        </div>
      </div>

      {/* Summary stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Link to="/projects" className="block">
          <StatCard label="Total Projects" value={projects.length} ring={projectsRing} ringColor="#4f46e5" />
        </Link>
        <StatCard label="Total Tasks" value={totalTasks} ring={overallProgress} ringColor="#4285f4" />
        <StatCard label="Overall Progress" value={`${overallProgress}%`} ring={overallProgress} />
        <StatCard label="Delayed Tasks" value={delayedTasks.length} icon={WarningIcon} accent={delayedTasks.length > 0} iconBg="#fef2f2" iconColor="#ea4335" />
      </div>

      {/* Project progress, Upcoming deadlines, Delayed tasks — one row on desktop/tablet */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        <div className="bg-white rounded-2xl shadow-card p-5 hover-lift">
          <p className="text-sm font-semibold text-gray-800 mb-4">Project progress &amp; deadlines</p>
          <div className="space-y-4">
            {projectStats.map((p) => (
              <div key={p.id}>
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-sm text-gray-700 font-medium truncate">{p.name}</span>
                  <span className={`text-xs whitespace-nowrap ml-2 ${p.deadlinePassed ? 'text-google-red font-medium' : 'text-gray-400'}`}>
                    {p.progress}%
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-gray-100 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${p.deadlinePassed ? 'bg-google-red' : 'bg-indigo-600'}`}
                    style={{ width: `${p.progress}%` }}
                  />
                </div>
              </div>
            ))}
            {projectStats.length === 0 && <p className="text-sm text-gray-400">No projects yet.</p>}
          </div>
        </div>

        <div className="bg-yellow-50 border border-yellow-100 rounded-2xl p-5">
          <p className="text-sm font-semibold text-yellow-700 mb-3">Upcoming deadlines (next 7 days)</p>
          {upcomingTasks.length === 0 ? (
            <p className="text-sm text-yellow-700/60">Nothing due in the next 7 days.</p>
          ) : (
            <div className="space-y-2">
              {upcomingTasks.map((t) => (
                <div key={t.id} className="flex justify-between items-center text-sm bg-white rounded-xl px-3 py-2.5 hover-lift">
                  <div className="min-w-0">
                    <p className="text-gray-800 font-medium truncate">{t.taskName}</p>
                    <p className="text-xs text-gray-400 truncate">{projectByName[t.projectId] || 'Unknown project'} · {t.assignee}</p>
                  </div>
                  <span className="text-xs text-yellow-700 font-medium whitespace-nowrap ml-2">
                    {t.daysLeft === 0 ? 'Due today' : `${t.daysLeft} day${t.daysLeft !== 1 ? 's' : ''} left`}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-red-50 border border-red-100 rounded-2xl p-5">
          <p className="text-sm font-semibold text-google-red mb-3">⚠ {delayedTasks.length} delayed task{delayedTasks.length !== 1 ? 's' : ''}</p>
          {delayedTasks.length === 0 ? (
            <p className="text-sm text-google-red/60">Nothing overdue right now.</p>
          ) : (
            <div className="space-y-2">
              {delayedTasks.map((t) => (
                <div key={t.id} className="flex justify-between items-center text-sm bg-white rounded-xl px-3 py-2.5 hover-lift">
                  <div className="min-w-0">
                    <p className="text-gray-800 font-medium truncate">{t.taskName}</p>
                    <p className="text-xs text-gray-400 truncate">{projectByName[t.projectId] || 'Unknown project'} · {t.assignee}</p>
                  </div>
                  <span className="text-xs text-google-red font-medium whitespace-nowrap ml-2">
                    {t.daysOverdue} day{t.daysOverdue !== 1 ? 's' : ''} overdue
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
