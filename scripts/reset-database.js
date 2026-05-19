#!/usr/bin/env node
/**
 * Full database reset: backup, delete escooter.db, recreate schema + seed + admin.
 *
 * Stops requiring manual migration runs — seed.sql includes 13 scooters and walk-in user.
 *
 * Usage (stop the backend first to avoid SQLITE_BUSY):
 *   npm run db:reset
 *   DB_PATH=data/escooter.db npm run db:reset
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const projectRoot = path.resolve(__dirname, '..');
const dbPath = path.resolve(
  process.env.DB_PATH || path.join(projectRoot, 'data', 'escooter.db')
);

function main() {
  const dataDir = path.dirname(dbPath);

  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  if (fs.existsSync(dbPath)) {
    const backupPath = dbPath.replace(
      /(\.db)$/,
      `.backup-reset-${Date.now()}.db`
    );
    console.log(`Backing up existing database to:\n  ${backupPath}`);
    fs.copyFileSync(dbPath, backupPath);
    fs.unlinkSync(dbPath);
    console.log('Removed old database file.');
  } else {
    console.log('No existing database file; creating a new one.');
  }

  console.log('\nRunning npm run db:init …\n');
  const result = spawnSync('npm', ['run', 'db:init'], {
    cwd: projectRoot,
    stdio: 'inherit',
    env: { ...process.env, DB_PATH: dbPath },
  });

  if (result.status !== 0) {
    console.error('\nDatabase reset failed during db:init.');
    process.exit(result.status || 1);
  }

  console.log('\nDatabase reset complete.');
  console.log(`  Path:    ${dbPath}`);
  console.log('  Fleet:   13 scooters (ESC-001 … ESC-013) from seed.sql');
  console.log(
    '  Users:   cleared — default admin + walk-in placeholder re-created by db:init'
  );
  console.log(
    '  Admin:   admin@escooter.local / AdminPass123! (unless ADMIN_* env overrides)'
  );
  console.log(
    '\nRestart the backend, then register new customer accounts in the app.'
  );
}

main();
