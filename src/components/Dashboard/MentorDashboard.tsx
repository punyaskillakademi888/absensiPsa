import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Users,
  CheckCircle2,
  Clock,
  FileSpreadsheet,
  AlertTriangle,
  Check,
  MapPin,
  CalendarCheck,
  ShieldCheck,
  UserCheck,
  Target,
  Trophy,
  FileText
} from 'lucide-react';
import { getTodayDateString, formatIndonesianDate, getCurrentTimeWIB } from '../../utils/dateUtils';
import { AttendanceStatus } from '../../types';
import { exportToExcel, exportToPDF } from '../../utils/exportUtils';
import { getMentorKejuruanIds } from '../../utils/mentorKejuruan';

export const MentorDashboard: React.FC = () => {
  const {
    currentUser,
    users,
    kejuruanList,
    attendanceRecords,
    refreshUsers,
    refreshAttendanceRecords,
    leaveRequests,
    settings,
    clockIn,
    clockOut,
    getTodayRecordForUser,
    verifyAttendance,
    markAttendanceStatus,
    manualAddOrUpdateAttendance,
    setActiveTab
  } = useApp();

  const today = getTodayDateString();
  const [currentYear, currentMonth] = today.split('-').map(Number);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [mentorNote, setMentorNote] = useState<string>('');

  // Mentor's assigned kejuruan
  const mentorKejuruanIds = useMemo(
    () => getMentorKejuruanIds(currentUser, kejuruanList),
    [currentUser, kejuruanList]
  );
  const mentorRosterKejuruanIds = useMemo(() => [...new Set([
    ...mentorKejuruanIds,
    ...(currentUser.kejuruanId ? [currentUser.kejuruanId] : []),
  ])], [mentorKejuruanIds, currentUser.kejuruanId]);
  const normalizeProgramName = (name?: string) => name?.trim().toLowerCase().replace(/\s+/g, ' ');
  const mentorProgramNames = useMemo(() => [...new Set([
    ...kejuruanList.filter(program => mentorKejuruanIds.includes(program.id)).map(program => program.name),
    ...(currentUser.kejuruanName ? [currentUser.kejuruanName] : []),
    ...(currentUser.name.toLowerCase().includes('fadil') ? ['Pengembangan Web dengan Node.js dan React'] : []),
    ...(currentUser.name.toLowerCase().includes('davy') ? ['Pemasangan Sistem Integrasi Bangunan Cerdas'] : []),
    ...(currentUser.name.toLowerCase().includes('ayu') || currentUser.name.toLowerCase().includes('vanesha') ? ['Pembuatan Sistem Informasi Pariwisata Berbasis Website'] : []),
    ...(currentUser.name.toLowerCase().includes('dzikri') ? [
      'Pengoperasian Tools Generative AI untuk Konten Digital dan Bisnis',
      'Pembuatan Konten Visual untuk Sosial Media',
      'Optimalisasi Pemasaran Melalui Media Sosial',
    ] : []),
  ])]
    .map(name => normalizeProgramName(name))
    .filter((name): name is string => !!name), [kejuruanList, mentorKejuruanIds, currentUser.kejuruanName, currentUser.name]);

  useEffect(() => {
    const refresh = () => {
      void refreshAttendanceRecords();
      void refreshUsers();
    };
    refresh();
    window.addEventListener('focus', refresh);
    const timer = window.setInterval(refresh, 15000);
    return () => {
      window.removeEventListener('focus', refresh);
      window.clearInterval(timer);
    };
  }, [currentUser.id, refreshAttendanceRecords, refreshUsers]);

  const belongsToMentor = (kejuruanId?: string, kejuruanName?: string) => {
    const programName = normalizeProgramName(kejuruanName) || '';
    const matchesProgramName = mentorProgramNames.some(name =>
      name === programName || (!!programName && (name.includes(programName) || programName.includes(name)))
    );
    return mentorRosterKejuruanIds.includes(kejuruanId || '') || matchesProgramName;
  };
  const mentorKejuruan = useMemo(() => {
    const firstProgram = kejuruanList.find(k => k.id === mentorKejuruanIds[0]) || kejuruanList[0];
    if (mentorKejuruanIds.length < 2 || !firstProgram) return firstProgram;
    return { ...firstProgram, id: 'smart-creative', name: 'Smart Creative', code: 'SC-04' };
  }, [kejuruanList, mentorKejuruanIds]);

  // Mentor's own today attendance record (verified by Admin)
  const myMentorRecord = getTodayRecordForUser(currentUser.id);
  const isMentorCheckedIn = !!myMentorRecord?.checkInTime;
  const isMentorCheckedOut = !!myMentorRecord?.checkOutTime;

  // Trainees in this mentor's class
  const classTrainees = useMemo(() => {
    return users.filter(u => u.role === 'trainee' && belongsToMentor(u.kejuruanId, u.kejuruanName));
  }, [users, mentorRosterKejuruanIds, mentorProgramNames]);

  // Trainee today records for this class
  const classTodayRecords = useMemo(() => {
    const classTraineeIds = new Set(classTrainees.map(trainee => trainee.id));
    return attendanceRecords.filter(r => r.date === today && r.userRole !== 'mentor' && (
      classTraineeIds.has(r.userId) || belongsToMentor(r.kejuruanId, r.kejuruanName)
    ));
  }, [attendanceRecords, today, classTrainees, mentorRosterKejuruanIds, mentorProgramNames]);

  // Class stats
  const stats = useMemo(() => {
    let hadir = 0;
    let telat = 0;
    let izin = 0;
    let sakit = 0;
    let pendingVerification = 0;

    classTodayRecords.forEach(r => {
      if (r.status === 'hadir') hadir++;
      else if (r.status === 'terlambat') telat++;
      else if (r.status === 'izin') izin++;
      else if (r.status === 'sakit') sakit++;

      if (r.verificationStatus === 'pending') {
        pendingVerification++;
      }
    });

    const totalPresent = hadir + telat;
    const totalTrainees = classTrainees.length;
    const rate = totalTrainees > 0 ? Math.round((totalPresent / totalTrainees) * 100) : 0;
    const belumAbsen = Math.max(0, totalTrainees - (totalPresent + izin + sakit));

    return { hadir, telat, izin, sakit, pendingVerification, belumAbsen, totalPresent, rate };
  }, [classTodayRecords, classTrainees.length]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  // Mentor self check-in
  const handleMentorClockIn = async () => {
    const res = await clockIn(mentorNote || 'Hadir memfasilitasi pelatihan kelas kejuruan');
    showToast(res.message);
  };

  // Mentor self check-out
  const handleMentorClockOut = async () => {
    const res = await clockOut('Sesi pelatihan kejuruan hari ini selesai');
    showToast(res.message);
  };

  // Mentor verifies a trainee's attendance
  const handleVerifyTrainee = (recordId: string, traineeName: string) => {
    verifyAttendance(recordId, 'verified');
    showToast(`Presensi ${traineeName} berhasil diverifikasi!`);
  };

  // Mentor approves all pending trainees in their class
  const handleApproveAllPendingTrainees = () => {
    const pendingList = classTodayRecords.filter(r => r.verificationStatus === 'pending');
    pendingList.forEach(r => {
      verifyAttendance(r.id, 'verified');
    });
    showToast(`Semua presensi peserta (${pendingList.length}) berhasil diverifikasi!`);
  };

  // Quick mark status for a trainee
  const handleQuickMark = (traineeId: string, status: AttendanceStatus) => {
    const existing = classTodayRecords.find(r => r.userId === traineeId);
    if (existing) {
      markAttendanceStatus(existing.id, status, 'verified');
    } else {
      const time = status === 'hadir' || status === 'terlambat' ? getCurrentTimeWIB() : undefined;
      manualAddOrUpdateAttendance(
        traineeId,
        today,
        status,
        time,
        `Divalidasi langsung oleh Mentor ${currentUser.name}`
      );
    }
    showToast(`Status presensi diubah ke: ${status.toUpperCase()}`);
  };

  const handleExportClassExcel = () => {
    exportToExcel({
      year: currentYear,
      month: currentMonth,
      selectedKejuruanId: mentorKejuruan.id,
      kejuruanList,
      trainees: classTrainees,
      records: attendanceRecords
    });
  };

  const handleExportClassPDF = () => {
    exportToPDF({
      year: currentYear,
      month: currentMonth,
      selectedKejuruanId: mentorKejuruan.id,
      kejuruanList,
      trainees: classTrainees,
      records: attendanceRecords
    });
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-7 left-1/2 -translate-x-1/2 z-50 rounded-xl bg-[#0D2F47] px-5 py-3 text-center text-sm font-bold text-white shadow-xl flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2">
          <Check className="w-4 h-4 text-[#A9C7DE]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* SECTION 1: PRESENSI MANDIRI MENTOR (Diverifikasi oleh Admin) */}
      <section className="surface soft-hover rounded-2xl p-5 border border-[#E4EAF0] space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E4EAF0] pb-3">
          <div className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-xl bg-[#EAF2F8] text-[#4C83B5] flex items-center justify-center font-bold">
              <CalendarCheck className="w-4 h-4" />
            </span>
            <div>
              <p className="text-[10px] font-bold tracking-[.13em] text-[#4C83B5] uppercase">
                PRESENSI MANDIRI
              </p>
              <h2 className="text-sm font-bold text-[#123B59]">
                Kehadiran Instruktur Mentor Hari Ini
              </h2>
            </div>
          </div>

          {/* Verification Status by Admin Badge */}
          <div>
            {!isMentorCheckedIn ? (
              <span className="text-xs text-[#6F7F8D] font-bold bg-[#F4F6F8] px-3 py-1 rounded-full">
                Belum Check-In Hari Ini
              </span>
            ) : myMentorRecord?.verificationStatus === 'pending' ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FFF5E6] text-[#C05621] border border-amber-200 text-xs font-bold">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                <span>Menunggu Verifikasi Admin</span>
              </span>
            ) : myMentorRecord?.verificationStatus === 'verified' ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#EAF2F8] text-[#28618F] border border-[#C8DCEB] text-xs font-bold">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#4C83B5]" />
                <span>Diverifikasi oleh Admin {myMentorRecord?.verifiedBy ? `(${myMentorRecord.verifiedBy})` : ''}</span>
              </span>
            ) : null}
          </div>
        </div>

        {/* Mentor Action Terminal */}
        <div className="flex flex-col sm:flex-row items-center gap-4">
          {!isMentorCheckedIn ? (
            <div className="flex-1 w-full space-y-3">
              <input
                type="text"
                value={mentorNote}
                onChange={e => setMentorNote(e.target.value)}
                placeholder="Rencana materi & topik pengajaran hari ini (opsional)..."
                className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-[#E4EAF0] bg-[#F8FAFB] text-[#123B59] outline-none focus:border-[#4C83B5]"
              />
              <button
                type="button"
                onClick={handleMentorClockIn}
                className="w-full sm:w-auto px-5 py-3 rounded-xl bg-[#123B59] hover:bg-[#0D2F47] text-white text-xs font-bold transition cursor-pointer shadow-sm hover:-translate-y-0.5"
              >
                Catat Kehadiran Mentor (Check-In)
              </button>
            </div>
          ) : (
            <div className="flex-1 w-full flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs bg-[#F8FAFB] p-3.5 rounded-xl border border-[#E4EAF0]">
              <div className="space-y-1">
                <div className="font-mono text-[#123B59] font-bold">
                  Masuk: <strong>{myMentorRecord?.checkInTime} WIB</strong>
                  {myMentorRecord?.checkOutTime && (
                    <span> &middot; Pulang: <strong>{myMentorRecord.checkOutTime} WIB</strong></span>
                  )}
                </div>
                <div className="text-[#6F7F8D] text-[11px]">
                  Agenda: {myMentorRecord?.notes || 'Hadir mengajar onsite'}
                </div>
              </div>

              {!isMentorCheckedOut && (
                <button
                  type="button"
                  onClick={handleMentorClockOut}
                  className="px-4 py-2.5 rounded-xl bg-[#123B59] hover:bg-[#0D2F47] text-white text-xs font-bold transition cursor-pointer shadow-sm"
                >
                  Check-Out Selesai Mengajar
                </button>
              )}
            </div>
          )}
        </div>
      </section>

      {/* SECTION 2: METRICS KELAS */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <article className="surface soft-hover rounded-2xl p-4 sm:p-5 border border-[#E4EAF0]">
          <span className="text-[10px] font-bold text-[#6F7F8D] uppercase tracking-wider block">
            Total Siswa Binaan
          </span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-bold tabular-nums text-[#123B59]">
              {classTrainees.length}
            </span>
            <span className="text-xs text-[#6F7F8D]">siswa</span>
          </div>
        </article>

        <article className="surface soft-hover rounded-2xl p-4 sm:p-5 border border-[#E4EAF0]">
          <span className="text-[10px] font-bold text-[#4C83B5] uppercase tracking-wider block">
            Kehadiran Hari Ini
          </span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-bold tabular-nums text-[#28618F]">
              {stats.rate}%
            </span>
            <span className="text-xs text-[#6F7F8D]">
              ({stats.totalPresent}/{classTrainees.length})
            </span>
          </div>
        </article>

        <article className="surface soft-hover rounded-2xl p-4 sm:p-5 border border-[#E4EAF0]">
          <span className="text-[10px] font-bold text-[#D95B83] uppercase tracking-wider block">
            Menunggu Verifikasi Mentor
          </span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-bold tabular-nums text-[#B84469]">
              {stats.pendingVerification}
            </span>
            <span className="text-xs text-[#6F7F8D]">siswa</span>
          </div>
        </article>

        <article className="surface soft-hover rounded-2xl p-4 sm:p-5 border border-[#E4EAF0]">
          <span className="text-[10px] font-bold text-[#4C83B5] uppercase tracking-wider block">
            Izin / Sakit / Belum
          </span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-bold tabular-nums text-[#4C83B5]">
              {stats.izin + stats.sakit}
            </span>
            <span className="text-xs text-[#6F7F8D]">/ {stats.belumAbsen} belum</span>
          </div>
        </article>
      </div>

      {/* SECTION 3: VERIFIKASI PRESENSI TRAINEE */}
      <div className="surface rounded-2xl border border-[#E4EAF0] overflow-hidden shadow-sm">
        <div className="p-4 sm:p-5 border-b border-[#E4EAF0] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold tracking-[.13em] text-[#4C83B5] uppercase">
              VALIDASI KELAS BINAAN
            </p>
            <h2 className="text-base font-bold text-[#123B59]">
              Verifikasi Presensi Peserta Kelas {mentorKejuruan.name}
            </h2>
            <p className="text-xs text-[#6F7F8D] mt-0.5">
              Validasi catatan presensi peserta magang untuk hari ini.
            </p>
          </div>

          {stats.pendingVerification > 0 && (
            <button
              type="button"
              onClick={handleApproveAllPendingTrainees}
              className="px-4 py-2 rounded-xl bg-[#123B59] hover:bg-[#0D2F47] text-white text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shadow-sm"
            >
              <Check className="w-3.5 h-3.5 text-[#A9C7DE]" />
              <span>Verifikasi Semua Pending ({stats.pendingVerification})</span>
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[#E4EAF0] text-[#6F7F8D] text-[10px] font-bold tracking-wide uppercase bg-[#F8FAFB]">
                <th className="py-3 px-4">Nama Peserta</th>
                <th className="py-3 px-3">Jam Masuk</th>
                <th className="py-3 px-3">Status Absensi</th>
                <th className="py-3 px-3">Status Verifikasi Mentor</th>
                <th className="py-3 px-3">Agenda / Catatan</th>
                <th className="py-3 px-4 text-right">Aksi Mentor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E4EAF0]">
              {classTrainees.map(trainee => {
                const record = classTodayRecords.find(r => r.userId === trainee.id);
                const isPending = record && record.verificationStatus === 'pending';
                const isVerified = record && record.verificationStatus === 'verified';
                const notCheckedIn = !record || !record.checkInTime;

                return (
                  <tr key={trainee.id} className="hover:bg-[#F8FAFB]/60 transition">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        <img
                          src={trainee.avatar}
                          alt={trainee.name}
                          className="w-8 h-8 rounded-xl object-cover border border-[#E4EAF0]"
                        />
                        <div>
                          <div className="font-bold text-[#123B59]">
                            {trainee.name}
                          </div>
                          <div className="text-[10px] text-[#6F7F8D] font-mono">
                            NIM: {trainee.nim}
                          </div>
                          {record && <div className="mt-1 flex flex-wrap gap-x-2 text-[10px]">
                            <span className="font-bold text-[#28618F]">{record.workMode || 'WFO'}</span>
                            {(record.checkInCoordinates || record.coordinates) && <a className="text-[#28618F] hover:underline" target="_blank" rel="noreferrer" href={`https://www.google.com/maps?q=${(record.checkInCoordinates || record.coordinates)!.lat},${(record.checkInCoordinates || record.coordinates)!.lng}`}>Check-in Maps</a>}
                            {record.checkOutCoordinates && <a className="text-[#28618F] hover:underline" target="_blank" rel="noreferrer" href={`https://www.google.com/maps?q=${record.checkOutCoordinates.lat},${record.checkOutCoordinates.lng}`}>Check-out Maps</a>}
                          </div>}
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-3 font-mono text-[#123B59] tabular-nums">
                      {record?.checkInTime ? `${record.checkInTime} WIB` : (
                        <span className="text-[#6F7F8D] italic">Belum hadir</span>
                      )}
                    </td>

                    <td className="py-3 px-3">
                      {record ? (
                        <span
                          className={`rounded-full px-2.5 py-1 text-[10px] font-bold capitalize ${
                            record.status === 'hadir'
                              ? 'bg-[#EAF2F8] text-[#28618F]'
                              : record.status === 'terlambat'
                              ? 'bg-[#FFF5E6] text-[#C05621]'
                              : record.status === 'izin' || record.status === 'sakit'
                              ? 'bg-[#EEF5FA] text-[#4C83B5]'
                              : 'bg-[#FCF3F6] text-[#B84469]'
                          }`}
                        >
                          {record.status}
                        </span>
                      ) : (
                        <span className="inline-flex whitespace-nowrap rounded-lg px-2 py-1 text-[10px] font-bold bg-[#F4F6F8] text-[#6F7F8D]">
                          Belum Absen
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-3">
                      {notCheckedIn ? (
                        <span className="text-[#6F7F8D] text-[11px]">Menunggu Check-In</span>
                      ) : isPending ? (
                        <span className="inline-flex items-center gap-1 font-bold text-[10px] bg-[#FFF5E6] text-[#C05621] px-2.5 py-1 rounded-full border border-amber-200">
                          <AlertTriangle className="w-3 h-3 shrink-0" />
                          <span>Menunggu Verifikasi</span>
                        </span>
                      ) : isVerified ? (
                        <span className="inline-flex items-center gap-1 text-[#28618F] bg-[#EAF2F8] font-bold text-[10px] px-2.5 py-1 rounded-full">
                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-[#4C83B5]" />
                          <span>Terverifikasi Mentor</span>
                        </span>
                      ) : (
                        <span className="text-[#B84469] font-bold text-[11px]">Ditolak</span>
                      )}
                    </td>

                    <td className="py-3 px-3 text-[#6F7F8D] text-[11px] truncate max-w-[180px]">
                      {record?.notes || '-'}
                    </td>

                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        {isPending && record && (
                          <button
                            type="button"
                            onClick={() => handleVerifyTrainee(record.id, trainee.name)}
                            className="px-3 py-1.5 rounded-xl bg-[#123B59] hover:bg-[#0D2F47] text-white font-bold text-xs transition cursor-pointer flex items-center gap-1 shadow-xs"
                            title="Setujui Kehadiran Peserta"
                          >
                            <Check className="w-3 h-3" />
                            <span>Verifikasi</span>
                          </button>
                        )}

                        {/* Quick Mark buttons */}
                        <button
                          type="button"
                          onClick={() => handleQuickMark(trainee.id, 'hadir')}
                          className={`w-6 h-6 rounded-lg text-[10px] font-bold transition cursor-pointer flex items-center justify-center ${
                            record?.status === 'hadir' && isVerified
                              ? 'bg-[#EAF2F8] text-[#28618F] ring-1 ring-[#4C83B5]'
                              : 'text-[#6F7F8D] hover:bg-[#F4F6F8]'
                          }`}
                          title="Tandai Hadir Tepat Waktu"
                        >
                          H
                        </button>
                        <button
                          type="button"
                          onClick={() => handleQuickMark(trainee.id, 'terlambat')}
                          className={`w-6 h-6 rounded-lg text-[10px] font-bold transition cursor-pointer flex items-center justify-center ${
                            record?.status === 'terlambat' && isVerified
                              ? 'bg-[#FFF5E6] text-[#C05621] ring-1 ring-amber-400'
                              : 'text-[#6F7F8D] hover:bg-[#F4F6F8]'
                          }`}
                          title="Tandai Terlambat"
                        >
                          T
                        </button>
                        <button
                          type="button"
                          onClick={() => handleQuickMark(trainee.id, 'izin')}
                          className={`w-6 h-6 rounded-lg text-[10px] font-bold transition cursor-pointer flex items-center justify-center ${
                            record?.status === 'izin' && isVerified
                              ? 'bg-[#EEF5FA] text-[#4C83B5] ring-1 ring-[#4C83B5]'
                              : 'text-[#6F7F8D] hover:bg-[#F4F6F8]'
                          }`}
                          title="Tandai Izin"
                        >
                          I
                        </button>
                        <button
                          type="button"
                          onClick={() => handleQuickMark(trainee.id, 'sakit')}
                          className={`w-6 h-6 rounded-lg text-[10px] font-bold transition cursor-pointer flex items-center justify-center ${
                            record?.status === 'sakit' && isVerified
                              ? 'bg-[#EEF5FA] text-[#4C83B5] ring-1 ring-[#4C83B5]'
                              : 'text-[#6F7F8D] hover:bg-[#F4F6F8]'
                          }`}
                          title="Tandai Sakit"
                        >
                          S
                        </button>
                        <button
                          type="button"
                          onClick={() => handleQuickMark(trainee.id, 'alpha')}
                          className={`w-6 h-6 rounded-lg text-[10px] font-bold transition cursor-pointer flex items-center justify-center ${
                            record?.status === 'alpha' && isVerified
                              ? 'bg-[#FCF3F6] text-[#B84469] ring-1 ring-[#D95B83]'
                              : 'text-[#6F7F8D] hover:bg-[#F4F6F8]'
                          }`}
                          title="Tandai Alpha"
                        >
                          A
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
