import { useCallback, useEffect, useState } from 'react';
import { applyTheme, getInitialTheme } from '../utils/theme';

export function useTheme() {
  const [theme, setThemeState] = useState(() => getInitialTheme());

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const setTheme = useCallback((next) => {
    if (next !== 'light' && next !== 'dark') {
      console.warn('useTheme: invalid theme value', next);
      return;
    }
    setThemeState(next);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((current) => (current === 'dark' ? 'light' : 'dark'));
  }, []);

  return { theme, setTheme, toggleTheme };
}
