import { randomBytes, randomUUID } from 'node:crypto';
import { Router, Response } from 'express';
import type { PoolConnection } from 'mysql2/promise';
import { authenticateToken, AuthenticatedRequest } from './auth.js';
import { getPool } from './db.js';
import {
  ABSENT_PENALTY_START_DATE,
  computeAbsentPenalty,
  normalizeAbsentPointPenaltyPerDay,
  todayWib,
} from './latePenalty.js';

export const rewardsRouter = Router();

const isValidImageUrl = (value: string) => {
  if (!value) return true;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
};

const formatDate = (value: any) => value instanceof Date
  ? value.toISOString()
  : value ? String(value).replace(' ', 'T') : undefined;

const mapReward = (row: any) => ({
  id: String(row.id),
  title: String(row.title),
  description: String(row.description || ''),
  pointsCost: Number(row.points_cost),
  stock: Number(row.stock),
  imageUrl: row.image_url || '',
  imagePublicId: row.image_public_id || '',
  category: String(row.category),
  isActive: Number(row.is_active) === 1,
  createdAt: formatDate(row.created_at),
  updatedAt: formatDate(row.updated_at),
});

const mapRedemption = (row: any) => ({
  id: String(row.id),
  rewardId: String(row.reward_id),
  rewardTitle: String(row.reward_title),
  traineeId: String(row.trainee_id),
  traineeName: String(row.trainee_name),
  pointsSpent: Number(row.points_spent),
  status: String(row.status),
  pickupCode: String(row.pickup_code),
  redeemedAt: formatDate(row.redeemed_at),
  completedAt: formatDate(row.completed_at),
  updatedBy: row.updated_by || undefined,
  updatedAt: formatDate(row.updated_at),
  notes: row.notes || '',
});

async function getSpendableBalance(connection: PoolConnection, traineeId: string) {
  const [userRows] = await connection.query<any[]>(
    `SELECT id, joined_date FROM users
     WHERE id = ? AND role = 'trainee' AND status = 'active'
     LIMIT 1`,
    [traineeId]
  );
  const user = userRows[0];
  if (!user) return null;

  const [earnedRows] = await connection.query<any[]>(
    `SELECT COALESCE(SUM(points_delta), 0) AS points
     FROM point_ledger
     WHERE trainee_id = ?`,
    [traineeId]
  );
  const [lateRows] = await connection.query<any[]>(
    `SELECT COALESCE(SUM(late_penalty_points), 0) AS points
     FROM attendance_records
     WHERE user_id = ? AND late_penalty_points > 0`,
    [traineeId]
  );
  const [settingsRows] = await connection.query<any[]>(
    'SELECT work_days, absent_point_penalty_per_day FROM attendance_settings ORDER BY updated_at DESC LIMIT 1'
  );
  const setting = settingsRows[0];
  let workDays = [1, 2, 3, 4, 5];
  try {
    const parsed = typeof setting?.work_days === 'string' ? JSON.parse(setting.work_days) : setting?.work_days;
    if (Array.isArray(parsed)) {
      const validDays = parsed.map(Number).filter((day: number) => Number.isInteger(day) && day >= 0 && day <= 6);
      if (validDays.length) workDays = validDays;
    }
  } catch (error) {
    throw new Error(`Pengaturan hari kerja tidak valid: ${error instanceof Error ? error.message : String(error)}`);
  }

  const today = todayWib();
  const [attendanceRows] = await connection.query<any[]>(
    `SELECT attendance_date FROM attendance_records
     WHERE user_id = ? AND check_in_time IS NOT NULL AND attendance_date >= ? AND attendance_date <= ?`,
    [traineeId, ABSENT_PENALTY_START_DATE, today]
  );
  const [leaveRows] = await connection.query<any[]>(
    `SELECT start_date, end_date FROM leave_requests
     WHERE user_id = ? AND status = 'approved' AND end_date >= ? AND start_date <= ?`,
    [traineeId, ABSENT_PENALTY_START_DATE, today]
  );
  const exemptDates = new Set<string>();
  const asDate = (value: any) => value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
  for (const row of attendanceRows) exemptDates.add(asDate(row.attendance_date));
  for (const row of leaveRows) {
    const start = asDate(row.start_date);
    const end = asDate(row.end_date);
    let timestamp = Math.max(Date.parse(`${start}T00:00:00Z`), Date.parse(`${ABSENT_PENALTY_START_DATE}T00:00:00Z`));
    const endTimestamp = Math.min(Date.parse(`${end}T00:00:00Z`), Date.parse(`${today}T00:00:00Z`));
    for (let guard = 0; timestamp <= endTimestamp && guard < 400; guard++, timestamp += 86_400_000) {
      exemptDates.add(new Date(timestamp).toISOString().slice(0, 10));
    }
  }
  const absent = computeAbsentPenalty({
    workDays,
    absentPointPenaltyPerDay: normalizeAbsentPointPenaltyPerDay(setting?.absent_point_penalty_per_day),
    today,
    joinedDate: user.joined_date ? asDate(user.joined_date) : null,
    attendedOrLeaveDates: exemptDates,
  });

  const [spentRows] = await connection.query<any[]>(
    `SELECT COALESCE(SUM(points_spent), 0) AS points
     FROM reward_redemptions
     WHERE trainee_id = ? AND status <> 'cancelled'`,
    [traineeId]
  );
  const earnedPoints = Number(earnedRows[0]?.points || 0);
  const latePenaltyPoints = Number(lateRows[0]?.points || 0);
  const absentPenaltyPoints = absent.absentPenaltyPoints;
  const pointsSpent = Number(spentRows[0]?.points || 0);
  const netBalance = earnedPoints - latePenaltyPoints - absentPenaltyPoints - pointsSpent;
  return {
    earnedPoints,
    latePenaltyPoints,
    absentPenaltyPoints,
    pointsSpent,
    netBalance,
    availablePoints: Math.max(0, netBalance),
  };
}

