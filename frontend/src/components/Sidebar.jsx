import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { GridIcon, FolderIcon, ChecklistIcon, GearIcon, HelpIcon, LogoutIcon, ChevronsLeftIcon } from './Icons.jsx';

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
  const username = localStorage.getItem('st_username');
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('st_sidebar_collapsed') === '1');

  function logout() {
    localStorage.clear();
    navigate('/login', { replace: true });
  }

  function toggleCollapsed() {
    setCollapsed((c) => {
      const next = !c;
      localStorage.setItem('st_sidebar_collapsed', next ? '1' : '0');
      return next;
    });
  }

  return (
    <aside
      className={`hidden sm:flex sm:flex-col shrink-0 bg-white border-r border-gray-100 h-screen sticky top-0 transition-all duration-200 ${
        collapsed ? 'w-[76px]' : 'w-64'
      }`}
    >
      <div className={`flex items-center gap-3 px-5 py-5 ${collapsed ? 'justify-center px-0' : ''}`}>
        <img src="/logo.png" alt="Stone Tracker" className="w-9 h-9 rounded-lg shadow-sm shrink-0" />
        {!collapsed && (
          <div className="min-w-0">
            <p className="text-base font-semibold text-gray-900 leading-tight truncate">Stone Tracker</p>
            {username && <p className="text-xs font-medium text-gray-600 leading-tight truncate mt-0.5">{username}</p>}
            <p className="text-[11px] tracking-wide text-gray-400 font-medium leading-tight mt-0.5">{(ROLE_LABELS[role] || 'ENTERPRISE').toUpperCase()}</p>
          </div>
        )}
      </div>

      <div className={`px-3 ${collapsed ? 'flex justify-center' : 'flex justify-end'}`}>
        <button
          onClick={toggleCollapsed}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="w-7 h-7 rounded-full flex items-center justify-center text-gray-300 hover:bg-gray-100 hover:text-gray-600 transition-colors"
        >
          <ChevronsLeftIcon className={`w-4 h-4 transition-transform duration-200 ${collapsed ? 'rotate-180' : ''}`} />
        </button>
      </div>

      <nav className="flex-1 px-3 mt-2 space-y-1">
        {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            title={collapsed ? label : undefined}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                collapsed ? 'justify-center px-0' : ''
              } ${isActive ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'}`
            }
          >
            <Icon className="w-[18px] h-[18px] shrink-0" />
            {!collapsed && label}
          </NavLink>
        ))}
      </nav>

      <div className="px-3 pb-5 space-y-1 border-t border-gray-100 pt-3">
        <a
          href="mailto:teambsagency@gmail.com"
          title={collapsed ? 'Help' : undefined}
          className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-500 hover:bg-gray-50 hover:text-gray-800 transition-colors ${
            collapsed ? 'justify-center px-0' : ''
          }`}
        >
          <HelpIcon className="w-[18px] h-[18px] shrink-0" />
          {!collapsed && 'Help'}
        </a>
        <button
          onClick={logout}
          title={collapsed ? 'Logout' : undefined}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-500 hover:bg-red-50 hover:text-google-red transition-colors ${
            collapsed ? 'justify-center px-0' : ''
          }`}
        >
          <LogoutIcon className="w-[18px] h-[18px] shrink-0" />
          {!collapsed && 'Logout'}
        </button>
      </div>
    </aside>
  );
}
