const DEFAULT_API_BASE = 'http://127.0.0.1:3000';

/**
 * API origin for fetch calls. Defaults to the backend on port 3000 (CORS enabled).
 * Override with VITE_API_BASE_URL (no trailing slash), e.g. empty string to use
 * Vite's `/api` proxy only.
 */
export function getApiBaseUrl() {
  const fromEnv = import.meta.env?.VITE_API_BASE_URL;

  if (typeof fromEnv === 'string') {
    const trimmed = fromEnv.trim();
    if (trimmed === '') {
      return '';
    }
    return trimmed.replace(/\/$/, '');
  }

  return DEFAULT_API_BASE;
}

export function apiUrl(path) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const base = getApiBaseUrl();

  if (!base) {
    return normalizedPath;
  }

  return `${base}${normalizedPath}`;
}
