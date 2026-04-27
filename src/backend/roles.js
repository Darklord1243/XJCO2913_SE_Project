/**
 * Canonical role model + permission matrix for the platform.
 *
 * Roles:
 * - standard / student / senior: regular customer accounts. Differ only in
 *   pricing eligibility (student/senior get the discounted plan).
 * - staff: operational role limited to issue triage/resolution.
 * - admin: superset administrator role. Has every staff permission plus
 *   visibility into income analytics, fleet management, and bookings
 *   oversight.
 *
 * Self-registration is intentionally restricted to regular customer roles.
 * Staff and admin accounts are provisioned via the database init script
 * (or a future privileged endpoint), never the public /api/auth/register
 * route. This prevents privilege escalation through ordinary signup.
 */

const REGULAR_USER_TYPES = new Set(['standard', 'student', 'senior']);
const PRIVILEGED_USER_TYPES = new Set(['staff', 'admin']);
const ALL_USER_TYPES = new Set([
  ...REGULAR_USER_TYPES,
  ...PRIVILEGED_USER_TYPES,
]);
const SELF_REGISTRABLE_USER_TYPES = new Set(REGULAR_USER_TYPES);

function getUserType(user) {
  if (!user || typeof user !== 'object') {
    return null;
  }

  const candidate = user.user_type ?? user.userType;
  return typeof candidate === 'string' ? candidate : null;
}

/**
 * `admin` is the only role with administrator-tier access (income, fleet
 * management, bookings oversight, etc.).
 */
function isAdmin(user) {
  return getUserType(user) === 'admin';
}

/**
 * Staff-tier access: any account permitted to operate issue triage or
 * other operator-level workflows. Admins are a superset of staff so they
 * implicitly satisfy this check.
 */
function hasStaffAccess(user) {
  const type = getUserType(user);
  return type === 'admin' || type === 'staff';
}

/**
 * Defensive normalization for any user_type string we receive from
 * downstream stores (database row, decoded session token, etc.). Returns
 * `'standard'` when the value is missing or not in the allowed set so we
 * never grant unintended privileges.
 */
function normalizeUserType(value) {
  return ALL_USER_TYPES.has(value) ? value : 'standard';
}

function isSelfRegistrableUserType(value) {
  return SELF_REGISTRABLE_USER_TYPES.has(value);
}

module.exports = {
  ALL_USER_TYPES,
  PRIVILEGED_USER_TYPES,
  REGULAR_USER_TYPES,
  SELF_REGISTRABLE_USER_TYPES,
  hasStaffAccess,
  isAdmin,
  isSelfRegistrableUserType,
  normalizeUserType,
};
