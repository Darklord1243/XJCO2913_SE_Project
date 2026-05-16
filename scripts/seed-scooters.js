#!/usr/bin/env node
/**
 * One-shot script: inspect current DB, back it up, insert 10 new scooters
 * with pricing in a single transaction, then verify.
 *
 * Usage: node scripts/seed-scooters.js
 */

const fs = require('fs');
const path = require('path');

const DB_PATH = path.resolve(process.cwd(), 'data', 'escooter.db');

// ── Backup ──────────────────────────────────────────────────────────────────
const backupPath = DB_PATH.replace('.db', `.backup-${Date.now()}.db`);
fs.copyFileSync(DB_PATH, backupPath);
console.log(`Backup created: ${backupPath}\n`);

// ── DB helper (must load AFTER backup so .backup file doesn't get locked) ──
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database(DB_PATH);

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve({ changes: this.changes, lastID: this.lastID });
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row ?? null);
    });
  });
}

// ── New scooter data (realistic Leeds-area coords) ──────────────────────────
const newScooters = [
  // id,         status,       lat,      lng,       description
  ['ESC-004', 'available', 53.821, -1.5765, 'Headingley Arndale Centre'],
  ['ESC-005', 'available', 53.8095, -1.56, 'Hyde Park Corner'],
  ['ESC-006', 'available', 53.807, -1.549, 'Woodhouse Lane Car Park'],
  ['ESC-007', 'in_use', 53.816, -1.602, 'Kirkstall Abbey Entrance'],
  ['ESC-008', 'available', 53.829, -1.564, 'Meanwood Park'],
  ['ESC-009', 'available', 53.787, -1.547, 'Holbeck Moor Road'],
  ['ESC-010', 'maintenance', 53.7985, -1.585, 'Armley Town Street'],
  ['ESC-011', 'available', 53.812, -1.58, 'Burley Road Shops'],
  ['ESC-012', 'available', 53.806, -1.52, 'Harehills Lane'],
  ['ESC-013', 'available', 53.775, -1.555, 'Beeston Co-op'],
];

// Pricing tiers — small variation to feel realistic
function pricingForId(id) {
  const num = parseInt(id.split('-')[1], 10);
  const base = 4.0 + (num % 3) * 0.5; // 4.0, 4.5, or 5.0
  return [
    base, // one_hour
    Math.round(base * 3 * 10) / 10, // four_hours (~3×)
    Math.round(base * 5.5 * 10) / 10, // one_day (~5.5×)
    Math.round(base * 20 * 10) / 10, // one_week (~20×)
  ];
}

