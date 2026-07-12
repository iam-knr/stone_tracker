import axios from 'axios';

// Separate axios instance for the Customer Portal. Uses its own token key
// (portal_token) so a portal session can never be confused with an internal
// staff session (st_token) - they are completely independent auth tracks.
const portalApi = axios.create({ baseURL: '/api' });

portalApi.interceptors.request.use((config) => {
  const token = localStorage.getItem('portal_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default portalApi;
