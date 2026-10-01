import express, { Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { getPool, initDatabase, pingDatabase, describeDatabaseConfig, DbUser } from './db.js';
import { appDataRouter } from './appData.js';
import { canonicalKejuruanCode } from './kejuruanCodes.js';
import bcrypt from 'bcryptjs';
import { createDirectUploadSignature, uploadToCloudinary, isCloudinaryConfigured } from './cloudinary.js';
import {
  generateToken,
  authenticateToken,
  authorizeRoles,
  comparePassword,
  AuthenticatedRequest,
  Role,
} from './auth.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5010;
const AUTH_COOKIE = 'hadirku_auth';
const AUTH_COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000;
const isVercelRuntime = process.env.VERCEL === '1';
const authCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production' || isVercelRuntime,
  sameSite: 'lax' as const,
  path: '/',
  maxAge: AUTH_COOKIE_MAX_AGE,
};

function importedKejuruanId(programName: string): string {
  let hash = 2166136261;
  for (const char of programName.trim().toLowerCase()) {
    hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  }
  return `kj-import-${(hash >>> 0).toString(36)}`;
}

const configuredClientOrigins = (process.env.CLIENT_ORIGIN || '')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);

function isAllowedOrigin(origin: string): boolean {
  if (configuredClientOrigins.includes(origin)) return true;
  const vercelHost = process.env.VERCEL_URL;
  if (vercelHost && origin === `https://${vercelHost}`) return true;
  try {
    const hostname = new URL(origin).hostname;
    if (hostname.endsWith('.vercel.app')) return true;
  } catch {
    return false;
  }
  return process.env.NODE_ENV !== 'production' && configuredClientOrigins.length === 0;
}

app.set('trust proxy', 1);
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (isAllowedOrigin(origin)) return callback(null, true);
    return callback(null, false);
  },
  credentials: true,
}));
app.use((req, res, next) => {
  if (req.body !== undefined && req.body !== null && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
    return next();
  }
  if (typeof req.body === 'string') {
    try {
      req.body = req.body ? JSON.parse(req.body) : {};
      return next();
    } catch {
      req.body = {};
      return next();
    }
  }
  if (Buffer.isBuffer(req.body)) {
    try {
      const text = req.body.toString('utf8');
      req.body = text ? JSON.parse(text) : {};
    } catch {
      req.body = {};
    }
    return next();
  }
  return express.json({ limit: '10mb' })(req, res, next);
});

// Vercel Functions have no persistent server startup hook. Initialize once per
// warm function instance before the first API request instead of calling listen().
if (isVercelRuntime) {
  let databaseInitialization: Promise<void> | null = null;
  app.use((req, res, next) => {
    const path = (req.path || req.url || '').split('?')[0];
    if (path === '/api/health' || path === '/health') {
      return next();
    }
    databaseInitialization ??= initDatabase();
    databaseInitialization.then(() => next()).catch(error => {
      databaseInitialization = null;
      console.error('[TiDB] Initialization failed in Vercel Function:', error);
      res.status(503).json({ success: false, message: 'Database belum siap. Coba lagi beberapa saat.', error: (error as Error).message });
    });
  });
}

app.use('/api/app-data', appDataRouter);

app.post('/api/upload/signature', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const folder = String(req.body?.folder || '');
  if (!['hadirku/profile', 'hadirku/reports'].includes(folder)) {
    return res.status(400).json({ success: false, message: 'Folder upload tidak valid.' });
  }

  try {
    return res.json({ success: true, ...createDirectUploadSignature(folder) });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message || 'Gagal menyiapkan upload.' });
  }
});

app.post('/api/upload', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { image, folder = 'hadirku' } = req.body || {};

    if (!image || typeof image !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Gambar tidak ditemukan untuk diupload.',
      });
    }

    if (!isCloudinaryConfigured) {
      return res.status(500).json({
        success: false,
        message: 'Cloudinary belum dikonfigurasi di server. Hubungi admin untuk menyiapkan variabel environment.',
      });
    }

    const uploadResult = await uploadToCloudinary(String(image), String(folder));

    return res.json({
      success: true,
      url: uploadResult.url,
      publicId: uploadResult.publicId,
      message: 'Gambar berhasil diupload ke Cloudinary.',
    });
  } catch (error: any) {
    console.error('[Cloudinary Upload Error]', error);
    return res.status(500).json({
      success: false,
      message: 'Gagal mengupload gambar ke Cloudinary.',
      error: error.message,
    });
  }
});

// Allow every authenticated user to change only their own profile photo.
app.put('/api/profile/avatar', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { avatar } = req.body || {};
    if (typeof avatar !== 'string' || !avatar.trim()) {
      return res.status(400).json({ success: false, message: 'Foto profil tidak valid.' });
    }
    const pool = getPool();
    const [result] = await pool.query<any>('UPDATE users SET avatar = ? WHERE id = ?', [avatar, req.user!.id]);
    if (!result.affectedRows) {
      return res.status(404).json({ success: false, message: 'Pengguna tidak ditemukan.' });
    }
    return res.json({ success: true, message: 'Foto profil berhasil diperbarui.' });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: 'Gagal menyimpan foto profil.', error: error.message });
  }
});

