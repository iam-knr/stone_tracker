import { useState } from 'react';
import api from '../api.js';
import { useNavigate } from 'react-router-dom';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  async function handleLogin(e) {
    e.preventDefault();
    setError('');
    try {
      const { data } = await api.post('/auth/login', { username, password });
      localStorage.setItem('st_token', data.token);
      localStorage.setItem('st_role', data.role);
      localStorage.setItem('st_username', data.username);
      navigate('/');
    } catch {
      setError('Invalid username or password. Contact your admin if you forgot your password.');
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-google-grey px-4">
      <form onSubmit={handleLogin} className="bg-white rounded-2xl shadow-card p-8 w-full max-w-sm">
        <div className="flex flex-col items-center mb-6">
          <div className="w-14 h-14 rounded-full bg-google-blue flex items-center justify-center text-white text-2xl font-bold mb-3">S</div>
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
        <button className="w-full bg-google-blue text-white font-medium py-2 rounded-full shadow-card hover:bg-blue-700 transition">
          Sign in
        </button>
        <p className="text-xs text-gray-400 text-center mt-4">Forgot password? Only your admin can reset it.</p>
      </form>
    </div>
  );
}
