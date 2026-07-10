import { useEffect, useState } from 'react';
import api from '../api.js';
import DashboardShell from '../components/DashboardShell.jsx';
import Preloader from '../components/Preloader.jsx';

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
  const [emailEditId, setEmailEditId] = useState(null);
  const [emailDraft, setEmailDraft] = useState('');
  const [error, setError] = useState('');

  const [transferFrom, setTransferFrom] = useState('');
  const [transferTo, setTransferTo] = useState('');
  const [transferMsg, setTransferMsg] = useState('');
  const [transferring, setTransferring] = useState(false);

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

  async function handleEmailSave(id) {
    await api.put(`/users/${id}/email`, { email: emailDraft });
    setEmailEditId(null); setEmailDraft('');
    load();
  }

  async function handleRoleChange(id, role) {
    try {
      await api.put(`/users/${id}/role`, { role });
      load();
    } catch (err) {
      alert(err?.response?.data?.error || 'Could not update role.');
      load();
    }
  }

  async function handleInvoiceAccessToggle(id, current) {
    try {
      await api.put(`/users/${id}/invoice-access`, { canAccessInvoices: !current });
      load();
    } catch (err) {
      alert(err?.response?.data?.error || 'Could not update invoice access.');
    }
  }

  async function handleDelete(id, username) {
    if (!window.confirm(`Delete user "${username}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/users/${id}`);
      load();
    } catch (err) {
      alert(err?.response?.data?.error || 'Could not delete user.');
    }
  }

  async function handleTransfer(e) {
    e.preventDefault();
    setTransferMsg('');
    if (!transferFrom || !transferTo) return;
    setTransferring(true);
    try {
      const { data } = await api.post('/users/transfer', { fromUsername: transferFrom, toUsername: transferTo });
      setTransferMsg(`Moved ${data.ownedTasksMoved} owned task(s) and ${data.assignedTasksMoved} assigned task(s) from ${transferFrom} to ${transferTo}.`);
      setTransferFrom(''); setTransferTo('');
    } catch (err) {
      setTransferMsg(err?.response?.data?.error || 'Transfer failed.');
    } finally {
      setTransferring(false);
    }
  }

  return (
    <DashboardShell title="Manage Users" subtitle="Create accounts, edit access, and transfer work between users.">
      <div className="max-w-2xl">
        <form onSubmit={handleCreate} className="bg-white rounded-2xl shadow-card p-5 mb-5 hover-lift">
          <h3 className="text-sm font-semibold text-gray-800 mb-3">Create New User</h3>
          {error && <p className="text-google-red text-xs mb-2">{error}</p>}
          <div className="flex flex-col sm:flex-row gap-3 mb-3">
            <input required placeholder="Username" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition" />
            <input required placeholder="Temp Password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition" />
          </div>
          <div className="flex flex-col sm:flex-row gap-3 mb-3">
            <input type="email" placeholder="Email (for password reset)" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
              {ROLE_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
          <button className="bg-indigo-600 text-white px-4 py-2 rounded-full text-sm font-medium btn-modern">Add User</button>
        </form>

        <form onSubmit={handleTransfer} className="bg-white rounded-2xl shadow-card p-5 mb-5 hover-lift">
          <h3 className="text-sm font-semibold text-gray-800 mb-1">Transfer Projects &amp; Tasks</h3>
          <p className="text-xs text-gray-400 mb-3">Move every task owned or assigned by one user to another — useful when offboarding or replacing a task owner/assignee.</p>
          {transferMsg && <p className="text-xs text-indigo-600 mb-2">{transferMsg}</p>}
          <div className="flex flex-col sm:flex-row gap-3 mb-3 items-center">
            <select required value={transferFrom} onChange={(e) => setTransferFrom(e.target.value)} className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm">
              <option value="">From user...</option>
              {users.map((u) => <option key={u.id} value={u.username}>{u.username} ({roleLabel(u.role)})</option>)}
            </select>
            <span className="text-gray-400 text-sm">&rarr;</span>
            <select required value={transferTo} onChange={(e) => setTransferTo(e.target.value)} className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm">
              <option value="">To user...</option>
              {users.map((u) => <option key={u.id} value={u.username}>{u.username} ({roleLabel(u.role)})</option>)}
            </select>
          </div>
          <button disabled={transferring} className="bg-indigo-600 text-white px-4 py-2 rounded-full text-sm font-medium btn-modern disabled:opacity-60">
            {transferring ? 'Transferring…' : 'Transfer'}
          </button>
        </form>

        {loading ? (
          <Preloader label="Loading users…" />
        ) : (
        <div className="bg-white rounded-2xl shadow-card divide-y animate-stagger">
          {users.map((u) => (
            <div key={u.id} className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 transition-colors hover:bg-gray-50">
              <div>
                <p className="text-sm font-medium text-gray-800">{u.username} <span className="text-xs text-gray-400">({roleLabel(u.role)})</span></p>
                {emailEditId === u.id ? (
                  <div className="flex gap-2 mt-1">
                    <input type="email" placeholder="email@example.com" value={emailDraft} onChange={(e) => setEmailDraft(e.target.value)} className="border border-gray-300 rounded-lg px-2 py-1 text-xs" />
                    <button onClick={() => handleEmailSave(u.id)} className="text-xs text-indigo-600 font-medium">Save</button>
                  </div>
                ) : (
                  <p className="text-xs text-gray-400">
                    {u.email || 'no email'}{' '}
                    <button onClick={() => { setEmailEditId(u.id); setEmailDraft(u.email || ''); }} className="text-indigo-600 link-underline">edit</button>
                  </p>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <select value={u.role} onChange={(e) => handleRoleChange(u.id, e.target.value)} className="text-xs border border-gray-300 rounded-md px-2 py-1">
                  {ROLE_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
                {resetId === u.id ? (
                  <div className="flex gap-2">
                    <input placeholder="New password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="border border-gray-300 rounded-lg px-2 py-1 text-xs" />
                    <button onClick={() => handleReset(u.id)} className="text-xs text-indigo-600 font-medium">Save</button>
                  </div>
                ) : (
                  <button onClick={() => setResetId(u.id)} className="text-xs text-indigo-600 font-medium link-underline">Reset Password</button>
                )}
                {u.role !== 'admin' && (
                  <button
                    onClick={() => handleInvoiceAccessToggle(u.id, u.canAccessInvoices === true)}
                    className={`text-xs font-medium px-2 py-1 rounded-full ${u.canAccessInvoices ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-500'}`}
                    title="Grant or revoke access to the Invoices dashboard"
                  >
                    Invoices: {u.canAccessInvoices ? 'On' : 'Off'}
                  </button>
                )}
                <button onClick={() => handleDelete(u.id, u.username)} className="text-xs text-google-red font-medium link-underline">Delete</button>
              </div>
            </div>
          ))}
          {users.length === 0 && <p className="text-gray-400 text-sm text-center p-4">No users yet.</p>}
        </div>
        )}
      </div>
    </DashboardShell>
  );
}
