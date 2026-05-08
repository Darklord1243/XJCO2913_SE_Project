/**
 * Integration test scaffolding (Phase A3).
 *
 * Why this file exists:
 *   - Tests must NOT touch the real on-disk SQLite database.
 *   - Tests must NOT bind a network port (no app.listen()).
 *   - Tests need a deterministic way to mint admin/staff/rider sessions
 *     so route-level RBAC contracts can be exercised end-to-end.
 *
 * Critical ordering invariant:
 *   `src/backend/db/connection.js` reads `process.env.DB_PATH` at module
 *   load time (singleton). `src/backend/app.js` constructs routes which
 *   transitively require that connection. Therefore we MUST set
 *   `DB_PATH` BEFORE this module's first `require('../../src/backend/app')`.
 *
 *   We default `DB_PATH` to `:memory:` at this helper's load time. A test
 *   that wants something else (e.g. a temp file) can set `DB_PATH`
 *   explicitly before importing this helper.
 *
 * Note on isolation:
 *   `node --test` runs each *.test.js file in its own child process, so
 *   the sqlite3 in-memory DB is naturally isolated per test file. Within
 *   a single test file, callers should treat the DB as shared across
 *   `createTestApp()` calls.
 */

const fs = require('node:fs');
const path = require('node:path');

if (!process.env.DB_PATH || process.env.DB_PATH.trim() === '') {
  process.env.DB_PATH = ':memory:';
}

const SCHEMA_PATH = path.resolve(
  __dirname,
  '..',
  '..',
  'database',
  'schema.sql'
);
const SEED_PATH = path.resolve(__dirname, '..', '..', 'database', 'seed.sql');

function execSql(db, sql) {
  return new Promise((resolve, reject) => {
    db.exec(sql, (error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

function dbRun(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(error) {
      if (error) {
        reject(error);
        return;
      }

      resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function dbGet(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (error, row) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(row || null);
    });
  });
}

/**
 * Build a fresh test app bound to an isolated SQLite database.
 *
 * Behavior:
 *   - Loads the Express app (no `listen()` is called).
 *   - Applies `database/schema.sql` (idempotent: uses CREATE TABLE IF NOT EXISTS).
 *   - Optionally applies `database/seed.sql` (idempotent: uses INSERT OR IGNORE).
 *
 * Returns: { app, db }
 *   - `app`: the Express application instance, ready for HTTP-level testing.
 *   - `db`: the underlying sqlite3 connection (singleton), exposed so tests can
 *     seed users/scooters/etc. directly without going through HTTP.
 */
async function createTestApp({ seed = true } = {}) {
  let app;
  let db;

  try {
    // Defensive: re-assert DB_PATH so a misconfigured caller cannot
    // accidentally land on the real on-disk database mid-suite.
    if (!process.env.DB_PATH || process.env.DB_PATH.trim() === '') {
      process.env.DB_PATH = ':memory:';
    }

    ({ app } = require('../../src/backend/app'));
    db = require('../../src/backend/db/connection');
  } catch (error) {
    console.error('createTestApp: failed to load app/db modules:', error);
    throw error;
  }

  try {
    const schemaSql = fs.readFileSync(SCHEMA_PATH, 'utf8');
    await execSql(db, schemaSql);
  } catch (error) {
    console.error('createTestApp: failed to apply schema.sql:', error);
    throw error;
  }

  if (seed) {
    try {
      const seedSql = fs.readFileSync(SEED_PATH, 'utf8');
      await execSql(db, seedSql);
    } catch (error) {
      console.error('createTestApp: failed to apply seed.sql:', error);
      throw error;
    }
  }

  return { app, db };
}

/**
 * Insert a user with a hashed password using the same hashing primitive the
 * production auth path uses, so `mintToken(seededUser)` produces a session
 * the live auth middleware will accept.
 *
 * Returns the inserted user row (snake_case columns), suitable for passing
 * directly into `mintToken`.
 */
async function seedUser(
  db,
  { email, fullName, password, userType = 'standard' } = {}
) {
  if (!db) {
    throw new Error('seedUser: db connection is required.');
  }
  if (!email || typeof email !== 'string') {
    throw new Error('seedUser: email is required and must be a string.');
  }
  if (!fullName || typeof fullName !== 'string') {
    throw new Error('seedUser: fullName is required and must be a string.');
  }
  if (!password || typeof password !== 'string') {
    throw new Error('seedUser: password is required and must be a string.');
  }

  // Lazy-require so this module stays cheap to import and so we never
  // reach into the production auth-service before DB_PATH is set.
  const { hashPassword } = require('../../src/backend/auth-service');

  const normalizedEmail = email.trim().toLowerCase();
  const { passwordHash, passwordSalt } = hashPassword(password);

  try {
    const insertResult = await dbRun(
      db,
      `
        INSERT INTO users (full_name, email, user_type, password_salt, password_hash)
        VALUES (?, ?, ?, ?, ?);
      `,
      [fullName, normalizedEmail, userType, passwordSalt, passwordHash]
    );

    return dbGet(
      db,
      `
        SELECT id, full_name, email, user_type, password_salt, password_hash, created_at
        FROM users
        WHERE id = ?;
      `,
      [insertResult.lastID]
    );
  } catch (error) {
    console.error(
      'seedUser: failed to insert user',
      { email: normalizedEmail },
      error
    );
    throw error;
  }
}

/**
 * Wraps `auth-service.createSessionToken`. Accepts a raw users row
 * (snake_case columns) or anything shaped like { id, email, user_type }.
 */
function mintToken(user) {
  if (!user || typeof user !== 'object') {
    throw new Error('mintToken: user is required.');
  }

  const { createSessionToken } = require('../../src/backend/auth-service');
  return createSessionToken(user);
}

/**
 * Helper to build a Bearer Authorization header for `fetch`/supertest-style
 * callers. Returns { Authorization: 'Bearer <token>' }.
 */
function authHeader(token) {
  if (!token || typeof token !== 'string') {
    throw new Error('authHeader: token must be a non-empty string.');
  }

  return { Authorization: `Bearer ${token}` };
}

/**
 * Closes the SQLite handle so the Node process can exit cleanly after a
 * test suite completes. Safe to call when `db` is missing.
 */
function closeApp({ db } = {}) {
  return new Promise((resolve, reject) => {
    if (!db) {
      resolve();
      return;
    }

    db.close((error) => {
      if (error) {
        console.error('closeApp: failed to close SQLite connection:', error);
        reject(error);
        return;
      }

      resolve();
    });
  });
}

module.exports = {
  authHeader,
  closeApp,
  createTestApp,
  mintToken,
  seedUser,
};
