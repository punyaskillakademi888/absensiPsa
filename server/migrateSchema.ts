import 'dotenv/config';
import { getPool, initDatabase } from './db.js';

async function main() {
  try {
    await initDatabase();
  } finally {
    await getPool().end();
  }
}

main().catch(error => {
  console.error(`[TiDB] Schema migration failed: ${error.code || error.message}`);
  process.exitCode = 1;
});
