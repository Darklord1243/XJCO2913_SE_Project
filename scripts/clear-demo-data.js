/**
 * clear-demo-data.js — Option B: Wipe transactional data, keep users & scooters.
 *
 * Usage:
 *   node scripts/clear-demo-data.js
 *   DB_PATH=/tmp/other.db node scripts/clear-demo-data.js
 *
 * Before running: STOP the Node backend to avoid SQLITE_BUSY.
 */

const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();

// ── Database path (same logic as src/backend/db/connection.js) ──────────────
const dbPath = path.resolve(
  process.env.DB_PATH || path.join(process.cwd(), 'data', 'escooter.db')
);

// ── 1. Timestamped backup ───────────────────────────────────────────────────
const ts = Date.now();
const backupPath = dbPath.replace(/(\.db)$/, `.pre-option-b-${ts}.db`);
console.log(`[1/5] Creating backup: ${backupPath}`);
try {
  fs.copyFileSync(dbPath, backupPath);
  console.log('       Backup created.');
} catch (err) {
  console.error('       FAILED to create backup:', err.message);
  process.exit(1);
}

// ── 2. Open DB and enable FKs ───────────────────────────────────────────────
console.log(`[2/5] Opening database: ${dbPath}`);
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('       Failed to open database:', err.message);
    process.exit(1);
  }
});

db.serialize(() => {
  db.run('PRAGMA foreign_keys = ON;');

  // ── 3. Cleanup in a single transaction ────────────────────────────────────
  console.log(
    '[3/5] Clearing transactional data inside a single transaction...'
  );

  db.run('BEGIN TRANSACTION;', (err) => {
    if (err) return rollbackAndExit(db, err);

    db.run('DELETE FROM bookings;', (err) => {
      if (err) return rollbackAndExit(db, err);
      console.log('       Deleted all bookings.');

      db.run('DELETE FROM issues;', (err) => {
        if (err) return rollbackAndExit(db, err);
        console.log('       Deleted all issues.');

        // Reset in_use → available (bookings were the source of "in use")
        db.run(
          "UPDATE scooters SET status = 'available', updated_at = CURRENT_TIMESTAMP WHERE status = 'in_use';",
          function (err) {
            if (err) return rollbackAndExit(db, err);
            console.log(
              `       Reset ${this.changes} scooter(s) from 'in_use' to 'available'.`
            );

            db.run('COMMIT;', (err) => {
              if (err) return rollbackAndExit(db, err);
              console.log('       Transaction committed.');

              // ── 4. Verify ────────────────────────────────────────────────
              runVerification(db);
            });
          }
        );
      });
    });
  });
});

// ── Helpers ─────────────────────────────────────────────────────────────────
function rollbackAndExit(db, err) {
  console.error('       ERROR:', err.message);
  db.run('ROLLBACK;', () => {
    console.error('       Transaction rolled back. Database is unchanged.');
    db.close(() => process.exit(1));
  });
}

function runVerification(db) {
  console.log('[4/5] Running verification queries...');

  const queries = [
    ['users', 'SELECT COUNT(*) AS count FROM users;'],
    ['scooters (total)', 'SELECT COUNT(*) AS count FROM scooters;'],
    [
      'scooters by status',
      'SELECT status, COUNT(*) AS count FROM scooters GROUP BY status ORDER BY status;',
    ],
    [
      'scooters still in_use',
      "SELECT COUNT(*) AS count FROM scooters WHERE status = 'in_use';",
    ],
    ['bookings', 'SELECT COUNT(*) AS count FROM bookings;'],
    ['issues', 'SELECT COUNT(*) AS count FROM issues;'],
  ];

  let pending = queries.length;

  queries.forEach(([label, sql]) => {
    db.all(sql, [], (err, rows) => {
      if (err) {
        console.error(`       ${label}: ERROR — ${err.message}`);
      } else if (rows.length === 1 && rows[0].count !== undefined) {
        console.log(`       ${label}: ${rows[0].count}`);
      } else {
        console.log(`       ${label}:`);
        rows.forEach((r) => console.log(`         ${r.status}: ${r.count}`));
      }

      pending--;
      if (pending === 0) finish(db);
    });
  });
}

function finish(db) {
  console.log('[5/5] Done.');
  db.close((err) => {
    if (err) console.error('       Error closing database:', err.message);
    else console.log('       Database connection closed.');

    console.log('');
    console.log('──────────────────────────────────────────────');
    console.log('  Restart instructions');
    console.log('──────────────────────────────────────────────');
    console.log('');
    console.log('  1. Start the backend:');
    console.log('     node src/backend/server.js');
    console.log('');
    console.log('  2. Smoke test — public scooter list:');
    console.log('     curl -s http://127.0.0.1:3000/api/scooters | head -c 200');
    console.log('');
    console.log(
      `  3. Restore backup if needed: cp ${backupPath} ${dbPath}`
    );
    console.log('');
  });
}
