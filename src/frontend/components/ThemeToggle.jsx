import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../hooks/useTheme';

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';
  const nextLabel = isDark ? 'Switch to light theme' : 'Switch to dark theme';

  function handleClick() {
    try {
      toggleTheme();
    } catch (error) {
      console.error('ThemeToggle: failed to toggle theme', error);
    }
  }

  return (
    <button
      type="button"
      className="nav__icon-btn"
      onClick={handleClick}
      aria-label={nextLabel}
      title={nextLabel}
    >
      {isDark ? (
        <Sun size={18} aria-hidden="true" />
      ) : (
        <Moon size={18} aria-hidden="true" />
      )}
    </button>
  );
}
