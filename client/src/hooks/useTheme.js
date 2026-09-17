import { useEffect, useState } from 'react';

export const THEME_KEY = 'one_theme';

function temaGuardado() {
  try {
    return localStorage.getItem(THEME_KEY) === 'dark';
  } catch {
    return false;
  }
}

function aplicarTema(dark) {
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  try {
    localStorage.setItem(THEME_KEY, dark ? 'dark' : 'light');
  } catch {}
}

export function useTheme() {
  const [dark, setDark] = useState(temaGuardado);

  useEffect(() => {
    aplicarTema(dark);
  }, [dark]);

  return { dark, toggle: () => setDark((d) => !d) };
}