import axios from 'axios';

// In production set VITE_API_URL to your Render URL, e.g. https://tuition-api.onrender.com/api
const baseURL = import.meta.env.VITE_API_URL || '/api';

export const api = axios.create({ baseURL, timeout: 20000 });

// Attach the JWT to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('tc_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Friendly error messages + auto logout on expired sessions
api.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err.response?.status;
    if (status === 401 && !err.config.url.includes('/auth/login')) {
      localStorage.removeItem('tc_token');
      localStorage.removeItem('tc_user');
      if (!location.pathname.startsWith('/login')) location.href = '/login';
    }
    err.message = err.response?.data?.message || (err.code === 'ECONNABORTED' ? 'The server is taking too long. Please retry.' : 'Network error. Check your connection.');
    return Promise.reject(err);
  }
);

// Helpers for formatting
export const money = (n = 0) => `₹${Number(n).toLocaleString('en-IN')}`;
export const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');
export const todayISO = () => new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10);
export const currentMonth = () => todayISO().slice(0, 7);
