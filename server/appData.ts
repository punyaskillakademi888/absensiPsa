import { Router, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { getPool } from './db.js';
import { authenticateToken, AuthenticatedRequest } from './auth.js';
import { canonicalKejuruanCode } from './kejuruanCodes.js';

export const appDataRouter = Router();

const dateValue = (value?: string) => value ? String(value).slice(0, 10) : null;
const dateTimeValue = (value?: string) => value ? String(value).replace('T', ' ').replace(/Z$/, '').slice(0, 19) : null;
const dateText = (value: any) => value instanceof Date ? value.toISOString().slice(0, 10) : value ? String(value).slice(0, 10) : '';
const dateTimeText = (value: any) => value instanceof Date ? value.toISOString() : value ? String(value).replace(' ', 'T') : undefined;

const mapAttendance = (r: any) => ({
  id: r.id, userId: r.user_id, userName: r.user_name, userNim: r.user_nim, userRole: r.user_role,
  kejuruanId: r.kejuruan_id || '', kejuruanName: r.kejuruan_name || '', date: dateText(r.attendance_date),
  checkInTime: r.check_in_time || undefined, checkOutTime: r.check_out_time || undefined,
  status: r.status, workMode: r.work_mode || undefined, verificationStatus: r.verification_status, verifiedBy: r.verified_by || undefined,
  verifiedAt: dateTimeText(r.verified_at), location: r.location || undefined,
  coordinates: r.latitude == null || r.longitude == null ? undefined : { lat: Number(r.latitude), lng: Number(r.longitude) },
  notes: r.notes || undefined, photoUrl: r.photo_url || undefined, rejectionReason: r.rejection_reason || undefined,
});
const mapLeave = (r: any) => ({
  id: r.id, userId: r.user_id, userName: r.user_name, userNim: r.user_nim, kejuruanId: r.kejuruan_id || '',
  kejuruanName: r.kejuruan_name || '', type: r.request_type, startDate: dateText(r.start_date), endDate: dateText(r.end_date),
  daysCount: r.days_count, reason: r.reason, attachmentName: r.attachment_name || undefined,
  attachmentUrl: r.attachment_url || undefined, status: r.status, submittedAt: dateTimeText(r.submitted_at),
  reviewedBy: r.reviewed_by || undefined, reviewedAt: dateTimeText(r.reviewed_at), reviewNotes: r.review_notes || undefined,
});
const mapKejuruan = (r: any) => ({
  id: r.id, name: r.name, code: canonicalKejuruanCode(r.name, r.code), category: r.category, color: r.color,
  description: r.description || '', mentorId: r.mentor_id || undefined, mentorName: r.mentor_name || undefined,
});
const mapMission = (r: any) => ({
  id: r.id, title: r.title, description: r.description, kejuruanId: r.kejuruan_id, kejuruanName: r.kejuruan_name,
  mentorId: r.mentor_id, mentorName: r.mentor_name, points: r.points, difficulty: r.difficulty,
  dueDate: dateText(r.due_date), createdAt: dateText(r.created_at), status: r.status,
  category: r.category || undefined, submissionGuide: r.submission_guide || undefined,
});
const mapSubmission = (r: any) => ({
  id: r.id, missionId: r.mission_id, missionTitle: r.mission_title, traineeId: r.trainee_id,
  traineeName: r.trainee_name, traineeNim: r.trainee_nim, traineeAvatar: r.trainee_avatar || '',
  kejuruanId: r.kejuruan_id || '', kejuruanName: r.kejuruan_name || '', submissionLink: r.submission_link || undefined,
  notes: r.notes || '', points: r.points, submittedAt: dateTimeText(r.submitted_at), status: r.status,
  reviewedBy: r.reviewed_by || undefined, reviewedAt: dateTimeText(r.reviewed_at), feedback: r.feedback || undefined,
});
const mapReport = (r: any) => ({
  id: r.id, traineeId: r.trainee_id, traineeName: r.trainee_name, traineeNim: r.trainee_nim,
  traineeAvatar: r.trainee_avatar || '', kejuruanId: r.kejuruan_id || '', kejuruanName: r.kejuruan_name || '',
  date: dateText(r.report_date), description: r.description, photoUrl: r.photo_url || undefined,
  photoName: r.photo_name || undefined, submissionLink: r.submission_link || undefined, status: r.status,
  submittedAt: dateTimeText(r.submitted_at), reviewedBy: r.reviewed_by || undefined,
  reviewedAt: dateTimeText(r.reviewed_at), reviewNotes: r.review_notes || undefined,
});

const assignedProgramNames = (user: { kejuruanName?: string | null }) =>
  user.kejuruanName?.trim() ? [user.kejuruanName.trim().toLowerCase()] : [];

const normalizedNameClause = (column: string, names: string[]) => names.length
  ? `LOWER(TRIM(${column})) IN (${names.map(() => '?').join(',')})`
  : '';

appDataRouter.get('/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    const pool = getPool();
    const scope = user.role === 'admin' ? null : user.role === 'mentor' ? user.kejuruanId || '' : user.id;
    const programNames = user.role === 'admin' ? [] : assignedProgramNames(user);
    const nameClause = normalizedNameClause('name', programNames);
    const [kejuruanRows] = await pool.query<any[]>(scope === null
      ? 'SELECT * FROM kejuruan ORDER BY name'
      : user.role === 'mentor'
        ? `SELECT * FROM kejuruan WHERE id = ? OR mentor_id = ?${nameClause ? ` OR ${nameClause}` : ''} ORDER BY name`
        : `SELECT * FROM kejuruan WHERE id = ?${nameClause ? ` OR ${nameClause}` : ''} ORDER BY name`,
    scope === null ? [] : user.role === 'mentor' ? [scope, user.id, ...programNames] : [user.kejuruanId || '', ...programNames]);

    const scopedQuery = async (table: string, field: string, value: string | null) => {
      const [rows] = await pool.query<any[]>(value === null ? `SELECT * FROM ${table}` : `SELECT * FROM ${table} WHERE ${field} = ?`, value === null ? [] : [value]);
      return rows;
    };
    const mentorKejuruanIds = user.role === 'mentor'
      ? [...new Set([
          ...kejuruanRows.map((row: any) => String(row.id)),
          ...(user.kejuruanId ? [String(user.kejuruanId)] : []),
        ])]
      : [];
    const scopedKejuruanQuery = async (table: string, field: string, ids: string[], names: string[], personalValue: string) => {
      if (user.role === 'admin') return scopedQuery(table, '', null);
      if (user.role === 'trainee' && table !== 'missions') return scopedQuery(table, field, personalValue);
      const clauses: string[] = [];
      const params: string[] = [];
      if (ids.length) {
        clauses.push(`kejuruan_id IN (${ids.map(() => '?').join(',')})`);
        params.push(...ids);
      }
      const programNameClause = normalizedNameClause('kejuruan_name', names);
      if (programNameClause) {
        clauses.push(programNameClause);
        params.push(...names);
      }
      if (user.role === 'trainee' && table === 'missions') {
        clauses.push('kejuruan_id = ?');
        params.push(personalValue);
      }
      if (!clauses.length) return [];
      const [rows] = await pool.query<any[]>(
        `SELECT * FROM ${table} WHERE ${clauses.join(' OR ')}`,
        params
      );
      return rows;
    };
    const [scopedAttendanceRows, leaveRows, missionRows, scopedSubmissionRows, reportRows, settingRows] = await Promise.all([
      user.role === 'mentor'
        ? (async () => {
            const clauses: string[] = [];
            const params: string[] = [];
            // A mentor's own attendance is keyed by users.id, independently of
            // whether the mentor profile still has a matching program ID/name.
            clauses.push('a.user_id = ?');
            params.push(user.id);
            if (mentorKejuruanIds.length) {
              clauses.push(`a.kejuruan_id IN (${mentorKejuruanIds.map(() => '?').join(',')})`);
              params.push(...mentorKejuruanIds);
              clauses.push(`u.kejuruan_id IN (${mentorKejuruanIds.map(() => '?').join(',')})`);
              params.push(...mentorKejuruanIds);
            }
            for (const column of ['a.kejuruan_name', 'u.kejuruan_name']) {
              const nameClause = normalizedNameClause(column, programNames);
              if (nameClause) {
                clauses.push(nameClause);
                params.push(...programNames);
              }
            }
            if (!clauses.length) return [];
            const [rows] = await pool.query<any[]>(
              `SELECT DISTINCT a.* FROM attendance_records a LEFT JOIN users u ON u.id = a.user_id WHERE ${clauses.map(clause => `(${clause})`).join(' OR ')}`,
              params
            );
            return rows;
          })()
        : scopedKejuruanQuery('attendance_records', 'user_id', [], [], user.id),
      scopedKejuruanQuery('leave_requests', user.role === 'trainee' ? 'user_id' : 'kejuruan_id', mentorKejuruanIds, programNames, user.id),
      scopedKejuruanQuery('missions', 'kejuruan_id', mentorKejuruanIds, programNames, user.kejuruanId || ''),
      user.role === 'mentor'
        ? (async () => {
            const clauses: string[] = [];
            const params: string[] = [];
            if (mentorKejuruanIds.length) {
              clauses.push(`s.kejuruan_id IN (${mentorKejuruanIds.map(() => '?').join(',')})`);
              params.push(...mentorKejuruanIds);
              clauses.push(`m.kejuruan_id IN (${mentorKejuruanIds.map(() => '?').join(',')})`);
              params.push(...mentorKejuruanIds);
            }
            const submissionNameClause = normalizedNameClause('s.kejuruan_name', programNames);
            const missionNameClause = normalizedNameClause('m.kejuruan_name', programNames);
            if (submissionNameClause) {
              clauses.push(submissionNameClause);
              params.push(...programNames);
            }
            if (missionNameClause) {
              clauses.push(missionNameClause);
              params.push(...programNames);
            }
            if (!clauses.length) return [];
            const [rows] = await pool.query<any[]>(
              `SELECT DISTINCT s.* FROM mission_submissions s LEFT JOIN missions m ON m.id = s.mission_id WHERE ${clauses.map(clause => `(${clause})`).join(' OR ')}`,
              params
            );
            return rows;
          })()
        : scopedKejuruanQuery('mission_submissions', 'trainee_id', [], [], user.id),
      scopedKejuruanQuery('daily_reports', user.role === 'trainee' ? 'trainee_id' : 'kejuruan_id', mentorKejuruanIds, programNames, user.id),
      pool.query<any[]>('SELECT * FROM attendance_settings ORDER BY updated_at DESC LIMIT 1'),
    ]);
    const attendanceRows = scopedAttendanceRows;
    const submissionRows = scopedSubmissionRows;
    const setting = settingRows[0][0];
    const officeLocation = setting
      ? typeof setting.office_location === 'string' ? JSON.parse(setting.office_location) : setting.office_location
      : null;
    const legacyOfficePin = officeLocation?.lat === -6.921024681282541 && officeLocation?.lng === 107.6750205521894;
    return res.json({
      success: true,
      kejuruanList: kejuruanRows.map(mapKejuruan),
      attendanceRecords: attendanceRows.map(mapAttendance),
      leaveRequests: leaveRows.map(mapLeave),
      missions: missionRows.map(mapMission),
      missionSubmissions: submissionRows.map(mapSubmission),
      dailyReports: reportRows.map(mapReport),
      settings: setting ? {
        startTime: setting.start_time, lateLimitTime: setting.late_limit_time, endTime: setting.end_time,
        allowCheckoutStart: setting.allow_checkout_start,
        workDays: typeof setting.work_days === 'string' ? JSON.parse(setting.work_days) : setting.work_days,
        officeLocation: legacyOfficePin ? {
          ...officeLocation,
          lat: -6.921045982595817,
          lng: 107.67498836568335,
        } : officeLocation,
      } : null,
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: 'Gagal memuat data aplikasi dari TiDB.', error: error.message });
  }
});

