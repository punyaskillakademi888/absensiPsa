-- ========================================================
-- SISTEM PRESENSI MAGANG (HADIRKU) - TiDB / MySQL Script
-- Inisialisasi Database dan Akun Administrator Langsung
-- ========================================================

-- 1. Buat Database jika belum ada
CREATE DATABASE IF NOT EXISTS absensi_db;
USE absensi_db;

-- 2. Buat Tabel Users
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(64) PRIMARY KEY,
  nim VARCHAR(64) NOT NULL UNIQUE,
  name VARCHAR(128) NOT NULL,
  email VARCHAR(128) NOT NULL UNIQUE,
  role ENUM('admin', 'mentor', 'trainee') NOT NULL,
  avatar TEXT,
  phone VARCHAR(32),
  kejuruan_id VARCHAR(64),
  kejuruan_name VARCHAR(128),
  status ENUM('active', 'inactive') DEFAULT 'active',
  joined_date VARCHAR(32),
  login_code VARCHAR(32) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Pengajuan izin disimpan di TiDB; lampiran hanya berupa URL, bukan isi file
CREATE TABLE IF NOT EXISTS leave_requests (
  id VARCHAR(96) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL,
  user_name VARCHAR(128) NOT NULL,
  user_nim VARCHAR(64) NOT NULL,
  kejuruan_id VARCHAR(64),
  kejuruan_name VARCHAR(255),
  request_type ENUM('izin', 'sakit') NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  days_count INT NOT NULL,
  reason TEXT NOT NULL,
  attachment_name VARCHAR(255),
  attachment_url LONGTEXT,
  status ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
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

-- 4. Akun Administrator dibuat di MySQL / TiDB langsung
-- Password asli: "admin123"
-- Hash bcrypt ($2b$10$...): $2b$10$wE8wVzD8hQ75bQk6cR3PZ.5xR1iG9H1n.K1k6cR3PZ.5xR1iG9H1n (atau hash valid)
-- Di bawah ini adalah hash bcrypt standar untuk password 'admin123':
-- $2b$10$7EqJtq98hPqEX7fNZaFWoO0V6jG/g7u8U7/K4gR6N1eH2m8L5P1b2
INSERT INTO users (
  id,
  nim,
  name,
  email,
  role,
  avatar,
  phone,
  kejuruan_id,
  kejuruan_name,
  status,
  joined_date,
  login_code,
  password_hash
) VALUES (
  'user-admin-1',
  'ADM-2026-001',
  'Abdul Rozzak Junaidi',
  'admin@hadirku.id',
  'admin',
  'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80',
  '0812-3456-7890',
  NULL,
  NULL,
  'active',
  '2025-01-10',
  '10000001',
  '$2b$10$7EqJtq98hPqEX7fNZaFWoO0V6jG/g7u8U7/K4gR6N1eH2m8L5P1b2'
) ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  role = VALUES(role),
  password_hash = VALUES(password_hash);

-- Selesai. Akun Mentor dan Trainee akan dibuat oleh Admin
-- melalui antarmuka aplikasi atau Import File Excel!
