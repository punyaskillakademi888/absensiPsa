export type Role = 'admin' | 'mentor' | 'trainee';

export type AttendanceStatus = 'hadir' | 'terlambat' | 'izin' | 'sakit' | 'alpha';

export type VerificationStatus = 'pending' | 'verified' | 'rejected';

export interface Kejuruan {
  id: string;
  name: string;
  code: string;
  category: string;
  color: string;
  description: string;
  mentorId?: string;
  mentorName?: string;
  subPrograms?: string[];
}

export interface User {
  id: string;
  nim: string; // Nomor Induk Siswa / NIP Mentor / Admin
  name: string;
  role: Role;
  avatar: string;
  phone: string;
  kejuruanId?: string;
  kejuruanName?: string;
  status: 'active' | 'inactive';
  joinedDate: string;
  loginCode?: string; // 8-digit random code (e.g. 84920194)
  password?: string;  // Login password
}

export interface TraineeHallOfFameEntry {
  id: string;
  nim: string;
  name: string;
  avatar: string;
  kejuruanId?: string;
  kejuruanName?: string;
  totalPoints: number;
  completedMissionsCount: number;
}

export interface AttendanceRecord {
  id: string;
  userId: string;
  userName: string;
  userNim: string;
  userRole?: Role;
  kejuruanId: string;
  kejuruanName: string;
  date: string; // YYYY-MM-DD
  checkInTime?: string; // HH:mm:ss
  checkOutTime?: string; // HH:mm:ss
  status: AttendanceStatus;
  verificationStatus: VerificationStatus;
  verifiedBy?: string;
  verifiedAt?: string;
  location?: string;
  workMode?: 'WFO' | 'WFH';
  coordinates?: { lat: number; lng: number };
  checkInCoordinates?: { lat: number; lng: number };
  checkOutCoordinates?: { lat: number; lng: number };
  notes?: string;
  photoUrl?: string;
  rejectionReason?: string;
}

export interface LeaveRequest {
  id: string;
  userId: string;
  userName: string;
  userNim: string;
  kejuruanId: string;
  kejuruanName: string;
  type: 'izin' | 'sakit';
  startDate: string;
  endDate: string;
  daysCount: number;
  reason: string;
  attachmentName?: string;
  attachmentUrl?: string;
  status: 'pending' | 'approved' | 'rejected';
  submittedAt: string;
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNotes?: string;
}

export interface AttendanceSettings {
  startTime: string; // "08:00"
  lateLimitTime: string; // "08:15"
  endTime: string; // "17:00"
  allowCheckoutStart: string; // "16:00"
  workDays: number[]; // 1 = Senin, 5 = Jumat
  officeLocation: {
    lat: number;
    lng: number;
    name: string;
    radiusMeters: number;
  };
}

export type MissionDifficulty = 'Mudah' | 'Sedang' | 'Tantangan';

export interface Mission {
  id: string;
  title: string;
  description: string;
  kejuruanId: string;
  kejuruanName: string;
  mentorId: string;
  mentorName: string;
  points: number; // e.g., 50, 100, 150, 200
  difficulty: MissionDifficulty;
  dueDate: string; // YYYY-MM-DD
  createdAt: string;
  status: 'active' | 'archived';
  category?: string;
  submissionGuide?: string;
}

export type SubmissionStatus = 'pending' | 'approved' | 'rejected';

export type DailyReportStatus = 'pending' | 'approved' | 'rejected';

export interface DailyReport {
  id: string;
  traineeId: string;
  traineeName: string;
  traineeNim: string;
  traineeAvatar: string;
  kejuruanId: string;
  kejuruanName: string;
  date: string;            // YYYY-MM-DD — harus satu per hari per user
  description: string;     // catatan kegiatan hari itu
  photoUrl?: string;       // base64 data URL foto laporan
  photoName?: string;      // nama file asli
  submissionLink?: string; // tautan kumpul tugas (GitHub, Drive, dll)
  status: DailyReportStatus;
  submittedAt: string;     // ISO string
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNotes?: string;    // komentar mentor / admin
}

export interface MissionSubmission {
  id: string;
  missionId: string;
  missionTitle: string;
  traineeId: string;
  traineeName: string;
  traineeNim: string;
  traineeAvatar: string;
  kejuruanId: string;
  kejuruanName: string;
  submissionLink?: string;
  notes: string;
  points: number;
  submittedAt: string;
  status: SubmissionStatus;
  reviewedBy?: string;
  reviewedAt?: string;
  feedback?: string;
}
