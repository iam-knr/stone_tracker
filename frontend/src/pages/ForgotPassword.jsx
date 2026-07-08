import { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api.js';
import Spinner from '../components/Spinner.jsx';

export default function ForgotPassword() {
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { username });
    } finally {
      setLoading(false);
      setSent(true);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-google-grey px-4">
      <div className="animate-fade-in bg-white rounded-2xl shadow-card p-8 w-full max-w-sm">
        <div className="flex flex-col items-center mb-6">
          <img src="/logo.png" alt="Stone Tracker" className="w-16 h-16 rounded-xl mb-3 shadow-card" />
          <h1 className="text-xl font-medium text-gray-800">Forgot password</h1>
          <p className="text-sm text-gray-500 text-center mt-1">Enter your username or email and we'll email you a reset link, if your account has an email on file.</p>
        </div>

        {sent ? (
          <p className="text-sm text-gray-600 text-center">
            If an account with that username or email exists and has an email on file, a reset link has been sent. Check your inbox.
          </p>
        ) : (
          <form onSubmit={handleSubmit}>
            <input
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 mb-4 text-sm focus:outline-none focus:ring-2 focus:ring-google-blue"
              placeholder="Username or email" value={username} onChange={(e) => setUsername(e.target.value)}
            />
            <button disabled={loading} className="w-full bg-google-blue text-white font-medium py-2 rounded-full shadow-card hover:bg-blue-700 transition disabled:opacity-60 flex items-center justify-center gap-2">
              {loading && <Spinner />}
              {loading ? 'Sending…' : 'Send reset link'}
            </button>
          </form>
        )}

        <p className="text-xs text-gray-400 text-center mt-4">
          <Link to="/login" className="text-google-blue hover:underline">Back to sign in</Link>
        </p>
      </div>
    </div>
  );
}
