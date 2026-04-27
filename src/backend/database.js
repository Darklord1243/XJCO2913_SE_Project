const path = require('path');
const db = require('./db/connection');

class AsyncMutex {
  constructor() {
    this._locked = false;
    this._queue = [];
  }

  acquire() {
    return new Promise((resolve) => {
      const release = () => {
        const nextResolver = this._queue.shift();

        if (nextResolver) {
          nextResolver(release);
          return;
        }

        this._locked = false;
      };

      if (this._locked) {
        this._queue.push(resolve);
        return;
      }

      this._locked = true;
      resolve(release);
    });
  }

  async runExclusive(work) {
    const release = await this.acquire();

    try {
      return await work();
    } catch (error) {
      console.error('AsyncMutex protected operation failed:', error);
      throw error;
    } finally {
      release();
    }
  }
}

const transactionMutex = new AsyncMutex();

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
      SELECT id, full_name, email, user_type, password_salt, password_hash, created_at
      FROM users
      WHERE email = ?;
    `,
    [email]
  );
}

async function findUserById(id) {
  return dbGet(
    `
      SELECT id, full_name, email, user_type, password_salt, password_hash, created_at
      FROM users
      WHERE id = ?;
    `,
    [id]
  );
}

async function createUser({
  fullName,
  email,
  userType = 'standard',
  passwordSalt,
  passwordHash,
}) {
  const result = await dbRun(
    `
      INSERT INTO users (full_name, email, user_type, password_salt, password_hash)
      VALUES (?, ?, ?, ?, ?);
    `,
    [fullName, email, userType, passwordSalt, passwordHash]
  );

  return dbGet(
    `
      SELECT id, full_name, email, user_type, password_salt, password_hash, created_at
      FROM users
      WHERE id = ?;
    `,
    [result.lastID]
  );
}

module.exports = {
  AsyncMutex,
  createUser,
  findUserByEmail,
  findUserById,
  resolveDatabasePath,
  transactionMutex,
};
