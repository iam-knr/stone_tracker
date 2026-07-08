import { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api.js';
import DashboardShell from '../components/DashboardShell.jsx';

const ROLE_LABELS = {
  admin: 'Super Admin',
  task_owner: 'Task Owner',
  task_assignee: 'Task Assignee',
};

export default function Settings() {
  const username = localStorage.getItem('st_username');
  const role = localStorage.getItem('st_role');
  const isAdmin = role === 'admin';

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccess(false);
    if (newPassword.length < 8) return setError('New password must be at least 8 characters.');
    if (newPassword !== confirm) return setError('Passwords do not match.');
    setSaving(true);
    try {
      await api.put('/users/me/password', { currentPassword, newPassword });
      setSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirm('');
    } catch (err) {
      setError(err?.response?.data?.error || 'Could not change password.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <DashboardShell title="Settings" subtitle="Manage your account and preferences.">
      <div className="max-w-xl space-y-5">
        <div className="bg-white rounded-2xl shadow-card p-5 hover-lift">
          <p className="text-sm font-semibold text-gray-800 mb-4">Account</p>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-semibold text-lg">
              {username?.[0]?.toUpperCase()}
            </div>
            <div>
              <p className="text-sm font-medium text-gray-800">{username}</p>
              <p className="text-xs text-gray-400">{ROLE_LABELS[role] || role}</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-card p-5 hover-lift">
          <p className="text-sm font-semibold text-gray-800 mb-1">Change Password</p>
          <p className="text-xs text-gray-400 mb-4">Update the password you use to sign in.</p>
          {error && <p className="text-google-red text-xs mb-3">{error}</p>}
          {success && <p className="text-google-green text-xs mb-3">Password updated successfully.</p>}
          <label className="block text-xs text-gray-500 mb-1">Current Password</label>
          <input type="password" required value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 mb-3 text-sm focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition" />
          <label className="block text-xs text-gray-500 mb-1">New Password</label>
          <input type="password" required value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 mb-3 text-sm focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition" />
          <label className="block text-xs text-gray-500 mb-1">Confirm New Password</label>
          <input type="password" required value={confirm} onChange={(e) => setConfirm(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 mb-4 text-sm focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition" />
          <button disabled={saving} className="bg-indigo-600 text-white text-sm font-medium px-5 py-2.5 rounded-full btn-modern disabled:opacity-60">
            {saving ? 'Saving…' : 'Save Password'}
          </button>
        </form>

        {isAdmin && (
          <div className="bg-white rounded-2xl shadow-card p-5 hover-lift">
            <p className="text-sm font-semibold text-gray-800 mb-1">Administration</p>
            <p className="text-xs text-gray-400 mb-4">Create accounts, edit emails/passwords, and transfer projects or tasks between users.</p>
            <Link to="/admin/users" className="inline-block bg-indigo-600 text-white text-sm font-medium px-5 py-2.5 rounded-full btn-modern">
              Manage Users
            </Link>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