// 1. Health check & DB status
app.get('/api/health', async (_req, res) => {
  const dbConfig = describeDatabaseConfig();
  const jwtConfigured = Boolean(process.env.JWT_SECRET);
  const requiresJwt = isVercelRuntime || process.env.NODE_ENV === 'production';

  if (requiresJwt && !jwtConfigured) {
    return res.status(503).json({
      status: 'error',
      database: dbConfig.ok ? 'TiDB Cloud' : 'not configured',
      jwt: 'missing JWT_SECRET',
      error: 'JWT_SECRET belum diisi di Environment Variables Vercel.',
      timestamp: new Date().toISOString(),
    });
  }

  if (!dbConfig.ok) {
    return res.status(503).json({
      status: 'error',
      database: 'not configured',
      jwt: jwtConfigured ? 'enabled' : 'missing JWT_SECRET',
      error: `Konfigurasi database belum lengkap: ${dbConfig.missing.join(', ')}.`,
      timestamp: new Date().toISOString(),
    });
  }

  const ping = await pingDatabase();
  if (!ping.ok) {
    return res.status(503).json({
      status: 'error',
      database: 'TiDB Cloud Error',
      jwt: jwtConfigured ? 'enabled' : 'missing JWT_SECRET',
      error: ping.error,
      timestamp: new Date().toISOString(),
    });
  }

  return res.json({
    status: 'online',
    database: 'TiDB Cloud',
    jwt: 'enabled',
    timestamp: new Date().toISOString(),
  });
});

// 2. Login Endpoint (Supports all 3 roles: admin, mentor, trainee)
// Accepts either { code, password } or { identifier, password }
app.post('/api/auth/change-password', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body || {};
    const trimmedCurrent = String(currentPassword ?? '').trim();
    const trimmedNew = String(newPassword ?? '').trim();

    if (!trimmedCurrent || !trimmedNew) {
      return res.status(400).json({
        success: false,
        message: 'Kata sandi lama dan kata sandi baru wajib diisi.',
      });
    }

    if (!/^\d{8}$/.test(trimmedNew)) {
      return res.status(400).json({
        success: false,
        message: 'Kata sandi baru harus berupa 8 digit angka.',
      });
    }

    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Sesi login tidak valid.',
      });
    }

    const pool = getPool();
    const [rows] = await pool.query<any[]>(
      'SELECT password_hash FROM users WHERE id = ? LIMIT 1',
      [userId]
    );

    if (!rows || rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Pengguna tidak ditemukan.',
      });
    }

    const isMatch = await comparePassword(trimmedCurrent, rows[0].password_hash);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Kata sandi lama tidak sesuai.',
      });
    }

    const salt = await bcrypt.genSalt(10);
    const newHash = await bcrypt.hash(trimmedNew, salt);

    await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [newHash, userId]);

    return res.json({
      success: true,
      message: 'Kata sandi berhasil diperbarui.',
    });
  } catch (error: any) {
    console.error('[Change Password Error]', error);
    return res.status(500).json({
      success: false,
      message: 'Gagal memperbarui kata sandi. Silakan coba lagi.',
      error: error.message,
    });
  }
});

app.post('/api/auth/login', async (req, res: Response) => {
  try {
    const { code, identifier, password } = req.body;
    const searchKey = (code || identifier || '').trim();

    if (!searchKey) {
      return res.status(400).json({
        success: false,
        message: 'Silakan masukkan Kode Login 8-digit atau NIM Anda.',
      });
    }

    const pool = getPool();
    // Query user by login_code or nim from TiDB
    const [rows] = await pool.query<any[]>(
      `SELECT * FROM users 
       WHERE login_code = ? OR LOWER(nim) = LOWER(?)
       LIMIT 1`,
      [searchKey, searchKey]
    );

    if (!rows || rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Akun dengan kode login atau NIM tersebut tidak ditemukan.',
      });
    }

    const user: DbUser = rows[0];

    // Admin masuk hanya dengan login_code numerik 8 digit.
    if (user.role === 'admin' && !/^\d{8}$/.test(searchKey)) {
      return res.status(401).json({
        success: false,
        message: 'Administrator harus masuk menggunakan kode login 8 digit.',
      });
    }

    // Check account status
    if (user.status !== 'active') {
      return res.status(403).json({
        success: false,
        message: 'Akun Anda sedang dinonaktifkan. Silakan hubungi Administrator.',
      });
    }

    // Semua role wajib melalui verifikasi password.
    if (password && password.trim()) {
      const isMatch = await comparePassword(password.trim(), user.password_hash);
      if (!isMatch) {
        return res.status(401).json({
          success: false,
          message: 'Password yang Anda masukkan salah.',
        });
      }
    } else {
      return res.status(400).json({
        success: false,
        message: 'Password akun wajib diisi.',
      });
    }

    // Generate JWT token
    const token = generateToken({
      id: user.id,
      nim: user.nim,
      name: user.name,
      role: user.role,
      kejuruanId: user.kejuruan_id,
      kejuruanName: user.kejuruan_name,
      loginCode: user.login_code,
    });
    res.cookie(AUTH_COOKIE, token, authCookieOptions);

    const safeUser = {
      id: user.id,
      nim: user.nim,
      name: user.name,
      role: user.role,
      avatar: user.avatar,
      phone: user.phone,
      kejuruanId: user.kejuruan_id,
      kejuruanName: user.kejuruan_name,
      status: user.status,
      joinedDate: user.joined_date,
      loginCode: user.login_code,
    };

    return res.json({
      success: true,
      message: `Login berhasil sebagai ${user.role.toUpperCase()} (${user.name})`,
      token,
      user: safeUser,
    });
  } catch (error: any) {
    console.error('[TiDB Auth Error]', error);
    return res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan saat memproses login ke database TiDB.',
      error: error.message,
    });
  }
});

