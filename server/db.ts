import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import { computeLatePenalty, normalizeLatePointPenaltyPerMinute } from './latePenalty.js';

dotenv.config();

export function describeDatabaseConfig(): { ok: boolean; missing: string[] } {
  const splitConfigKeys = [
    'TIDB_HOST',
    'TIDB_PORT',
    'TIDB_USER',
    'TIDB_PASSWORD',
    'TIDB_DATABASE',
  ] as const;
  const hasSplitConfig = splitConfigKeys.some(key => process.env[key]);

  if (hasSplitConfig) {
    const missing = ['TIDB_HOST', 'TIDB_USER', 'TIDB_PASSWORD']
      .filter(key => !process.env[key]);
    return { ok: missing.length === 0, missing };
  }

  if (process.env.DATABASE_URL) {
    return { ok: true, missing: [] };
  }

  return { ok: false, missing: ['TIDB_HOST', 'TIDB_USER', 'TIDB_PASSWORD'] };
}

export async function pingDatabase(): Promise<{ ok: boolean; error?: string }> {
  try {
    const pool = getPool();
    await pool.query('SELECT 1 as connected');
    return { ok: true };
  } catch (error: any) {
    return { ok: false, error: error?.message || String(error) };
  }
}

function getDbConfig() {
  const splitConfigKeys = [
    'TIDB_HOST',
    'TIDB_PORT',
    'TIDB_USER',
    'TIDB_PASSWORD',
    'TIDB_DATABASE',
  ] as const;
  const hasSplitConfig = splitConfigKeys.some(key => process.env[key] !== undefined);

  let host: string;
  let port: number;
  let user: string;
  let password: string;
  let database: string;

  if (hasSplitConfig) {
    const missing = ['TIDB_HOST', 'TIDB_USER', 'TIDB_PASSWORD']
      .filter(key => !process.env[key]);
    if (missing.length) {
      throw new Error(`Konfigurasi TiDB belum lengkap. Variabel wajib: ${missing.join(', ')}.`);
    }

    host = process.env.TIDB_HOST!;
    port = Number(process.env.TIDB_PORT || 4000);
    user = process.env.TIDB_USER!;
    password = process.env.TIDB_PASSWORD!;
    database = process.env.TIDB_DATABASE || 'absensi_db';
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      throw new Error('TIDB_PORT harus berupa nomor port yang valid.');
    }
  } else {
    // Keep DATABASE_URL support for existing deployments. Reserved characters
    // in URL credentials (such as @) must be percent-encoded, e.g. %40.
    const url = new URL(process.env.DATABASE_URL || 'mysql://localhost:3306/test');
    const dbName = url.pathname.replace(/^\//, '');
    host = url.hostname;
    port = parseInt(url.port || '4000', 10);
    user = decodeURIComponent(url.username);
    password = decodeURIComponent(url.password);
    database = dbName && dbName !== 'sys' ? dbName : 'absensi_db';
  }

  return {
    host,
    port,
    user,
    password,
    database,
    ssl: {
      minVersion: 'TLSv1.2',
      rejectUnauthorized: true,
    },
    waitForConnections: true,
    connectionLimit: process.env.VERCEL === '1' ? 1 : 10,
    queueLimit: 0,
    connectTimeout: 12000,
    // Preserve SQL DATE values as YYYY-MM-DD strings. Converting DATE to a JS
    // Date applies the server timezone and can shift attendance to the prior day.
    dateStrings: ['DATE'] as ('DATE' | 'DATETIME' | 'TIMESTAMP')[],
  };
}

let pool: mysql.Pool;

export function getPool(): mysql.Pool {
  if (!pool) {
    pool = mysql.createPool(getDbConfig());
  }
  return pool;
}

export interface DbUser {
  id: string;
  nim: string;
  name: string;
  email: string;
  role: 'admin' | 'mentor' | 'trainee';
  avatar: string;
  phone: string;
  kejuruan_id?: string;
  kejuruan_name?: string;
  status: 'active' | 'inactive';
  joined_date: string;
  login_code: string;
  password_hash: string;
}

