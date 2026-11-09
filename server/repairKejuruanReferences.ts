import 'dotenv/config';
import { getPool } from './db.js';

const aliases = [
  'Pengoperasian Tools Generative AI untuk Konten Digital dan Bisnis',
  'Pembuatan Konten Visual untuk Sosial Media',
  'Optimalisasi Pemasaran Melalui Media Sosial',
];

const referenceTables = [
  'users',
  'attendance_records',
  'batch_enrollments',
  'leave_requests',
  'missions',
  'mission_submissions',
  'daily_reports',
  'mentor_daily_reports',
] as const;

const aliasPlaceholders = aliases.map(() => '?').join(', ');

async function main() {
  const pool = getPool();
  const applyChanges = process.argv.includes('--apply');
  const connection = await pool.getConnection();
  let transactionStarted = false;

  try {
    const [databaseRows] = await connection.query<any[]>('SELECT DATABASE() AS name');
    const databaseName = String(databaseRows[0]?.name || '');
    if (!databaseName) throw new Error('Nama database aktif tidak dapat diverifikasi.');
    if (applyChanges && !process.argv.includes(`--confirm-database=${databaseName}`)) {
      throw new Error(`Apply memerlukan --confirm-database=${databaseName} untuk memverifikasi target.`);
    }
    if (applyChanges && !process.argv.includes('--backup-verified')) {
      throw new Error('Apply memerlukan --backup-verified setelah backup database diverifikasi.');
    }

    const [programRows] = await connection.query<any[]>(
      `SELECT id, name, code FROM kejuruan
       WHERE UPPER(code) = 'SC-04' AND LOWER(TRIM(name)) = 'smart creative'`
    );
    if (programRows.length !== 1) {
      throw new Error(`Dibutuhkan tepat satu program Smart Creative berkode SC-04; ditemukan ${programRows.length}.`);
    }

    const canonicalId = String(programRows[0].id);
    console.log(`Database target: ${databaseName}`);
    console.log(`Target kanonis: ${programRows[0].name} (${programRows[0].code}), ID ${canonicalId}`);
    console.log(applyChanges ? 'Mode: APPLY' : 'Mode: DRY RUN (database tidak diubah)');

    let plannedTotal = 0;
    for (const table of referenceTables) {
      const [rows] = await connection.query<any[]>(
        `SELECT COUNT(*) AS total FROM ${table}
         WHERE LOWER(TRIM(COALESCE(kejuruan_name, ''))) IN (${aliasPlaceholders})
           AND (
             COALESCE(kejuruan_id, '') <> ?
             OR LOWER(TRIM(COALESCE(kejuruan_name, ''))) <> 'smart creative'
           )`,
        [...aliases.map(name => name.toLowerCase()), canonicalId]
      );
      const count = Number(rows[0]?.total || 0);
      plannedTotal += count;
      console.log(`${table}: ${count} baris akan diselaraskan`);
    }

    let unresolvedTotal = 0;
    for (const table of referenceTables) {
      const [rows] = await connection.query<any[]>(
        `SELECT COUNT(*) AS total FROM ${table} t
         LEFT JOIN kejuruan k ON k.id = t.kejuruan_id
         WHERE t.kejuruan_id IS NOT NULL AND t.kejuruan_id <> ''
           AND k.id IS NULL
           AND LOWER(TRIM(COALESCE(t.kejuruan_name, ''))) NOT IN (${aliasPlaceholders})`,
        aliases.map(name => name.toLowerCase())
      );
      const count = Number(rows[0]?.total || 0);
      unresolvedTotal += count;
      if (count) console.warn(`${table}: ${count} referensi yatim lain perlu pemeriksaan terpisah`);
    }

    console.log(`Total baris yang cocok: ${plannedTotal}`);
    console.log(`Referensi yatim di luar alias yang dikenal: ${unresolvedTotal}`);
    if (!applyChanges) return;

    await connection.beginTransaction();
    transactionStarted = true;
    for (const table of referenceTables) {
      const [result] = await connection.query<any>(
        `UPDATE ${table}
         SET kejuruan_id = ?, kejuruan_name = 'Smart Creative'
         WHERE LOWER(TRIM(COALESCE(kejuruan_name, ''))) IN (${aliasPlaceholders})
           AND (
             COALESCE(kejuruan_id, '') <> ?
             OR LOWER(TRIM(COALESCE(kejuruan_name, ''))) <> 'smart creative'
           )`,
        [canonicalId, ...aliases.map(name => name.toLowerCase()), canonicalId]
      );
      console.log(`${table}: ${Number(result.affectedRows || 0)} baris diperbarui`);
    }
    await connection.commit();
    transactionStarted = false;
    console.log('Perbaikan referensi program selesai.');
  } catch (error) {
    if (transactionStarted) await connection.rollback();
    throw error;
  } finally {
    connection.release();
    await pool.end();
  }
}

main().catch(error => {
  console.error('[Kejuruan Reference Repair Failed]', error);
  process.exitCode = 1;
});
