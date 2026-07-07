import axios from 'axios';

const api = axios.create({ baseURL: '/api' });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('st_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// If the token is missing/expired/invalid, the backend returns 401.
// Clear the stale session and bounce to login instead of leaving the
// user stuck on a broken page full of failed requests.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && window.location.pathname !== '/login') {
      localStorage.clear();
      window.location.assign('/login');
    }
    return Promise.reject(error);
  }
);

export default api;