app.post('/api/auth/logout', (_req, res: Response) => {
  res.clearCookie(AUTH_COOKIE, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production' || isVercelRuntime,
    sameSite: 'lax',
    path: '/',
  });
  return res.json({ success: true, message: 'Sesi berhasil diakhiri.' });
});

// 3. Current User Profile (Protected by JWT)
app.get('/api/auth/me', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const pool = getPool();

    const [rows] = await pool.query<any[]>(
      `SELECT id, nim, name, role, avatar, phone, kejuruan_id, kejuruan_name,
              status, joined_date, login_code 
       FROM users WHERE id = ? LIMIT 1`,
      [userId]
    );

    if (!rows || rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Pengguna tidak ditemukan di TiDB.',
      });
    }

    const row = rows[0];
    const user = {
      id: row.id,
      nim: row.nim,
      name: row.name,
      role: row.role as Role,
      avatar: row.avatar,
      phone: row.phone,
      kejuruanId: row.kejuruan_id,
      kejuruanName: row.kejuruan_name,
      status: row.status,
      joinedDate: row.joined_date,
      loginCode: row.login_code,
    };

    return res.json({
      success: true,
      user,
      tokenPayload: req.user,
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: 'Gagal memuat profil pengguna dari TiDB.',
      error: error.message,
    });
  }
});

// 5. Get Users List from TiDB (RBAC: Admin & Mentor only)
app.get(
  '/api/users',
  authenticateToken,
  authorizeRoles('admin', 'mentor'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const pool = getPool();
      let query = `
        SELECT id, nim, name, role, avatar, phone, kejuruan_id, kejuruan_name,
               status, joined_date, login_code 
        FROM users ORDER BY role ASC, name ASC
      `;
      const [rows] = await pool.query<any[]>(query);

      const mappedUsers = rows.map(r => ({
        id: r.id,
        nim: r.nim,
        name: r.name,
        role: r.role,
        avatar: r.avatar,
        phone: r.phone,
        kejuruanId: r.kejuruan_id,
        kejuruanName: r.kejuruan_name,
        status: r.status,
        joinedDate: r.joined_date,
        loginCode: r.login_code,
      }));

      return res.json({
        success: true,
        count: mappedUsers.length,
        users: mappedUsers,
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }
);

// 6. Create User (Mentor or Trainee by Admin)
app.post(
  '/api/users',
  authenticateToken,
  authorizeRoles('admin'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const {
        name,
        nim,
        role,
        avatar,
        phone,
        kejuruanId,
        kejuruanName,
        status = 'active',
        loginCode,
        password,
      } = req.body;

      if (!name || !nim || !role) {
        return res.status(400).json({
          success: false,
          message: 'Nama, NIM, dan Role wajib diisi.',
        });
      }

      if (role !== 'mentor' && role !== 'trainee') {
        return res.status(400).json({
          success: false,
          message: 'Role yang dapat dibuat oleh Admin hanya "mentor" atau "trainee". Akun admin dibuat langsung di database MySQL.',
        });
      }

      const normalizedNim = String(nim).trim();
      const code = String(loginCode || normalizedNim).trim();
      const rawPassword = String(password || '').trim();
      if (!/^\d{8}$/.test(normalizedNim) || normalizedNim !== code) {
        return res.status(400).json({ success: false, message: 'NIM/Kode Login harus satu nilai yang sama dan tepat 8 digit angka.' });
      }
      if (!/^\d{8}$/.test(rawPassword)) {
        return res.status(400).json({ success: false, message: 'Sandi harus tepat 8 digit angka.' });
      }

      const pool = getPool();

      // Check if NIM or login code already exists
      const [dupes] = await pool.query<any[]>(
        'SELECT id, nim, login_code FROM users WHERE nim = ? OR login_code = ? LIMIT 1',
        [nim.trim(), code]
      );

      if (dupes && dupes.length > 0) {
        const found = dupes[0];
        let field = 'Data';
        if (found.nim.toLowerCase() === nim.trim().toLowerCase()) field = 'NIM';
        else if (found.login_code === code) field = 'Kode login';
        return res.status(409).json({
          success: false,
          message: `${field} "${found.nim || code}" sudah terdaftar di sistem.`,
        });
      }

      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(rawPassword, salt);
      const id = `user-${role}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const joinedDate = new Date().toISOString().split('T')[0];

      await pool.query(
        `INSERT INTO users (
          id, nim, name, email, role, avatar, phone, kejuruan_id, kejuruan_name,
          status, joined_date, login_code, password_hash
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          nim.trim(),
          name.trim(),
          `${code}@internal.hadirku.id`,
          role,
          avatar || null,
          phone || null,
          kejuruanId || null,
          kejuruanName || null,
          status,
          joinedDate,
          code,
          passwordHash,
        ]
      );

      const createdUser = {
        id,
        nim: nim.trim(),
        name: name.trim(),
        role,
        avatar: avatar || '',
        phone: phone || '',
        kejuruanId: kejuruanId || null,
        kejuruanName: kejuruanName || null,
        status,
        joinedDate,
        loginCode: code,
        password: rawPassword,
      };

      return res.status(201).json({
        success: true,
        message: `Akun ${role === 'mentor' ? 'Mentor' : 'Peserta'} (${name}) berhasil dibuat di database TiDB.`,
        user: createdUser,
      });
    } catch (error: any) {
      console.error('[Create User Error]', error);
      return res.status(500).json({ success: false, message: 'Gagal membuat user di database TiDB.', error: error.message });
    }
  }
);

