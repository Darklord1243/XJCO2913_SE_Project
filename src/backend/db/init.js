const fs = require('fs');
const path = require('path');
const db = require('./connection');

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