// ── Main ────────────────────────────────────────────────────────────────────
(async () => {
  try {
    // ─── 1. Inspect current state ──────────────────────────────────────────
    console.log('=== CURRENT STATE (before insert) ===');

    const totalBefore = await get('SELECT COUNT(*) AS cnt FROM scooters');
    console.log(`Total scooters: ${totalBefore.cnt}`);

    const byStatus = await all(
      'SELECT status, COUNT(*) AS cnt FROM scooters GROUP BY status ORDER BY status'
    );
    console.log('By status:');
    byStatus.forEach((r) => console.log(`  ${r.status}: ${r.cnt}`));

    const withPricing = await get(
      `SELECT COUNT(*) AS cnt FROM scooters s
       INNER JOIN scooter_pricing p ON p.scooter_id = s.scooter_id`
    );
    console.log(`Scooters with pricing: ${withPricing.cnt}`);

    const missingPricing = await all(
      `SELECT s.scooter_id, s.status FROM scooters s
       LEFT JOIN scooter_pricing p ON p.scooter_id = s.scooter_id
       WHERE p.scooter_id IS NULL`
    );
    if (missingPricing.length) {
      console.log('Scooters MISSING pricing:');
      missingPricing.forEach((r) =>
        console.log(`  ${r.scooter_id} (${r.status})`)
      );
    }

    console.log('\nSample scooters (before):');
    const sample = await all(
      'SELECT scooter_id, status, latitude, longitude, location_description FROM scooters ORDER BY scooter_id LIMIT 5'
    );
    sample.forEach((r) =>
      console.log(
        `  ${r.scooter_id} | ${r.status} | (${r.latitude}, ${r.longitude}) | ${r.location_description}`
      )
    );

    // Lat/lng nulls check
    const badCoords = await all(
      'SELECT scooter_id, latitude, longitude FROM scooters WHERE latitude IS NULL OR longitude IS NULL OR latitude = 0 OR longitude = 0'
    );
    if (badCoords.length) {
      console.log('\nScooters with missing/zero coordinates:');
      badCoords.forEach((r) => console.log(`  ${r.scooter_id}`));
    }

    // ─── 2. Check for existing IDs ─────────────────────────────────────────
    const existingIds = new Set(
      (await all('SELECT scooter_id FROM scooters')).map((r) => r.scooter_id)
    );
    const toInsert = newScooters.filter((s) => !existingIds.has(s[0]));
    const skipped = newScooters.filter((s) => existingIds.has(s[0]));

    if (skipped.length) {
      console.log(
        `\nSkipping ${skipped.length} already-existing IDs: ${skipped.map((s) => s[0]).join(', ')}`
      );
    }
    if (toInsert.length === 0) {
      console.log('\nNo new scooters to insert. Done.');
      process.exit(0);
    }

    // ─── 3. Insert in transaction ──────────────────────────────────────────
    console.log(`\n=== INSERTING ${toInsert.length} NEW SCOOTERS ===`);

    await run('BEGIN TRANSACTION');
    try {
      for (const [id, status, lat, lng, desc] of toInsert) {
        await run(
          `INSERT INTO scooters (scooter_id, status, latitude, longitude, location_description)
           VALUES (?, ?, ?, ?, ?)`,
          [id, status, lat, lng, desc]
        );

        const [oneH, fourH, oneD, oneW] = pricingForId(id);
        await run(
          `INSERT INTO scooter_pricing (scooter_id, one_hour, four_hours, one_day, one_week)
           VALUES (?, ?, ?, ?, ?)`,
          [id, oneH, fourH, oneD, oneW]
        );

        console.log(
          `  Inserted ${id} (${status}) at (${lat}, ${lng}) — £${oneH}/£${fourH}/£${oneD}/£${oneW}`
        );
      }

      await run('COMMIT');
      console.log('Transaction committed successfully.\n');
    } catch (txErr) {
      await run('ROLLBACK');
      console.error('Transaction rolled back due to error:', txErr);
      throw txErr;
    }

    // ─── 4. Verify after insert ────────────────────────────────────────────
    console.log('=== VERIFICATION (after insert) ===');

    const totalAfter = await get('SELECT COUNT(*) AS cnt FROM scooters');
    console.log(`Total scooters: ${totalAfter.cnt}`);

    const byStatusAfter = await all(
      'SELECT status, COUNT(*) AS cnt FROM scooters GROUP BY status ORDER BY status'
    );
    console.log('By status:');
    byStatusAfter.forEach((r) => console.log(`  ${r.status}: ${r.cnt}`));

    const withPricingAfter = await get(
      `SELECT COUNT(*) AS cnt FROM scooters s
       INNER JOIN scooter_pricing p ON p.scooter_id = s.scooter_id`
    );
    console.log(`Scooters with pricing: ${withPricingAfter.cnt}`);

    const missingAfter = await all(
      `SELECT s.scooter_id, s.status FROM scooters s
       LEFT JOIN scooter_pricing p ON p.scooter_id = s.scooter_id
       WHERE p.scooter_id IS NULL`
    );
    if (missingAfter.length) {
      console.log('WARNING — scooters missing pricing:');
      missingAfter.forEach((r) =>
        console.log(`  ${r.scooter_id} (${r.status})`)
      );
    } else {
      console.log('All scooters have pricing rows.');
    }

    // Rider-visible: INNER JOIN pricing, exclude retired
    const riderVisible = await all(
      `SELECT s.scooter_id, s.status, s.latitude, s.longitude, s.location_description
       FROM scooters s
       INNER JOIN scooter_pricing p ON p.scooter_id = s.scooter_id
       WHERE s.status IN ('available', 'in_use', 'maintenance', 'offline')
       ORDER BY s.scooter_id`
    );
    console.log(
      `\nRider-visible scooters (non-retired + have pricing): ${riderVisible.length}`
    );
    riderVisible.forEach((r) =>
      console.log(
        `  ${r.scooter_id} | ${r.status} | (${r.latitude}, ${r.longitude}) | ${r.location_description}`
      )
    );

    // Retired check
    const retired = await get(
      "SELECT COUNT(*) AS cnt FROM scooters WHERE status = 'retired'"
    );
    console.log(`\nRetired scooters: ${retired.cnt}`);

    // ─── 5. Map-visibility diagnosis ───────────────────────────────────────
    console.log('\n=== MAP VISIBILITY DIAGNOSIS ===');

    const mapQuery = await all(
      `SELECT s.scooter_id, s.status, s.latitude, s.longitude,
              CASE WHEN p.scooter_id IS NULL THEN 'MISSING PRICING' ELSE 'ok' END AS pricing_check
       FROM scooters s
       LEFT JOIN scooter_pricing p ON p.scooter_id = s.scooter_id
       ORDER BY s.scooter_id`
    );
    console.log('Full scooter audit (left-join pricing):');
    mapQuery.forEach((r) =>
      console.log(
        `  ${r.scooter_id} | ${r.status} | (${r.latitude}, ${r.longitude}) | pricing: ${r.pricing_check}`
      )
    );

    const riderFiltered = mapQuery.filter((r) =>
      ['available', 'in_use', 'maintenance', 'offline'].includes(r.status)
    );
    const riderPriced = riderFiltered.filter((r) => r.pricing_check === 'ok');

    console.log(
      `\nRider query filters: ${mapQuery.length} total → ${riderFiltered.length} non-retired → ${riderPriced.length} with pricing (visible on map)`
    );

    if (riderPriced.length <= 3) {
      console.log(
        'ISSUE: Very few scooters visible on map because the DB only had 3 seeded scooters.'
      );
      console.log(
        "All 3 had pricing and non-retired status, so they all appear — there just weren't more."
      );
    } else {
      console.log(`Map should now show ${riderPriced.length} scooters.`);
    }

    console.log('\nDone.');
  } catch (err) {
    console.error('Fatal error:', err);
    process.exit(1);
  } finally {
    db.close();
  }
})();
