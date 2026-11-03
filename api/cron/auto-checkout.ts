import { timingSafeEqual } from 'node:crypto';
import { getPool } from '../../server/db.js';
import { autoCheckoutAttendance, getJakartaDateTime } from '../../server/attendanceAutoCheckout.js';

export const config = {
  maxDuration: 30,
};

export default async function autoCheckout(req: any, res: any) {
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

  const { date, time } = getJakartaDateTime();
  if (time < '19:00:00') {
    return res.status(409).json({ success: false, message: 'Auto check-out hanya berjalan mulai pukul 19.00 WIB.' });
  }

  try {
    const updatedCount = await autoCheckoutAttendance(getPool(), date);
    return res.status(200).json({ success: true, date, time: '19:00:00', updatedCount });
  } catch (error) {
    console.error('[Attendance Auto Checkout Error]', error);
    return res.status(500).json({ success: false, message: 'Auto check-out gagal diperbarui di database.' });
  }
}