// 7. Batch Import Users (for Trainees/Mentors via Excel)
app.post(
  '/api/users/batch',
  authenticateToken,
  authorizeRoles('admin'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { users } = req.body;
      if (!Array.isArray(users) || users.length === 0) {
        return res.status(400).json({ success: false, message: 'Daftar data pengguna tidak boleh kosong.' });
      }

      const invalidIndex = users.findIndex((item: any) => {
        const identifier = String(item?.loginCode || item?.nim || '').trim();
        const nimValue = String(item?.nim || '').trim();
        const passwordValue = String(item?.password || '').trim();
        return !item?.name?.trim() ||
          !['admin', 'mentor', 'trainee'].includes(item?.role) ||
          !/^\d{8}$/.test(identifier) ||
          nimValue !== identifier ||
          !/^\d{8}$/.test(passwordValue) ||
          (item?.role !== 'admin' && !item?.kejuruanName?.trim());
      });
      if (invalidIndex !== -1) {
        return res.status(400).json({
          success: false,
          message: `Data pengguna pada baris ${invalidIndex + 1} tidak sesuai. Isi nama, NIM/Kode Login 8 digit, sandi 8 digit, role admin/mentor/trainee, dan program kejuruan untuk mentor/peserta.`,
        });
      }

      const seenIdentifiers = new Set<string>();
      const duplicateIndex = users.findIndex((item: any) => {
        const code = String(item.loginCode || item.nim).trim();
        if (seenIdentifiers.has(code)) return true;
        seenIdentifiers.add(code);
        return false;
      });
      if (duplicateIndex !== -1) {
        return res.status(400).json({
          success: false,
          message: `Kode login atau NIM duplikat pada baris ${duplicateIndex + 1}. Setiap akun harus memakai kode login yang unik.`,
        });
      }

      const pool = getPool();
      const connection = await pool.getConnection();
      let insertedCount = 0;
      let processedCount = 0;
      let adminCount = 0;
      let mentorCount = 0;
      let traineeCount = 0;
      const createdUsers: any[] = [];

      try {
        await connection.beginTransaction();
        for (let rowIndex = 0; rowIndex < users.length; rowIndex++) {
          const item = users[rowIndex];
          if (!item.name || !item.name.trim()) continue;
          processedCount++;

          const role = item.role as Role;
          const code = String(item.loginCode || item.nim).trim();
          const nim = code;
          const internalEmail = `${code}@internal.hadirku.id`;
          const rawPassword = String(item.password).trim();
          const kejuruanName = String(item.kejuruanName || '').trim();
          let kejuruanId = String(item.kejuruanId || '').trim();
          if (kejuruanName && (kejuruanId.startsWith('kj-import-') || kejuruanId.length > 64)) {
            kejuruanId = importedKejuruanId(kejuruanName);
            const programHash = kejuruanId.slice('kj-import-'.length);
            await connection.query(
              `INSERT INTO kejuruan (id,name,code,category,color,description)
               VALUES (?,?,?,'Lainnya','#4C83B5','Program ditambahkan melalui impor akun.')
               ON DUPLICATE KEY UPDATE name=VALUES(name),code=VALUES(code)`,
              [kejuruanId, kejuruanName, canonicalKejuruanCode(kejuruanName, `IMP-${programHash}`)]
            );
          }
          if (role === 'admin') adminCount++;
          else if (role === 'mentor') mentorCount++;
          else traineeCount++;

          const [existing] = await connection.query<any[]>(
            'SELECT id, role FROM users WHERE nim = ? OR login_code = ? LIMIT 2',
            [nim, code]
          );
          if (existing.some(user => user.role === 'admin')) {
            throw Object.assign(new Error(`Baris ${rowIndex + 1} memakai kredensial akun administrator.`), { code: 'IMPORT_ADMIN_COLLISION', rowIndex });
          }
          if (existing.length > 1) {
            throw Object.assign(new Error(`Baris ${rowIndex + 1} mencocokkan lebih dari satu akun lama.`), { code: 'IMPORT_ACCOUNT_COLLISION', rowIndex });
          }

          const salt = await bcrypt.genSalt(10);
          const hash = await bcrypt.hash(rawPassword, salt);

          if (existing.length > 0) {
            await connection.query(
            `UPDATE users SET
              nim = ?, name = ?, role = ?, avatar = ?, phone = ?,
              kejuruan_id = ?, kejuruan_name = ?, status = ?, joined_date = ?,
              login_code = ?, password_hash = ?
             WHERE id = ?`,
            [
              nim,
              item.name.trim(),
              role,
              item.avatar || null,
              item.phone || null,
              kejuruanId || null,
              kejuruanName || null,
              item.status || 'active',
              item.joinedDate || new Date().toISOString().split('T')[0],
              code,
              hash,
              existing[0].id,
            ]
            );
          } else {
            const id = `user-${role}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
            const joinedDate = item.joinedDate || new Date().toISOString().split('T')[0];

            await connection.query(
            `INSERT INTO users (
              id, nim, name, email, role, avatar, phone, kejuruan_id, kejuruan_name,
              status, joined_date, login_code, password_hash
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              id,
              nim,
              item.name.trim(),
              internalEmail,
              role,
              item.avatar || null,
              item.phone || null,
              kejuruanId || null,
              kejuruanName || null,
              item.status || 'active',
              joinedDate,
              code,
              hash,
            ]
            );

            createdUsers.push({
            id,
            nim,
            name: item.name.trim(),
            role,
            kejuruanId: item.kejuruanId || null,
            kejuruanName: item.kejuruanName || null,
            status: item.status || 'active',
            joinedDate,
            loginCode: code,
            password: rawPassword,
            });
            insertedCount++;
          }
        }
        await connection.commit();
      } catch (error: any) {
        await connection.rollback();
        const rowNumber = Number.isInteger(error.rowIndex) ? error.rowIndex + 1 : undefined;
        const message = error.code === 'ER_DUP_ENTRY'
          ? `Impor gagal pada baris ${rowNumber || '?'}: kode login atau NIM sudah digunakan akun lain.`
          : error.code?.startsWith('IMPORT_')
          ? error.message
          : `Gagal mengimpor data ke TiDB${rowNumber ? ` pada baris ${rowNumber}` : ''}. Periksa panjang data dan pastikan kode login atau NIM tidak duplikat.`;
        console.error('[Batch Import Error]', { code: error.code, row: rowNumber, message: error.message });
        return res.status(400).json({ success: false, message, errorCode: error.code || 'BATCH_IMPORT_FAILED' });
      } finally {
        connection.release();
      }

      return res.json({
        success: true,
        count: processedCount,
        traineeCount,
        mentorCount,
        adminCount,
        message: `Berhasil memproses ${processedCount} akun (${adminCount} Admin, ${mentorCount} Mentor, ${traineeCount} Peserta) di database TiDB. ${insertedCount} akun baru ditambahkan.`,
        createdUsers,
      });
    } catch (error: any) {
      console.error('[Batch Import Error]', { code: error.code, message: error.message });
      return res.status(500).json({ success: false, message: 'Gagal terhubung ke TiDB untuk memproses impor.', errorCode: error.code || 'DATABASE_ERROR' });
    }
  }
);