appDataRouter.get('/hall-of-fame/trainees', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  if (req.user?.role !== 'trainee') {
    return res.status(403).json({ success: false, message: 'Peringkat peserta hanya tersedia untuk akun peserta.' });
  }

  try {
    const [rows] = await getPool().query<any[]>(`
      SELECT u.id, u.nim, u.name, u.avatar, u.kejuruan_id, u.kejuruan_name,
             COUNT(s.id) AS completed_missions_count,
             COALESCE(SUM(s.points), 0) AS total_points
      FROM users u
      LEFT JOIN mission_submissions s ON s.trainee_id = u.id AND s.status = 'approved'
      WHERE u.role = 'trainee'
      GROUP BY u.id, u.nim, u.name, u.avatar, u.kejuruan_id, u.kejuruan_name
      ORDER BY total_points DESC, completed_missions_count DESC, u.name ASC
    `);
    return res.json({
      success: true,
      trainees: rows.map((row: any) => ({
        id: row.id,
        nim: row.nim,
        name: row.name,
        avatar: row.avatar || '',
        kejuruanId: row.kejuruan_id || undefined,
        kejuruanName: row.kejuruan_name || undefined,
        totalPoints: Number(row.total_points),
        completedMissionsCount: Number(row.completed_missions_count),
      })),
    });
  } catch (error: any) {
    console.error('[Trainee Hall of Fame Error]', error);
    return res.status(500).json({ success: false, message: 'Gagal memuat peringkat peserta.' });
  }
});

