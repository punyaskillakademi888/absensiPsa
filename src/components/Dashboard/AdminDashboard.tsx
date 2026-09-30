import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Users,
  CheckCircle2,
  Clock,
  AlertTriangle,
  FileSpreadsheet,
  Check,
  GraduationCap,
  UserCheck,
  ShieldCheck,
  ChevronRight,
  FileText
} from 'lucide-react';
import { getTodayDateString, formatIndonesianDate, getCurrentTimeWIB } from '../../utils/dateUtils';
import { AttendanceStatus } from '../../types';
import { exportToExcel, exportToPDF } from '../../utils/exportUtils';
import { getKejuruanFilterOptions, HIDDEN_ADMIN_DASHBOARD_PROGRAM_CODES, matchesKejuruanFilter } from '../../utils/kejuruanCodes';

export const AdminDashboard: React.FC = () => {
  const {
    currentUser,
    users,
    refreshUsers,
    kejuruanList,
    attendanceRecords,
    refreshAttendanceRecords,
    leaveRequests,
    verifyAttendance,
    markAttendanceStatus,
    manualAddOrUpdateAttendance,
    setActiveTab
  } = useApp();

  const today = getTodayDateString();
  const [currentYear, currentMonth] = today.split('-').map(Number);
  const [selectedKejuruanFilter, setSelectedKejuruanFilter] = useState<string>('all');
  const [activeAdminView, setActiveAdminView] = useState<'mentors' | 'trainees'>('mentors');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    const refresh = () => void refreshAttendanceRecords();
    refresh();
    window.addEventListener('focus', refresh);
    const timer = window.setInterval(refresh, 15000);
    return () => {
      window.removeEventListener('focus', refresh);
      window.clearInterval(timer);
    };
  }, [refreshAttendanceRecords]);

  // A normal login starts with only the signed-in user in AppContext. Fetch
  // the complete admin-visible roster whenever this dashboard is opened.
  useEffect(() => {
    void refreshUsers();
  }, [refreshUsers]);

  const mentors = useMemo(() => users.filter(u => u.role === 'mentor'), [users]);
  const trainees = useMemo(() => users.filter(u => u.role === 'trainee'), [users]);
  const smartCreativeProgramIds = useMemo(() => kejuruanList
    .filter(kj => kj.category === 'Smart Creative' ||
      kj.name.includes('Generative AI') ||
      kj.name.includes('Konten Visual untuk Sosial Media') ||
      kj.name.includes('Optimalisasi Pemasaran Melalui Media Sosial'))
    .map(kj => kj.id), [kejuruanList]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  // Mentor attendance records today
  const mentorTodayRecords = useMemo(() => {
    return mentors.map(mentor => {
      const record = attendanceRecords.find(r => r.userId === mentor.id && r.date === today);
      return {
        mentor,
        record
      };
    });
  }, [mentors, attendanceRecords, today]);

  // Mentor stats
  const mentorStats = useMemo(() => {
    let hadir = 0;
    let pendingVerification = 0;
    let verified = 0;
    let belumAbsen = 0;

    mentorTodayRecords.forEach(({ record }) => {
      if (!record || !record.checkInTime) {
        belumAbsen++;
      } else {
        hadir++;
        if (record.verificationStatus === 'pending') {
          pendingVerification++;
        } else if (record.verificationStatus === 'verified') {
          verified++;
        }
      }
    });

    return {
      total: mentors.length,
      hadir,
      pendingVerification,
      verified,
      belumAbsen
    };
  }, [mentorTodayRecords, mentors.length]);

  // Trainee attendance records today
  const traineeTodayRecords = useMemo(() => {
    return attendanceRecords.filter(r => r.date === today && r.userRole !== 'mentor');
  }, [attendanceRecords, today]);

  const traineeMetrics = useMemo(() => {
    const totalTrainees = trainees.length;
    let hadirTepat = 0;
    let terlambat = 0;
    let izin = 0;
    let sakit = 0;

    traineeTodayRecords.forEach(r => {
      if (r.status === 'hadir') hadirTepat++;
      else if (r.status === 'terlambat') terlambat++;
      else if (r.status === 'izin') izin++;
      else if (r.status === 'sakit') sakit++;
    });

    const totalRecorded = hadirTepat + terlambat + izin + sakit;
    const belumAbsen = Math.max(0, totalTrainees - totalRecorded);
    const totalHadir = hadirTepat + terlambat;
    const attendanceRate = totalTrainees > 0 ? Math.round((totalHadir / totalTrainees) * 100) : 0;

    return {
      totalTrainees,
      hadirTepat,
      terlambat,
      izin,
      sakit,
      belumAbsen,
      totalHadir,
      attendanceRate
    };
  }, [trainees.length, traineeTodayRecords]);

  // Kejuruan statistics for trainees
  const kejuruanStats = useMemo(() => {
    const stats = kejuruanList.filter(kj =>
      !HIDDEN_ADMIN_DASHBOARD_PROGRAM_CODES.has(kj.code.trim().toUpperCase())
    ).map(kj => {
      const normalizedProgramName = kj.name.trim().toLocaleLowerCase();
      const kjTrainees = trainees.filter(t =>
        t.kejuruanId === kj.id || t.kejuruanName?.trim().toLocaleLowerCase() === normalizedProgramName
      );
      const traineeIds = new Set(kjTrainees.map(trainee => trainee.id));
      const kjRecords = traineeTodayRecords.filter(r =>
        traineeIds.has(r.userId) || r.kejuruanId === kj.id || r.kejuruanName?.trim().toLocaleLowerCase() === normalizedProgramName
      );
      const present = kjRecords.filter(r => r.status === 'hadir' || r.status === 'terlambat').length;
      const rate = kjTrainees.length > 0 ? Math.round((present / kjTrainees.length) * 100) : 0;

      return {
        kejuruan: kj,
        totalTrainees: kjTrainees.length,
        presentCount: present,
        rate
      };
    });

    const smartCreativePrograms = stats.filter(stat => smartCreativeProgramIds.includes(stat.kejuruan.id));
    if (smartCreativePrograms.length < 2) return stats;

    const totalTrainees = smartCreativePrograms.reduce((total, stat) => total + stat.totalTrainees, 0);
    const presentCount = smartCreativePrograms.reduce((total, stat) => total + stat.presentCount, 0);
    const smartCreativeIds = new Set(smartCreativePrograms.map(stat => stat.kejuruan.id));
    return [
      ...stats.filter(stat => !smartCreativeIds.has(stat.kejuruan.id)),
      {
        kejuruan: {
          id: 'smart-creative',
          name: 'Smart Creative',
          code: 'SC-04',
          category: 'Smart Creative',
          color: '#059669',
          description: 'Program Smart Creative yang mencakup tiga kejuruan.'
        },
        totalTrainees,
        presentCount,
        rate: totalTrainees > 0 ? Math.round((presentCount / totalTrainees) * 100) : 0
      }
    ];
  }, [kejuruanList, smartCreativeProgramIds, trainees, traineeTodayRecords]);

  const getProgramMentorLabel = (programName: string) => {
    const name = programName.toLowerCase();
    if (name === 'smart creative') return 'Mas Dzikri';
    if (name.includes('sistem informasi pariwisata')) return 'Ayu / Vanesha';
    if (name.includes('generative ai') || name.includes('konten visual untuk sosial media') || name.includes('optimalisasi pemasaran melalui media sosial')) return 'Mas Dzikri (Smart Creative)';
    if (name.includes('node.js') || name.includes('react')) return 'Fadil';
    if (name.includes('integrasi bangunan cerdas')) return 'Davy';
    return 'Manajemen';
  };

  // Handle Admin approving a mentor's check-in
  const handleVerifyMentor = (recordId: string, mentorName: string) => {
    verifyAttendance(recordId, 'verified');
    showToast(`Presensi Mentor ${mentorName} berhasil diverifikasi!`);
  };

  // Handle Admin changing mentor status
  const handleSetMentorStatus = (
    mentorId: string,
    existingRecordId: string | undefined,
    status: AttendanceStatus
  ) => {
    if (existingRecordId) {
      markAttendanceStatus(existingRecordId, status, 'verified');
    } else {
      const currentTime = status === 'hadir' || status === 'terlambat' ? getCurrentTimeWIB() : undefined;
      manualAddOrUpdateAttendance(
        mentorId,
        today,
        status,
        currentTime,
        `Ditetapkan langsung oleh Administrator`
      );
    }
    showToast(`Status kehadiran mentor diperbarui ke: ${status.toUpperCase()}`);
  };

  // Approve all pending mentors
  const handleApproveAllPendingMentors = () => {
    const pending = mentorTodayRecords.filter(m => m.record && m.record.verificationStatus === 'pending');
    pending.forEach(m => {
      if (m.record) {
        verifyAttendance(m.record.id, 'verified');
      }
    });
    showToast(`Semua presensi mentor (${pending.length}) berhasil diverifikasi!`);
  };

  const handleExportExcel = () => {
    exportToExcel({
      year: currentYear,
      month: currentMonth,
      selectedKejuruanId: selectedKejuruanFilter,
      kejuruanList,
      trainees,
      records: attendanceRecords
    });
  };

  const handleExportPDF = () => {
    exportToPDF({
      year: currentYear,
      month: currentMonth,
      selectedKejuruanId: selectedKejuruanFilter,
      kejuruanList,
      trainees,
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

      {/* Segmented View Switcher: Verifikasi Mentor vs Rekap Peserta */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E4EAF0] pb-3">
        <div className="flex flex-wrap items-center gap-1 bg-[#F4F6F8] p-1 rounded-xl border border-[#E4EAF0]">
          <button
            onClick={() => setActiveAdminView('mentors')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-2 ${
              activeAdminView === 'mentors'
                ? 'bg-[#123B59] text-white shadow-xs'
                : 'text-[#6F7F8D] hover:text-[#123B59]'
            }`}
          >
            <GraduationCap className="w-3.5 h-3.5 text-[#A9C7DE]" />
            <span>Verifikasi Mentor ({mentorStats.total})</span>
            {mentorStats.pendingVerification > 0 && (
              <span className="px-2 py-0.2 rounded-full bg-[#D95B83] text-white font-bold text-[10px]">
                {mentorStats.pendingVerification}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveAdminView('trainees')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-2 ${
              activeAdminView === 'trainees'
                ? 'bg-[#123B59] text-white shadow-xs'
                : 'text-[#6F7F8D] hover:text-[#123B59]'
            }`}
          >
            <Users className="w-3.5 h-3.5 text-[#A9C7DE]" />
            <span>Monitoring Peserta ({traineeMetrics.totalTrainees})</span>
          </button>
        </div>

        {activeAdminView === 'mentors' && mentorStats.pendingVerification > 0 && (
          <button
            type="button"
            onClick={handleApproveAllPendingMentors}
            className="px-4 py-2 rounded-xl bg-[#123B59] hover:bg-[#0D2F47] text-white text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shadow-sm"
          >
            <Check className="w-3.5 h-3.5 text-[#A9C7DE]" />
            <span>Setujui Semua Pending ({mentorStats.pendingVerification})</span>
          </button>
        )}
      </div>

      {/* VIEW 1: VERIFIKASI MENTOR */}
      {activeAdminView === 'mentors' && (
        <div className="space-y-6">
          {/* Mentor Metrics Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <article className="surface soft-hover rounded-2xl p-4 sm:p-5 border border-[#E4EAF0]">
              <span className="text-[10px] font-bold text-[#6F7F8D] uppercase tracking-wider block">
                Total Instruktur Mentor
              </span>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl font-bold tabular-nums text-[#123B59]">
                  {mentorStats.total}
                </span>
                <span className="text-xs text-[#6F7F8D]">orang</span>
              </div>
            </article>

            <article className="surface soft-hover rounded-2xl p-4 sm:p-5 border border-[#E4EAF0]">
              <span className="text-[10px] font-bold text-[#4C83B5] uppercase tracking-wider block">
                Mentor Hadir Hari Ini
              </span>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl font-bold tabular-nums text-[#28618F]">
                  {mentorStats.hadir}
                </span>
                <span className="text-xs text-[#6F7F8D]">tercatat</span>
              </div>
            </article>

            <article className="surface soft-hover rounded-2xl p-4 sm:p-5 border border-[#E4EAF0]">
              <span className="text-[10px] font-bold text-[#D95B83] uppercase tracking-wider block">
                Menunggu Verifikasi Admin
              </span>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl font-bold tabular-nums text-[#B84469]">
                  {mentorStats.pendingVerification}
                </span>
                <span className="text-xs text-[#6F7F8D]">perlu aksi</span>
              </div>
            </article>

            <article className="surface soft-hover rounded-2xl p-4 sm:p-5 border border-[#E4EAF0]">
              <span className="text-[10px] font-bold text-[#4C83B5] uppercase tracking-wider block">
                Telah Diverifikasi
              </span>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl font-bold tabular-nums text-[#4C83B5]">
                  {mentorStats.verified}
                </span>
                <span className="text-xs text-[#6F7F8D]">selesai</span>
              </div>
            </article>
          </div>

          {/* Table: Mentor Attendance & Verification List */}
          <div className="surface rounded-2xl border border-[#E4EAF0] overflow-hidden shadow-sm">
            <div className="p-4 sm:p-5 border-b border-[#E4EAF0] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <p className="text-[10px] font-bold tracking-[.13em] text-[#4C83B5] uppercase">
                  VERIFIKASI TINGKAT 1
                </p>
                <h2 className="text-base font-bold text-[#123B59]">
                  Daftar Presensi Instruktur & Mentor Kejuruan
                </h2>
              </div>
              <span className="rounded-full bg-[#EAF2F8] px-3 py-1 text-xs font-bold text-[#28618F]">
                {mentorTodayRecords.length} Mentor Terdaftar
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#E4EAF0] text-[#6F7F8D] text-[10px] font-bold tracking-wide uppercase bg-[#F8FAFB]">
                    <th className="py-3 px-4">Instruktur / Mentor</th>
                    <th className="py-3 px-3">Kejuruan</th>
                    <th className="py-3 px-3">Jam Masuk</th>
                    <th className="py-3 px-3">Status Absen</th>
                    <th className="py-3 px-3">Status Verifikasi Admin</th>
                    <th className="py-3 px-4 text-right">Aksi Administrator</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E4EAF0]">
                  {mentorTodayRecords.map(({ mentor, record }) => {
                    const isPending = record && record.verificationStatus === 'pending';
                    const isVerified = record && record.verificationStatus === 'verified';
                    const notCheckedIn = !record || !record.checkInTime;

                    return (
                      <tr key={mentor.id} className="hover:bg-[#F8FAFB]/60 transition">
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2.5">
                            <img
                              src={mentor.avatar}
                              alt={mentor.name}
                              className="w-8 h-8 rounded-xl object-cover border border-[#E4EAF0]"
                            />
                            <div>
                              <div className="font-bold text-[#123B59]">
                                {mentor.name}
                              </div>
                              <div className="text-[10px] text-[#6F7F8D] font-mono">
                                NIP: {mentor.nim}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="py-3.5 px-3 font-semibold text-[#123B59]">
                          {mentor.kejuruanName || '-'}
                        </td>

                        <td className="py-3.5 px-3 font-mono text-[#123B59] tabular-nums">
                          {record?.checkInTime ? `${record.checkInTime} WIB` : (
                            <span className="text-[#6F7F8D] italic">Belum hadir</span>
                          )}
                        </td>

                        <td className="py-3.5 px-3">
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

                        <td className="py-3.5 px-3">
                          {notCheckedIn ? (
                            <span className="text-[#6F7F8D] text-[11px]">Menunggu Check-In</span>
                          ) : isPending ? (
                            <span className="inline-flex items-center gap-1 font-bold text-[10px] bg-[#FFF5E6] text-[#C05621] px-2.5 py-1 rounded-full border border-amber-200">
                              <AlertTriangle className="w-3 h-3 shrink-0" />
                              <span>Menunggu Verifikasi Admin</span>
                            </span>
                          ) : isVerified ? (
                            <div className="space-y-0.5">
                              <span className="inline-flex items-center gap-1 text-[#28618F] bg-[#EAF2F8] font-bold text-[10px] px-2.5 py-1 rounded-full">
                                <CheckCircle2 className="w-3 h-3 shrink-0 text-[#4C83B5]" />
                                <span>Terverifikasi Admin</span>
                              </span>
                              {record?.verifiedBy && (
                                <div className="text-[10px] text-[#6F7F8D] truncate">
                                  Oleh: {record.verifiedBy}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-[#B84469] font-bold text-[11px]">Ditolak</span>
                          )}
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            {isPending && record && (
                              <button
                                type="button"
                                onClick={() => handleVerifyMentor(record.id, mentor.name)}
                                className="px-3 py-1.5 rounded-xl bg-[#123B59] hover:bg-[#0D2F47] text-white font-bold text-xs transition cursor-pointer flex items-center gap-1 shadow-xs"
                                title="Setujui Kehadiran Mentor"
                              >
                                <Check className="w-3 h-3" />
                                <span>Verifikasi</span>
                              </button>
                            )}

                            {/* Quick Select Status Badges */}
                            <button
                              type="button"
                              onClick={() => handleSetMentorStatus(mentor.id, record?.id, 'hadir')}
                              className={`w-6 h-6 rounded-lg text-[10px] font-bold transition cursor-pointer flex items-center justify-center ${
                                record?.status === 'hadir' && isVerified
                                  ? 'bg-[#EAF2F8] text-[#28618F] ring-1 ring-[#4C83B5]'
                                  : 'text-[#6F7F8D] hover:bg-[#F4F6F8]'
                              }`}
                              title="Tandai Hadir"
                            >
                              H
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSetMentorStatus(mentor.id, record?.id, 'terlambat')}
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
                              onClick={() => handleSetMentorStatus(mentor.id, record?.id, 'izin')}
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
                              onClick={() => handleSetMentorStatus(mentor.id, record?.id, 'sakit')}
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
                              onClick={() => handleSetMentorStatus(mentor.id, record?.id, 'alpha')}
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
      )}

      {/* VIEW 2: MONITORING PESERTA (TRAINEES) */}
      {activeAdminView === 'trainees' && (
        <div className="space-y-6">
          {/* Trainee Metrics Overview */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <article className="surface soft-hover rounded-2xl p-4 sm:p-5 border border-[#E4EAF0]">
              <span className="text-[10px] font-bold text-[#6F7F8D] uppercase tracking-wider block">
                Total Peserta Pelatihan
              </span>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl font-bold tabular-nums text-[#123B59]">
                  {traineeMetrics.totalTrainees}
                </span>
                <span className="text-xs text-[#6F7F8D]">siswa</span>
              </div>
            </article>

            <article className="surface soft-hover rounded-2xl p-4 sm:p-5 border border-[#E4EAF0]">
              <span className="text-[10px] font-bold text-[#4C83B5] uppercase tracking-wider block">
                Tingkat Kehadiran
              </span>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl font-bold tabular-nums text-[#4C83B5]">
                  {traineeMetrics.attendanceRate}%
                </span>
                <span className="text-xs text-[#6F7F8D]">
                  ({traineeMetrics.totalHadir}/{traineeMetrics.totalTrainees})
                </span>
              </div>
            </article>

            <article className="surface soft-hover rounded-2xl p-4 sm:p-5 border border-[#E4EAF0]">
              <span className="text-[10px] font-bold text-[#4C83B5] uppercase tracking-wider block">
                Hadir Tepat / Terlambat
              </span>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl font-bold tabular-nums text-[#28618F]">
                  {traineeMetrics.hadirTepat}
                </span>
                <span className="text-xs font-mono text-[#C05621]">/ {traineeMetrics.terlambat} T</span>
              </div>
            </article>

            <article className="surface soft-hover rounded-2xl p-4 sm:p-5 border border-[#E4EAF0]">
              <span className="text-[10px] font-bold text-[#D95B83] uppercase tracking-wider block">
                Izin / Sakit / Belum
              </span>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl font-bold tabular-nums text-[#4C83B5]">
                  {traineeMetrics.izin + traineeMetrics.sakit}
                </span>
                <span className="text-xs text-[#6F7F8D]">/ {traineeMetrics.belumAbsen} belum</span>
              </div>
            </article>
          </div>

          {/* Kejuruan Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {kejuruanStats.map(stat => (
              <div
                key={stat.kejuruan.id}
                onClick={() => setSelectedKejuruanFilter(stat.kejuruan.id)}
                className={`p-3.5 rounded-2xl border transition cursor-pointer soft-hover ${
                  selectedKejuruanFilter === stat.kejuruan.id
                    ? 'border-[#4C83B5] bg-[#EAF2F8]'
                    : 'border-[#E4EAF0] bg-white hover:border-[#A9C7DE]'
                }`}
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-[#123B59] truncate">
                    {stat.kejuruan.code}
                  </span>
                  <span className="font-bold text-[#4C83B5]">
                    {stat.rate}%
                  </span>
                </div>
                <div className="text-[11px] text-[#6F7F8D] truncate mt-1">
                  {stat.kejuruan.name}
                </div>
                <div className="text-[10px] text-[#6F7F8D] mt-1">
                  Mentor: <strong className="text-[#123B59]">{getProgramMentorLabel(stat.kejuruan.name)}</strong>
                </div>
              </div>
            ))}
          </div>

          {/* Filter & Trainee Attendance Table */}
          <div className="surface rounded-2xl border border-[#E4EAF0] overflow-hidden shadow-sm">
            <div className="p-4 sm:p-5 border-b border-[#E4EAF0] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold tracking-[.13em] text-[#4C83B5] uppercase">
                  MONITORING GLOBAL
                </p>
                <h2 className="text-base font-bold text-[#123B59]">
                  Monitoring Kehadiran Peserta & Verifikasi Mentor
                </h2>
                <p className="text-xs text-[#6F7F8D] mt-0.5">
                  Diverifikasi langsung oleh instruktur mentor masing-masing kejuruan.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <label className="text-xs font-bold text-[#123B59]">Filter Kejuruan:</label>
                <select
                  value={selectedKejuruanFilter}
                  onChange={e => setSelectedKejuruanFilter(e.target.value)}
                  className="text-xs py-2 px-3 rounded-xl border border-[#E4EAF0] bg-[#F8FAFB] text-[#123B59] font-semibold outline-none focus:border-[#4C83B5]"
                >
                  <option value="all">Semua Kejuruan</option>
                  {kejuruanList.filter(kj => kj.category === 'Smart Creative').map(kj => (
                    <option key={`${kj.id}-group`} value={kj.id}>SC-04 - Semua Smart Creative</option>
                  ))}
                  {getKejuruanFilterOptions(kejuruanList.filter(kj =>
                    !HIDDEN_ADMIN_DASHBOARD_PROGRAM_CODES.has(kj.code.trim().toUpperCase())
                  )).map(option => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#E4EAF0] text-[#6F7F8D] text-[10px] font-bold tracking-wide uppercase bg-[#F8FAFB]">
                    <th className="py-3 px-4">Nama Peserta</th>
                    <th className="py-3 px-3">Kejuruan</th>
                    <th className="py-3 px-3">Jam Masuk</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3">Status Verifikasi Mentor</th>
                    <th className="py-3 px-4">Catatan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E4EAF0]">
                  {trainees
                    .filter(t => matchesKejuruanFilter(selectedKejuruanFilter, kejuruanList, t.kejuruanId, t.kejuruanName))
                    .map(trainee => {
                      const record = traineeTodayRecords.find(r => r.userId === trainee.id);
                      const isPending = record && record.verificationStatus === 'pending';
                      const isVerified = record && record.verificationStatus === 'verified';

                      return (
                        <tr key={trainee.id} className="hover:bg-[#F8FAFB]/60 transition">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2.5">
                              <img
                                src={trainee.avatar}
                                alt={trainee.name}
                                className="w-7 h-7 rounded-xl object-cover border border-[#E4EAF0]"
                              />
                              <div>
                                <div className="font-bold text-[#123B59]">
                                  {trainee.name}
                                </div>
                                <div className="text-[10px] text-[#6F7F8D] font-mono">
                                  {trainee.nim}
                                </div>
                                {record && <div className="mt-1 flex flex-wrap gap-x-2 text-[10px]">
                                  <span className="font-bold text-[#28618F]">{record.workMode || 'WFO'}</span>
                                  {(record.checkInCoordinates || record.coordinates) && <a className="text-[#28618F] hover:underline" target="_blank" rel="noreferrer" href={`https://www.google.com/maps?q=${(record.checkInCoordinates || record.coordinates)!.lat},${(record.checkInCoordinates || record.coordinates)!.lng}`}>Check-in Maps</a>}
                                  {record.checkOutCoordinates && <a className="text-[#28618F] hover:underline" target="_blank" rel="noreferrer" href={`https://www.google.com/maps?q=${record.checkOutCoordinates.lat},${record.checkOutCoordinates.lng}`}>Check-out Maps</a>}
                                </div>}
                              </div>
                            </div>
                          </td>

                          <td className="py-3 px-3 font-medium text-[#123B59]">
                            {trainee.kejuruanName?.split(' ')[0] || '-'}
                          </td>

                          <td className="py-3 px-3 font-mono text-[#123B59] tabular-nums">
                            {record?.checkInTime ? `${record.checkInTime} WIB` : '-'}
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
                              <span className="rounded-full px-2.5 py-1 text-[10px] font-bold bg-[#F4F6F8] text-[#6F7F8D]">
                                Belum Presensi
                              </span>
                            )}
                          </td>

                          <td className="py-3 px-3">
                            {record ? (
                              isPending ? (
                                <span className="text-[#C05621] bg-[#FFF5E6] font-bold text-[10px] px-2.5 py-1 rounded-full flex items-center gap-1 w-fit">
                                  <Clock className="w-3 h-3 shrink-0" />
                                  <span>Menunggu Verifikasi Mentor</span>
                                </span>
                              ) : isVerified ? (
                                <div className="space-y-0.5">
                                  <span className="text-[#28618F] bg-[#EAF2F8] font-bold text-[10px] px-2.5 py-1 rounded-full flex items-center gap-1 w-fit">
                                    <CheckCircle2 className="w-3 h-3 shrink-0 text-[#4C83B5]" />
                                    <span>Terverifikasi Mentor</span>
                                  </span>
                                  {record.verifiedBy && (
                                    <div className="text-[10px] text-[#6F7F8D] truncate">
                                      Oleh: {record.verifiedBy}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <span className="text-[#B84469] font-bold text-[11px]">Ditolak</span>
                              )
                            ) : (
                              <span className="text-[#6F7F8D] text-[11px]">-</span>
                            )}
                          </td>

                          <td className="py-3 px-4 text-[#6F7F8D] text-[11px] truncate max-w-[200px]">
                            {record?.notes || '-'}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
