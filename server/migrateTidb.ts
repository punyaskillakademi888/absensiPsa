import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { randomInt, randomUUID } from 'node:crypto';
import { ensureDatabaseExists, getPool, initDatabase } from './db.js';

function randomEightDigitNumber(): string {
  return String(randomInt(10_000_000, 100_000_000));
}

async function main() {
  await ensureDatabaseExists();
  await initDatabase();
  const pool = getPool();

  for (const [table, column] of [
    ['users', 'kejuruan_name'], ['kejuruan', 'name'], ['attendance_records', 'kejuruan_name'],
    ['leave_requests', 'kejuruan_name'], ['missions', 'kejuruan_name'],
    ['mission_submissions', 'kejuruan_name'], ['daily_reports', 'kejuruan_name'],
  ]) {
    await pool.query(`ALTER TABLE ${table} MODIFY COLUMN ${column} VARCHAR(255)${table === 'kejuruan' || table === 'missions' ? ' NOT NULL' : ' NULL'}`);
  }

  const [invalidUserCodes] = await pool.query<any[]>(
    `SELECT COUNT(*) AS total FROM users
     WHERE nim NOT REGEXP '^[0-9]{8}$' OR login_code NOT REGEXP '^[0-9]{8}$'`
  );
  if (Number(invalidUserCodes[0]?.total || 0) === 0) {
    await pool.query(
      'ALTER TABLE users MODIFY COLUMN nim CHAR(8) NOT NULL, MODIFY COLUMN login_code CHAR(8) NOT NULL'
    );
  } else {
    console.warn(`[TiDB] Skema kode user lama belum dipersempit: ${invalidUserCodes[0].total} akun masih memiliki NIM/kode bukan 8 digit. Data akun dipertahankan agar tidak mengubah kode login tanpa pemberitahuan.`);
  }

  const [existingAdmins] = await pool.query<any[]>(
    "SELECT id FROM users WHERE role = 'admin' AND name = ? LIMIT 1",
    ['Abdul rozzak junaidi']
  );
  if (existingAdmins.length > 0) {
    const [tables] = await pool.query<any[]>('SHOW TABLES');
    console.log(`[TiDB] Skema selesai; ${tables.length} tabel tersedia: ${tables.map(row => Object.values(row)[0]).join(', ')}.`);
    console.log('[TiDB] Akun admin Abdul rozzak junaidi sudah ada; tidak membuat duplikat.');
    await pool.end();
    return;
  }

  let loginCode = randomEightDigitNumber();
  let password = randomEightDigitNumber();
  let email = `${loginCode}@hadirku.id`;
  let freeCode = false;

  while (!freeCode) {
    loginCode = randomEightDigitNumber();
    password = randomEightDigitNumber();
    email = `${loginCode}@hadirku.id`;
    const [matches] = await pool.query<any[]>(
      'SELECT id FROM users WHERE nim = ? OR login_code = ? OR email = ? LIMIT 1',
      [loginCode, loginCode, email]
    );
    freeCode = matches.length === 0;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const now = new Date().toISOString().slice(0, 10);
  const id = `user-admin-${randomUUID()}`;

  await pool.query(
    `INSERT INTO users (
      id, nim, name, email, role, status, joined_date, login_code, password_hash
    ) VALUES (?, ?, ?, ?, 'admin', 'active', ?, ?, ?)`,
    [id, loginCode, 'Abdul rozzak junaidi', email, now, loginCode, passwordHash]
  );

  const [tables] = await pool.query<any[]>('SHOW TABLES');
  console.log(`[TiDB] Migrasi selesai; ${tables.length} tabel terdeteksi: ${tables.map(row => Object.values(row)[0]).join(', ')}.`);
  console.log(`Akun admin dibuat: Abdul rozzak junaidi | Kode login: ${loginCode} | Sandi: ${password}`);
  await pool.end();
}

main().catch(error => {
  console.error(`[TiDB] Migrasi gagal: ${error.code || error.message}`);
  process.exitCode = 1;
});