appDataRouter.get('/hall-of-fame/mentors', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  if (req.user?.role !== 'admin' && req.user?.role !== 'mentor') {
    return res.status(403).json({ success: false, message: 'Peringkat mentor hanya tersedia untuk admin dan mentor.' });
  }

  try {
    const mentorScope = req.user.role === 'mentor' ? 'AND mentor.id = ?' : '';
    const [rows] = await getPool().query<any[]>(`
      SELECT mentor.id, mentor.nim, mentor.name, mentor.kejuruan_name,
             COUNT(DISTINCT CASE WHEN submission.status = 'approved' THEN submission.id END) AS completed_missions_count,
             COALESCE(SUM(
               CASE WHEN submission.status = 'approved'
                 THEN submission.points / COALESCE(NULLIF(trainee_counts.active_trainees, 0), 1)
                 ELSE 0
               END
             ), 0) AS total_points
      FROM users mentor
      LEFT JOIN missions mission ON mission.mentor_id = mentor.id
      LEFT JOIN mission_submissions submission ON submission.mission_id = mission.id
      LEFT JOIN (
        SELECT kejuruan_id, COUNT(*) AS active_trainees
        FROM users
        WHERE role = 'trainee' AND status = 'active'
        GROUP BY kejuruan_id
      ) trainee_counts ON trainee_counts.kejuruan_id = mission.kejuruan_id
      WHERE mentor.role = 'mentor' ${mentorScope}
      GROUP BY mentor.id, mentor.nim, mentor.name, mentor.kejuruan_name
      ORDER BY total_points DESC, completed_missions_count DESC, mentor.name ASC
    `, req.user.role === 'mentor' ? [req.user.id] : []);

    return res.json({
      success: true,
      mentors: rows.map((row: any) => ({
        id: row.id,
        nim: row.nim,
        name: row.name,
        kejuruanName: row.kejuruan_name || undefined,
        totalPoints: Number(Number(row.total_points).toFixed(1)),
        completedMissionsCount: Number(row.completed_missions_count),
      })),
    });
  } catch (error: any) {
    console.error('[Mentor Hall of Fame Error]', error);
    return res.status(500).json({ success: false, message: 'Gagal memuat peringkat mentor.' });
  }
});

