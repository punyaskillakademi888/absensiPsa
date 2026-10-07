import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Clock,
  CheckCircle2,
  MapPin,
  FileText,
  Check,
  Calendar,
  AlertCircle,
  AlertTriangle,
  GraduationCap,
  Target,
  Trophy,
  LogIn,
  LogOut,
  CalendarClock,
  CircleCheck,
  CircleX
} from 'lucide-react';
import {
  getTodayDateString,
  formatIndonesianDate,
  formatShortDate,
  INDONESIAN_MONTHS,
  INDONESIAN_DAYS
} from '../../utils/dateUtils';
import { exportToPDF } from '../../utils/exportUtils';

export const TraineeDashboard: React.FC = () => {
  const {
    currentUser,
    kejuruanList,
    attendanceRecords,
    leaveRequests,
    settings,
    clockIn,
    clockOut,
    getTodayRecordForUser,
    setActiveTab
  } = useApp();

  const today = getTodayDateString();
  const todayRecord = getTodayRecordForUser(currentUser.id);
  const [currentYear, currentMonth] = today.split('-').map(Number);
  const monthName = INDONESIAN_MONTHS[currentMonth - 1];

  const [liveTime, setLiveTime] = useState<string>('');
  const [dailyNote, setDailyNote] = useState<string>('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [workMode, setWorkMode] = useState<'WFO' | 'WFH'>(todayRecord?.workMode || 'WFO');

  const isCheckedIn = !!todayRecord?.checkInTime;
  const isCheckedOut = !!todayRecord?.checkOutTime;

  // Detect if current time is past check-in limit (late warning before check-in)
  const [isCurrentlyLate, setIsCurrentlyLate] = useState(false);

  // Assigned kejuruan & mentor name
  const myKejuruan = kejuruanList.find(k => k.id === currentUser.kejuruanId);
  const mentorName = myKejuruan?.mentorName || 'Instruktur Kejuruan';

  // User's today leave
  const todayLeave = leaveRequests.find(
    l => l.userId === currentUser.id && l.startDate <= today && l.endDate >= today && l.status === 'approved'
  );

  const myRecords = useMemo(() => {
    return attendanceRecords
      .filter(r => r.userId === currentUser.id)
      .sort((a, b) => {
        // Compare normalized calendar days so both YYYY-MM-DD and SQL/ISO
        // datetime values keep the same newest-first order.
        const dateA = Date.parse(`${String(a.date).slice(0, 10)}T00:00:00Z`);
        const dateB = Date.parse(`${String(b.date).slice(0, 10)}T00:00:00Z`);
        const dayDifference = dateB - dateA;
        if (Number.isFinite(dayDifference) && dayDifference !== 0) return dayDifference;
        if (a.date !== b.date) return String(b.date).localeCompare(String(a.date));
        return (b.checkInTime || '').localeCompare(a.checkInTime || '');
      });
  }, [attendanceRecords, currentUser.id]);

  const monthlyStats = useMemo(() => {
    let hadir = 0;
    let telat = 0;
    let izin = 0;
    let sakit = 0;
    let alpha = 0;

    const monthStr = String(currentMonth).padStart(2, '0');
    const prefix = `${currentYear}-${monthStr}`;

    myRecords.forEach(r => {
      if (r.date.startsWith(prefix)) {
        if (r.status === 'hadir') hadir++;
        else if (r.status === 'terlambat') telat++;
        else if (r.status === 'izin') izin++;
        else if (r.status === 'sakit') sakit++;
        else if (r.status === 'alpha') alpha++;
      }
    });

    const totalPresent = hadir + telat;
    const totalRecorded = totalPresent + izin + sakit + alpha;
    const rate = totalRecorded > 0 ? Math.round((totalPresent / totalRecorded) * 100) : 100;

    return { hadir, telat, izin, sakit, alpha, totalPresent, rate };
  }, [myRecords, currentYear, currentMonth]);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const hh = String(now.getHours()).padStart(2, '0');
      const mm = String(now.getMinutes()).padStart(2, '0');
      const ss = String(now.getSeconds()).padStart(2, '0');
      const timeStr = `${hh}.${mm}.${ss}`;
      setLiveTime(timeStr);
      // Compare HH:MM against 09:00 (jam masuk resmi)
      const currentHHMM = `${hh}:${mm}`;
      setIsCurrentlyLate(currentHHMM > '09:00');
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, [settings.lateLimitTime]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleAttendance = () => {
    if (!navigator.geolocation) {
      setLocationError('Browser atau perangkat ini tidak mendukung GPS.');
      return;
    }
    setIsLocating(true);
    setLocationError(null);
    navigator.geolocation.getCurrentPosition(
      async position => {
        const coordinates = { lat: position.coords.latitude, lng: position.coords.longitude };
        const result = isCheckedIn
          ? await clockOut(undefined, coordinates)
          : await clockIn(dailyNote, undefined, coordinates, workMode);
        setIsLocating(false);
        showToast(result.message);
      },
      error => {
        setIsLocating(false);
        setLocationError(error.code === error.PERMISSION_DENIED
          ? 'Izin lokasi ditolak. Aktifkan izin lokasi untuk situs ini, lalu coba lagi.'
          : error.code === error.TIMEOUT
            ? 'Deteksi lokasi terlalu lama. Pastikan GPS aktif, lalu coba lagi.'
            : 'Lokasi belum dapat dideteksi. Pastikan GPS aktif dan coba lagi.');
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  const handleDownloadMyReport = () => {
    exportToPDF({
      year: currentYear,
      month: currentMonth,
      selectedKejuruanId: currentUser.kejuruanId || 'all',
      kejuruanList,
      trainees: [currentUser],
      records: myRecords
    });
  };

  // Calendar generation for mini calendar
  const calendarDays = useMemo(() => {
    const year = currentYear;
    const month = currentMonth - 1; // 0-indexed
    // Monday as first day of week: (day + 6) % 7
    const firstDayIndex = (new Date(year, month, 1).getDay() + 6) % 7;
    const totalDays = new Date(year, month + 1, 0).getDate();
    const days: { day: number | null; dateStr: string }[] = [];

    for (let i = 0; i < firstDayIndex; i++) {
      days.push({ day: null, dateStr: '' });
    }

    for (let d = 1; d <= totalDays; d++) {
      const pad = (n: number) => String(n).padStart(2, '0');
      const dateStr = `${year}-${pad(month + 1)}-${pad(d)}`;
      days.push({ day: d, dateStr });
    }

    return days;
  }, [currentYear, currentMonth]);

  // Determine current status & label
  let statusText = 'Belum absen';
  let statusHelper = 'Belum ada catatan kehadiran hari ini. Silakan lakukan check-in.';
  let statusBadgeClass = 'bg-[#F4F6F8] text-[#6F7F8D]';
  let buttonLabel = 'Check-in Sekarang';
  let buttonIcon = LogIn;
  let isButtonDisabled = false;

  if (todayLeave) {
    statusText = 'Izin Disetujui';
    statusHelper = 'Pengajuan izin/sakit Anda telah disetujui untuk hari ini.';
    statusBadgeClass = 'bg-[#EEF5FA] text-[#4C83B5]';
    buttonLabel = 'Izin Disetujui';
    isButtonDisabled = true;
  } else if (isCheckedOut) {
    statusText = 'Presensi Selesai';
    statusHelper = `Check-out tercatat pukul ${todayRecord?.checkOutTime} WIB. Sesi hari ini telah selesai.`;
    statusBadgeClass = 'bg-[#EAF2F8] text-[#28618F]';
    buttonLabel = 'Presensi Hari Ini Selesai';
    buttonIcon = Check;
    isButtonDisabled = true;
  } else if (isCheckedIn) {
    statusText = 'Sudah Check-in';
    statusHelper = `Masuk tercatat pukul ${todayRecord?.checkInTime} WIB. Jangan lupa check-out saat jam pulang.`;
    statusBadgeClass = 'bg-[#EAF2F8] text-[#28618F]';
    buttonLabel = 'Check-out Pulang';
    buttonIcon = LogOut;
  }

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-7 left-1/2 -translate-x-1/2 z-50 rounded-xl bg-[#0D2F47] px-5 py-3 text-center text-sm font-bold text-white shadow-xl flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2">
          <Check className="w-4 h-4 text-[#A9C7DE]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Late Warning Banner — tampil jika belum check-in dan sudah lewat jam masuk */}
      {isCurrentlyLate && !isCheckedIn && !todayLeave && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 px-5 py-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-amber-800">
              Perhatian: Kamu Terlambat!
            </p>
            <p className="mt-0.5 text-xs text-amber-700 leading-relaxed">
              Jam masuk resmi adalah pukul <strong>09.00 WIB</strong>. Check-in setelah jam tersebut
              akan dicatat sebagai <strong>Terlambat</strong> dan akan mendapatkan{' '}
              <strong>pengurangan poin kehadiran</strong>. Segera lakukan check-in sekarang.
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-5">
      {/* 1. Summary Cards (Matching style.html) */}
      <section className="order-2 grid grid-cols-1 gap-4 sm:order-1 sm:grid-cols-3">
        {/* Hadir */}
        <article className="metric-card soft-hover surface rounded-2xl p-5">
          <div className="flex items-center justify-between">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#EAF2F8] text-[#4C83B5]">
              <CircleCheck className="h-4 w-4" />
            </span>
            <span className="text-[10px] font-bold text-[#4C83B5] uppercase tracking-wider">
              BULAN INI
            </span>
          </div>
          <p className="mt-5 text-3xl font-bold text-[#123B59] tabular-nums">
            {monthlyStats.totalPresent}
          </p>
          <p className="mt-1 text-xs font-bold text-[#4C83B5]">
            Hadir ({monthlyStats.rate}%)
          </p>
        </article>

        {/* Izin */}
        <article className="metric-card soft-hover surface rounded-2xl p-5">
          <div className="flex items-center justify-between">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#EEF5FA] text-[#4C83B5]">
              <CalendarClock className="h-4 w-4" />
            </span>
            <span className="text-[10px] font-bold text-[#6F7F8D] uppercase tracking-wider">
              BULAN INI
            </span>
          </div>
          <p className="mt-5 text-3xl font-bold text-[#123B59] tabular-nums">
            {monthlyStats.izin + monthlyStats.sakit}
          </p>
          <p className="mt-1 text-xs font-bold text-[#4C83B5]">
            Izin & Sakit
          </p>
        </article>

        {/* Alpha */}
        <article className="metric-card soft-hover surface rounded-2xl p-5">
          <div className="flex items-center justify-between">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#FCF3F6] text-[#D95B83]">
              <CircleX className="h-4 w-4" />
            </span>
            <span className="text-[10px] font-bold text-[#6F7F8D] uppercase tracking-wider">
              BULAN INI
            </span>
          </div>
          <p className="mt-5 text-3xl font-bold text-[#123B59] tabular-nums">
            {monthlyStats.alpha}
          </p>
          <p className="mt-1 text-xs font-bold text-[#D95B83]">
            Alpha
          </p>
        </article>
      </section>

      {/* 2. Middle Section: Today's Status & Today's Activity */}
      <div className="order-1 grid gap-5 sm:order-2 xl:grid-cols-12">
        {/* Left: Presensi Hari Ini (today-status-card) */}
        <section className="surface soft-hover rounded-2xl p-5 sm:p-6 xl:col-span-7 flex flex-col justify-between">
          <div>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold tracking-[.13em] text-[#4C83B5]">
                  PRESENSI HARI INI
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <h2 className="text-2xl font-bold text-[#123B59]">
                    {statusText}
                  </h2>
                  <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${statusBadgeClass}`}>
                    {statusText}
                  </span>
                </div>
                <p className="mt-2 max-w-lg text-sm leading-relaxed text-[#6F7F8D]">
                  {statusHelper}
                </p>
              </div>

              <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${
                isCheckedIn ? 'bg-[#EAF2F8] text-[#28618F]' : 'bg-[#F4F6F8] text-[#4C83B5]'
              }`}>
                <Clock className="h-5 w-5" />
              </span>
            </div>

            {/* Verification Status Banner if checked in */}
            {isCheckedIn && (
              <div className="mt-4 rounded-xl border border-[#C8DCEB] bg-[#EEF6FB] px-4 py-3">
                <div className="flex items-center gap-2.5">
                  {todayRecord?.verificationStatus === 'verified' ? (
                    <>
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#4C83B5] text-white">
                        <Check className="h-3.5 w-3.5" />
                      </span>
                      <div>
                        <p className="text-xs font-bold text-[#123B59]">
                          Kehadiran Diverifikasi oleh Mentor
                        </p>
                        <p className="text-[11px] text-[#6F7F8D]">
                          Divalidasi oleh {todayRecord.verifiedBy || mentorName}
                        </p>
                      </div>
                    </>
                  ) : (
                    <>
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-500 text-white">
                        <AlertTriangle className="h-3.5 w-3.5" />
                      </span>
                      <div>
                        <p className="text-xs font-bold text-[#123B59]">
                          Menunggu Validasi Mentor ({mentorName})
                        </p>
                        <p className="text-[11px] text-[#6F7F8D]">
                          Mentor kejuruan Anda akan memverifikasi presensi ini di kelas.
                        </p>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Date & Location Info Box */}
            <div className="mt-4 grid gap-3 rounded-xl border border-[#E4EAF0] bg-[#F8FAFB] p-4 sm:grid-cols-2">
              <div>
                <p className="text-[9px] font-bold tracking-[.11em] text-[#6F7F8D]">
                  TANGGAL PRESENSI
                </p>
                <p className="mt-1 text-sm font-bold text-[#123B59]">
                  {formatIndonesianDate(today)}
                </p>
              </div>
              <div className="sm:text-right">
                <p className="text-[9px] font-bold tracking-[.11em] text-[#6F7F8D]">
                  LOKASI PELATIHAN
                </p>
                <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-[#4C83B5] sm:justify-end">
                  <span className="h-2 w-2 rounded-full bg-[#4C83B5]"></span>
                  <span>{settings.officeLocation.name}</span>
                </p>
              </div>
            </div>

            {!isCheckedIn && !todayLeave && (
              <div className="mt-4">
                <label htmlFor="attendance-daily-note" className="text-xs font-bold text-[#123B59]">
                  Catatan / Agenda Pelatihan Hari Ini (Opsional)
                </label>
                <input
                  id="attendance-daily-note"
                  type="text"
                  value={dailyNote}
                  onChange={event => setDailyNote(event.target.value)}
                  placeholder="Contoh: Praktik modul kejuruan, instalasi server..."
                  className="mt-1.5 w-full rounded-xl border border-[#E4EAF0] bg-[#F8FAFB] px-3.5 py-2.5 text-xs text-[#123B59] focus:border-[#4C83B5] focus:outline-none"
                />
              </div>
            )}

          </div>

          {/* Big Action Button (Matching style.html) */}
          <div className="mt-5">
            {!todayLeave && (
              <fieldset className="mb-3" disabled={isCheckedIn}>
                <legend className="mb-2 text-xs font-bold text-[#123B59]">Mode kerja hari ini</legend>
                <div className="grid grid-cols-2 gap-2">
                  {(['WFO', 'WFH'] as const).map(mode => (
                    <button key={mode} type="button" aria-pressed={(todayRecord?.workMode || workMode) === mode} onClick={() => setWorkMode(mode)} className={`rounded-xl border px-3 py-2.5 text-xs font-bold transition ${(todayRecord?.workMode || workMode) === mode ? 'border-[#28618F] bg-[#EAF2F8] text-[#28618F]' : 'border-[#E4EAF0] bg-white text-[#6F7F8D]'} disabled:cursor-not-allowed disabled:opacity-70`}>
                      {mode === 'WFO' ? 'WFO · Kantor Bandung' : 'WFH · Kerja dari rumah'}
                    </button>
                  ))}
                </div>
              </fieldset>
            )}
            <div className="mb-3 flex items-start gap-2 rounded-xl border border-[#C8DCEB] bg-[#EEF6FB] px-3.5 py-3 text-xs text-[#28618F]">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{(todayRecord?.workMode || workMode) === 'WFO' ? `GPS harus berada dalam radius ${settings.officeLocation.radiusMeters} m dari ${settings.officeLocation.name}.` : 'Mode WFH: lokasi GPS tetap direkam, tanpa batas jarak dari kantor.'}</span>
            </div>
            {locationError && (
              <p role="alert" className="mb-3 rounded-xl border border-[#E3C4D0] bg-[#FCF3F6] px-3.5 py-3 text-xs font-semibold text-[#B84469]">{locationError}</p>
            )}
            {!isCheckedIn ? (
              <button
                type="button"
                onClick={handleAttendance}
                disabled={isButtonDisabled || isLocating}
                className="w-full flex items-center justify-center gap-3 rounded-xl px-5 py-4 font-bold text-white transition hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed bg-[#123B59] hover:bg-[#0D2F47] cursor-pointer shadow-sm"
              >
                <LogIn className="h-5 w-5" />
                <span>{isLocating ? 'Mendeteksi lokasi...' : 'Check-in Sekarang'}</span>
                <span className="ml-1 h-2 w-2 rounded-full bg-[#D95B83]"></span>
              </button>
            ) : !isCheckedOut ? (
              <button
                type="button"
                onClick={handleAttendance}
                disabled={isButtonDisabled || isLocating}
                className="w-full flex items-center justify-center gap-3 rounded-xl px-5 py-4 font-bold text-white transition hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed bg-[#123B59] hover:bg-[#0D2F47] cursor-pointer shadow-sm"
              >
                <LogOut className="h-5 w-5" />
                <span>{isLocating ? 'Mendeteksi lokasi...' : 'Check-out Pulang'}</span>
                <span className="ml-1 h-2 w-2 rounded-full bg-[#D95B83]"></span>
              </button>
            ) : (
              <button
                type="button"
                disabled
                className="w-full flex items-center justify-center gap-2 rounded-xl px-5 py-4 font-bold bg-[#EAF2F8] text-[#28618F] cursor-not-allowed"
              >
                <CheckCircle2 className="h-5 w-5" />
                <span>Presensi Hari Ini Lengkap ({todayRecord?.checkInTime} - {todayRecord?.checkOutTime} WIB)</span>
              </button>
            )}
          </div>
        </section>

        {/* Right: Aktivitas Hari Ini (activity-card) */}
        <aside className="surface soft-hover rounded-2xl p-5 xl:col-span-5 flex flex-col justify-between">
          <div>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[10px] font-bold tracking-[.13em] text-[#4C83B5]">
                  AKTIVITAS HARI INI
                </p>
                <h2 className="mt-1 text-xl font-bold text-[#123B59]">
                  Ringkasan presensi
                </h2>
              </div>
              <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
                isCheckedOut ? 'bg-[#EAF2F8] text-[#28618F]' : isCheckedIn ? 'bg-[#EEF5FA] text-[#4C83B5]' : 'bg-[#F4F6F8] text-[#6F7F8D]'
              }`}>
                {isCheckedOut ? 'Selesai' : isCheckedIn ? 'Dalam Sesi' : 'Belum Absen'}
              </span>
            </div>

            {/* Timeline matching style.html */}
            <div className="relative mt-6">
              <div className="timeline-line"></div>

              {/* Check-In Point */}
              <div className="relative flex gap-3 pb-6">
                <span
                  className={`z-10 flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                    isCheckedIn ? 'bg-[#4C83B5] text-white' : 'bg-[#EAF2F8] text-[#4C83B5]'
                  }`}
                >
                  <LogIn className="h-3.5 w-3.5" />
                </span>
                <div>
                  <p className="text-[10px] font-bold tracking-[.08em] text-[#6F7F8D]">
                    CHECK-IN
                  </p>
                  <p className="mt-0.5 text-sm font-bold text-[#123B59]">
                    {todayRecord?.checkInTime ? `${todayRecord.checkInTime} WIB` : 'Belum tercatat'}
                  </p>
                  <p className="mt-0.5 text-xs text-[#6F7F8D]">
                    {todayRecord?.workMode || workMode} · {todayRecord?.notes || settings.officeLocation.name}
                  </p>
                  {(todayRecord?.checkInCoordinates || todayRecord?.coordinates) && (
                    <a className="mt-1 inline-flex text-xs font-semibold text-[#28618F] hover:underline" target="_blank" rel="noreferrer" href={`https://www.google.com/maps?q=${(todayRecord.checkInCoordinates || todayRecord.coordinates)!.lat},${(todayRecord.checkInCoordinates || todayRecord.coordinates)!.lng}`}>
                      Lihat lokasi check-in di Maps
                    </a>
                  )}
                </div>
              </div>

              {/* Check-Out Point */}
              <div className="relative flex gap-3">
                <span
                  className={`z-10 flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                    isCheckedOut ? 'bg-[#4C83B5] text-white' : 'bg-[#F4F6F8] text-[#6F7F8D]'
                  }`}
                >
                  <LogOut className="h-3.5 w-3.5" />
                </span>
                <div>
                  <p className="text-[10px] font-bold tracking-[.08em] text-[#6F7F8D]">
                    CHECK-OUT
                  </p>
                  <p className="mt-0.5 text-sm font-bold text-[#123B59]">
                    {todayRecord?.checkOutTime ? `${todayRecord.checkOutTime} WIB` : 'Menunggu check-out'}
                  </p>
                  <p className="mt-0.5 text-xs text-[#6F7F8D]">
                    Lakukan check-out saat aktivitas selesai.
                  </p>
                  {todayRecord?.checkOutCoordinates && (
                    <a className="mt-1 inline-flex text-xs font-semibold text-[#28618F] hover:underline" target="_blank" rel="noreferrer" href={`https://www.google.com/maps?q=${todayRecord.checkOutCoordinates.lat},${todayRecord.checkOutCoordinates.lng}`}>
                      Lihat lokasi check-out di Maps
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Quick Guidance Box */}
          <div className="mt-6 rounded-xl border border-[#E4EAF0] bg-[#F8FAFB] p-3 text-xs text-[#6F7F8D] space-y-1">
            <p className="font-bold text-[#123B59]">Aturan Absensi:</p>
            <p className="text-[11px] leading-relaxed">
              Jam Masuk: <strong className="text-[#123B59]">09.00 WIB</strong>
              {' '}&middot; Pulang: <strong className="text-[#123B59]">17.00 WIB</strong>.
            </p>
            <p className="text-[11px] leading-relaxed text-amber-700">
              ⚠ Check-in lebih dari pukul <strong>09.00 WIB</strong> dihitung <strong>Terlambat</strong> dan mendapat pengurangan poin.
            </p>
          </div>
        </aside>
      </div>
      </div>

      {/* 3. Bottom Section: Mini Calendar & Recent History List */}
      <div className="grid gap-5 xl:grid-cols-12">
        {/* Left: Kalender Kehadiran (mini-calendar-card) */}
        <section className="surface rounded-2xl p-5 xl:col-span-7">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold tracking-[.13em] text-[#4C83B5]">
                REKAP BULANAN
              </p>
              <h2 className="mt-1 text-xl font-bold text-[#123B59]">
                Kalender kehadiran
              </h2>
            </div>
            <span className="rounded-full bg-[#F4F6F8] px-3 py-1.5 text-xs font-semibold text-[#6F7F8D]">
              {monthName} {currentYear}
            </span>
          </div>

          {/* Days Header */}
          <div className="mt-5 grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-[#6F7F8D]">
            <span>Sn</span>
            <span>Sl</span>
            <span>Ra</span>
            <span>Ka</span>
            <span>Ju</span>
            <span>Sa</span>
            <span>Mg</span>
          </div>

          {/* Calendar Cells */}
          <div className="mt-2 grid grid-cols-7 gap-1">
            {calendarDays.map((item, idx) => {
              if (!item.day) {
                return <div key={`empty-${idx}`} className="h-10" />;
              }

              const rec = myRecords.find(r => r.date === item.dateStr);
              const isToday = item.dateStr === today;

              let cellClass = 'bg-[#F8FAFB] text-[#6F7F8D]';
              if (rec?.status === 'hadir' || rec?.status === 'terlambat') {
                cellClass = 'bg-[#EAF2F8] text-[#28618F]';
              } else if (rec?.status === 'izin' || rec?.status === 'sakit') {
                cellClass = 'bg-[#EEF5FA] text-[#4C83B5]';
              } else if (rec?.status === 'alpha') {
                cellClass = 'bg-[#FCF3F6] text-[#B84469]';
              }

              return (
                <div
                  key={item.dateStr}
                  title={`${item.dateStr}: ${rec ? rec.status : 'Belum ada data'}`}
                  className={`calendar-cell flex items-center justify-center rounded-xl text-xs font-bold transition ${cellClass} ${
                    isToday ? 'today ring-2 ring-[#4C83B5]' : ''
                  }`}
                >
                  {item.day}
                </div>
              );
            })}
          </div>

          {/* Legend from style.html */}
          <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-[11px] font-medium text-[#6F7F8D] border-t border-[#E4EAF0] pt-3">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[#4C83B5]"></span>
              <span>Hadir</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[#A9C7DE]"></span>
              <span>Izin / Sakit</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[#D95B83]"></span>
              <span>Alpha</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[#DDE5EB]"></span>
              <span>Belum ada data</span>
            </span>
          </div>
        </section>

        {/* Right: Riwayat Terbaru (matching style.html recent-history) */}
        <section className="surface rounded-2xl p-5 xl:col-span-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold tracking-[.13em] text-[#4C83B5]">
                  AKTIVITAS
                </p>
                <h2 className="mt-1 text-lg font-bold text-[#123B59]">
                  Riwayat terbaru
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('rekap')}
                className="text-xs font-bold text-[#4C83B5] hover:underline cursor-pointer"
              >
                Lihat semua
              </button>
            </div>

            <div className="mt-3 divide-y divide-[#E4EAF0]">
              {myRecords.length === 0 ? (
                <p className="py-8 text-center text-sm text-[#6F7F8D]">
                  Belum ada aktivitas presensi.
                </p>
              ) : (
                myRecords.slice(0, 5).map(rec => {
                  let badgeStyle = 'bg-[#F4F6F8] text-[#6F7F8D]';
                  if (rec.status === 'hadir' || rec.status === 'terlambat') {
                    badgeStyle = 'bg-[#EAF2F8] text-[#28618F]';
                  } else if (rec.status === 'izin' || rec.status === 'sakit') {
                    badgeStyle = 'bg-[#EEF5FA] text-[#4C83B5]';
                  } else if (rec.status === 'alpha') {
                    badgeStyle = 'bg-[#FCF3F6] text-[#B84469]';
                  }

                  return (
                    <div key={rec.id} className="flex items-center justify-between gap-3 py-3">
                      <div>
                        <p className="text-sm font-bold text-[#123B59]">
                          {formatShortDate(rec.date)}
                        </p>
                        <p className="mt-0.5 text-xs text-[#6F7F8D]">
                          {rec.checkInTime ? `${rec.checkInTime} WIB` : '-'} &middot; {rec.workMode || 'WFO'} &middot; {rec.notes || 'Lokasi tercatat'}
                        </p>
                        {(rec.checkInCoordinates || rec.coordinates || rec.checkOutCoordinates) && <div className="mt-1 flex gap-3 text-[10px] font-semibold">
                          {(rec.checkInCoordinates || rec.coordinates) && <a className="text-[#28618F] hover:underline" target="_blank" rel="noreferrer" href={`https://www.google.com/maps?q=${(rec.checkInCoordinates || rec.coordinates)!.lat},${(rec.checkInCoordinates || rec.coordinates)!.lng}`}>Check-in Maps</a>}
                          {rec.checkOutCoordinates && <a className="text-[#28618F] hover:underline" target="_blank" rel="noreferrer" href={`https://www.google.com/maps?q=${rec.checkOutCoordinates.lat},${rec.checkOutCoordinates.lng}`}>Check-out Maps</a>}
                        </div>}
                      </div>
                      <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold capitalize ${badgeStyle}`}>
                        {rec.status}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={handleDownloadMyReport}
            className="mt-4 w-full rounded-xl border border-[#E4EAF0] bg-white hover:bg-[#F8FAFB] py-2.5 text-xs font-bold text-[#123B59] transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
          >
            <FileText className="w-3.5 h-3.5 text-[#6F7F8D]" />
            <span>Unduh Laporan Presensi Lengkap (PDF)</span>
          </button>
        </section>
      </div>
    </div>
  );
};
