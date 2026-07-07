import { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import api from '../api.js';
import Spinner from '../components/Spinner.jsx';

export default function ResetPassword() {
  const [params] = useSearchParams();
  const id = params.get('id');
  const token = params.get('token');
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      await api.post('/auth/reset-password', { id, token, newPassword: password });
      setDone(true);
      setTimeout(() => navigate('/login'), 2000);
    } catch (err) {
      setError(err?.response?.data?.error || 'Could not reset password. The link may have expired.');
    } finally {
      setLoading(false);
    }
  }

  if (!id || !token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-google-grey px-4">
        <div className="animate-fade-in bg-white rounded-2xl shadow-card p-8 w-full max-w-sm text-center">
          <p className="text-sm text-google-red mb-4">This reset link is missing required information.</p>
          <Link to="/forgot-password" className="text-google-blue text-sm hover:underline">Request a new link</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-google-grey px-4">
      <form onSubmit={handleSubmit} className="animate-fade-in bg-white rounded-2xl shadow-card p-8 w-full max-w-sm">
        <div className="flex flex-col items-center mb-6">
          <img src="/logo.png" alt="Stone Tracker" className="w-16 h-16 rounded-xl mb-3 shadow-card" />
          <h1 className="text-xl font-medium text-gray-800">Set a new password</h1>
        </div>

        {done ? (
          <p className="text-sm text-google-green text-center">Password updated. Redirecting to sign in…</p>
        ) : (
          <>
            {error && <p className="text-google-red text-sm mb-3 text-center">{error}</p>}
            <input
              type="password" required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 mb-3 text-sm focus:outline-none focus:ring-2 focus:ring-google-blue"
              placeholder="New password (min 8 characters)" value={password} onChange={(e) => setPassword(e.target.value)}
            />
            <input
              type="password" required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 mb-4 text-sm focus:outline-none focus:ring-2 focus:ring-google-blue"
              placeholder="Confirm new password" value={confirm} onChange={(e) => setConfirm(e.target.value)}
            />
            <button disabled={loading} className="w-full bg-google-blue text-white font-medium py-2 rounded-full shadow-card hover:bg-blue-700 transition disabled:opacity-60 flex items-center justify-center gap-2">
              {loading && <Spinner />}
              {loading ? 'Saving…' : 'Reset password'}
            </button>
          </>
        )}
      </form>
    </div>
  );
}
