import { NavLink, useNavigate } from 'react-router-dom';
import { GridIcon, FolderIcon, ChecklistIcon, GearIcon, HelpIcon, LogoutIcon } from './Icons.jsx';

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: GridIcon, end: true },
  { to: '/projects', label: 'Projects', icon: FolderIcon },
  { to: '/tasks', label: 'Tasks', icon: ChecklistIcon },
  { to: '/settings', label: 'Settings', icon: GearIcon },
];

const ROLE_LABELS = {
  admin: 'Super Admin',
  task_owner: 'Task Owner',
  task_assignee: 'Task Assignee',
};

export default function Sidebar() {
  const navigate = useNavigate();
  const role = localStorage.getItem('st_role');

  function logout() {
    localStorage.clear();
    navigate('/login', { replace: true });
  }

  return (
    <aside className="hidden sm:flex sm:flex-col w-64 shrink-0 bg-white border-r border-gray-100 h-screen sticky top-0">
      <div className="flex items-center gap-3 px-5 py-5">
        <div className="w-9 h-9 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-semibold text-sm">
          St
        </div>
        <div>
          <p className="text-base font-semibold text-gray-900 leading-tight">Stone Tracker</p>
          <p className="text-[11px] tracking-wide text-gray-400 font-medium">{(ROLE_LABELS[role] || 'ENTERPRISE').toUpperCase()}</p>
        </div>
      </div>

      <nav className="flex-1 px-3 mt-2 space-y-1">
        {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                isActive ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'
              }`
            }
          >
            <Icon className="w-[18px] h-[18px] shrink-0" />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="px-3 pb-5 space-y-1 border-t border-gray-100 pt-3">
        <a
          href="mailto:teambsagency@gmail.com"
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-500 hover:bg-gray-50 hover:text-gray-800 transition-colors"
        >
          <HelpIcon className="w-[18px] h-[18px] shrink-0" />
          Help
        </a>
        <button
          onClick={logout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-500 hover:bg-red-50 hover:text-google-red transition-colors"
        >
          <LogoutIcon className="w-[18px] h-[18px] shrink-0" />
          Logout
        </button>
      </div>
    </aside>
  );
}