// 8. Update User (Admins can manage accounts; users can update their own avatar)
app.put(
  '/api/users/:id',
  authenticateToken,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { name, nim, phone, avatar, kejuruanId, kejuruanName, status, loginCode, password } = req.body;

      const isAdmin = req.user?.role === 'admin';
      const isSelfAvatarUpdate = req.user?.id === id &&
        Object.keys(req.body || {}).length === 1 &&
        Object.prototype.hasOwnProperty.call(req.body || {}, 'avatar');

      if (!isAdmin && !isSelfAvatarUpdate) {
        return res.status(403).json({
          success: false,
          message: 'Anda hanya dapat mengubah foto profil akun sendiri.',
        });
      }

      const pool = getPool();
      const [existing] = await pool.query<any[]>('SELECT * FROM users WHERE id = ? LIMIT 1', [id]);
      if (!existing || existing.length === 0) {
        return res.status(404).json({ success: false, message: 'Pengguna tidak ditemukan.' });
      }

      if (!isAdmin) {
        await pool.query('UPDATE users SET avatar = ? WHERE id = ?', [avatar ?? null, id]);
        return res.json({ success: true, message: 'Foto profil berhasil diperbarui.' });
      }

      let passwordClause = '';
      const params: any[] = [
        name !== undefined ? name : existing[0].name,
        nim !== undefined ? nim : existing[0].nim,
        phone !== undefined ? phone : existing[0].phone,
        avatar !== undefined ? avatar : existing[0].avatar,
        kejuruanId !== undefined ? kejuruanId : existing[0].kejuruan_id,
        kejuruanName !== undefined ? kejuruanName : existing[0].kejuruan_name,
        status !== undefined ? status : existing[0].status,
        loginCode !== undefined ? loginCode : existing[0].login_code,
      ];

      if (password && password.trim()) {
        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(password.trim(), salt);
        passwordClause = ', password_hash = ?';
        params.push(hash);
      }

      params.push(id);

      await pool.query(
        `UPDATE users SET
          name = ?, nim = ?, phone = ?, avatar = ?, kejuruan_id = ?,
          kejuruan_name = ?, status = ?, login_code = ? ${passwordClause}
         WHERE id = ?`,
        params
      );

      return res.json({
        success: true,
        message: 'Data pengguna berhasil diperbarui di TiDB.',
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }
);

// 9. Delete User (Admin only, cannot delete Admin)
app.delete(
  '/api/users/:id',
  authenticateToken,
  authorizeRoles('admin'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const pool = getPool();

      const [existing] = await pool.query<any[]>('SELECT id, role, name FROM users WHERE id = ? LIMIT 1', [id]);
      if (!existing || existing.length === 0) {
        return res.status(404).json({ success: false, message: 'Pengguna tidak ditemukan.' });
      }

      if (existing[0].role === 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Akun Administrator utama tidak boleh dihapus dari sistem.',
        });
      }

      await pool.query('DELETE FROM users WHERE id = ?', [id]);

      return res.json({
        success: true,
        message: `Pengguna ${existing[0].name} (${existing[0].role}) berhasil dihapus dari database TiDB.`,
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }
);

// 10. Clear All Users by Role (Admin only: bulk delete trainees, mentors, or both)
app.delete(
  '/api/users/clear/:role',
  authenticateToken,
  authorizeRoles('admin'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { role } = req.params;
      const validRoles = ['trainee', 'mentor', 'all'];

      if (!validRoles.includes(role)) {
        return res.status(400).json({
          success: false,
          message: 'Parameter role tidak valid. Pilih "trainee", "mentor", atau "all".',
        });
      }

      const pool = getPool();
      let query = '';
      let roleLabel = '';

      if (role === 'trainee') {
        query = "DELETE FROM users WHERE role = 'trainee'";
        roleLabel = 'Peserta Magang';
      } else if (role === 'mentor') {
        query = "DELETE FROM users WHERE role = 'mentor'";
        roleLabel = 'Instruktur Mentor';
      } else {
        // 'all' deletes both trainees and mentors, but ALWAYS preserves admin
        query = "DELETE FROM users WHERE role IN ('trainee', 'mentor')";
        roleLabel = 'Peserta Magang dan Instruktur Mentor';
      }

      const [result]: any = await pool.query(query);
      const affected = result?.affectedRows || 0;

      return res.json({
        success: true,
        count: affected,
        message: `Berhasil menghapus ${affected} akun ${roleLabel} dari database TiDB. Akun Administrator tetap aman.`,
      });
    } catch (error: any) {
      console.error('[Clear Users Error]', error);
      return res.status(500).json({
        success: false,
        message: 'Gagal menghapus data dari database TiDB.',
        error: error.message,
      });
    }
  }
);

