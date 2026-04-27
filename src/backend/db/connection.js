const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const defaultDbPath = path.resolve(process.cwd(), 'data', 'escooter.db');
const dbPath = process.env.SQLITE_DB_PATH || defaultDbPath;

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Failed to connect to SQLite database:', err);
    return;
  }

  db.run('PRAGMA foreign_keys = ON;', (pragmaError) => {
    if (pragmaError) {
      console.error(
        'Failed to enable SQLite foreign key enforcement (PRAGMA foreign_keys = ON):',
        pragmaError
      );
      throw pragmaError;
    }
  });
});

module.exports = db;