appDataRouter.post('/hall-of-fame/reset-trainee-points', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Hanya admin yang dapat mereset poin Hall of Fame peserta.' });
  }

  try {
    const [result]: any = await getPool().query('UPDATE mission_submissions SET points = 0 WHERE points <> 0');
    const count = Number(result?.affectedRows || 0);
    return res.json({
      success: true,
      count,
      message: `Poin HOF peserta berhasil direset untuk ${count} submission. Riwayat submission tetap tersimpan.`,
    });
  } catch (error: any) {
    console.error('[Reset Trainee HOF Points Error]', error);
    return res.status(500).json({ success: false, count: 0, message: 'Gagal mereset poin HOF peserta.' });
  }
});

appDataRouter.post('/missions/reset', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  if (req.user?.role !== 'mentor') {
    return res.status(403).json({ success: false, missions: 0, submissions: 0, message: 'Hanya mentor yang dapat mereset data misi.' });
  }

  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();
    const [missions] = await connection.query<any[]>('SELECT id FROM missions WHERE mentor_id = ?', [req.user.id]);
    const missionIds = missions.map((mission: any) => String(mission.id));
    let submissionCount = 0;
    if (missionIds.length) {
      const placeholders = missionIds.map(() => '?').join(',');
      const [result]: any = await connection.query(`DELETE FROM mission_submissions WHERE mission_id IN (${placeholders})`, missionIds);
      submissionCount = Number(result?.affectedRows || 0);
    }
    const [missionResult]: any = await connection.query('DELETE FROM missions WHERE mentor_id = ?', [req.user.id]);
    const missionCount = Number(missionResult?.affectedRows || 0);
    await connection.commit();
    return res.json({
      success: true,
      missions: missionCount,
      submissions: submissionCount,
      message: `Data misi berhasil dibersihkan: ${missionCount} misi dan ${submissionCount} tugas/review dihapus beserta poinnya.`,
    });
  } catch (error: any) {
    await connection.rollback();
    console.error('[Reset Mission Submission Points Error]', error);
    return res.status(500).json({ success: false, missions: 0, submissions: 0, message: 'Gagal membersihkan data misi.' });
  } finally {
    connection.release();
  }
});

appDataRouter.put('/settings', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Hanya admin yang dapat mengubah pengaturan lokasi presensi.' });
  }

  const settings = req.body || {};
  const location = settings.officeLocation || {};
  const lat = Number(location.lat);
  const lng = Number(location.lng);
  const radiusMeters = Number(location.radiusMeters);
  if (
    typeof settings.startTime !== 'string' || !settings.startTime ||
    typeof settings.lateLimitTime !== 'string' || !settings.lateLimitTime ||
    typeof settings.endTime !== 'string' || !settings.endTime ||
    typeof settings.allowCheckoutStart !== 'string' || !settings.allowCheckoutStart ||
    !Array.isArray(settings.workDays) || typeof location.name !== 'string' || !location.name.trim() ||
    !Number.isFinite(lat) || lat < -90 || lat > 90 ||
    !Number.isFinite(lng) || lng < -180 || lng > 180 ||
    !Number.isFinite(radiusMeters) || radiusMeters < 10 || radiusMeters > 5000
  ) {
    return res.status(400).json({ success: false, message: 'Pengaturan jam atau koordinat lokasi tidak valid.' });
  }

  try {
    await getPool().query(
      `INSERT INTO attendance_settings (id,start_time,late_limit_time,end_time,allow_checkout_start,work_days,office_location,updated_by)
       VALUES ('global',?,?,?,?,?,?,?)
       ON DUPLICATE KEY UPDATE start_time=VALUES(start_time),late_limit_time=VALUES(late_limit_time),
       end_time=VALUES(end_time),allow_checkout_start=VALUES(allow_checkout_start),work_days=VALUES(work_days),
       office_location=VALUES(office_location),updated_by=VALUES(updated_by)`,
      [settings.startTime, settings.lateLimitTime, settings.endTime, settings.allowCheckoutStart,
        JSON.stringify(settings.workDays), JSON.stringify({ ...location, lat, lng, radiusMeters }), req.user.id]
    );
    return res.json({ success: true, message: 'Pengaturan lokasi presensi berhasil disimpan.' });
  } catch (error: any) {
    console.error('[Attendance Settings Save Error]', error);
    return res.status(500).json({ success: false, message: 'Pengaturan lokasi presensi gagal disimpan ke database.' });
  }
});

