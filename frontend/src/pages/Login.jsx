import { useState } from 'react';
import api from '../api.js';
import { useNavigate, Link } from 'react-router-dom';
import Spinner from '../components/Spinner.jsx';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleLogin(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', { username, password });
      localStorage.setItem('st_token', data.token);
      localStorage.setItem('st_role', data.role);
      localStorage.setItem('st_username', data.username);
      navigate('/');
    } catch {
      setError('Invalid username or password. Contact your admin if you forgot your password.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-google-grey px-4">
      <form onSubmit={handleLogin} className="animate-fade-in bg-white rounded-2xl shadow-card p-8 w-full max-w-sm">
        <div className="flex flex-col items-center mb-6">
          <img src="/logo.png" alt="Stone Tracker" className="w-16 h-16 rounded-xl mb-3 shadow-card" />
          <h1 className="text-xl font-medium text-gray-800">Stone Tracker</h1>
          <p className="text-sm text-gray-500">Sign in to continue</p>
        </div>
        {error && <p className="text-google-red text-sm mb-3 text-center">{error}</p>}
        <input
          className="w-full border border-gray-300 rounded-lg px-3 py-2 mb-3 text-sm focus:outline-none focus:ring-2 focus:ring-google-blue"
          placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)}
        />
        <input
          type="password"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 mb-4 text-sm focus:outline-none focus:ring-2 focus:ring-google-blue"
          placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)}
        />
        <button disabled={loading} className="w-full bg-google-blue text-white font-medium py-2 rounded-full shadow-card hover:bg-blue-700 transition disabled:opacity-60 flex items-center justify-center gap-2">
          {loading && <Spinner />}
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
        <p className="text-xs text-gray-400 text-center mt-4">
          <Link to="/forgot-password" className="text-google-blue hover:underline">Forgot password?</Link>
        </p>
      </form>
    </div>
  );
}
