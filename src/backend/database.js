const path = require('path');
const db = require('./db/connection');

function resolveDatabasePath() {
  return (
    process.env.SQLITE_DB_PATH ||
    path.resolve(process.cwd(), 'data', 'escooter.db')
  );
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

      resolve({
        lastID: this.lastID,
        changes: this.changes,
      });
    });
  });
}

async function findUserByEmail(email) {
  return dbGet(
    `
      SELECT id, full_name, email, password_salt, password_hash, created_at
      FROM users
      WHERE email = ?;
    `,
    [email]
  );
}

async function createUser({ fullName, email, passwordSalt, passwordHash }) {
  const result = await dbRun(
    `
      INSERT INTO users (full_name, email, password_salt, password_hash)
      VALUES (?, ?, ?, ?);
    `,
    [fullName, email, passwordSalt, passwordHash]
  );

  return dbGet(
    `
      SELECT id, full_name, email, password_salt, password_hash, created_at
      FROM users
      WHERE id = ?;
    `,
    [result.lastID]
  );
}

module.exports = {
  createUser,
  findUserByEmail,
  resolveDatabasePath,
};
