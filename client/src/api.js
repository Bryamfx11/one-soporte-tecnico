import { useEffect, useState } from 'react';

const BASE = '/api';
const TOKEN_KEY = 'one_soporte_token';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export function getUser() {
  try {
    return JSON.parse(localStorage.getItem('one_soporte_user') ?? 'null');
  } catch {
    return null;
  }
}

export function setUser(user) {
  if (user) localStorage.setItem('one_soporte_user', JSON.stringify(user));
  else localStorage.removeItem('one_soporte_user');
}

async function request(path, options = {}) {
  const token = getToken();
  const res = await fetch(BASE + path, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    ...options
  });
  if (res.status === 401) {
    setToken(null);
    setUser(null);
    window.location.assign('/login');
    throw new Error('Sesión expirada. Inicie sesión nuevamente.');
  }
  if (!res.ok) {
    let msg = `Error ${res.status}`;
    try {
      const data = await res.json();
      msg = Array.isArray(data.details) && data.details.length ? `${data.error}: ${data.details.join(', ')}` : (data.error ?? msg);
    } catch {}
    throw new Error(msg);
  }
  return res.json();
}

export const api = {
  get: (p) => request(p),
  post: (p, body) => request(p, { method: 'POST', body: JSON.stringify(body) }),
  patch: (p, body) => request(p, { method: 'PATCH', body: JSON.stringify(body) }),
  del: (p) => request(p, { method: 'DELETE' })
};

export function useApi(fn, deps = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    fn()
      .then((d) => { if (active) setData(d); })
      .catch((e) => { if (active) setError(e.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  const reload = () => {
    setLoading(true);
    setError(null);
    return fn()
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  return { data, loading, error, reload, setData };
}