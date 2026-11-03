// Perhitungan pengurangan poin karena keterlambatan check-in.
// Tarif per menit diatur admin pada AttendanceSettings.latePointPenaltyPerMinute
// (default 1 poin untuk setiap menit keterlambatan).
// Logika ini disalin di server/latePenalty.ts karena backend dijalankan terpisah.

export interface LatePenaltySettings {
  lateLimitTime: string; // "09:00" atau "09:00:00"
  latePointPenaltyPerMinute: number;
}

export interface LatePenaltyInput {
  role?: string;
  status?: string;
  checkInTime?: string | null;
}

export interface LatePenaltyResult {
  lateMinutes: number;
  latePenaltyPoints: number;
}

export const DEFAULT_LATE_POINT_PENALTY_PER_MINUTE = 1;

const toSeconds = (time?: string | null): number | null => {
  if (!time) return null;
  const match = /^(\d{1,2}):(\d{2})(?::(\d{2}))?/.exec(String(time).trim());
  if (!match) return null;
  return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3] || 0);
};

export const normalizeLatePointPenaltyPerMinute = (value: unknown): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return DEFAULT_LATE_POINT_PENALTY_PER_MINUTE;
  return Math.min(Math.round(parsed), 500);
};

/**
 * True jika jam check-in melewati batas toleransi (format "HH:MM" atau "HH:MM:SS").
 */
export const isLateCheckIn = (limitTime?: string | null, checkInTime?: string | null): boolean => {
  const limitSeconds = toSeconds(limitTime);
  const checkInSeconds = toSeconds(checkInTime);
  if (limitSeconds == null || checkInSeconds == null) return false;
  return checkInSeconds > limitSeconds;
};

/**
 * Hitung keterlambatan check-in (dibulatkan ke atas per menit) dan poin yang
 * dipotong. Hanya peserta (trainee) yang statusnya "terlambat" yang kena potongan.
 */
export const computeLatePenalty = (
  settings: LatePenaltySettings,
  record: LatePenaltyInput
): LatePenaltyResult => {
  const empty = { lateMinutes: 0, latePenaltyPoints: 0 };
  if (!record || record.status !== 'terlambat' || !record.checkInTime) return empty;
  if (record.role === 'mentor' || record.role === 'admin') return empty;

  const limitSeconds = toSeconds(settings.lateLimitTime);
  const checkInSeconds = toSeconds(record.checkInTime);
  if (limitSeconds == null || checkInSeconds == null) return empty;

  const diffSeconds = checkInSeconds - limitSeconds;
  if (diffSeconds <= 0) return empty;

  const lateMinutes = Math.ceil(diffSeconds / 60);
  const rate = normalizeLatePointPenaltyPerMinute(settings.latePointPenaltyPerMinute);
  return { lateMinutes, latePenaltyPoints: lateMinutes * rate };
};

// ---------------------------------------------------------------------------
// Pengurangan poin untuk peserta yang tidak absen pada hari kerja.
// Mulai dihitung sejak 1 Oktober 2026 (atau tanggal gabung peserta, mana yang
// lebih akhir). Hari dengan check-in atau izin/sakit yang disetujui dikecualikan.
// ---------------------------------------------------------------------------
export const ABSENT_PENALTY_START_DATE = '2026-10-01';

export const normalizeAbsentPointPenaltyPerDay = (value: unknown): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return DEFAULT_LATE_POINT_PENALTY_PER_MINUTE;
  return Math.min(Math.round(parsed), 500);
};

const normalizeDateOnly = (value?: string | null): string | null => {
  const text = String(value || '').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
};

/** Jumlah hari kerja (sesuai workDays) dalam rentang yang belum diecualikan. */
export const countAbsentWorkDays = (input: {
  workDays: number[];
  startDate: string;
  endDate: string;
  exemptDates: Iterable<string>;
}): number => {
  const start = Date.parse(`${input.startDate}T00:00:00Z`);
  const end = Date.parse(`${input.endDate}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return 0;

  const allowedDays = new Set(
    (input.workDays || []).map(Number).filter(day => Number.isInteger(day) && day >= 0 && day <= 6)
  );
  if (!allowedDays.size) return 0;

  const exempt = input.exemptDates instanceof Set
    ? input.exemptDates
    : new Set(Array.from(input.exemptDates || []));

  let count = 0;
  for (let timestamp = start; timestamp <= end && count < 2000; timestamp += 86_400_000) {
    const date = new Date(timestamp).toISOString().slice(0, 10);
    if (!allowedDays.has(new Date(timestamp).getUTCDay())) continue;
    if (exempt.has(date)) continue;
    count++;
  }
  return count;
};

export const computeAbsentPenalty = (input: {
  workDays: number[];
  absentPointPenaltyPerDay: number;
  today: string;
  joinedDate?: string | null;
  attendedOrLeaveDates: Iterable<string>;
}): { absentDays: number; absentPenaltyPoints: number } => {
  const today = normalizeDateOnly(input.today);
  const joinedDate = normalizeDateOnly(input.joinedDate);
  if (!today) return { absentDays: 0, absentPenaltyPoints: 0 };

  const startDate = joinedDate && joinedDate > ABSENT_PENALTY_START_DATE
    ? joinedDate
    : ABSENT_PENALTY_START_DATE;
  const absentDays = countAbsentWorkDays({
    workDays: input.workDays,
    startDate,
    endDate: today,
    exemptDates: input.attendedOrLeaveDates,
  });
  const rate = normalizeAbsentPointPenaltyPerDay(input.absentPointPenaltyPerDay);
  return { absentDays, absentPenaltyPoints: absentDays * rate };
};
