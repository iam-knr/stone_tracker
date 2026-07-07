import { useEffect, useState } from 'react';
import api from '../api.js';
import TopBar from '../components/TopBar.jsx';

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState({ username:'', password:'', role:'user' });
  const [resetId, setResetId] = useState(null);
  const [newPassword, setNewPassword] = useState('');

  async function load() {
    const { data } = await api.get('/users');
    setUsers(data);
  }
  useEffect(() => { load(); }, []);

  async function handleCreate(e) {
    e.preventDefault();
    await api.post('/users', form);
    setForm({ username:'', password:'', role:'user' });
    load();
  }

  async function handleReset(id) {
    await api.put(`/users/${id}/password`, { password: newPassword });
    setResetId(null); setNewPassword('');
  }

  return (
    <div className="min-h-screen bg-google-grey pb-8">
      <TopBar title="Manage Users" />
      <div className="max-w-2xl mx-auto p-4">
        <form onSubmit={handleCreate} className="bg-white rounded-xl shadow-card p-4 mb-6">
          <h3 className="font-medium mb-3">Create New User</h3>
          <div className="flex flex-col sm:flex-row gap-3 mb-3">
            <input required placeholder="Username" value={form.username} onChange={(e)=>setForm({...form, username:e.target.value})} className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            <input required placeholder="Temp Password" value={form.password} onChange={(e)=>setForm({...form, password:e.target.value})} className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            <select value={form.role} onChange={(e)=>setForm({...form, role:e.target.value})} className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <button className="bg-google-blue text-white px-4 py-2 rounded-full text-sm font-medium">Add User</button>
        </form>

        <div className="bg-white rounded-xl shadow-card divide-y">
          {users.map((u) => (
            <div key={u.id} className="p-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{u.username} <span className="text-xs text-gray-400">({u.role})</span></p>
              </div>
              {resetId === u.id ? (
                <div className="flex gap-2">
                  <input placeholder="New password" value={newPassword} onChange={(e)=>setNewPassword(e.target.value)} className="border border-gray-300 rounded-lg px-2 py-1 text-xs" />
                  <button onClick={() => handleReset(u.id)} className="text-xs text-google-blue font-medium">Save</button>
                </div>
              ) : (
                <button onClick={() => setResetId(u.id)} className="text-xs text-google-blue font-medium">Reset Password</button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
