const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname);

function walk(dir, out) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (error) {
    console.error('Failed to read directory while listing tests:', dir, error);
    throw error;
  }

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      walk(fullPath, out);
      continue;
    }

    if (entry.isFile() && entry.name.endsWith('.test.js')) {
      out.push(fullPath);
    }
  }
}

function main() {
  const files = [];
  walk(ROOT, files);
  files.sort();

  // Output space-delimited paths for use via command substitution:
  //   node --test $(node tests/_list-test-files.cjs)
  //
  // Paths in this repo don't contain spaces; keep it simple and portable.
  process.stdout.write(files.join(' '));
}

try {
  main();
} catch (error) {
  process.exitCode = 1;
}