export async function ensureDatabaseExists() {
  const dbConfig = getDbConfig();
  if (!/^[a-zA-Z0-9_]+$/.test(dbConfig.database)) {
    throw new Error('Nama database hanya boleh berisi huruf, angka, dan garis bawah.');
  }
  const { database, ...serverConfig } = dbConfig;
  const serverConnection = await mysql.createConnection(serverConfig);
  try {
    await serverConnection.query(
      `CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
  } finally {
    await serverConnection.end();
  }
}

/**
 * Samakan penalti keterlambatan pada record lama dengan tarif terbaru admin,
 * supaya riwayat keterlambatan sebelum fitur ini ada ikut terpotong di Hall of Fame.
 */
async function backfillLatePenalties(p: mysql.Pool) {
  try {
    const [settingRows] = await p.query<any[]>(
      'SELECT late_limit_time, late_point_penalty_per_minute FROM attendance_settings ORDER BY updated_at DESC LIMIT 1'
    );
    const setting = settingRows[0];
    const penaltySettings = {
      lateLimitTime: setting?.late_limit_time ? String(setting.late_limit_time) : '09:00',
      latePointPenaltyPerMinute: normalizeLatePointPenaltyPerMinute(setting?.late_point_penalty_per_minute),
    };
    const [rows] = await p.query<any[]>(
      `SELECT a.id, COALESCE(u.role, a.user_role) AS role, a.check_in_time, a.late_minutes, a.late_penalty_points
         FROM attendance_records a
         LEFT JOIN users u ON u.id = a.user_id
        WHERE a.status = 'terlambat' AND a.check_in_time IS NOT NULL`
    );
    let updated = 0;
    for (const row of rows) {
      const penalty = computeLatePenalty(penaltySettings, {
        role: row.role,
        status: 'terlambat',
        checkInTime: row.check_in_time,
      });
      if (penalty.lateMinutes === Number(row.late_minutes || 0) &&
          penalty.latePenaltyPoints === Number(row.late_penalty_points || 0)) {
        continue;
      }
      await p.query(
        'UPDATE attendance_records SET late_minutes = ?, late_penalty_points = ? WHERE id = ?',
        [penalty.lateMinutes, penalty.latePenaltyPoints, row.id]
      );
      updated += 1;
    }
    if (updated) {
      console.log(`[TiDB] Penalti keterlambatan riwayat lama diperbarui pada ${updated} record presensi.`);
    }
  } catch (error: any) {
    console.warn('[TiDB] Backfill penalti keterlambatan dilewati:', error?.message || error);
  }
}

export async function initDatabase() {
  const { database } = getDbConfig();
  const p = getPool();
  console.log(`[TiDB] Memeriksa tabel aplikasi pada database ${database}...`);

  const tableMigrations = [
    `
    CREATE TABLE IF NOT EXISTS users (
      id VARCHAR(64) PRIMARY KEY,
      nim CHAR(8) NOT NULL UNIQUE,
      name VARCHAR(128) NOT NULL,
      email VARCHAR(128) NOT NULL UNIQUE,
      role ENUM('admin', 'mentor', 'trainee') NOT NULL,
      avatar TEXT,
      phone VARCHAR(32),
      kejuruan_id VARCHAR(64),
      kejuruan_name VARCHAR(255),
      status ENUM('active', 'inactive') DEFAULT 'active',
      joined_date VARCHAR(32),
      login_code CHAR(8) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `,
    `
    CREATE TABLE IF NOT EXISTS kejuruan (
      id VARCHAR(64) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      code VARCHAR(64) NOT NULL,
      category VARCHAR(128) NOT NULL,
      color VARCHAR(16) NOT NULL,
      description TEXT,
      mentor_id VARCHAR(64),
      mentor_name VARCHAR(128),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_kejuruan_code (code),
      INDEX idx_kejuruan_mentor (mentor_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `,
    `
    CREATE TABLE IF NOT EXISTS attendance_records (
      id VARCHAR(64) PRIMARY KEY,
      user_id VARCHAR(64) NOT NULL,
      user_name VARCHAR(128) NOT NULL,
      user_nim VARCHAR(64) NOT NULL,
      user_role ENUM('admin','mentor','trainee') NOT NULL DEFAULT 'trainee',
      kejuruan_id VARCHAR(64),
      kejuruan_name VARCHAR(255),
      attendance_date DATE NOT NULL,
      check_in_time TIME,
      check_out_time TIME,
      work_mode ENUM('WFO','WFH') NULL,
      status ENUM('hadir','terlambat','izin','sakit','alpha') NOT NULL,
      verification_status ENUM('pending','verified','rejected') NOT NULL DEFAULT 'pending',
      verified_by VARCHAR(64),
      verified_at DATETIME,
      location TEXT,
      latitude DECIMAL(10,7),
      longitude DECIMAL(10,7),
      notes TEXT,
      photo_url LONGTEXT,
      rejection_reason TEXT,
      late_minutes INT NOT NULL DEFAULT 0,
      late_penalty_points INT NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_attendance_user_date (user_id, attendance_date),
      INDEX idx_attendance_date_status (attendance_date, verification_status),
      INDEX idx_attendance_kejuruan_date (kejuruan_id, attendance_date)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `,
    `
    CREATE TABLE IF NOT EXISTS leave_requests (
      id VARCHAR(64) PRIMARY KEY,
      user_id VARCHAR(64) NOT NULL,
      user_name VARCHAR(128) NOT NULL,
      user_nim VARCHAR(64) NOT NULL,
      kejuruan_id VARCHAR(64),
      kejuruan_name VARCHAR(255),
      request_type ENUM('izin','sakit') NOT NULL,
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      days_count INT NOT NULL DEFAULT 1,
      reason TEXT NOT NULL,
      attachment_name VARCHAR(255),
      attachment_url LONGTEXT,
      status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
      submitted_at DATETIME NOT NULL,
      reviewed_by VARCHAR(64),
      reviewed_at DATETIME,
      review_notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_leave_user (user_id),
      INDEX idx_leave_status_dates (status, start_date, end_date),
      INDEX idx_leave_kejuruan_status (kejuruan_id, status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `,
    `
    CREATE TABLE IF NOT EXISTS attendance_settings (
      id VARCHAR(64) PRIMARY KEY,
      start_time TIME NOT NULL,
      late_limit_time TIME NOT NULL,
      end_time TIME NOT NULL,
      allow_checkout_start TIME NOT NULL,
      work_days JSON NOT NULL,
      office_location JSON NOT NULL,
      late_point_penalty_per_minute INT NOT NULL DEFAULT 1,
      absent_point_penalty_per_day INT NOT NULL DEFAULT 1,
      updated_by VARCHAR(64),
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `,
    `
    CREATE TABLE IF NOT EXISTS missions (
      id VARCHAR(64) PRIMARY KEY,
      title VARCHAR(200) NOT NULL,
      description TEXT NOT NULL,
      kejuruan_id VARCHAR(64) NOT NULL,
      kejuruan_name VARCHAR(255) NOT NULL,
      mentor_id VARCHAR(64) NOT NULL,
      mentor_name VARCHAR(128) NOT NULL,
      points INT NOT NULL DEFAULT 0,
      difficulty ENUM('Mudah','Sedang','Tantangan') NOT NULL,
      due_date DATE NOT NULL,
      created_at DATETIME NOT NULL,
      status ENUM('active','archived') NOT NULL DEFAULT 'active',
      category VARCHAR(128),
      submission_guide TEXT,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_missions_kejuruan_status (kejuruan_id, status),
      INDEX idx_missions_due_date (due_date)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `,
    `
    CREATE TABLE IF NOT EXISTS mission_submissions (
      id VARCHAR(64) PRIMARY KEY,
      mission_id VARCHAR(64) NOT NULL,
      mission_title VARCHAR(200) NOT NULL,
      trainee_id VARCHAR(64) NOT NULL,
      trainee_name VARCHAR(128) NOT NULL,
      trainee_nim VARCHAR(64) NOT NULL,
      trainee_avatar LONGTEXT,
      kejuruan_id VARCHAR(64),
      kejuruan_name VARCHAR(255),
      submission_link TEXT,
      notes TEXT,
      points INT NOT NULL DEFAULT 0,
      submitted_at DATETIME NOT NULL,
      status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
      reviewed_by VARCHAR(64),
      reviewed_at DATETIME,
      feedback TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_submissions_mission (mission_id, status),
      INDEX idx_submissions_trainee (trainee_id, submitted_at),
      INDEX idx_submissions_kejuruan (kejuruan_id, status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `,
    `
    CREATE TABLE IF NOT EXISTS daily_reports (
      id VARCHAR(64) PRIMARY KEY,
      trainee_id VARCHAR(64) NOT NULL,
      trainee_name VARCHAR(128) NOT NULL,
      trainee_nim VARCHAR(64) NOT NULL,
      trainee_avatar LONGTEXT,
      kejuruan_id VARCHAR(64),
      kejuruan_name VARCHAR(255),
      report_date DATE NOT NULL,
      description TEXT NOT NULL,
      photo_url LONGTEXT,
      photo_name VARCHAR(255),
      submission_link TEXT,
      status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
      submitted_at DATETIME NOT NULL,
      reviewed_by VARCHAR(64),
      reviewed_at DATETIME,
      review_notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_daily_report_trainee_date (trainee_id, report_date),
      INDEX idx_daily_reports_status_date (status, report_date),
      INDEX idx_daily_reports_kejuruan (kejuruan_id, status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `,
  ];

  for (const migration of tableMigrations) {
    await p.query(migration);
  }

  const [leaveAttachmentColumns] = await p.query<any[]>(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'leave_requests' AND COLUMN_NAME = 'attachment_name'`,
    [database]
  );
  if (leaveAttachmentColumns.length === 0) {
    await p.query('ALTER TABLE leave_requests ADD COLUMN attachment_name VARCHAR(255) NULL AFTER reason');
  }

  const [attendanceWorkModeColumns] = await p.query<any[]>(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'attendance_records' AND COLUMN_NAME = 'work_mode'`,
    [database]
  );
  if (attendanceWorkModeColumns.length === 0) {
    await p.query("ALTER TABLE attendance_records ADD COLUMN work_mode ENUM('WFO','WFH') NULL AFTER check_out_time");
  }

  // Penalti keterlambatan check-in: menit telat dan poin yang dipotong per record.
  const [latePenaltyColumns] = await p.query<any[]>(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'attendance_records' AND COLUMN_NAME IN ('late_minutes','late_penalty_points')`,
    [database]
  );
  const existingLatePenaltyColumns = new Set(latePenaltyColumns.map((row: any) => String(row.COLUMN_NAME)));
  if (!existingLatePenaltyColumns.has('late_minutes')) {
    await p.query('ALTER TABLE attendance_records ADD COLUMN late_minutes INT NOT NULL DEFAULT 0 AFTER rejection_reason');
  }
  if (!existingLatePenaltyColumns.has('late_penalty_points')) {
    await p.query('ALTER TABLE attendance_records ADD COLUMN late_penalty_points INT NOT NULL DEFAULT 0 AFTER late_minutes');
  }

  // Tarif pengurangan poin per menit keterlambatan (diatur admin, default 1).
  const [latePenaltyRateColumns] = await p.query<any[]>(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'attendance_settings' AND COLUMN_NAME = 'late_point_penalty_per_minute'`,
    [database]
  );
  if (latePenaltyRateColumns.length === 0) {
    await p.query('ALTER TABLE attendance_settings ADD COLUMN late_point_penalty_per_minute INT NOT NULL DEFAULT 1 AFTER office_location');
  }

  // Tarif pengurangan poin per hari tidak absen (diatur admin, default 1).
  const [absentPenaltyRateColumns] = await p.query<any[]>(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'attendance_settings' AND COLUMN_NAME = 'absent_point_penalty_per_day'`,
    [database]
  );
  if (absentPenaltyRateColumns.length === 0) {
    await p.query('ALTER TABLE attendance_settings ADD COLUMN absent_point_penalty_per_day INT NOT NULL DEFAULT 1 AFTER late_point_penalty_per_minute');
  }

  // Riwayat keterlambatan lama harus ikut terpotong saat fitur ini diaktifkan,
  // bukan hanya check-in baru setelah deploy.
  await backfillLatePenalties(p);

  const [attendanceDayUniqueIndex] = await p.query<any[]>(
    `SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'attendance_records' AND INDEX_NAME = 'uq_attendance_user_date'`,
    [database]
  );
  if (attendanceDayUniqueIndex.length === 0) {
    const [duplicateAttendanceGroups] = await p.query<any[]>(
      `SELECT COUNT(*) AS total FROM (
         SELECT user_id, attendance_date FROM attendance_records
         GROUP BY user_id, attendance_date HAVING COUNT(*) > 1
       ) duplicate_days`
    );
    if (Number(duplicateAttendanceGroups[0]?.total || 0) === 0) {
      await p.query('ALTER TABLE attendance_records ADD UNIQUE KEY uq_attendance_user_date (user_id, attendance_date)');
    } else {
      console.warn(`[TiDB] Unique index presensi per user/hari belum dibuat: ditemukan ${duplicateAttendanceGroups[0].total} grup duplikat lama.`);
    }
  }

  await p.query(`UPDATE kejuruan SET code = CASE
    WHEN LOWER(TRIM(name)) LIKE '%pemasangan sistem integrasi bangunan cerdas%' OR LOWER(code) = 'imp-1nl422t' THEN 'SB-04'
    WHEN LOWER(TRIM(name)) LIKE '%pembuatan sistem informasi pariwisata berbasis website%' OR LOWER(code) = 'imp-1t5ojqc' THEN 'ST-04'
    WHEN LOWER(TRIM(name)) LIKE '%pengembangan web dengan node.js dan react%' OR LOWER(code) = 'imp-hyd7hm' THEN 'WEB-04'
    ELSE code END
    WHERE LOWER(code) IN ('imp-1nl422t','imp-1t5ojqc','imp-hyd7hm')
       OR LOWER(TRIM(name)) LIKE '%pemasangan sistem integrasi bangunan cerdas%'
       OR LOWER(TRIM(name)) LIKE '%pembuatan sistem informasi pariwisata berbasis website%'
       OR LOWER(TRIM(name)) LIKE '%pengembangan web dengan node.js dan react%'`);

  const [smartCreativeRows] = await p.query<any[]>(`SELECT id, name FROM kejuruan
    WHERE LOWER(TRIM(category)) = 'smart creative'
       OR LOWER(name) LIKE '%generative ai%'
       OR LOWER(name) LIKE '%konten visual untuk sosial media%'
       OR LOWER(name) LIKE '%optimalisasi pemasaran melalui media sosial%'
    ORDER BY CASE WHEN LOWER(name) LIKE '%generative ai%' THEN 0 ELSE 1 END, created_at ASC`);
  if (smartCreativeRows.length) {
    const smartCreativeId = String(smartCreativeRows[0].id);
    const relatedTables = ['users', 'attendance_records', 'leave_requests', 'missions', 'mission_submissions', 'daily_reports'];
    for (const oldProgram of smartCreativeRows) {
      for (const table of relatedTables) {
        await p.query(
          `UPDATE ${table} SET kejuruan_id = ?
           WHERE kejuruan_id = ? OR LOWER(TRIM(kejuruan_name)) = LOWER(TRIM(?))`,
          [smartCreativeId, oldProgram.id, oldProgram.name]
        );
      }
      if (String(oldProgram.id) !== smartCreativeId) {
        await p.query('DELETE FROM kejuruan WHERE id = ?', [oldProgram.id]);
      }
    }
    await p.query(
      `UPDATE kejuruan SET name = 'Smart Creative', code = 'SC-04', category = 'Smart Creative',
       description = 'Program gabungan Generative AI, konten visual, dan pemasaran media sosial.',
       mentor_name = 'Mas Dzikri' WHERE id = ?`,
      [smartCreativeId]
    );
  }

  await p.query(`DELETE FROM kejuruan WHERE UPPER(code) IN ('CS-05','DA-03','DM-04','UX-02','WD-01')`);

  console.log(`[TiDB] Skema aplikasi siap: ${tableMigrations.length} tabel.`);
}
