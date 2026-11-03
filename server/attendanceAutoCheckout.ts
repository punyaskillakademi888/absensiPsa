import type { Pool } from 'mysql2/promise';

export interface JakartaDateTime {
  date: string;
  time: string;
}

export function getJakartaDateTime(now = new Date()): JakartaDateTime {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return {
    date: `${values.year}-${values.month}-${values.day}`,
    time: `${values.hour}:${values.minute}:${values.second}`,
  };
}

export async function autoCheckoutAttendance(pool: Pool, date: string): Promise<number> {
  const [result] = await pool.query<any>(
    `UPDATE attendance_records
     SET check_out_time = '19:00:00',
         notes = CONCAT_WS(' | ', NULLIF(notes, ''), 'Check-out otomatis oleh sistem pukul 19:00 WIB')
     WHERE attendance_date <= ?
       AND check_in_time IS NOT NULL
       AND check_out_time IS NULL`,
    [date]
  );
  return Number(result.affectedRows || 0);
}

export async function completeExpiredBatchEnrollments(pool: Pool, date: string): Promise<{
  enrollments: number;
  batches: number;
}> {
  const [baselineRows] = await pool.query<any[]>(
    "SELECT start_date FROM batches WHERE code = 'BATCH-5' LIMIT 1"
  );
  if (!baselineRows[0]?.start_date) {
    throw new Error('Batch 5 tidak ditemukan; batas awal auto-selesai tidak dapat ditentukan.');
  }
  const baselineDate = String(baselineRows[0].start_date).slice(0, 10);

  const [enrollmentResult] = await pool.query<any>(
    `UPDATE batch_enrollments be
     JOIN batches b ON b.id = be.batch_id
     JOIN users u ON u.id = be.user_id
     SET be.status = 'graduated',
         be.end_date = COALESCE(be.end_date, b.end_date)
     WHERE u.role = 'trainee'
       AND be.status = 'active'
       AND b.start_date >= ?
       AND b.end_date < ?`,
    [baselineDate, date]
  );

  const [statusColumns] = await pool.query<any[]>(
    `SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'batches' AND COLUMN_NAME = 'status'`
  );
  const enumValues = String(statusColumns[0]?.COLUMN_TYPE || '')
    .match(/'((?:[^'\\]|\\.)*)'/g)
    ?.map(value => value.slice(1, -1)) || [];
  const completedStatus = enumValues.includes('selesai')
    ? 'selesai'
    : enumValues.includes('completed')
      ? 'completed'
      : null;
  if (!completedStatus) {
    throw new Error('Kolom status batches tidak memiliki nilai selesai yang dikenali.');
  }

  const [batchResult] = await pool.query<any>(
    `UPDATE batches
     SET status = ?
     WHERE start_date >= ? AND end_date < ? AND status <> ?`,
    [completedStatus, baselineDate, date, completedStatus]
  );

  return {
    enrollments: Number(enrollmentResult.affectedRows || 0),
    batches: Number(batchResult.affectedRows || 0),
  };
}
