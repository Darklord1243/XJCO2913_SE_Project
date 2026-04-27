const fs = require('fs');
const path = require('path');
const db = require('./connection');
const { hashPassword } = require('../auth-service');

const DEFAULT_ADMIN_EMAIL = 'admin@escooter.local';
const DEFAULT_ADMIN_NAME = 'Platform Administrator';
const DEFAULT_ADMIN_PASSWORD = 'AdminPass123!';

function readSqlFile(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    console.error(`Failed to read SQL file: ${filePath}`, error);
    throw error;
  }
}

function execSql(sql) {
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

function dbGet(sql, params = []) {
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

function dbRun(sql, params = []) {
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

function closeDb() {
  return new Promise((resolve, reject) => {
    db.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

/**
 * Bootstrap an administrator account when none is present. We only insert
 * once: subsequent runs leave any existing admin (and password) untouched
 * so credentials cannot be silently reset by reseeding.
 */
async function ensureDefaultAdmin() {
  try {
    const adminEmail = (process.env.ADMIN_EMAIL || DEFAULT_ADMIN_EMAIL)
      .trim()
      .toLowerCase();
    const adminName = process.env.ADMIN_NAME || DEFAULT_ADMIN_NAME;
    const adminPassword = process.env.ADMIN_PASSWORD || DEFAULT_ADMIN_PASSWORD;

    const existing = await dbGet(
      'SELECT id, user_type FROM users WHERE user_type = ? OR email = ? LIMIT 1;',
      ['admin', adminEmail]
    );

    if (existing) {
      console.log('Admin account already exists; skipping bootstrap.');
      return;
    }

    const { passwordHash, passwordSalt } = hashPassword(adminPassword);

    await dbRun(
      `
        INSERT INTO users (full_name, email, user_type, password_salt, password_hash)
        VALUES (?, ?, 'admin', ?, ?);
      `,
      [adminName, adminEmail, passwordSalt, passwordHash]
    );

    console.log('Bootstrapped default administrator account.');
    console.log(`  email:    ${adminEmail}`);
    console.log(`  password: ${adminPassword}`);
    console.log(
      'Override these defaults via ADMIN_EMAIL / ADMIN_NAME / ADMIN_PASSWORD env vars.'
    );
  } catch (error) {
    console.error('Failed to bootstrap admin account:', error);
    throw error;
  }
}

async function initDatabase() {
  const projectRoot = path.resolve(__dirname, '../../../');
  const dataDir = path.join(projectRoot, 'data');
  const schemaPath = path.join(projectRoot, 'database', 'schema.sql');
  const seedPath = path.join(projectRoot, 'database', 'seed.sql');

  try {
    fs.mkdirSync(dataDir, { recursive: true });

    const schemaSql = readSqlFile(schemaPath);
    const seedSql = readSqlFile(seedPath);

    await execSql(schemaSql);
    console.log('Database schema created successfully.');

    await execSql(seedSql);
    console.log('Database seed data inserted successfully.');

    await ensureDefaultAdmin();
    console.log('Database tables created and seeded successfully.');
  } catch (error) {
    console.error('Database initialization failed:', error);
    process.exitCode = 1;
  } finally {
    try {
      await closeDb();
    } catch (closeError) {
      console.error('Failed to close SQLite connection:', closeError);
      process.exitCode = 1;
    }
  }
}

initDatabase();
