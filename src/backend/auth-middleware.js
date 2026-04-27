const { parseSessionToken } = require('./auth-service');
const { findUserById } = require('./database');
const { hasStaffAccess, isAdmin } = require('./roles');

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function extractSessionToken(authorizationHeader) {
  const normalizedHeader = normalizeText(authorizationHeader);

  if (!normalizedHeader) {
    return '';
  }

  const bearerMatch = normalizedHeader.match(/^Bearer\s+(.+)$/i);
  return bearerMatch ? bearerMatch[1].trim() : normalizedHeader;
}

/**
 * Resolve the request's authenticated user from the Authorization header.
 * Writes a 401 response (and returns null) when the request is unauthenticated
 * or the token cannot be matched to a real user. The caller MUST check the
 * return value and abort if it is null.
 */
async function authenticateRequest(req, res) {
  const authorizationHeader = req.get('authorization');

  if (!authorizationHeader) {
    res.status(401).json({
      success: false,
      error: 'Authorization header is required.',
    });
    return null;
  }

  const session = parseSessionToken(extractSessionToken(authorizationHeader));

  if (!session) {
    res.status(401).json({
      success: false,
      error: 'Invalid session token.',
    });
    return null;
  }

  try {
    const user = await findUserById(session.userId);

    if (!user) {
      res.status(401).json({
        success: false,
        error: 'Invalid session token.',
      });
      return null;
    }

    return user;
  } catch (error) {
    console.error('authenticateRequest: failed to load user', error);
    res.status(500).json({
      success: false,
      error: 'Failed to verify session.',
    });
    return null;
  }
}

/**
 * Returns true and lets the caller proceed; otherwise writes 403 and returns
 * false. Use this on routes that should be administrator-only.
 */
function requireAdmin(res, user) {
  if (!isAdmin(user)) {
    res.status(403).json({
      success: false,
      error: 'Administrator access required.',
    });
    return false;
  }

  return true;
}

/**
 * Staff-tier gate: allows both `staff` and `admin` users (admins are a
 * superset of staff). Mirrors `requireAdmin` semantics.
 */
function requireStaff(res, user) {
  if (!hasStaffAccess(user)) {
    res.status(403).json({
      success: false,
      error: 'Staff access required.',
    });
    return false;
  }

  return true;
}

module.exports = {
  authenticateRequest,
  extractSessionToken,
  requireAdmin,
  requireStaff,
};
