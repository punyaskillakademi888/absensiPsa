import type { Pool } from 'mysql2/promise';

export async function completeExpiredMissions(pool: Pool, date: string): Promise<number> {
  const [dateResult] = await pool.query<any>(
    `UPDATE missions
     SET status = 'archived'
     WHERE status = 'active' AND due_date < ?`,
    [date]
  );
  const [submissionResult] = await pool.query<any>(
    `UPDATE missions m
     INNER JOIN mission_submissions s ON s.mission_id = m.id
     SET m.status = 'archived'
     WHERE m.status = 'active'`
  );
  return Number(dateResult.affectedRows || 0) + Number(submissionResult.affectedRows || 0);
}