appDataRouter.put('/attendance', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const input = req.body || {};
  const date = String(input.date || '');
  const timePattern = /^\d{2}:\d{2}(:\d{2})?$/;
  const checkInTime = input.checkInTime ? String(input.checkInTime) : null;
  const checkOutTime = input.checkOutTime ? String(input.checkOutTime) : null;
  const validStatuses = ['hadir', 'terlambat', 'izin', 'sakit', 'alpha'];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      (checkInTime && !timePattern.test(checkInTime)) ||
      (checkOutTime && !timePattern.test(checkOutTime)) ||
      !validStatuses.includes(input.status)) {
    return res.status(400).json({ success: false, message: 'Data presensi tidak valid.' });
  }

  try {
    const targetUserId = user.role === 'trainee' ? user.id : String(input.userId || user.id);
    if (user.role === 'trainee' && !['hadir', 'terlambat'].includes(input.status)) {
      return res.status(403).json({ success: false, message: 'Peserta hanya dapat mencatat check-in dan check-out sendiri.' });
    }
    const pool = getPool();
    const [targetRows] = await pool.query<any[]>(
      'SELECT id,name,nim,role,kejuruan_id,kejuruan_name FROM users WHERE id = ? LIMIT 1',
      [targetUserId]
    );
    const target = targetRows[0];
    if (!target) return res.status(404).json({ success: false, message: 'Akun untuk record presensi tidak ditemukan.' });

    if (user.role === 'mentor' && target.id !== user.id) {
      const names = assignedProgramNames(user);
      const nameClause = normalizedNameClause('name', names);
      const [programRows] = await pool.query<any[]>(
        `SELECT id FROM kejuruan WHERE id = ? OR mentor_id = ?${nameClause ? ` OR ${nameClause}` : ''}`,
        [user.kejuruanId || '', user.id, ...names]
      );
      const programIds = new Set<string>([
        ...programRows.map((row: any) => String(row.id)),
        ...(user.kejuruanId ? [String(user.kejuruanId)] : []),
      ]);
      const belongsById = programIds.has(String(target.kejuruan_id || ''));
      const belongsByName = names.includes(String(target.kejuruan_name || '').trim().toLowerCase());
      if (target.role !== 'trainee' || (!belongsById && !belongsByName)) {
        return res.status(403).json({ success: false, message: 'Mentor tidak dapat mengubah presensi peserta di luar kejuruan binaannya.' });
      }
    }

    const isReview = user.role === 'admin' || (user.role === 'mentor' && target.id !== user.id);
    const requestedVerification = ['verified', 'rejected'].includes(input.verificationStatus)
      ? input.verificationStatus
      : 'pending';
    const verificationStatus = isReview ? requestedVerification : 'pending';
    const verifiedBy = isReview && verificationStatus !== 'pending'
      ? `${user.name} (${user.role === 'admin' ? 'Admin' : 'Mentor'})`
      : null;
    const verifiedAt = verifiedBy ? new Date().toISOString().slice(0, 19).replace('T', ' ') : null;
    const coordinates = input.coordinates || {};
    const [existingRows] = await pool.query<any[]>(
      'SELECT * FROM attendance_records WHERE user_id = ? AND attendance_date = ? ORDER BY created_at ASC LIMIT 1',
      [target.id, date]
    );
    const existingRecord = existingRows[0];
    // A retry or stale browser state must never replace the original check-in
    // time or agenda. Return the persisted row as the source of truth.
    if (existingRecord && target.id === user.id && checkInTime && !checkOutTime && existingRecord.check_in_time) {
      return res.json({
        success: true,
        duplicate: true,
        message: 'Check-in hari ini sudah tercatat.',
        attendanceRecord: mapAttendance(existingRecord),
      });
    }
    // Old deterministic IDs (`att-<user>-<date>`) can collide with legacy
    // records. The database's UNIQUE(user_id, attendance_date) is the proper
    // idempotency key; use an unrelated random primary key for new rows.
    const id = existingRecord?.id || `att-${randomUUID()}`;
    const canWriteReview = isReview ? 1 : 0;
    const protectExistingCheckIn = target.id === user.id && !!checkInTime && !checkOutTime;
    const [writeResult] = await pool.query<any>(
      `INSERT INTO attendance_records (
        id,user_id,user_name,user_nim,user_role,kejuruan_id,kejuruan_name,attendance_date,
        check_in_time,check_out_time,status,verification_status,verified_by,verified_at,
        location,latitude,longitude,notes,photo_url,rejection_reason,work_mode
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      ON DUPLICATE KEY UPDATE
        notes=${protectExistingCheckIn ? 'IF(check_in_time IS NULL,VALUES(notes),notes)' : 'VALUES(notes)'},
        work_mode=${protectExistingCheckIn ? 'IF(check_in_time IS NULL,COALESCE(VALUES(work_mode),work_mode),COALESCE(work_mode,VALUES(work_mode)))' : 'COALESCE(VALUES(work_mode),work_mode)'},
        check_in_time=COALESCE(VALUES(check_in_time),check_in_time),
        check_out_time=COALESCE(VALUES(check_out_time),check_out_time),
        status=VALUES(status),location=VALUES(location),latitude=VALUES(latitude),
        longitude=VALUES(longitude),photo_url=VALUES(photo_url),
        verification_status=IF(?,VALUES(verification_status),verification_status),
        verified_by=IF(?,VALUES(verified_by),verified_by),verified_at=IF(?,VALUES(verified_at),verified_at),
        rejection_reason=IF(?,VALUES(rejection_reason),rejection_reason)`,
      [
        id,target.id,target.name,target.nim,target.role,target.kejuruan_id || null,target.kejuruan_name || 'Umum',date,
        checkInTime,checkOutTime,input.status,verificationStatus,verifiedBy,verifiedAt,
        input.location || null,coordinates.lat ?? null,coordinates.lng ?? null,input.notes || null,input.photoUrl || null,
        isReview ? input.rejectionReason || null : null,input.workMode === 'WFH' ? 'WFH' : input.workMode === 'WFO' ? 'WFO' : null,
        canWriteReview,canWriteReview,canWriteReview,canWriteReview,
      ]
    );
    // Read back by primary key first so the response identifies the exact row
    // affected by INSERT/ON DUPLICATE KEY, even when an older row uses a
    // non-canonical ID. Fall back to the natural key for concurrent upserts.
    let [savedRows] = await pool.query<any[]>('SELECT * FROM attendance_records WHERE id = ? LIMIT 1', [id]);
    if (!savedRows[0]) {
      [savedRows] = await pool.query<any[]>(
        'SELECT * FROM attendance_records WHERE user_id = ? AND attendance_date = ? LIMIT 1',
        [target.id, date]
      );
    }
    if (!savedRows[0]) {
      const affectedRows = writeResult?.affectedRows ?? 'unknown';
      throw new Error(`Presensi tidak ditemukan setelah simpan (user=${target.id}, date=${date}, id=${id}, affectedRows=${affectedRows}).`);
    }
    if (String(savedRows[0].user_id) !== String(target.id) || dateText(savedRows[0].attendance_date) !== date) {
      throw new Error(`Record hasil simpan tidak cocok dengan pemilik/tanggal request (user=${target.id}, date=${date}, id=${id}).`);
    }
    return res.json({
      success: true,
      message: 'Presensi berhasil disimpan.',
      attendanceRecord: mapAttendance(savedRows[0]),
    });
  } catch (error: any) {
    console.error('[Attendance Save Error]', error);
    return res.status(500).json({ success: false, message: 'Presensi gagal disimpan ke database.', error: error.message });
  }
});

