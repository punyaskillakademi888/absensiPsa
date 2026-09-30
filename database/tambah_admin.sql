-- ============================================================
-- TAMBAH AKUN ADMIN LANGSUNG DI TiDB SQL EDITOR
-- Sistem Presensi Magang (HadirKu) - absensi_db
-- ============================================================
--
-- CARA PAKAI:
-- 1. Buka TiDB Cloud Console → pilih cluster → SQL Editor
-- 2. Pilih database: absensi_db
-- 3. Copy-paste salah satu INSERT di bawah, lalu jalankan
--
-- PENTING: Kolom password_hash adalah hasil bcrypt hash.
--   Untuk generate hash baru, jalankan di terminal proyek:
--   node -e "const b=require('bcryptjs'); b.hash('passwordbaru',10).then(h=>console.log(h))"
-- ============================================================

-- ─────────────────────────────────────────────
-- CONTOH 1: Admin default sistem (password: admin123)
-- ─────────────────────────────────────────────
INSERT INTO absensi_db.users (
  id,
  nim,
  name,
  email,
  role,
  phone,
  status,
  joined_date,
  login_code,
  password_hash
) VALUES (
  'user-admin-1',           -- ID unik (ganti jika sudah ada)
  'ADM-2026-001',           -- NIM / kode identitas admin
  'Abdul Rozzak Junaidi', -- Nama lengkap
  'admin@hadirku.id',       -- Email (dipakai untuk login Tab Administrator)
  'admin',
  '0812-3456-7890',
  'active',
  '2026-01-10',
  '10000001',               -- Kode login 8 digit (dipakai di Tab Kode/NIM)
  '$2b$10$1i2uNDesRLHYB5sDcN/Jk./Bs1o1dOP9RkhPCiOzeKobM2kLR0Hnu' -- bcrypt hash "admin123"
)
ON DUPLICATE KEY UPDATE
  name           = 'Abdul Rozzak Junaidi',
  role           = VALUES(role),
  password_hash  = VALUES(password_hash),
  status         = VALUES(status);

-- ─────────────────────────────────────────────
-- CONTOH 2: Tambah Admin kedua (password: adminbaru456)
--   Hash dihasilkan dari: bcrypt.hash('adminbaru456', 10)
--   Ganti hash di bawah dengan hasil generate Anda sendiri!
-- ─────────────────────────────────────────────
-- INSERT INTO absensi_db.users (
--   id, nim, name, email, role, phone, status, joined_date, login_code, password_hash
-- ) VALUES (
--   'user-admin-2',
--   'ADM-2026-002',
--   'Nama Admin Kedua',
--   'admin2@hadirku.id',
--   'admin',
--   '0811-0000-0000',
--   'active',
--   '2026-09-24',
--   '20000002',
--   '$2b$10$GANTI_DENGAN_HASH_BCRYPT_YANG_VALID_DARI_NODE_JS_COMMAND'
-- )
-- ON DUPLICATE KEY UPDATE
--   name = VALUES(name), role = VALUES(role), password_hash = VALUES(password_hash);

-- ─────────────────────────────────────────────
-- CEK: Lihat semua user yang ada di database
-- ─────────────────────────────────────────────
-- SELECT id, nim, name, email, role, login_code, status FROM absensi_db.users ORDER BY role;

-- ─────────────────────────────────────────────
-- RESET PASSWORD admin (ganti hash sesuai password baru):
-- ─────────────────────────────────────────────
-- UPDATE absensi_db.users
-- SET password_hash = '$2b$10$HASH_BARU_DI_SINI'
-- WHERE email = 'admin@hadirku.id';
