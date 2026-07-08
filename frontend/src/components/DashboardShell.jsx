import { NavLink, useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar.jsx';
import ActivityDrawer from './ActivityDrawer.jsx';
import { GridIcon, FolderIcon, ChecklistIcon, GearIcon, LogoutIcon } from './Icons.jsx';

const MOBILE_NAV_ITEMS = [
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

function MobileTopBar() {
  const navigate = useNavigate();
  const role = localStorage.getItem('st_role');
  const username = localStorage.getItem('st_username');

  function logout() {
    localStorage.clear();
    navigate('/login', { replace: true });
  }
  return (
    <div className="sm:hidden sticky top-0 z-10 bg-white border-b border-gray-100">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2 min-w-0">
          <img src="/logo.png" alt="Stone Tracker" className="w-8 h-8 rounded-lg shadow-sm shrink-0" />
          <div className="min-w-0">
            <p className="text-base font-semibold text-gray-900 leading-tight truncate">Stone Tracker</p>
            <p className="text-[11px] text-gray-400 font-medium leading-tight truncate">
              {username}{username ? ' · ' : ''}{(ROLE_LABELS[role] || 'ENTERPRISE').toUpperCase()}
            </p>
          </div>
        </div>
        <button onClick={logout} className="text-gray-400 hover:text-google-red p-1 shrink-0">
          <LogoutIcon className="w-5 h-5" />
        </button>
      </div>
      <div className="flex items-stretch border-t border-gray-100">
        {MOBILE_NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${
                isActive ? 'text-indigo-600' : 'text-gray-400'
              }`
            }
          >
            <Icon className="w-[18px] h-[18px]" />
            {label}
          </NavLink>
        ))}
      </div>
    </div>
  );
}

export default function DashboardShell({ title, subtitle, actions, children, fullWidth }) {
  return (
    <div className="min-h-screen flex bg-gray-50">
      <Sidebar />
      <div className="flex-1 min-w-0">
        <MobileTopBar />
        <main className={`mx-auto p-5 sm:p-8 ${fullWidth ? 'max-w-full' : 'max-w-6xl'}`}>
          {(title || actions) && (
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-7">
              <div>
                {title && <h1 className="text-2xl font-semibold text-gray-900">{title}</h1>}
                {subtitle && <div className="text-sm text-gray-500 mt-1">{subtitle}</div>}
              </div>
              {actions && <div className="flex items-center gap-4 shrink-0">{actions}</div>}
            </div>
          )}
          {children}
        </main>
      </div>
      <ActivityDrawer />
    </div>
  );
}