rewardsRouter.use(authenticateToken);

rewardsRouter.get('/items', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const includeInactive = req.user?.role !== 'trainee';
    const [rows] = await getPool().query<any[]>(
      `SELECT * FROM reward_items ${includeInactive ? '' : 'WHERE is_active = 1'} ORDER BY created_at DESC`
    );
    return res.json({ success: true, items: rows.map(mapReward) });
  } catch (error) {
    console.error('[Rewards] Gagal memuat katalog:', error);
    return res.status(500).json({ success: false, message: 'Gagal memuat katalog hadiah.' });
  }
});

rewardsRouter.get('/balance', async (req: AuthenticatedRequest, res: Response) => {
  if (req.user?.role !== 'trainee') {
    return res.status(403).json({ success: false, message: 'Saldo penukaran hanya tersedia untuk peserta.' });
  }
  let connection: PoolConnection | undefined;
  try {
    connection = await getPool().getConnection();
    const balance = await getSpendableBalance(connection, req.user.id);
    if (!balance) return res.status(403).json({ success: false, message: 'Hanya peserta aktif yang dapat menukar hadiah.' });
    return res.json({ success: true, balance });
  } catch (error) {
    console.error('[Rewards] Gagal menghitung saldo:', error);
    return res.status(500).json({ success: false, message: 'Gagal menghitung saldo poin.' });
  } finally {
    connection?.release();
  }
});

rewardsRouter.get('/redemptions', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const isTrainee = req.user?.role === 'trainee';
    const [rows] = await getPool().query<any[]>(
      `SELECT * FROM reward_redemptions
       ${isTrainee ? 'WHERE trainee_id = ?' : ''}
       ORDER BY redeemed_at DESC LIMIT 500`,
      isTrainee ? [req.user!.id] : []
    );
    return res.json({ success: true, redemptions: rows.map(mapRedemption) });
  } catch (error) {
    console.error('[Rewards] Gagal memuat riwayat:', error);
    return res.status(500).json({ success: false, message: 'Gagal memuat riwayat penukaran.' });
  }
});

