import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { MobileHeaderStatus } from '../MobileHeaderStatus';
import {
  FileSpreadsheet,
  FileText,
  Search,
  CheckCircle2,
  Clock,
  UserX,
  AlertCircle,
  TrendingUp,
  ChevronDown,
  ChevronUp,
  Calendar,
  Sparkles,
  UserCheck
} from 'lucide-react';
import { INDONESIAN_MONTHS, getTodayDateString } from '../../utils/dateUtils';
import { computeMonthlyRecapData, exportToExcel, exportToPDF } from '../../utils/exportUtils';
import { getMentorKejuruanIds } from '../../utils/mentorKejuruan';
import { getKejuruanFilterOptions } from '../../utils/kejuruanCodes';

export const MonthlyRecapView: React.FC = () => {
  const { users, kejuruanList, attendanceRecords, currentUser, dailyReports, setActiveTab } = useApp();

  const isTrainee = currentUser.role === 'trainee';
  const isMentor = currentUser.role === 'mentor';
  const mentorKejuruanIds = getMentorKejuruanIds(currentUser, kejuruanList);
  const kejuruanFilterOptions = getKejuruanFilterOptions(kejuruanList);
  const isDzikri = isMentor && /dzikri/i.test(currentUser.name);

  const today = getTodayDateString();
  const [currentYear, currentMonth] = today.split('-').map(Number);

  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [selectedMonth, setSelectedMonth] = useState<number>(currentMonth);

  const defaultKj = isTrainee
    ? currentUser.kejuruanId || 'all'
    : isDzikri
    ? 'all'
    : isMentor && currentUser.kejuruanId
    ? currentUser.kejuruanId
    : 'all';
  const [selectedKejuruanId, setSelectedKejuruanId] = useState<string>(defaultKj);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterPredicate, setFilterPredicate] = useState<string>('all');

  // Date detail dropdown selector (Default: 'summary', or specific day 1..31, or 'all-days')
  const [selectedDayFilter, setSelectedDayFilter] = useState<string>('summary');

  // Expanded row IDs for viewing chronological date breakdown
  const [expandedUserIds, setExpandedUserIds] = useState<Record<string, boolean>>(() => {
    if (isTrainee) {
      return { [currentUser.id]: true };
    }
    return {};
  });

  const trainees = useMemo(() => {
    if (isTrainee) {
      return [currentUser];
    }
    if (isMentor && mentorKejuruanIds.length) {
      return users.filter(u => u.role === 'trainee' && mentorKejuruanIds.includes(u.kejuruanId || ''));
    }
    return users.filter(u => u.role === 'trainee');
  }, [users, isTrainee, isMentor, currentUser, mentorKejuruanIds.join('|')]);

  useEffect(() => {
    if (isTrainee) {
      setExpandedUserIds({ [currentUser.id]: true });
      if (currentUser.kejuruanId) {
        setSelectedKejuruanId(currentUser.kejuruanId);
      }
    }
  }, [isTrainee, currentUser.id, currentUser.kejuruanId]);

  const recapData = useMemo(() => {
    return computeMonthlyRecapData({
      year: selectedYear,
      month: selectedMonth,
      selectedKejuruanId: isTrainee ? currentUser.kejuruanId || 'all' : selectedKejuruanId,
      kejuruanList,
      trainees,
      records: attendanceRecords
    });
  }, [selectedYear, selectedMonth, isTrainee, currentUser.kejuruanId, selectedKejuruanId, kejuruanList, trainees, attendanceRecords]);

  const filteredSummaries = useMemo(() => {
    return recapData.summaries.filter(item => {
      const matchSearch =
        item.trainee.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.trainee.nim.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.trainee.kejuruanName || '').toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchSearch) return false;

      if (filterPredicate === 'danger') {
        return item.attendancePercentage < 75;
      }
      if (filterPredicate === 'good') {
        return item.attendancePercentage >= 90;
      }
      return true;
    });
  }, [recapData.summaries, searchQuery, filterPredicate]);

  const aggregates = useMemo(() => {
    const list = recapData.summaries;
    if (list.length === 0) {
      return { totalHadir: 0, totalTelat: 0, totalIzin: 0, totalSakit: 0, totalAlpha: 0, avgRate: 0 };
    }
    const totalHadir = list.reduce((acc, s) => acc + s.hadir, 0);
    const totalTelat = list.reduce((acc, s) => acc + s.terlambat, 0);
    const totalIzin = list.reduce((acc, s) => acc + s.izin, 0);
    const totalSakit = list.reduce((acc, s) => acc + s.sakit, 0);
    const totalAlpha = list.reduce((acc, s) => acc + s.alpha, 0);
    const avgRate = Math.round(list.reduce((acc, s) => acc + s.attendancePercentage, 0) / list.length);

    return { totalHadir, totalTelat, totalIzin, totalSakit, totalAlpha, avgRate };
  }, [recapData.summaries]);

  const toggleExpand = (userId: string) => {
    setExpandedUserIds(prev => ({
      ...prev,
      [userId]: !prev[userId]
    }));
  };

  const handleExportExcel = () => {
    exportToExcel({
      year: selectedYear,
      month: selectedMonth,
      selectedKejuruanId: isTrainee ? currentUser.kejuruanId || 'all' : selectedKejuruanId,
      kejuruanList,
      trainees,
      records: attendanceRecords
    });
  };

  const handleExportPDF = () => {
    exportToPDF({
      year: selectedYear,
      month: selectedMonth,
      selectedKejuruanId: isTrainee ? currentUser.kejuruanId || 'all' : selectedKejuruanId,
      kejuruanList,
      trainees,
      records: attendanceRecords
    });
  };

  const getStatusBadge = (statusChar: string) => {
    switch (statusChar) {
      case 'H':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#EAF2F8] text-[#28618F]">Hadir</span>;
      case 'T':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#FFF5E6] text-[#C05621]">Telat</span>;
      case 'I':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#EEF5FA] text-[#4C83B5]">Izin</span>;
      case 'S':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#EEF5FA] text-[#4C83B5]">Sakit</span>;
      case 'A':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#FCF3F6] text-[#B84469]">Alpha</span>;
      case 'L':
        return <span className="text-[10px] text-[#6F7F8D]">Libur</span>;
      default:
        return <span className="text-[10px] text-[#A9C7DE]">-</span>;
    }
  };

  const selectedDayNumber = selectedDayFilter !== 'summary' && selectedDayFilter !== 'all-days' ? Number(selectedDayFilter) : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col items-start gap-3 pb-4 border-b border-[#E4EAF0]">
        <div className="min-w-0 w-full">
          <p className="text-[10px] font-bold tracking-[.14em] text-[#4C83B5] uppercase">
            CATATAN KEHADIRAN & REKAPITULASI
          </p>
          <div className="flex items-center gap-2 mt-1">
            <h1 className="text-2xl lg:text-3xl font-bold tracking-tight text-[#123B59]">
              {isTrainee ? 'Rekapitulasi Presensi Saya' : 'Rekapitulasi Presensi Bulanan'}
            </h1>
            {isTrainee && (
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#EAF2F8] text-[#28618F] border border-[#C8DCEB]">
                Data Pribadi
              </span>
            )}
          </div>
          <p className="text-xs text-[#6F7F8D] mt-1">
            {isTrainee
              ? `Ringkasan kehadiran mandiri · Periode ${recapData.monthName} ${selectedYear} · ${currentUser.name} (${currentUser.nim || '-'})`
              : `Ringkasan Statistik Kehadiran Bulanan · Periode ${recapData.monthName} ${selectedYear} (${filteredSummaries.length} Peserta)`}
          </p>
          <MobileHeaderStatus />
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <button
            onClick={handleExportExcel}
            className="surface px-3.5 py-2.5 rounded-xl border border-[#E4EAF0] hover:bg-[#F8FAFB] text-xs font-bold text-[#123B59] transition flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>{isTrainee ? 'Slip Excel' : 'Export Excel'}</span>
          </button>
          <button
            onClick={handleExportPDF}
            className="px-3.5 py-2.5 rounded-xl bg-[#123B59] hover:bg-[#0D2F47] text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm hover:-translate-y-0.5"
          >
            <FileText className="w-4 h-4 text-[#A9C7DE]" />
            <span>{isTrainee ? 'Slip PDF' : 'Export PDF'}</span>
          </button>
        </div>
      </div>

      {/* Aggregate Metric Cards (style.html metric card look) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <article className="surface soft-hover p-4 rounded-2xl border border-[#E4EAF0]">
          <div className="text-[10px] text-[#6F7F8D] font-bold uppercase tracking-wider mb-1">
            {isTrainee ? 'Tingkat Kehadiran' : 'Rata-rata Kelas'}
          </div>
          <div className="text-2xl font-bold text-[#123B59] tabular-nums">
            {aggregates.avgRate}%
          </div>
          <div className="text-[10px] text-[#4C83B5] font-semibold mt-1">
            {aggregates.avgRate >= 80 ? '✓ Memenuhi Standar' : '⚠ Perlu Ditingkatkan'}
          </div>
        </article>

        <article className="surface soft-hover p-4 rounded-2xl border border-[#E4EAF0]">
          <div className="text-[10px] text-[#4C83B5] font-bold uppercase tracking-wider mb-1 flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-[#4C83B5]"></span>
            <span>Hadir Tepat (H)</span>
          </div>
          <div className="text-2xl font-bold text-[#28618F] tabular-nums">
            {aggregates.totalHadir}
          </div>
          <div className="text-[10px] text-[#6F7F8D] mt-1">Sesi terjadwal</div>
        </article>

        <article className="surface soft-hover p-4 rounded-2xl border border-[#E4EAF0]">
          <div className="text-[10px] text-[#C05621] font-bold uppercase tracking-wider mb-1 flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
            <span>Terlambat (T)</span>
          </div>
          <div className="text-2xl font-bold text-[#C05621] tabular-nums">
            {aggregates.totalTelat}
          </div>
          <div className="text-[10px] text-[#6F7F8D] mt-1">Check-in lewat batas</div>
        </article>

        <article className="surface soft-hover p-4 rounded-2xl border border-[#E4EAF0]">
          <div className="text-[10px] text-[#4C83B5] font-bold uppercase tracking-wider mb-1 flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-[#A9C7DE]"></span>
            <span>Izin (I)</span>
          </div>
          <div className="text-2xl font-bold text-[#4C83B5] tabular-nums">
            {aggregates.totalIzin}
          </div>
          <div className="text-[10px] text-[#6F7F8D] mt-1">Disetujui mentor</div>
        </article>

        <article className="surface soft-hover p-4 rounded-2xl border border-[#E4EAF0]">
          <div className="text-[10px] text-[#4C83B5] font-bold uppercase tracking-wider mb-1 flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-[#4C83B5]"></span>
            <span>Sakit (S)</span>
          </div>
          <div className="text-2xl font-bold text-[#4C83B5] tabular-nums">
            {aggregates.totalSakit}
          </div>
          <div className="text-[10px] text-[#6F7F8D] mt-1">Dengan bukti surat</div>
        </article>

        <article className="surface soft-hover p-4 rounded-2xl border border-[#E4EAF0]">
          <div className="text-[10px] text-[#D95B83] font-bold uppercase tracking-wider mb-1 flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-[#D95B83]"></span>
            <span>Alpha (A)</span>
          </div>
          <div className="text-2xl font-bold text-[#B84469] tabular-nums">
            {aggregates.totalAlpha}
          </div>
          <div className="text-[10px] text-[#6F7F8D] mt-1">Tanpa keterangan</div>
        </article>
      </div>

      {/* Filter Toolbar & Date Detail Dropdown */}
      <div className="surface p-4 rounded-2xl border border-[#E4EAF0] flex flex-col lg:flex-row lg:items-center justify-between gap-3 shadow-xs">
        <div className="flex flex-wrap items-center gap-2">
          {/* Month Selector */}
          <select
            value={selectedMonth}
            onChange={e => setSelectedMonth(Number(e.target.value))}
            className="text-xs py-2 px-3 rounded-xl border border-[#E4EAF0] bg-[#F8FAFB] text-[#123B59] font-bold outline-none focus:border-[#4C83B5]"
          >
            {INDONESIAN_MONTHS.map((m, idx) => (
              <option key={m} value={idx + 1}>
                {m}
              </option>
            ))}
          </select>

          {/* Year Selector */}
          <select
            value={selectedYear}
            onChange={e => setSelectedYear(Number(e.target.value))}
            className="text-xs py-2 px-3 rounded-xl border border-[#E4EAF0] bg-[#F8FAFB] text-[#123B59] font-bold outline-none focus:border-[#4C83B5]"
          >
            {[currentYear - 2, currentYear - 1, currentYear, currentYear + 1].map(y => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>

          {/* Kejuruan Selector */}
          {!isTrainee ? (
            <select
              value={selectedKejuruanId}
              onChange={e => setSelectedKejuruanId(e.target.value)}
              className="text-xs py-2 px-3 rounded-xl border border-[#E4EAF0] bg-[#F8FAFB] text-[#123B59] font-bold outline-none focus:border-[#4C83B5] max-w-xs"
            >
              {(currentUser.role === 'admin' || isDzikri) && <option value="all">{isDzikri ? 'Semua Program Smart Creative' : 'Semua Program Kejuruan'}</option>}
              {kejuruanFilterOptions
                .filter(option => currentUser.role === 'admin' || mentorKejuruanIds.includes(option.programId))
                .map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
            </select>
          ) : (
            <div className="text-xs px-3 py-2 rounded-xl bg-[#EAF2F8] border border-[#C8DCEB] text-[#28618F] font-bold">
              Kejuruan: {currentUser.kejuruanName || '-'}
            </div>
          )}

          {/* DROPDOWN DETAIL TANGGAL */}
          <div className="flex items-center gap-1.5 bg-[#EEF5FA] p-1 px-2.5 rounded-xl border border-[#C8DCEB]">
            <Calendar className="w-3.5 h-3.5 text-[#4C83B5]" />
            <span className="text-[11px] font-bold text-[#123B59]">Detail:</span>
            <select
              value={selectedDayFilter}
              onChange={e => setSelectedDayFilter(e.target.value)}
              className="text-xs py-1 px-2 rounded-lg border border-[#A9C7DE] bg-white text-[#123B59] font-bold outline-none cursor-pointer"
            >
              <option value="summary">Ringkasan Saja</option>
              <option value="all-days">Buka Seluruh Tanggal</option>
              <optgroup label="Pilih Tanggal Spesifik">
                {Array.from({ length: recapData.daysInMonth }, (_, i) => i + 1).map(day => (
                  <option key={day} value={day}>
                    Tanggal {day} {recapData.monthName}
                  </option>
                ))}
              </optgroup>
            </select>
          </div>
        </div>

        {/* Search Input */}
        {!isTrainee && (
          <div className="relative w-full lg:w-64">
            <Search className="w-3.5 h-3.5 text-[#6F7F8D] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Cari siswa atau NIM..."
              className="w-full text-xs pl-9 pr-3 py-2 rounded-xl border border-[#E4EAF0] bg-[#F8FAFB] text-[#123B59] outline-none focus:border-[#4C83B5]"
            />
          </div>
        )}
      </div>

      {/* Trainee Privacy Banner */}
      {isTrainee && (
        <div className="p-3.5 bg-[#EEF6FB] border border-[#C8DCEB] rounded-2xl flex flex-col items-start gap-2 text-xs text-[#123B59] sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-2.5">
            <Sparkles className="w-4 h-4 text-[#4C83B5] shrink-0" />
            <span>
              Menampilkan rekapitulasi kehadiran pribadi Anda (<strong>{currentUser.name}</strong>). Data peserta lain terlindungi privasinya.
            </span>
          </div>
          <span className="font-mono text-[11px] font-bold text-[#28618F] bg-[#EAF2F8] px-2.5 py-1 rounded-full">
            NIM: {currentUser.nim}
          </span>
        </div>
      )}

      {/* Simplified, Clean Stats Table */}
      <div className="surface rounded-2xl border border-[#E4EAF0] overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-[#F8FAFB] text-[#6F7F8D] text-[10px] font-bold tracking-wide uppercase border-b border-[#E4EAF0]">
                <th className="py-3 px-3 w-10 text-center">No</th>
                <th className="py-3 px-3 min-w-[200px]">{isTrainee ? 'Peserta (Saya)' : 'Nama Peserta'}</th>
                <th className="py-3 px-3 min-w-[140px]">Kejuruan</th>
                <th className="py-3 px-3 text-center text-[#28618F] font-bold w-16">Hadir</th>
                <th className="py-3 px-3 text-center text-[#C05621] font-bold w-16">Telat</th>
                <th className="py-3 px-3 text-center text-[#4C83B5] font-bold w-16">Izin</th>
                <th className="py-3 px-3 text-center text-[#4C83B5] font-bold w-16">Sakit</th>
                <th className="py-3 px-3 text-center text-[#B84469] font-bold w-16">Alpha</th>
                <th className="py-3 px-3 min-w-[140px] text-right font-bold">Kehadiran (%)</th>
                {selectedDayNumber && (
                  <th className="py-3 px-3 text-center bg-[#EAF2F8] text-[#28618F] font-bold min-w-[100px]">
                    Tgl {selectedDayNumber}
                  </th>
                )}
                <th className="py-3 px-3 w-28 text-center">Detail Hari</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E4EAF0]">
              {filteredSummaries.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-8 text-center text-[#6F7F8D] italic">
                    Tidak ada data peserta yang cocok dengan filter pencarian.
                  </td>
                </tr>
              ) : (
                filteredSummaries.map((item, idx) => {
                  const isExpanded = selectedDayFilter === 'all-days' || !!expandedUserIds[item.trainee.id];
                  const specificDayStatus = selectedDayNumber ? item.dailyStatus[selectedDayNumber] : null;

                  return (
                    <React.Fragment key={item.trainee.id}>
                      <tr className="hover:bg-[#F8FAFB]/60 transition">
                        <td className="py-3 px-3 text-center text-[#6F7F8D] tabular-nums font-semibold">
                          {idx + 1}
                        </td>
                        <td className="py-3 px-3">
                          <div className="font-bold text-[#123B59]">
                            {item.trainee.name}
                          </div>
                          <div className="text-[10px] text-[#6F7F8D] font-mono">
                            {item.trainee.nim}
                          </div>
                        </td>
                        <td className="py-3 px-3 text-[#123B59] font-medium truncate max-w-[160px]">
                          {item.trainee.kejuruanName || '-'}
                        </td>

                        {/* Hadir */}
                        <td className="py-3 px-3 text-center font-bold text-[#28618F] tabular-nums">
                          {item.hadir}
                        </td>

                        {/* Telat */}
                        <td className="py-3 px-3 text-center font-bold text-[#C05621] tabular-nums">
                          {item.terlambat}
                        </td>

                        {/* Izin */}
                        <td className="py-3 px-3 text-center font-bold text-[#4C83B5] tabular-nums">
                          {item.izin}
                        </td>

                        {/* Sakit */}
                        <td className="py-3 px-3 text-center font-bold text-[#4C83B5] tabular-nums">
                          {item.sakit}
                        </td>

                        {/* Alpha */}
                        <td className="py-3 px-3 text-center font-bold text-[#B84469] tabular-nums">
                          {item.alpha}
                        </td>

                        {/* Rate with Progress Bar */}
                        <td className="py-3 px-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-16 h-2 rounded-full bg-[#E4EAF0] overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  item.attendancePercentage >= 90
                                    ? 'bg-[#28618F]'
                                    : item.attendancePercentage >= 75
                                    ? 'bg-[#4C83B5]'
                                    : 'bg-[#D95B83]'
                                }`}
                                style={{ width: `${item.attendancePercentage}%` }}
                              />
                            </div>
                            <span
                              className={`font-bold tabular-nums ${
                                item.attendancePercentage >= 90
                                  ? 'text-[#28618F]'
                                  : item.attendancePercentage >= 75
                                  ? 'text-[#123B59]'
                                  : 'text-[#D95B83]'
                              }`}
                            >
                              {item.attendancePercentage}%
                            </span>
                          </div>
                        </td>

                        {/* Specific Date Column if Selected */}
                        {selectedDayNumber && (
                          <td className="py-3 px-3 text-center bg-[#EAF2F8]/30">
                            {getStatusBadge(specificDayStatus || '-')}
                          </td>
                        )}

                        {/* Accordion / Dropdown Toggle for Individual Date Details */}
                        <td className="py-3 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => toggleExpand(item.trainee.id)}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold transition cursor-pointer ${
                              isExpanded
                                ? 'bg-[#EAF2F8] text-[#28618F]'
                                : 'bg-[#F4F6F8] hover:bg-[#EAF2F8] text-[#6F7F8D] hover:text-[#123B59]'
                            }`}
                          >
                            <span>{isExpanded ? 'Tutup' : 'Lihat'}</span>
                            {isExpanded ? (
                              <ChevronUp className="w-3 h-3" />
                            ) : (
                              <ChevronDown className="w-3 h-3" />
                            )}
                          </button>
                        </td>
                      </tr>

                      {/* Dropdown Expansion: Detailed Dates Calendar Breakdown */}
                      {isExpanded && (
                        <tr className="bg-[#F8FAFB] border-b border-[#E4EAF0]">
                          <td colSpan={selectedDayNumber ? 11 : 10} className="p-4 pl-10">
                            <div className="space-y-2">
                              <div className="flex items-center justify-between text-[11px] text-[#6F7F8D]">
                                <span className="font-bold text-[#123B59]">
                                  Rincian Tanggal {recapData.monthName} {selectedYear} ({item.trainee.name}):
                                </span>
                                <div className="flex items-center gap-3 text-[10px]">
                                  <span className="flex items-center gap-1">
                                    <span className="w-2 h-2 rounded-full bg-[#4C83B5] inline-block"></span>
                                    Hadir (H)
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <span className="w-2 h-2 rounded-full bg-amber-500 inline-block"></span>
                                    Telat (T)
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <span className="w-2 h-2 rounded-full bg-[#A9C7DE] inline-block"></span>
                                    Izin (I)
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <span className="w-2 h-2 rounded-full bg-[#4C83B5] inline-block"></span>
                                    Sakit (S)
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <span className="w-2 h-2 rounded-full bg-[#D95B83] inline-block"></span>
                                    Alpha (A)
                                  </span>
                                  <span className="flex items-center gap-1 pl-2 border-l border-[#E4EAF0]">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block"></span>
                                    Ada Laporan
                                  </span>
                                </div>
                              </div>

                              {/* Days Grid Chips */}
                              <div className="grid grid-cols-7 sm:grid-cols-10 md:grid-cols-16 gap-1 pt-1">
                                {Array.from({ length: recapData.daysInMonth }, (_, i) => i + 1).map(day => {
                                  const status = item.dailyStatus[day];
                                  const isSelectedDay = selectedDayNumber === day;
                                  const dateStr = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                                  const dayReport = dailyReports.find(r => r.traineeId === item.trainee.id && r.date === dateStr);

                                  return (
                                    <div
                                      key={day}
                                      onClick={() => {
                                        if (dayReport) {
                                          setActiveTab('laporan-harian');
                                        }
                                      }}
                                      className={`p-1.5 rounded-xl border text-center transition relative ${
                                        dayReport ? 'cursor-pointer hover:border-[#4C83B5]' : ''
                                      } ${
                                        isSelectedDay ? 'ring-2 ring-[#4C83B5]' : ''
                                      } ${
                                        status === 'H'
                                          ? 'bg-[#EAF2F8] border-[#C8DCEB] text-[#28618F] font-bold'
                                          : status === 'T'
                                          ? 'bg-[#FFF5E6] border-amber-200 text-[#C05621] font-bold'
                                          : status === 'I' || status === 'S'
                                          ? 'bg-[#EEF5FA] border-[#C8DCEB] text-[#4C83B5] font-bold'
                                          : status === 'A'
                                          ? 'bg-[#FCF3F6] border-[#E3C4D0] text-[#B84469] font-bold'
                                          : status === 'L'
                                          ? 'bg-[#F4F6F8] border-transparent text-[#6F7F8D]/40'
                                          : 'bg-white border-[#E4EAF0] text-[#6F7F8D]'
                                      }`}
                                      title={`Tgl ${day}: ${status || 'Tidak ada catatan'}${
                                        dayReport
                                          ? ` • Laporan Harian: ${
                                              dayReport.status === 'approved'
                                                ? 'Disetujui'
                                                : dayReport.status === 'rejected'
                                                ? 'Perlu Revisi'
                                                : 'Menunggu Review'
                                            } (Klik untuk lihat)`
                                          : ''
                                      }`}
                                    >
                                      {dayReport && (
                                        <span
                                          className={`absolute top-1 right-1 w-1.5 h-1.5 rounded-full ${
                                            dayReport.status === 'approved'
                                              ? 'bg-emerald-500'
                                              : dayReport.status === 'rejected'
                                              ? 'bg-[#D95B83]'
                                              : 'bg-amber-500'
                                          }`}
                                        />
                                      )}
                                      <div className="text-[9px] text-[#6F7F8D]">{day}</div>
                                      <div className="text-xs font-mono font-bold">{status || '-'}</div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
