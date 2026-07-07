import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import ChangePasswordModal from './ChangePasswordModal.jsx';

const ROLE_LABELS = {
  admin: 'Super Admin',
  task_owner: 'Task Owner',
  task_assignee: 'Task Assignee',
};

export default function TopBar({ title, onAdd, addLabel }) {
  const role = localStorage.getItem('st_role');
  const username = localStorage.getItem('st_username');
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [showChangePw, setShowChangePw] = useState(false);

  function logout() {
    localStorage.clear();
    navigate('/login', { replace: true });
  }

  return (
    <div className="sticky top-0 z-10 bg-white/90 backdrop-blur shadow-card flex items-center justify-between px-4 py-3">
      <div className="flex items-center gap-2">
        <img src="/logo.png" alt="Stone Tracker" className="w-8 h-8 rounded-lg transition-transform duration-200 hover:scale-105" />
        <span className="text-lg font-medium text-gray-800">{title}</span>
      </div>
      <div className="flex items-center gap-3">
        {onAdd && (
          <button onClick={onAdd} className="bg-google-blue text-white text-sm font-medium px-4 py-2 rounded-full shadow-card btn-modern">
            {addLabel}
          </button>
        )}
        {role === 'admin' && (
          <Link to="/admin/users" className="text-sm text-google-blue font-medium hidden sm:block link-underline">Manage Users</Link>
        )}
        <div className="relative">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-sm font-medium text-gray-700 transition-transform duration-150 hover:scale-105"
            title={`${username} (${ROLE_LABELS[role] || role})`}
          >
            {username?.[0]?.toUpperCase()}
          </button>
          {menuOpen && (
            <div className="absolute right-0 mt-2 w-44 bg-white rounded-xl shadow-lg border border-gray-100 py-1 animate-fade-in z-20">
              <p className="px-3 py-2 text-xs text-gray-400 border-b border-gray-100">{username} · {ROLE_LABELS[role] || role}</p>
              <button
                onClick={() => { setMenuOpen(false); setShowChangePw(true); }}
                className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Change Password
              </button>
              <button
                onClick={logout}
                className="w-full text-left px-3 py-2 text-sm text-google-red hover:bg-red-50 transition-colors"
              >
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
      {showChangePw && <ChangePasswordModal onClose={() => setShowChangePw(false)} />}
    </div>
  );
}
