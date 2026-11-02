import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api } from './api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('tc_user')) || null;
    } catch {
      return null;
    }
  });
  const [ready, setReady] = useState(false);

  // Re-validate the stored token on load
  useEffect(() => {
    const token = localStorage.getItem('tc_token');
    if (!token) return setReady(true);
    api
      .get('/auth/me')
      .then(({ data }) => {
        setUser(data);
        localStorage.setItem('tc_user', JSON.stringify(data));
      })
      .catch(() => setUser(null))
      .finally(() => setReady(true));
  }, []);

  const login = useCallback(async (phone, password) => {
    const { data } = await api.post('/auth/login', { phone, password });
    localStorage.setItem('tc_token', data.token);
    localStorage.setItem('tc_user', JSON.stringify(data.user));
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('tc_token');
    localStorage.removeItem('tc_user');
    setUser(null);
  }, []);

  return <AuthContext.Provider value={{ user, ready, login, logout }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);

// Where each role lands after login
export const homeFor = (role) => (role === 'admin' ? '/admin' : role === 'teacher' ? '/teacher' : '/parent');
