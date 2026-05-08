/**
 * Spin up an isolated in-memory SQLite + Express app for HTTP integration tests.
 *
 * IMPORTANT: Load this module before any backend code. Tests should call
 * setupTestApp() after forcing a fresh process.env.DB_PATH and clearing the
 * requirement cache via teardownTestApp().
 */

const path = require('path');
const fs = require('fs');

const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const BACKEND_MARKER = `${path.sep}src${path.sep}backend${path.sep}`;

let activeDb = null;

function clearBackendModuleCache() {
  for (const key of Object.keys(require.cache)) {
    if (key.includes(BACKEND_MARKER)) {
      delete require.cache[key];
    }
  }
}

function dbExec(db, sql) {
  return new Promise((resolve, reject) => {
    db.exec(sql, (err) => {
      if (err) {
        reject(err);
        return;
      }

      resolve();
    });
  });
}

async function setupTestApp() {
  await teardownTestApp();

  process.env.DB_PATH = ':memory:';
  clearBackendModuleCache();

  const schemaSql = fs.readFileSync(
    path.join(PROJECT_ROOT, 'database', 'schema.sql'),
    'utf8'
  );
  const seedSql = fs.readFileSync(
    path.join(PROJECT_ROOT, 'database', 'seed.sql'),
    'utf8'
  );

  const db = require(
    path.join(PROJECT_ROOT, 'src', 'backend', 'db', 'connection.js')
  );
  activeDb = db;

  await dbExec(db, schemaSql);
  await dbExec(db, seedSql);

  const { hashPassword, createSessionToken } = require(
    path.join(PROJECT_ROOT, 'src', 'backend', 'auth-service.js')
  );
  const { createUser } = require(
    path.join(PROJECT_ROOT, 'src', 'backend', 'database.js')
  );

  async function addUser(fullName, email, userType, plainPassword) {
    const { passwordHash, passwordSalt } = hashPassword(plainPassword);

    return createUser({
      fullName,
      email,
      userType,
      passwordHash,
      passwordSalt,
    });
  }

  const admin = await addUser(
    'Integration Admin',
    'admin@test.local',
    'admin',
    'AdminPass123!'
  );
  const rider = await addUser(
    'Integration Rider',
    'rider@test.local',
    'standard',
    'RiderPass123!'
  );
  const staff = await addUser(
    'Integration Staff',
    'staff@test.local',
    'staff',
    'StaffPass123!'
  );

  const { createApp } = require(
    path.join(PROJECT_ROOT, 'src', 'backend', 'app.js')
  );
  const app = createApp();

  const tokens = {
    admin: createSessionToken(admin),
    rider: createSessionToken(rider),
    staff: createSessionToken(staff),
  };

  return {
    app,
    db,
    tokens,
    users: { admin, rider, staff },
    createSessionToken,
  };
}

async function teardownTestApp() {
  if (activeDb) {
    await new Promise((resolve, reject) => {
      activeDb.close((err) => {
        if (err) {
          reject(err);
          return;
        }

        resolve();
      });
    });
    activeDb = null;
  }

  delete process.env.DB_PATH;
  clearBackendModuleCache();
}

function authHeader(token) {
  return { Authorization: `Bearer ${token}` };
}

/** Valid payment payload for POST /api/bookings (simulator accepts this card). */
const SAMPLE_PAYMENT = Object.freeze({
  cardholderName: 'Test Rider',
  cardNumber: '4242424242424242',
  expiryDate: '12/30',
  cvv: '123',
});

module.exports = {
  PROJECT_ROOT,
  SAMPLE_PAYMENT,
  authHeader,
  setupTestApp,
  teardownTestApp,
};
