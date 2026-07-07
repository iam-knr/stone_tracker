import { useState } from 'react';
import api from '../api.js';

export default function ChangePasswordModal({ onClose }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (newPassword.length < 8) return setError('New password must be at least 8 characters.');
    if (newPassword !== confirm) return setError('Passwords do not match.');
    setSaving(true);
    try {
      await api.put('/users/me/password', { currentPassword, newPassword });
      setSuccess(true);
    } catch (err) {
      setError(err?.response?.data?.error || 'Could not change password.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-30 animate-fade-in">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-sm p-6">
        <h2 className="text-lg font-medium mb-4">Change Password</h2>
        {success ? (
          <div>
            <p className="text-sm text-google-green mb-4">Password updated successfully.</p>
            <button onClick={onClose} className="w-full py-2 rounded-full bg-google-blue text-white font-medium btn-modern">Done</button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            {error && <p className="text-google-red text-xs mb-3">{error}</p>}
            <label className="block text-xs text-gray-500 mb-1">Current Password</label>
            <input type="password" required value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 mb-3 text-sm" />
            <label className="block text-xs text-gray-500 mb-1">New Password</label>
            <input type="password" required value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 mb-3 text-sm" />
            <label className="block text-xs text-gray-500 mb-1">Confirm New Password</label>
            <input type="password" required value={confirm} onChange={(e) => setConfirm(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 mb-4 text-sm" />
            <div className="flex gap-3">
              <button type="button" onClick={onClose} className="w-1/2 py-2 rounded-full border border-gray-300 text-gray-600 hover-lift">Cancel</button>
              <button disabled={saving} className="w-1/2 py-2 rounded-full bg-google-blue text-white font-medium btn-modern disabled:opacity-60">
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