rewardsRouter.post('/redemptions', async (req: AuthenticatedRequest, res: Response) => {
  if (req.user?.role !== 'trainee') {
    return res.status(403).json({ success: false, message: 'Hanya peserta yang dapat menukar hadiah.' });
  }
  const rewardId = String(req.body?.rewardId || '').trim();
  const requestId = String(req.body?.requestId || '').trim();
  if (!rewardId || !/^[\w-]{16,64}$/.test(requestId)) {
    return res.status(400).json({ success: false, message: 'Permintaan penukaran tidak valid.' });
  }

  let connection: PoolConnection | undefined;
  try {
    connection = await getPool().getConnection();
    await connection.beginTransaction();
    const [userRows] = await connection.query<any[]>(
      `SELECT id FROM users WHERE id = ? AND role = 'trainee' AND status = 'active' FOR UPDATE`,
      [req.user.id]
    );
    if (!userRows.length) {
      if (connection) await connection.rollback();
      return res.status(403).json({ success: false, message: 'Hanya peserta aktif yang dapat menukar hadiah.' });
    }
    const [existingRows] = await connection.query<any[]>(
      'SELECT * FROM reward_redemptions WHERE id = ? LIMIT 1',
      [requestId]
    );
    if (existingRows.length) {
      if (String(existingRows[0].trainee_id) !== req.user.id ||
          String(existingRows[0].reward_id) !== rewardId) {
        await connection.rollback();
        return res.status(409).json({ success: false, message: 'ID permintaan sudah digunakan.' });
      }
      const balance = await getSpendableBalance(connection, req.user.id);
      await connection.commit();
      return res.json({ success: true, redemption: mapRedemption(existingRows[0]), balance });
    }

    const [rewardRows] = await connection.query<any[]>(
      'SELECT * FROM reward_items WHERE id = ? AND is_active = 1 FOR UPDATE',
      [rewardId]
    );
    const reward = rewardRows[0];
    if (!reward) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'Hadiah tidak tersedia.' });
    }
    if (Number(reward.stock) < 1) {
      await connection.rollback();
      return res.status(409).json({ success: false, message: 'Stok hadiah sudah habis.' });
    }
    const balance = await getSpendableBalance(connection, req.user.id);
    if (!balance) {
      await connection.rollback();
      return res.status(403).json({ success: false, message: 'Hanya peserta aktif yang dapat menukar hadiah.' });
    }
    if (balance.availablePoints < Number(reward.points_cost)) {
      await connection.rollback();
      return res.status(409).json({
        success: false,
        message: 'Saldo poin tidak mencukupi.',
        availablePoints: balance.availablePoints,
      });
    }

    await connection.query('UPDATE reward_items SET stock = stock - 1 WHERE id = ? AND stock > 0', [rewardId]);
    const pickupCode = `PSA-${randomBytes(3).toString('hex').toUpperCase()}`;
    await connection.query(
      `INSERT INTO reward_redemptions
       (id, reward_id, reward_title, trainee_id, trainee_name, points_spent, status, pickup_code, redeemed_at)
       VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, NOW())`,
      [requestId, rewardId, reward.title, req.user.id, req.user.name, Number(reward.points_cost), pickupCode]
    );
    const updatedBalance = await getSpendableBalance(connection, req.user.id);
    await connection.commit();
    return res.status(201).json({
      success: true,
      redemption: {
        id: requestId,
        rewardId,
        rewardTitle: String(reward.title),
        traineeId: req.user.id,
        traineeName: req.user.name,
        pointsSpent: Number(reward.points_cost),
        status: 'pending',
        pickupCode,
        redeemedAt: new Date().toISOString(),
        notes: '',
      },
      balance: updatedBalance,
    });
  } catch (error: any) {
    if (connection) await connection.rollback();
    console.error('[Rewards] Penukaran gagal:', error);
    if (error?.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, message: 'Permintaan penukaran sudah diproses.' });
    }
    return res.status(500).json({ success: false, message: 'Penukaran hadiah gagal diproses.' });
  } finally {
    connection?.release();
  }
});

