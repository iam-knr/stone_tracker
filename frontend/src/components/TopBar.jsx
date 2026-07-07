import { Link, useNavigate } from 'react-router-dom';

const ROLE_LABELS = {
  admin: 'Super Admin',
  task_owner: 'Task Owner',
  task_assignee: 'Task Assignee',
};

export default function TopBar({ title, onAdd, addLabel }) {
  const role = localStorage.getItem('st_role');
  const username = localStorage.getItem('st_username');
  const navigate = useNavigate();

  function logout() {
    localStorage.clear();
    navigate('/login', { replace: true });
  }

  return (
    <div className="sticky top-0 z-10 bg-white shadow-card flex items-center justify-between px-4 py-3">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-full bg-google-blue flex items-center justify-center text-white font-bold">S</div>
        <span className="text-lg font-medium text-gray-800">{title}</span>
      </div>
      <div className="flex items-center gap-3">
        {onAdd && (
          <button onClick={onAdd} className="bg-google-blue text-white text-sm font-medium px-4 py-2 rounded-full shadow-card hover:bg-blue-700 transition">
            {addLabel}
          </button>
        )}
        {role === 'admin' && (
          <Link to="/admin/users" className="text-sm text-google-blue font-medium hidden sm:block">Manage Users</Link>
        )}
        <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-sm font-medium text-gray-700" title={`${username} (${ROLE_LABELS[role] || role})`}>
          {username?.[0]?.toUpperCase()}
        </div>
        <button onClick={logout} className="text-sm text-gray-500 hover:text-google-red">Logout</button>
      </div>
    </div>
  );
}