app.post(
  '/api/users/batch-delete-trainees',
  authenticateToken,
  authorizeRoles('admin'),
  async (req: AuthenticatedRequest, res: Response) => {
    const requestedIds = req.body?.ids;
    if (
      !Array.isArray(requestedIds) ||
      requestedIds.length === 0 ||
      requestedIds.length > 500 ||
      !requestedIds.every(id => typeof id === 'string' && id.trim().length > 0 && id.trim().length <= 64)
    ) {
      return res.status(400).json({ success: false, message: 'Pilih 1 sampai 500 ID peserta yang valid.' });
    }

    try {
      const ids = [...new Set((requestedIds as string[]).map(id => id.trim()))];
      const placeholders = ids.map(() => '?').join(',');
      const [result]: any = await getPool().query(
        `DELETE FROM users WHERE role = 'trainee' AND id IN (${placeholders})`,
        ids
      );
      const count = Number(result?.affectedRows || 0);
      return res.json({
        success: true,
        count,
        message: `Berhasil menghapus ${count} akun peserta terpilih dari TiDB. Akun admin dan mentor tetap aman.`,
      });
    } catch (error: any) {
      console.error('[Batch Delete Trainees Error]', error);
      return res.status(500).json({ success: false, message: 'Gagal menghapus peserta terpilih dari TiDB.' });
    }
  }
);

app.delete(
  '/api/attendance/reset',
  authenticateToken,
  authorizeRoles('admin'),
  async (_req: AuthenticatedRequest, res: Response) => {
    try {
      const [result]: any = await getPool().query('DELETE FROM attendance_records');
      const count = Number(result?.affectedRows || 0);
      return res.json({
        success: true,
        count,
        message: `Reset presensi berhasil. ${count} catatan presensi dihapus dari TiDB.`,
      });
    } catch (error: any) {
      console.error('[Reset Attendance Error]', error);
      return res.status(500).json({ success: false, count: 0, message: 'Gagal mereset data presensi di TiDB.' });
    }
  }
);

const mapMission = (row: any) => ({
  id: row.id,
  title: row.title,
  description: row.description,
  kejuruanId: row.kejuruan_id,
  kejuruanName: row.kejuruan_name,
  mentorId: row.mentor_id,
  mentorName: row.mentor_name,
  points: Number(row.points),
  difficulty: row.difficulty,
  dueDate: row.due_date,
  createdAt: row.created_at,
  status: row.status,
  category: row.category || undefined,
  submissionGuide: row.submission_guide || undefined,
});

const mentorCanManageProgram = (req: AuthenticatedRequest, kejuruanId: string) => {
  if (req.user?.role !== 'mentor') return req.user?.role === 'admin';
  return String(req.user.kejuruanId || '') === String(kejuruanId);
};

app.get('/api/missions', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const pool = getPool();
    let query = 'SELECT * FROM missions WHERE status = \'active\' ORDER BY created_at DESC';
    let params: string[] = [];
    if (req.user?.role === 'mentor') {
      query = `${query.replace(' WHERE status', ' WHERE mentor_id = ? AND status')}`;
      params = [req.user.id];
    }
    const [rows] = await pool.query<any[]>(query, params);
    res.json({ success: true, missions: rows.map(mapMission) });
  } catch (err: any) {
    console.error('GET /api/missions error:', err);
    res.status(500).json({ success: false, message: 'Gagal memuat misi kejuruan.' });
  }
});

