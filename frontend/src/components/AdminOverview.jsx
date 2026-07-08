import StatCard from './StatCard.jsx';
import { FolderIcon, ChecklistIcon, WarningIcon } from './Icons.jsx';

const STATUS_ORDER = ['To Do', 'In Progress', 'Review', 'Done'];
const STATUS_BAR_COLORS = {
  'To Do': 'bg-gray-300',
  'In Progress': 'bg-indigo-600',
  'Review': 'bg-google-yellow',
  'Done': 'bg-google-green',
};

function daysBetween(dateStr, today) {
  const due = new Date(dateStr);
  const diffMs = due.setHours(0, 0, 0, 0) - today.setHours(0, 0, 0, 0);
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

export default function AdminOverview({ projects, tasks }) {
  const today = new Date();

  const totalTasks = tasks.length;
  const doneTasks = tasks.filter((t) => t.status === 'Done').length;
  const overallProgress = totalTasks ? Math.round((doneTasks / totalTasks) * 100) : 0;

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

  return (
    <div className="space-y-5 animate-stagger">
      {/* Summary stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Projects" value={projects.length} icon={FolderIcon} iconBg="#eef2ff" iconColor="#4f46e5" />
        <StatCard label="Total Tasks" value={totalTasks} icon={ChecklistIcon} iconBg="#eef2ff" iconColor="#4f46e5" />
        <StatCard label="Overall Progress" value={`${overallProgress}%`} ring={overallProgress} />
        <StatCard label="Delayed Tasks" value={delayedTasks.length} icon={WarningIcon} accent={delayedTasks.length > 0} iconBg="#fef2f2" iconColor="#ea4335" />
      </div>

      {/* Status distribution bar */}
      <div className="bg-white rounded-2xl shadow-card p-5 hover-lift">
        <p className="text-sm font-semibold text-gray-800 mb-4">Task status breakdown</p>
        <div className="flex w-full h-2.5 rounded-full overflow-hidden bg-gray-100">
          {STATUS_ORDER.map((s) => (
            totalTasks > 0 && statusCounts[s] > 0 && (
              <div
                key={s}
                className={STATUS_BAR_COLORS[s]}
                style={{ width: `${(statusCounts[s] / totalTasks) * 100}%` }}
                title={`${s}: ${statusCounts[s]}`}
              />
            )
          ))}
        </div>
        <div className="flex flex-wrap gap-4 mt-4">
          {STATUS_ORDER.map((s) => (
            <span key={s} className="flex items-center gap-1.5 text-xs text-gray-500">
              <span className={`w-2.5 h-2.5 rounded-full ${STATUS_BAR_COLORS[s]}`} />
              {s} ({statusCounts[s]})
            </span>
          ))}
        </div>
      </div>

      {/* Per-project progress */}
      <div className="bg-white rounded-2xl shadow-card p-5 hover-lift">
        <p className="text-sm font-semibold text-gray-800 mb-4">Project progress &amp; deadlines</p>
        <div className="space-y-4">
          {projectStats.map((p) => (
            <div key={p.id}>
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-sm text-gray-700 font-medium">{p.name}</span>
                <span className={`text-xs ${p.deadlinePassed ? 'text-google-red font-medium' : 'text-gray-400'}`}>
                  {p.deadlinePassed ? `Overdue (was due ${p.deadline})` : `Due ${p.deadline || '—'}`} · {p.progress}%
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

      {/* Delayed tasks warning */}
      {delayedTasks.length > 0 && (
        <div className="bg-red-50 border border-red-100 rounded-2xl p-5">
          <p className="text-sm font-semibold text-google-red mb-3">⚠ {delayedTasks.length} delayed task{delayedTasks.length > 1 ? 's' : ''}</p>
          <div className="space-y-2">
            {delayedTasks.map((t) => (
              <div key={t.id} className="flex justify-between items-center text-sm bg-white rounded-xl px-3 py-2.5 hover-lift">
                <div>
                  <p className="text-gray-800 font-medium">{t.taskName}</p>
                  <p className="text-xs text-gray-400">{projectByName[t.projectId] || 'Unknown project'} · {t.assignee}</p>
                </div>
                <span className="text-xs text-google-red font-medium whitespace-nowrap ml-2">
                  {t.daysOverdue} day{t.daysOverdue !== 1 ? 's' : ''} overdue
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upcoming deadlines */}
      {upcomingTasks.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-100 rounded-2xl p-5">
          <p className="text-sm font-semibold text-yellow-700 mb-3">Upcoming deadlines (next 7 days)</p>
          <div className="space-y-2">
            {upcomingTasks.map((t) => (
              <div key={t.id} className="flex justify-between items-center text-sm bg-white rounded-xl px-3 py-2.5 hover-lift">
                <div>
                  <p className="text-gray-800 font-medium">{t.taskName}</p>
                  <p className="text-xs text-gray-400">{projectByName[t.projectId] || 'Unknown project'} · {t.assignee}</p>
                </div>
                <span className="text-xs text-yellow-700 font-medium whitespace-nowrap ml-2">
                  {t.daysLeft === 0 ? 'Due today' : `${t.daysLeft} day${t.daysLeft !== 1 ? 's' : ''} left`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
