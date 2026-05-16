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

function dbAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (error, rows) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(rows || []);
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

async function updateUserAccountType(userId, userType) {
  await dbRun(
    `
      UPDATE users
      SET user_type = ?
      WHERE id = ?;
    `,
    [userType, userId]
  );

  return findUserById(userId);
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

async function createIssue({
  userId,
  scooterId,
  description,
  priority = 'low',
  status = 'open',
}) {
  const result = await dbRun(
    `
      INSERT INTO issues (user_id, scooter_id, description, priority, status)
      VALUES (?, ?, ?, ?, ?);
    `,
    [userId, scooterId, description, priority, status]
  );

  return dbGet(
    `
      SELECT id, user_id, scooter_id, description, priority, status, created_at, updated_at
      FROM issues
      WHERE id = ?;
    `,
    [result.lastID]
  );
}

async function findIssueById(id) {
  return dbGet(
    `
      SELECT id, user_id, scooter_id, description, priority, status, created_at, updated_at
      FROM issues
      WHERE id = ?;
    `,
    [id]
  );
}

async function getIssues(filters = {}) {
  const whereClauses = [];
  const params = [];

  if (filters?.userId != null) {
    whereClauses.push('user_id = ?');
    params.push(filters.userId);
  }

  if (filters?.scooterId != null) {
    whereClauses.push('scooter_id = ?');
    params.push(filters.scooterId);
  }

  if (filters?.priority != null) {
    whereClauses.push('priority = ?');
    params.push(filters.priority);
  }

  if (filters?.status != null) {
    whereClauses.push('status = ?');
    params.push(filters.status);
  }

  const whereSql =
    whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  return dbAll(
    `
      SELECT id, user_id, scooter_id, description, priority, status, created_at, updated_at
      FROM issues
      ${whereSql}
      ORDER BY created_at DESC, id DESC;
    `,
    params
  );
}

async function updateIssue(id, updates = {}) {
  const setClauses = [];
  const params = [];

  if (updates?.description != null) {
    setClauses.push('description = ?');
    params.push(updates.description);
  }

  if (updates?.priority != null) {
    setClauses.push('priority = ?');
    params.push(updates.priority);
  }

  if (updates?.status != null) {
    setClauses.push('status = ?');
    params.push(updates.status);
  }

  if (setClauses.length === 0) {
    return dbGet(
      `
        SELECT id, user_id, scooter_id, description, priority, status, created_at, updated_at
        FROM issues
        WHERE id = ?;
      `,
      [id]
    );
  }

  setClauses.push('updated_at = CURRENT_TIMESTAMP');
  params.push(id);

  await dbRun(
    `
      UPDATE issues
      SET ${setClauses.join(', ')}
      WHERE id = ?;
    `,
    params
  );

  return dbGet(
    `
      SELECT id, user_id, scooter_id, description, priority, status, created_at, updated_at
      FROM issues
      WHERE id = ?;
    `,
    [id]
  );
}

module.exports = {
  AsyncMutex,
  createIssue,
  createUser,
  findIssueById,
  findUserByEmail,
  findUserById,
  getIssues,
  resolveDatabasePath,
  transactionMutex,
  updateIssue,
  updateUserAccountType,
};