appDataRouter.put('/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const body = req.body || {};
  const collections = ['kejuruanList', 'attendanceRecords', 'leaveRequests', 'missions', 'missionSubmissions', 'dailyReports'] as const;
  const lists: Record<string, any[]> = {};
  for (const key of collections) lists[key] = Array.isArray(body[key]) ? body[key] : [];

  const pool = getPool();
  const programNames = user.role === 'mentor' ? assignedProgramNames(user) : [];
  const programNameClause = normalizedNameClause('name', programNames);
  const mentorProgramRows = user.role === 'mentor'
    ? (await pool.query<any[]>(
        `SELECT id FROM kejuruan WHERE id = ? OR mentor_id = ?${programNameClause ? ` OR ${programNameClause}` : ''}`,
        [user.kejuruanId || '', user.id, ...programNames]
      ))[0]
    : [];
  const mentorKejuruanIds = [...new Set([
    ...mentorProgramRows.map((row: any) => String(row.id)),
    ...(user.role === 'mentor' && user.kejuruanId ? [String(user.kejuruanId)] : []),
  ])];
  const own = (row: any) => row && (row.userId === user.id || row.traineeId === user.id);
  const inKejuruan = (row: any) => row && (
    mentorKejuruanIds.includes(String(row.kejuruanId || '')) ||
    programNames.includes(String(row.kejuruanName || '').trim().toLowerCase())
  );
  if (user.role === 'trainee') {
    if (lists.kejuruanList.length || body.settings) {
      return res.status(403).json({ success: false, message: 'Peserta tidak diizinkan mengubah data master.' });
    }
    for (const key of ['attendanceRecords', 'leaveRequests', 'missionSubmissions', 'dailyReports']) {
      if (lists[key].some(row => !own(row))) return res.status(403).json({ success: false, message: 'Perubahan hanya boleh dilakukan pada data akun sendiri.' });
    }
  } else if (user.role === 'mentor') {
    if (lists.kejuruanList.length || body.settings) return res.status(403).json({ success: false, message: 'Mentor tidak diizinkan mengubah data master.' });
    for (const key of collections.filter(k => k !== 'kejuruanList' && k !== 'missions')) {
      if (lists[key].some(row => !inKejuruan(row))) return res.status(403).json({ success: false, message: 'Mentor hanya dapat mengelola data kejuruan sendiri.' });
    }
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const upsert = async (sql: string, params: any[]) => connection.query(sql, params);
    for (const r of lists.kejuruanList) await upsert(
      `INSERT INTO kejuruan (id,name,code,category,color,description,mentor_id,mentor_name) VALUES (?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE name=VALUES(name),code=VALUES(code),category=VALUES(category),color=VALUES(color),description=VALUES(description),mentor_id=VALUES(mentor_id),mentor_name=VALUES(mentor_name)`,
      [r.id,r.name,canonicalKejuruanCode(r.name, r.code),r.category,r.color,r.description || '',r.mentorId || null,r.mentorName || null]);

    for (const r of lists.attendanceRecords) {
      if (user.role === 'trainee' && !own(r)) continue;
      const reviewUpdate = user.role === 'trainee'
        ? 'user_name=VALUES(user_name),user_nim=VALUES(user_nim),check_in_time=VALUES(check_in_time),check_out_time=VALUES(check_out_time),work_mode=COALESCE(VALUES(work_mode),work_mode),status=VALUES(status),location=VALUES(location),latitude=VALUES(latitude),longitude=VALUES(longitude),notes=VALUES(notes),photo_url=VALUES(photo_url)'
        : 'user_name=VALUES(user_name),user_nim=VALUES(user_nim),user_role=VALUES(user_role),kejuruan_id=VALUES(kejuruan_id),kejuruan_name=VALUES(kejuruan_name),attendance_date=VALUES(attendance_date),check_in_time=VALUES(check_in_time),check_out_time=VALUES(check_out_time),work_mode=COALESCE(VALUES(work_mode),work_mode),status=VALUES(status),verification_status=VALUES(verification_status),verified_by=VALUES(verified_by),verified_at=VALUES(verified_at),location=VALUES(location),latitude=VALUES(latitude),longitude=VALUES(longitude),notes=VALUES(notes),photo_url=VALUES(photo_url),rejection_reason=VALUES(rejection_reason)';
      await upsert(`INSERT INTO attendance_records (id,user_id,user_name,user_nim,user_role,kejuruan_id,kejuruan_name,attendance_date,check_in_time,check_out_time,status,verification_status,verified_by,verified_at,location,latitude,longitude,notes,photo_url,rejection_reason,work_mode) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE ${reviewUpdate}`,
      [r.id,r.userId,r.userName,r.userNim,r.userRole || 'trainee',r.kejuruanId || null,r.kejuruanName || null,dateValue(r.date),r.checkInTime || null,r.checkOutTime || null,r.status,user.role === 'trainee' ? 'pending' : r.verificationStatus,user.role === 'trainee' ? null : r.verifiedBy || null,user.role === 'trainee' ? null : dateTimeValue(r.verifiedAt),r.location || null,r.coordinates?.lat ?? null,r.coordinates?.lng ?? null,r.notes || null,r.photoUrl || null,user.role === 'trainee' ? null : r.rejectionReason || null,r.workMode === 'WFH' ? 'WFH' : r.workMode === 'WFO' ? 'WFO' : null]);
    }

    for (const r of lists.leaveRequests) {
      if (user.role === 'trainee' && !own(r)) continue;
      const reviewUpdate = user.role === 'trainee'
        ? 'reason=VALUES(reason),attachment_name=VALUES(attachment_name),attachment_url=VALUES(attachment_url)'
        : 'status=VALUES(status),reviewed_by=VALUES(reviewed_by),reviewed_at=VALUES(reviewed_at),review_notes=VALUES(review_notes),reason=VALUES(reason),attachment_name=VALUES(attachment_name),attachment_url=VALUES(attachment_url)';
      await upsert(`INSERT INTO leave_requests (id,user_id,user_name,user_nim,kejuruan_id,kejuruan_name,request_type,start_date,end_date,days_count,reason,attachment_name,attachment_url,status,submitted_at,reviewed_by,reviewed_at,review_notes) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE ${reviewUpdate}`,
      [r.id,r.userId,r.userName,r.userNim,r.kejuruanId || null,r.kejuruanName || null,r.type,dateValue(r.startDate),dateValue(r.endDate),r.daysCount,r.reason,r.attachmentName || null,r.attachmentUrl || null,user.role === 'trainee' ? 'pending' : r.status,dateTimeValue(r.submittedAt),user.role === 'trainee' ? null : r.reviewedBy || null,user.role === 'trainee' ? null : dateTimeValue(r.reviewedAt),user.role === 'trainee' ? null : r.reviewNotes || null]);
    }

    // Mission CRUD uses the dedicated /api/missions endpoints. Never upsert
    // missions from this whole-app snapshot: another tab may hold stale data.

    if (user.role === 'trainee') {
      for (const r of lists.missionSubmissions) {
        if (!own(r)) continue;
        // Reviews are authoritative only through the dedicated review endpoint.
        await upsert(
          `INSERT INTO mission_submissions (id,mission_id,mission_title,trainee_id,trainee_name,trainee_nim,trainee_avatar,kejuruan_id,kejuruan_name,submission_link,notes,points,submitted_at,status,reviewed_by,reviewed_at,feedback) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE mission_title=VALUES(mission_title),submission_link=VALUES(submission_link),notes=VALUES(notes),submitted_at=VALUES(submitted_at)`,
          [r.id,r.missionId,r.missionTitle,r.traineeId,r.traineeName,r.traineeNim,r.traineeAvatar || null,r.kejuruanId || null,r.kejuruanName || null,r.submissionLink || null,r.notes || '',r.points,dateTimeValue(r.submittedAt),'pending',null,null,null]
        );
      }
    }

    for (const r of lists.dailyReports) {
      if (user.role === 'trainee' && !own(r)) continue;
      const reviewUpdate = user.role === 'trainee'
        ? 'description=VALUES(description),photo_url=VALUES(photo_url),photo_name=VALUES(photo_name),submission_link=VALUES(submission_link),submitted_at=VALUES(submitted_at)'
        : 'description=VALUES(description),photo_url=VALUES(photo_url),photo_name=VALUES(photo_name),submission_link=VALUES(submission_link),status=VALUES(status),reviewed_by=VALUES(reviewed_by),reviewed_at=VALUES(reviewed_at),review_notes=VALUES(review_notes)';
      await upsert(`INSERT INTO daily_reports (id,trainee_id,trainee_name,trainee_nim,trainee_avatar,kejuruan_id,kejuruan_name,report_date,description,photo_url,photo_name,submission_link,status,submitted_at,reviewed_by,reviewed_at,review_notes) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE ${reviewUpdate}`,
      [r.id,r.traineeId,r.traineeName,r.traineeNim,r.traineeAvatar || null,r.kejuruanId || null,r.kejuruanName || null,dateValue(r.date),r.description,r.photoUrl || null,r.photoName || null,r.submissionLink || null,user.role === 'trainee' ? 'pending' : r.status,dateTimeValue(r.submittedAt),user.role === 'trainee' ? null : r.reviewedBy || null,user.role === 'trainee' ? null : dateTimeValue(r.reviewedAt),user.role === 'trainee' ? null : r.reviewNotes || null]);
    }

    await connection.commit();
    return res.json({ success: true, message: 'Data aplikasi tersimpan di TiDB.' });
  } catch (error: any) {
    await connection.rollback();
    return res.status(500).json({ success: false, message: 'Gagal menyimpan data aplikasi ke TiDB.', error: error.message });
  } finally {
    connection.release();
  }
});

