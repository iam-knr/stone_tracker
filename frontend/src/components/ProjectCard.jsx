import { useNavigate } from 'react-router-dom';
import { ArchiveBoxIcon, TrashIcon } from './Icons.jsx';

const STATUS_COLORS = {
  'Not Started': 'bg-gray-100 text-gray-500',
  'In Progress': 'bg-blue-50 text-google-blue',
  'On Hold': 'bg-amber-50 text-amber-600',
  'Completed': 'bg-green-50 text-google-green',
};

export default function ProjectCard({ project, canDelete, onDelete, canArchive, onArchiveToggle }) {
  const navigate = useNavigate();

  function handleDelete(e) {
    e.stopPropagation();
    if (!window.confirm(`Delete project "${project.name}"? This will also delete all of its tasks. This cannot be undone.`)) return;
    onDelete?.(project.id);
  }

  function handleArchiveToggle(e) {
    e.stopPropagation();
    const willArchive = !project.archived;
    if (willArchive && !window.confirm(`Archive project "${project.name}"? It will be hidden from the active list until you unarchive it.`)) return;
    onArchiveToggle?.(project.id, willArchive);
  }

  const showActions = canArchive || canDelete;
  const statusLabel = project.archived ? 'Archived' : project.status;
  const statusClass = project.archived ? 'bg-gray-100 text-gray-400' : (STATUS_COLORS[project.status] || 'bg-gray-100 text-gray-500');

  return (
    <div
      onClick={() => navigate(`/project/${project.id}`)}
      className={`group bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-gray-200 transition-all duration-200 p-5 cursor-pointer ${project.archived ? 'opacity-70' : ''}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-semibold text-gray-900 text-[15px] leading-snug truncate">{project.name}</h3>
          <p className="text-sm text-gray-400 mt-0.5 truncate">{project.client}</p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className={`text-[11px] font-medium px-2.5 py-1 rounded-full whitespace-nowrap ${statusClass}`}>
            {statusLabel}
          </span>
          {showActions && (
            <div className="flex items-center gap-0.5 pl-1 border-l border-gray-100 ml-0.5">
              {canArchive && (
                <button
                  onClick={handleArchiveToggle}
                  title={project.archived ? 'Unarchive project' : 'Archive project'}
                  className="w-7 h-7 rounded-full flex items-center justify-center text-gray-300 hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
                >
                  <ArchiveBoxIcon className="w-[15px] h-[15px]" />
                </button>
              )}
              {canDelete && (
                <button
                  onClick={handleDelete}
                  title="Delete project"
                  className="w-7 h-7 rounded-full flex items-center justify-center text-gray-300 hover:bg-red-50 hover:text-google-red transition-colors"
                >
                  <TrashIcon className="w-[15px] h-[15px]" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center justify-between text-xs text-gray-400 mt-4 pt-3 border-t border-gray-50">
        <span>Start&nbsp;{project.startDate || '—'}</span>
        <span>Due&nbsp;{project.deadline || '—'}</span>
      </div>
    </div>
  );
}
