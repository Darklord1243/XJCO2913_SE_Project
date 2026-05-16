/**
 * Frontend mirror of the backend role model. Keep this file in sync with
 * `src/backend/roles.js`; the backend remains authoritative — these helpers
 * only decide which UI affordances to render.
 */

export function getSessionUserType(session) {
  const candidate = session?.user?.userType;
  return typeof candidate === 'string' ? candidate : null;
}

export function isAdminSession(session) {
  return getSessionUserType(session) === 'admin';
}

export function isStaffSession(session) {
  const userType = getSessionUserType(session);
  return userType === 'admin' || userType === 'staff';
}

export function getRoleLabel(session) {
  const userType = getSessionUserType(session);

  switch (userType) {
    case 'admin':
      return 'Administrator';
    case 'staff':
      return 'Staff';
    case 'student':
      return 'Student';
    case 'senior':
      return 'Senior';
    case 'standard':
      return 'Customer';
    case 'walkin':
      return 'Walk-in';
    default:
      return 'Guest';
  }
}
