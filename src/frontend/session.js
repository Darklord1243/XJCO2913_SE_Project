const SESSION_STORAGE_KEY = 'escooter.session';

export function loadSession() {
  const rawValue = localStorage.getItem(SESSION_STORAGE_KEY);

  if (!rawValue) {
    return null;
  }

  try {
    return JSON.parse(rawValue);
  } catch (error) {
    console.error('Failed to parse saved session:', error);
    localStorage.removeItem(SESSION_STORAGE_KEY);
    return null;
  }
}

export function saveSession(session) {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
}

export function clearSession() {
  localStorage.removeItem(SESSION_STORAGE_KEY);
}

/** Bearer token for Authorization headers (defensive: trims, handles missing session). */
export function getSessionToken(session) {
  if (!session || typeof session.token !== 'string') {
    return '';
  }

  const trimmed = session.token.trim();
  return trimmed || '';
}