appDataRouter.delete('/:collection/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const { collection, id } = req.params;
  const user = req.user!;
  const allowedTables: Record<string, { table: string; scopeColumn?: string }> = {
    kejuruanList: { table: 'kejuruan' },
    attendanceRecords: { table: 'attendance_records', scopeColumn: user.role === 'trainee' ? 'user_id' : 'kejuruan_id' },
    leaveRequests: { table: 'leave_requests', scopeColumn: user.role === 'trainee' ? 'user_id' : 'kejuruan_id' },
    missions: { table: 'missions', scopeColumn: 'kejuruan_id' },
    missionSubmissions: { table: 'mission_submissions', scopeColumn: user.role === 'trainee' ? 'trainee_id' : 'kejuruan_id' },
    dailyReports: { table: 'daily_reports', scopeColumn: user.role === 'trainee' ? 'trainee_id' : 'kejuruan_id' },
  };
  const target = allowedTables[collection];
  if (!target || (collection === 'kejuruanList' && user.role !== 'admin')) {
    return res.status(403).json({ success: false, message: 'Tidak diizinkan menghapus data ini.' });
  }
  try {
    const pool = getPool();
    if (user.role === 'admin') {
      await pool.query(`DELETE FROM ${target.table} WHERE id = ?`, [id]);
    } else if (user.role === 'mentor') {
      const programNames = assignedProgramNames(user);
      const nameClause = normalizedNameClause('name', programNames);
      const [programRows] = await pool.query<any[]>(
        `SELECT id FROM kejuruan WHERE id = ? OR mentor_id = ?${nameClause ? ` OR ${nameClause}` : ''}`,
        [user.kejuruanId || '', user.id, ...programNames]
      );
      const programIds = [...new Set([
        ...programRows.map((row: any) => String(row.id)),
        ...(user.kejuruanId ? [String(user.kejuruanId)] : []),
      ])];
      const conditions: string[] = [];
      const params: string[] = [id];
      if (programIds.length) {
        conditions.push(`${target.scopeColumn} IN (${programIds.map(() => '?').join(',')})`);
        params.push(...programIds);
      }
      const dataNameClause = normalizedNameClause('kejuruan_name', programNames);
      if (dataNameClause) {
        conditions.push(dataNameClause);
        params.push(...programNames);
      }
      if (!conditions.length) {
        return res.status(403).json({ success: false, message: 'Mentor tidak memiliki program kejuruan yang dapat dikelola.' });
      }
      await pool.query(
        `DELETE FROM ${target.table} WHERE id = ? AND (${conditions.join(' OR ')})`,
        params
      );
    } else {
      const scopeValue = user.id;
      await pool.query(`DELETE FROM ${target.table} WHERE id = ? AND ${target.scopeColumn} = ?`, [id, scopeValue]);
    }
    return res.json({ success: true });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: 'Gagal menghapus data dari TiDB.', error: error.message });
  }
});
