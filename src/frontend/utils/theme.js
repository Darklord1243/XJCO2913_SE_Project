export const THEME_KEY = 'escooter.theme';

export function getInitialTheme() {
  try {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch (error) {
    console.warn(
      'theme: localStorage unavailable, falling back to system preference',
      error
    );
  }
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
  }
  return 'light';
}

export function applyTheme(theme) {
  if (theme !== 'light' && theme !== 'dark') return;
  try {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(THEME_KEY, theme);
  } catch (error) {
    console.warn('theme: could not persist theme', error);
  }
}
