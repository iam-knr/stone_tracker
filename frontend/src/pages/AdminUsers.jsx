import { useEffect, useState } from 'react';
import api from '../api.js';
import TopBar from '../components/TopBar.jsx';
import Spinner from '../components/Spinner.jsx';

const ROLE_OPTIONS = [
  { value: 'task_assignee', label: 'Task Assignee' },
  { value: 'task_owner', label: 'Task Owner' },
  { value: 'admin', label: 'Super Admin' },
];

function roleLabel(role) {
  return ROLE_OPTIONS.find((r) => r.value === role)?.label || role;
}

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ username: '', password: '', email: '', role: 'task_assignee' });
  const [resetId, setResetId] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState('');

  async function load() {
    const { data } = await api.get('/users');
    setUsers(data);
  }
  useEffect(() => { setLoading(true); load().finally(() => setLoading(false)); }, []);

  async function handleCreate(e) {
    e.preventDefault();
    setError('');
    try {
      await api.post('/users', form);
      setForm({ username: '', password: '', email: '', role: 'task_assignee' });
      load();
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to create user');
    }
  }

  async function handleReset(id) {
    await api.put(`/users/${id}/password`, { password: newPassword });
    setResetId(null); setNewPassword('');
  }

  async function handleRoleChange(id, role) {
    await api.put(`/users/${id}/role`, { role });
    load();
  }

  async function handleDelete(id, username) {
    if (!window.confirm(`Delete user "${username}"? This cannot be undone.`)) return;
    await api.delete(`/users/${id}`);
    load();
  }

  return (
    <div className="min-h-screen bg-google-grey pb-8">
      <TopBar title="Manage Users" />
      <div className="max-w-2xl mx-auto p-4">
        <form onSubmit={handleCreate} className="bg-white rounded-xl shadow-card p-4 mb-6">
          <h3 className="font-medium mb-3">Create New User</h3>
          {error && <p className="text-google-red text-xs mb-2">{error}</p>}
          <div className="flex flex-col sm:flex-row gap-3 mb-3">
            <input required placeholder="Username" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            <input required placeholder="Temp Password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div className="flex flex-col sm:flex-row gap-3 mb-3">
            <input type="email" placeholder="Email (for password reset)" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
              {ROLE_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
          <button className="bg-google-blue text-white px-4 py-2 rounded-full text-sm font-medium">Add User</button>
        </form>

        {loading ? (
          <div className="flex justify-center py-12 text-google-blue"><Spinner className="text-2xl" /></div>
        ) : (
        <div className="bg-white rounded-xl shadow-card divide-y animate-fade-in">
          {users.map((u) => (
            <div key={u.id} className="p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <p className="text-sm font-medium">{u.username} <span className="text-xs text-gray-400">({roleLabel(u.role)})</span></p>
                {u.email && <p className="text-xs text-gray-400">{u.email}</p>}
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <select value={u.role} onChange={(e) => handleRoleChange(u.id, e.target.value)} className="text-xs border border-gray-300 rounded-md px-2 py-1">
                  {ROLE_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
                {resetId === u.id ? (
                  <div className="flex gap-2">
                    <input placeholder="New password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="border border-gray-300 rounded-lg px-2 py-1 text-xs" />
                    <button onClick={() => handleReset(u.id)} className="text-xs text-google-blue font-medium">Save</button>
                  </div>
                ) : (
                  <button onClick={() => setResetId(u.id)} className="text-xs text-google-blue font-medium">Reset Password</button>
                )}
                <button onClick={() => handleDelete(u.id, u.username)} className="text-xs text-google-red font-medium">Delete</button>
              </div>
            </div>
          ))}
          {users.length === 0 && <p className="text-gray-400 text-sm text-center p-4">No users yet.</p>}
        </div>
        )}
      </div>
    </div>
  );
}
