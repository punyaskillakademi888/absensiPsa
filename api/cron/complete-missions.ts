import { timingSafeEqual } from 'node:crypto';
import { getPool } from '../../server/db.js';
import { getJakartaDateTime } from '../../server/attendanceAutoCheckout.js';
import { completeExpiredMissions } from '../../server/missionLifecycle.js';

export const config = {
  maxDuration: 30,
};

export default async function completeMissions(req: any, res: any) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Metode request tidak diizinkan.' });
  }

  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return res.status(503).json({ success: false, message: 'CRON_SECRET belum dikonfigurasi.' });
  }
  const authorization = String(req.headers.authorization || '');
  const expectedAuthorization = `Bearer ${cronSecret}`;
  const providedBuffer = Buffer.from(authorization);
  const expectedBuffer = Buffer.from(expectedAuthorization);
  if (providedBuffer.length !== expectedBuffer.length || !timingSafeEqual(providedBuffer, expectedBuffer)) {
    return res.status(401).json({ success: false, message: 'Autorisasi cron tidak valid.' });
  }

  try {
    const { date } = getJakartaDateTime();
    const completedCount = await completeExpiredMissions(getPool(), date);
    return res.status(200).json({ success: true, date, completedCount });
  } catch (error) {
    console.error('[Mission Completion Cron Error]', error);
    return res.status(500).json({ success: false, message: 'Gagal menandai misi yang sudah melewati batas waktu.' });
  }
}