rewardsRouter.post('/items', async (req: AuthenticatedRequest, res: Response) => {
  if (req.user?.role !== 'admin' && req.user?.role !== 'mentor') {
    return res.status(403).json({ success: false, message: 'Hanya mentor/admin yang dapat mengelola katalog.' });
  }
  const title = String(req.body?.title || '').trim();
  const category = String(req.body?.category || '').trim();
  const pointsCost = Number(req.body?.pointsCost);
  const stock = Number(req.body?.stock);
  const description = String(req.body?.description || '').trim();
  const imageUrl = String(req.body?.imageUrl || '').trim();
  const imagePublicId = String(req.body?.imagePublicId || '').trim();
  if (!title || title.length > 150 || !category || category.length > 64 ||
      !Number.isSafeInteger(pointsCost) || pointsCost < 1 || pointsCost > 2_147_483_647 ||
      !Number.isSafeInteger(stock) || stock < 0 || stock > 2_147_483_647 ||
      description.length > 60_000 || imageUrl.length > 2_048 || !isValidImageUrl(imageUrl) || imagePublicId.length > 255) {
    return res.status(400).json({ success: false, message: 'Data hadiah atau URL gambar tidak valid.' });
  }
  const item = {
    id: randomUUID(),
    title,
    description,
    pointsCost,
    stock,
    imageUrl,
    imagePublicId,
    category,
    isActive: req.body?.isActive !== false,
  };
  try {
    await getPool().query(
      `INSERT INTO reward_items
       (id, title, description, points_cost, stock, image_url, image_public_id, category, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [item.id, item.title, item.description, item.pointsCost, item.stock, item.imageUrl, item.imagePublicId, item.category, item.isActive]
    );
    return res.status(201).json({ success: true, item });
  } catch (error) {
    console.error('[Rewards] Gagal membuat hadiah:', error);
    return res.status(500).json({ success: false, message: 'Gagal menyimpan hadiah.' });
  }
});

rewardsRouter.put('/items/:id', async (req: AuthenticatedRequest, res: Response) => {
  if (req.user?.role !== 'admin' && req.user?.role !== 'mentor') {
    return res.status(403).json({ success: false, message: 'Hanya mentor/admin yang dapat mengelola katalog.' });
  }
  const title = String(req.body?.title || '').trim();
  const category = String(req.body?.category || '').trim();
  const pointsCost = Number(req.body?.pointsCost);
  const stock = Number(req.body?.stock);
  const description = String(req.body?.description || '').trim();
  const imageUrl = String(req.body?.imageUrl || '').trim();
  const imagePublicId = String(req.body?.imagePublicId || '').trim();
  if (!title || title.length > 150 || !category || category.length > 64 ||
      !Number.isSafeInteger(pointsCost) || pointsCost < 1 || pointsCost > 2_147_483_647 ||
      !Number.isSafeInteger(stock) || stock < 0 || stock > 2_147_483_647 ||
      description.length > 60_000 || imageUrl.length > 2_048 || !isValidImageUrl(imageUrl) || imagePublicId.length > 255) {
    return res.status(400).json({ success: false, message: 'Data hadiah atau URL gambar tidak valid.' });
  }
  try {
    const [result]: any = await getPool().query(
      `UPDATE reward_items
       SET title = ?, description = ?, points_cost = ?, stock = ?, image_url = ?, image_public_id = ?, category = ?, is_active = ?
       WHERE id = ?`,
      [
        title,
        description,
        pointsCost,
        stock,
        imageUrl,
        imagePublicId,
        category,
        req.body?.isActive === false ? 0 : 1,
        req.params.id,
      ]
    );
    if (!result.affectedRows) return res.status(404).json({ success: false, message: 'Hadiah tidak ditemukan.' });
    return res.json({ success: true, message: 'Hadiah berhasil diperbarui.' });
  } catch (error) {
    console.error('[Rewards] Gagal memperbarui hadiah:', error);
    return res.status(500).json({ success: false, message: 'Gagal memperbarui hadiah.' });
  }
});

rewardsRouter.delete('/items/:id', async (req: AuthenticatedRequest, res: Response) => {
  if (req.user?.role !== 'admin' && req.user?.role !== 'mentor') {
    return res.status(403).json({ success: false, message: 'Hanya mentor/admin yang dapat mengelola katalog.' });
  }
  try {
    const [result]: any = await getPool().query(
      'DELETE FROM reward_items WHERE id = ?',
      [req.params.id]
    );
    if (!result.affectedRows) return res.status(404).json({ success: false, message: 'Hadiah tidak ditemukan.' });
    return res.json({ success: true, message: 'Hadiah berhasil dihapus.' });
  } catch (error) {
    console.error('[Rewards] Gagal menghapus hadiah:', error);
    return res.status(500).json({ success: false, message: 'Gagal menghapus hadiah.' });
  }
});

rewardsRouter.patch('/redemptions/:id', async (req: AuthenticatedRequest, res: Response) => {
  if (req.user?.role !== 'admin' && req.user?.role !== 'mentor') {
    return res.status(403).json({ success: false, message: 'Hanya mentor/admin yang dapat memproses penukaran.' });
  }
  const status = String(req.body?.status || '');
  const notes = String(req.body?.notes || '').trim();
  if (!['ready', 'completed', 'cancelled'].includes(status)) {
    return res.status(400).json({ success: false, message: 'Status penukaran tidak valid.' });
  }
  let connection: PoolConnection | undefined;
  try {
    connection = await getPool().getConnection();
    await connection.beginTransaction();
    const [rows] = await connection.query<any[]>(
      'SELECT * FROM reward_redemptions WHERE id = ? FOR UPDATE',
      [req.params.id]
    );
    const redemption = rows[0];
    if (!redemption) {
      if (connection) await connection.rollback();
      return res.status(404).json({ success: false, message: 'Permintaan penukaran tidak ditemukan.' });
    }
    const currentStatus = String(redemption.status);
    const validTransition =
      (status === 'ready' && currentStatus === 'pending') ||
      (status === 'completed' && currentStatus === 'ready') ||
      (status === 'cancelled' && (currentStatus === 'pending' || currentStatus === 'ready'));
    if (!validTransition) {
      await connection.rollback();
      return res.status(409).json({ success: false, message: 'Perubahan status ini tidak diperbolehkan.' });
    }
    if (status === 'cancelled') {
      await connection.query('UPDATE reward_items SET stock = stock + 1 WHERE id = ?', [redemption.reward_id]);
    }
    const combinedNotes = [String(redemption.notes || '').trim(), notes].filter(Boolean).join('\n');
    await connection.query(
      `UPDATE reward_redemptions
       SET status = ?, notes = ?, updated_by = ?, completed_at = ${status === 'completed' ? 'NOW()' : 'NULL'}
       WHERE id = ?`,
      [status, combinedNotes, req.user.id, req.params.id]
    );
    await connection.commit();
    return res.json({ success: true, message: 'Status penukaran berhasil diperbarui.' });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error('[Rewards] Gagal memperbarui status penukaran:', error);
    return res.status(500).json({ success: false, message: 'Gagal memperbarui status penukaran.' });
  } finally {
    connection?.release();
  }
});
