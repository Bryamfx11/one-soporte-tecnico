import { useCallback, useEffect, useRef, useState } from 'react';

const BASE = '/api';
const TOKEN_KEY = 'one_soporte_token';
const USER_KEY = 'one_soporte_user';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export function getUser() {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) ?? 'null');
  } catch {
    return null;
  }
}

export function setUser(user) {
  if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
  else localStorage.removeItem(USER_KEY);
}

async function request(path, options = {}) {
  const token = getToken();
  const headers = {
    ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
  const res = await fetch(BASE + path, { headers, ...options });
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
  const mountedRef = useRef(true);

  const run = useCallback(() => {
    if (!mountedRef.current) return Promise.resolve(data);
    setLoading(true);
    setError(null);
    return fn()
      .then((d) => { if (mountedRef.current) setData(d); })
      .catch((e) => { if (mountedRef.current) setError(e.message); })
      .finally(() => { if (mountedRef.current) setLoading(false); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    mountedRef.current = true;
    run();
    return () => { mountedRef.current = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, loading, error, reload: run, setData };
}