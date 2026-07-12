import { useState } from 'react';
import portalApi from '../../portalApi.js';

export default function PortalLogin() {
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!email.trim()) return;
    setSending(true);
    try {
      await portalApi.post('/portal/request-link', { email: email.trim() });
      setSent(true);
    } catch (err) {
      setSent(true);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-card p-8 w-full max-w-sm">
        <h1 className="text-xl font-semibold text-gray-900 mb-1">Client Portal</h1>
        <p className="text-sm text-gray-500 mb-6">Sign in with your email to view your projects, invoices, and quotes.</p>

        {sent ? (
          <div className="text-sm text-gray-600 bg-gray-50 rounded-lg p-4">
            If that email has portal access, a sign-in link has been sent. Check your inbox (it expires in 15 minutes).
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <label className="block text-xs text-gray-500 mb-1">Email address</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 mb-4 text-sm focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition"
            />
            <button
              type="submit"
              disabled={sending}
              className="w-full py-2 rounded-full bg-indigo-600 text-white font-medium btn-modern disabled:opacity-60"
            >
              {sending ? 'Sending link...' : 'Send sign-in link'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
