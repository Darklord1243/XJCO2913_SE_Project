const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const defaultDbPath = path.resolve(process.cwd(), 'data', 'escooter.db');
const dbPath = process.env.SQLITE_DB_PATH || defaultDbPath;

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Failed to connect to SQLite database:', err);
  }
});

module.exports = db;