app.post('/api/missions', authenticateToken, authorizeRoles('mentor'), async (req: AuthenticatedRequest, res) => {
  try {
    const mission = req.body;
    if (!mission?.id || !mission?.title?.trim() || !mission?.description?.trim() || !mission?.kejuruanId || !mission?.kejuruanName) {
      return res.status(400).json({ success: false, message: 'Data misi belum lengkap.' });
    }
    if (!mentorCanManageProgram(req, mission.kejuruanId)) {
      return res.status(403).json({ success: false, message: 'Mentor hanya dapat membuat misi untuk kejuruan yang ditugaskan.' });
    }

    const pool = getPool();
    await pool.query(
      `INSERT INTO missions (id, title, description, kejuruan_id, kejuruan_name, mentor_id, mentor_name, points, difficulty, due_date, created_at, status, category, submission_guide)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [mission.id, mission.title.trim(), mission.description.trim(), mission.kejuruanId, mission.kejuruanName,
        req.user?.id, req.user?.name, Number(mission.points) || 100, mission.difficulty || 'Sedang',
        mission.dueDate || '', mission.createdAt || new Date().toISOString().slice(0, 10),
        mission.status || 'active', mission.category || null, mission.submissionGuide || null]
    );
    res.status(201).json({ success: true, mission: { ...mission, mentorId: req.user?.id, mentorName: req.user?.name } });
  } catch (err: any) {
    console.error('POST /api/missions error:', err);
    res.status(500).json({ success: false, message: 'Gagal menyimpan misi ke database.' });
  }
});

app.put('/api/missions/:id', authenticateToken, authorizeRoles('mentor'), async (req: AuthenticatedRequest, res) => {
  try {
    const pool = getPool();
    const [rows] = await pool.query<any[]>('SELECT * FROM missions WHERE id = ? LIMIT 1', [req.params.id]);
    const existing = rows[0];
    if (!existing) return res.status(404).json({ success: false, message: 'Misi tidak ditemukan.' });
    if (req.user?.role === 'mentor' && existing.mentor_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Anda tidak dapat mengubah misi ini.' });
    }

    const updates = req.body || {};
    const targetKejuruanId = updates.kejuruanId || existing.kejuruan_id;
    if (!mentorCanManageProgram(req, targetKejuruanId)) {
      return res.status(403).json({ success: false, message: 'Mentor hanya dapat membuat misi untuk kejuruan yang ditugaskan.' });
    }
    await pool.query(
      `UPDATE missions SET title = ?, description = ?, kejuruan_id = ?, kejuruan_name = ?, points = ?, difficulty = ?, due_date = ?, status = ?, category = ?, submission_guide = ? WHERE id = ?`,
      [updates.title ?? existing.title, updates.description ?? existing.description, targetKejuruanId,
        updates.kejuruanName ?? existing.kejuruan_name, Number(updates.points ?? existing.points),
        updates.difficulty ?? existing.difficulty, updates.dueDate ?? existing.due_date,
        updates.status ?? existing.status, updates.category ?? existing.category,
        updates.submissionGuide ?? existing.submission_guide, req.params.id]
    );
    res.json({ success: true, message: 'Misi berhasil diperbarui.' });
  } catch (err: any) {
    console.error('PUT /api/missions/:id error:', err);
    res.status(500).json({ success: false, message: 'Gagal memperbarui misi.' });
  }
});

app.delete('/api/missions/:id', authenticateToken, authorizeRoles('mentor'), async (req: AuthenticatedRequest, res) => {
  try {
    const pool = getPool();
    const [rows] = await pool.query<any[]>('SELECT * FROM missions WHERE id = ? LIMIT 1', [req.params.id]);
    const mission = rows[0];
    // DELETE is idempotent; a retry after a successful delete stays successful.
    if (!mission) return res.json({ success: true, message: 'Misi sudah dihapus.' });
    if (mission.mentor_id !== req.user?.id) {
      return res.status(403).json({ success: false, message: 'Anda tidak dapat menghapus misi ini.' });
    }
    await pool.query('DELETE FROM missions WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Misi berhasil dihapus.' });
  } catch (err: any) {
    console.error('DELETE /api/missions/:id error:', err);
    res.status(500).json({ success: false, message: 'Gagal menghapus misi.' });
  }
});

app.patch('/api/missions/submissions/:id/review', authenticateToken, authorizeRoles('mentor', 'admin'), async (req: AuthenticatedRequest, res) => {
  try {
    const { status, feedback, points } = req.body || {};
    const awardedPoints = Number(points);
    if (!['approved', 'rejected'].includes(status) || !Number.isInteger(awardedPoints) || awardedPoints < 0 || awardedPoints > 500) {
      return res.status(400).json({ success: false, message: 'Status atau poin review tidak valid.' });
    }

    const pool = getPool();
    const [rows] = await pool.query<any[]>(
      `SELECT s.id, m.kejuruan_id
       FROM mission_submissions s
       JOIN missions m ON m.id = s.mission_id
       WHERE s.id = ? LIMIT 1`,
      [req.params.id]
    );
    const submission = rows[0];
    if (!submission) return res.status(404).json({ success: false, message: 'Pengumpulan tugas tidak ditemukan.' });
    if (req.user?.role === 'mentor' && String(submission.kejuruan_id || '') !== String(req.user.kejuruanId || '')) {
      return res.status(403).json({ success: false, message: 'Review hanya dapat dilakukan untuk tugas pada kejuruan Anda.' });
    }

    await pool.query(
      `UPDATE mission_submissions
       SET status = ?, points = ?, reviewed_by = ?, reviewed_at = NOW(), feedback = ?
       WHERE id = ?`,
      [status, awardedPoints, String(req.user?.name || 'Mentor').slice(0, 64), String(feedback || '').trim(), req.params.id]
    );
    return res.json({ success: true, message: 'Review tugas berhasil disimpan ke TiDB.' });
  } catch (error: any) {
    console.error('[Mission Review Error]', error);
    return res.status(500).json({ success: false, message: 'Review tugas gagal disimpan ke TiDB.' });
  }
});

// Leave requests: the attachment is a share URL stored as text in TiDB.
const mapLeaveRequest = (row: any) => ({
  id: row.id,
  userId: row.user_id,
  userName: row.user_name,
  userNim: row.user_nim,
  kejuruanId: row.kejuruan_id,
  kejuruanName: row.kejuruan_name,
  type: row.request_type,
  startDate: row.start_date,
  endDate: row.end_date,
  daysCount: Number(row.days_count),
  reason: row.reason,
  attachmentUrl: row.attachment_url,
  status: row.status,
  submittedAt: row.submitted_at,
  reviewedBy: row.reviewed_by || undefined,
  reviewedAt: row.reviewed_at || undefined,
  reviewNotes: row.review_notes || undefined,
});

app.get('/api/leaves', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const pool = getPool();
    let query = 'SELECT * FROM leave_requests ORDER BY created_at DESC';
    let params: string[] = [];
    if (req.user?.role === 'trainee') {
      query = 'SELECT * FROM leave_requests WHERE user_id = ? ORDER BY created_at DESC';
      params = [req.user.id];
    } else if (req.user?.role === 'mentor') {
      query = 'SELECT * FROM leave_requests WHERE kejuruan_id = ? ORDER BY created_at DESC';
      params = [req.user.kejuruanId || ''];
    }
    const [rows] = await pool.query<any[]>(query, params);
    return res.json({ success: true, requests: rows.map(mapLeaveRequest) });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: 'Gagal memuat pengajuan izin dari TiDB.', error: error.message });
  }
});

app.post('/api/leaves', authenticateToken, authorizeRoles('trainee'), async (req: AuthenticatedRequest, res) => {
  try {
    const { type, startDate, endDate, reason, attachmentUrl } = req.body || {};
    if (!['izin', 'sakit'].includes(type) || !/^\d{4}-\d{2}-\d{2}$/.test(startDate || '') || !/^\d{4}-\d{2}-\d{2}$/.test(endDate || '') || !String(reason || '').trim()) {
      return res.status(400).json({ success: false, message: 'Kategori, rentang tanggal, dan alasan wajib diisi.' });
    }
    let attachment: URL;
    try {
      attachment = new URL(String(attachmentUrl || ''));
      if (!['http:', 'https:'].includes(attachment.protocol) || attachment.href.length > 2048) throw new Error('Invalid URL');
    } catch {
      return res.status(400).json({ success: false, message: 'Tautan lampiran wajib berupa URL HTTP/HTTPS yang valid (maksimal 2048 karakter).' });
    }
    const start = new Date(`${startDate}T00:00:00Z`);
    const end = new Date(`${endDate}T00:00:00Z`);
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end < start) {
      return res.status(400).json({ success: false, message: 'Rentang tanggal pengajuan tidak valid.' });
    }
    const user = req.user!;
    const id = `leave-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const daysCount = Math.floor((end.getTime() - start.getTime()) / 86400000) + 1;
    const submittedAt = new Date().toISOString();
    const pool = getPool();
    await pool.query(
      `INSERT INTO leave_requests (
        id, user_id, user_name, user_nim, kejuruan_id, kejuruan_name,
        request_type, start_date, end_date, days_count, reason, attachment_url,
        status, submitted_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
      [id, user.id, user.name, user.nim, user.kejuruanId || '', user.kejuruanName || 'Umum', type, startDate, endDate, daysCount, String(reason).trim(), attachment.href, submittedAt]
    );
    const request = mapLeaveRequest({
      id, user_id: user.id, user_name: user.name, user_nim: user.nim,
      kejuruan_id: user.kejuruanId || '', kejuruan_name: user.kejuruanName || 'Umum',
      request_type: type, start_date: startDate, end_date: endDate, days_count: daysCount,
      reason: String(reason).trim(), attachment_url: attachment.href, status: 'pending', submitted_at: submittedAt
    });
    return res.status(201).json({ success: true, message: 'Pengajuan izin tersimpan di TiDB.', request });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: 'Gagal menyimpan pengajuan izin ke TiDB.', error: error.message });
  }
});

app.patch('/api/leaves/:id/review', authenticateToken, authorizeRoles('mentor'), async (req: AuthenticatedRequest, res) => {
  try {
    const { status, reviewNotes } = req.body || {};
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Status verifikasi tidak valid.' });
    }
    const pool = getPool();
    const [rows] = await pool.query<any[]>(
      'SELECT * FROM leave_requests WHERE id = ? AND kejuruan_id = ? LIMIT 1',
      [req.params.id, req.user?.kejuruanId || '']
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'Pengajuan izin tidak ditemukan untuk kejuruan Anda.' });
    if (rows[0].status !== 'pending') return res.status(409).json({ success: false, message: 'Pengajuan ini sudah diproses.' });
    const reviewedAt = new Date().toISOString();
    const notes = String(reviewNotes || (status === 'approved' ? 'Pengajuan disetujui' : 'Pengajuan ditolak')).slice(0, 2000);
    await pool.query(
      'UPDATE leave_requests SET status = ?, reviewed_by = ?, reviewed_at = ?, review_notes = ? WHERE id = ?',
      [status, req.user?.name || 'Mentor', reviewedAt, notes, req.params.id]
    );
    return res.json({
      success: true,
      message: status === 'approved' ? 'Permohonan disetujui.' : 'Permohonan ditolak.',
      request: mapLeaveRequest({ ...rows[0], status, reviewed_by: req.user?.name || 'Mentor', reviewed_at: reviewedAt, review_notes: notes })
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: 'Gagal memproses pengajuan izin di TiDB.', error: error.message });
  }
});

// Start server after initializing TiDB
async function startServer() {
  try {
    await initDatabase();
    const server = app.listen(PORT, () => {
      console.log(`[Server] Auth & TiDB API running on port ${PORT}`);
      console.log(`[Server] TiDB connected and 3 Roles seeded: Admin, Mentor, Trainee`);
    });
    server.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`[Server Error] Port ${PORT} sedang dipakai proses lain. Hentikan server lama yang memakai port ini, lalu jalankan npm run server lagi.`);
      } else {
        console.error('[Server Error] Gagal membuka HTTP server:', err);
      }
      process.exit(1);
    });
  } catch (err) {
    console.error('[Server Error] Failed to initialize TiDB:', err);
    process.exit(1);
  }
}

export default app;

if (!isVercelRuntime) {
  void startServer();
}
