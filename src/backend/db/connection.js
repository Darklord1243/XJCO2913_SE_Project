const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const defaultDbPath = path.resolve(process.cwd(), 'data', 'escooter.db');
const dbPath = process.env.DB_PATH || defaultDbPath;

// Open the DB at module load (see init.js). Ensure the parent folder exists
// so a fresh clone works after `rm -rf data/`.
if (dbPath !== ':memory:') {
  const dbDir = path.dirname(path.resolve(dbPath));
  fs.mkdirSync(dbDir, { recursive: true });
}

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
