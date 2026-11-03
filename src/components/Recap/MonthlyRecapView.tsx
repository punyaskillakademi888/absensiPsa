import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { MobileHeaderStatus } from '../MobileHeaderStatus';
import {
  FileSpreadsheet,
  FileText,
  Search,
  ChevronDown,
  ChevronUp,
  Calendar,
  Trash2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';
import { INDONESIAN_MONTHS, getTodayDateString } from '../../utils/dateUtils';
import { computeMonthlyRecapData, exportToExcel, exportToPDF } from '../../utils/exportUtils';
import { getMentorKejuruanIds } from '../../utils/mentorKejuruan';
import { getKejuruanFilterOptions } from '../../utils/kejuruanCodes';
import { User } from '../../types';

/* ───────────────────────── Tipe & konstanta ───────────────────────── */

type SortKey =
  | 'name'
  | 'kejuruan'
  | 'hadir'
  | 'terlambat'
  | 'izin'
  | 'sakit'
  | 'alpha'
  | 'batch'
  | 'status'
  | 'attendancePercentage';

type SortDirection = 'asc' | 'desc';

interface SortState {
  key: SortKey;
  direction: SortDirection;
}

const PAGE_SIZE_OPTIONS = [5, 7, 10, 25, 50, 100] as const;
const DEFAULT_PAGE_SIZE = 5;
const PAGE_GROUP_SIZE = 5; // jumlah tombol angka yang tampil

const ENROLLMENT_STATUS_LABELS: Record<NonNullable<User['enrollmentStatus']>, string> = {
  active: 'Aktif',
  graduated: 'Lulus',
  withdrawn: 'Mengundurkan diri',
};

/* ───────────────────────── Komponen bantu ───────────────────────── */

interface SortableThProps {
  label: string;
  sortKey: SortKey;
  sort: SortState | null;
  onSort: (key: SortKey) => void;
  className?: string;
  align?: 'left' | 'center' | 'right';
}

const SortableTh: React.FC<SortableThProps> = ({
  label,
  sortKey,
  sort,
  onSort,
  className = '',
  align = 'left',
}) => {
  const active = sort?.key === sortKey;
  const Icon = !active ? ArrowUpDown : sort!.direction === 'asc' ? ArrowUp : ArrowDown;
  const justify =
    align === 'center' ? 'justify-center' : align === 'right' ? 'justify-end' : 'justify-start';

  return (
    <th
      className={`py-3 px-3 ${className}`}
      aria-sort={active ? (sort!.direction === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={`flex w-full items-center gap-1 ${justify} uppercase font-bold tracking-wide hover:text-[#123B59] transition cursor-pointer`}
      >
        <span>{label}</span>
        <Icon className={`w-3 h-3 ${active ? 'opacity-100' : 'opacity-40'}`} />
      </button>
    </th>
  );
};

interface PaginationProps {
  page: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  startIndex: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

const getPageNumbers = (page: number, totalPages: number): number[] => {
  const groupStart = Math.floor((page - 1) / PAGE_GROUP_SIZE) * PAGE_GROUP_SIZE + 1;
  const groupEnd = Math.min(groupStart + PAGE_GROUP_SIZE - 1, totalPages);
  return Array.from({ length: groupEnd - groupStart + 1 }, (_, i) => groupStart + i);
};

const navBtnClass =
  'p-1.5 rounded-lg border border-[#E4EAF0] bg-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#EAF2F8]';

const Pagination: React.FC<PaginationProps> = ({
  page,
  totalPages,
  totalItems,
  pageSize,
  startIndex,
  onPageChange,
  onPageSizeChange,
}) => {
  const from = totalItems === 0 ? 0 : startIndex + 1;
  const to = Math.min(startIndex + pageSize, totalItems);

  const groupStart = Math.floor((page - 1) / PAGE_GROUP_SIZE) * PAGE_GROUP_SIZE + 1;
  const prevGroupPage = Math.max(1, groupStart - PAGE_GROUP_SIZE); // awal grup sebelumnya
  const nextGroupPage = Math.min(totalPages, groupStart + PAGE_GROUP_SIZE); // awal grup berikutnya

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-[#E4EAF0] bg-[#F8FAFB] text-[11px] text-[#6F7F8D]">
      <div className="flex flex-wrap items-center gap-3">
        <span>
          Menampilkan{' '}
          <b className="text-[#123B59]">
            {from}–{to}
          </b>{' '}
          dari <b className="text-[#123B59]">{totalItems}</b> peserta
        </span>
        <label className="flex items-center gap-1">
          <span>Per halaman:</span>
          <select
            value={pageSize}
            onChange={e => onPageSizeChange(Number(e.target.value))}
            className="border border-[#E4EAF0] rounded-lg px-1.5 py-1 bg-white text-[#123B59] font-bold outline-none"
          >
            {PAGE_SIZE_OPTIONS.map(n => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex items-center gap-1">
        {/* << grup sebelumnya */}
        <button
          type="button"
          onClick={() => onPageChange(prevGroupPage)}
          disabled={groupStart <= 1}
          className={navBtnClass}
          aria-label="Grup halaman sebelumnya"
        >
          <ChevronsLeft className="w-3.5 h-3.5" />
        </button>

        {/* < halaman sebelumnya */}
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className={navBtnClass}
          aria-label="Halaman sebelumnya"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>

        {/* Tombol angka (maksimal PAGE_GROUP_SIZE) */}
        {getPageNumbers(page, totalPages).map(p => (
          <button
            key={p}
            type="button"
            onClick={() => onPageChange(p)}
            className={`min-w-[28px] px-2 py-1 rounded-lg border font-bold tabular-nums transition ${
              p === page
                ? 'bg-[#28618F] border-[#28618F] text-white'
                : 'bg-white border-[#E4EAF0] text-[#123B59] hover:bg-[#EAF2F8]'
            }`}
          >
            {p}
          </button>
        ))}

        {/* > halaman berikutnya */}
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className={navBtnClass}
          aria-label="Halaman berikutnya"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>

        {/* >> grup berikutnya */}
        <button
          type="button"
          onClick={() => onPageChange(nextGroupPage)}
          disabled={groupStart + PAGE_GROUP_SIZE > totalPages}
          className={navBtnClass}
          aria-label="Grup halaman berikutnya"
        >
          <ChevronsRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

/* ───────────────────────── Komponen utama ───────────────────────── */

export const MonthlyRecapView: React.FC = () => {
  const {
    users,
    kejuruanList,
    attendanceRecords,
    currentUser,
    dailyReports,
    setActiveTab,
    resetAttendanceRecords,
  } = useApp();

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
  const [selectedBatchId, setSelectedBatchId] = useState('all');
  const [selectedEnrollmentStatus, setSelectedEnrollmentStatus] = useState('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterPredicate] = useState<string>('all');
  const [isResettingAttendance, setIsResettingAttendance] = useState(false);

  // Date detail dropdown selector (Default: 'summary', or specific day 1..31, or 'all-days')
  const [selectedDayFilter, setSelectedDayFilter] = useState<string>('summary');

  // Expanded row IDs for viewing chronological date breakdown
  const [expandedUserIds, setExpandedUserIds] = useState<Record<string, boolean>>(() => {
    if (isTrainee) {
      return { [currentUser.id]: true };
    }
    return {};
  });

  // Sorting & pagination
  const [sort, setSort] = useState<SortState | null>(null);
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE);

  const trainees = useMemo(() => {
    if (isTrainee) {
      return [currentUser];
    }
    if (isMentor && mentorKejuruanIds.length) {
      return users.filter(u => u.role === 'trainee' && mentorKejuruanIds.includes(u.kejuruanId || ''));
    }
    return users.filter(u => u.role === 'trainee');
  }, [users, isTrainee, isMentor, currentUser, mentorKejuruanIds.join('|')]);

  const batchOptions = useMemo(() => {
    const batches = new Map<string, string>();
    trainees.forEach(trainee => {
      if (trainee.batchId && trainee.batchName) batches.set(trainee.batchId, trainee.batchName);
    });
    return [...batches.entries()].sort((a, b) => a[1].localeCompare(b[1], 'id'));
  }, [trainees]);

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
      records: attendanceRecords,
    });
  }, [
    selectedYear,
    selectedMonth,
    isTrainee,
    currentUser.kejuruanId,
    selectedKejuruanId,
    kejuruanList,
    trainees,
    attendanceRecords,
  ]);

  const filteredSummaries = useMemo(() => {
    return recapData.summaries.filter(item => {
      const matchSearch =
        item.trainee.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.trainee.nim.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.trainee.kejuruanName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.trainee.batchName || '').toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchSearch) return false;
      if (selectedBatchId !== 'all' && (item.trainee.batchId || 'unassigned') !== selectedBatchId) return false;
      if (
        selectedEnrollmentStatus !== 'all' &&
        (item.trainee.enrollmentStatus || 'unassigned') !== selectedEnrollmentStatus
      ) return false;

      if (filterPredicate === 'danger') {
        return item.attendancePercentage < 75;
      }
      if (filterPredicate === 'good') {
        return item.attendancePercentage >= 90;
      }
      return true;
    });
  }, [recapData.summaries, searchQuery, filterPredicate, selectedBatchId, selectedEnrollmentStatus]);

  type SummaryItem = (typeof filteredSummaries)[number];

  const getSortValue = (item: SummaryItem, key: SortKey): string | number => {
    switch (key) {
      case 'name':
        return item.trainee.name ?? '';
      case 'kejuruan':
        return item.trainee.kejuruanName ?? '';
      case 'batch':
        return item.trainee.batchName ?? 'Belum ditetapkan';
      case 'status':
        return item.trainee.enrollmentStatus
          ? ENROLLMENT_STATUS_LABELS[item.trainee.enrollmentStatus]
          : 'Belum ditetapkan';
      default:
        return item[key] ?? 0;
    }
  };

  const handleSort = (key: SortKey) => {
    setSort(prev => {
      if (!prev || prev.key !== key) return { key, direction: 'asc' };
      if (prev.direction === 'asc') return { key, direction: 'desc' };
      return null; // klik ketiga: kembali ke urutan awal
    });
  };

  const sortedSummaries = useMemo(() => {
    if (!sort) return filteredSummaries;
    const factor = sort.direction === 'asc' ? 1 : -1;
    return [...filteredSummaries].sort((a, b) => {
      const va = getSortValue(a, sort.key);
      const vb = getSortValue(b, sort.key);
      if (typeof va === 'string' && typeof vb === 'string') {
        return va.localeCompare(vb, 'id', { sensitivity: 'base' }) * factor;
      }
      return ((va as number) - (vb as number)) * factor;
    });
  }, [filteredSummaries, sort]);

  const totalItems = sortedSummaries.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const currentPage = Math.min(page, totalPages);
  const startIndex = (currentPage - 1) * pageSize;

  const paginatedSummaries = useMemo(
    () => sortedSummaries.slice(startIndex, startIndex + pageSize),
    [sortedSummaries, startIndex, pageSize]
  );

  // Kembali ke halaman 1 saat filter, sort, atau jumlah per halaman berubah
  useEffect(() => {
    setPage(1);
  }, [searchQuery, filterPredicate, selectedKejuruanId, selectedBatchId, selectedEnrollmentStatus, selectedMonth, selectedYear, sort, pageSize]);

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
      [userId]: !prev[userId],
    }));
  };

  const exportParams = {
    year: selectedYear,
    month: selectedMonth,
    selectedKejuruanId: isTrainee ? currentUser.kejuruanId || 'all' : selectedKejuruanId,
    kejuruanList,
    trainees,
    records: attendanceRecords,
  };

  const handleExportExcel = () => {
    exportToExcel(exportParams);
  };

  const handleExportPDF = () => {
    exportToPDF(exportParams);
  };

  const handleResetAttendance = async () => {
    if (
      !window.confirm(
        'Hapus seluruh catatan presensi dari TiDB? Akun pengguna, pengajuan izin, dan laporan harian tidak akan dihapus.'
      )
    )
      return;
    setIsResettingAttendance(true);
    const result = await resetAttendanceRecords();
    setIsResettingAttendance(false);
    window.alert(result.message);
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

  const selectedDayNumber =
    selectedDayFilter !== 'summary' && selectedDayFilter !== 'all-days' ? Number(selectedDayFilter) : null;
  const tableColumnCount = (isTrainee ? 7 : 12) + (selectedDayNumber ? 1 : 0);

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
          </div>
          <p className="text-xs text-[#6F7F8D] mt-1">
            {isTrainee
              ? `Ringkasan kehadiran mandiri · Periode ${recapData.monthName} ${selectedYear}`
              : `Ringkasan Statistik Kehadiran Bulanan · Periode ${recapData.monthName} ${selectedYear} (${filteredSummaries.length} Peserta)`}
          </p>
          <MobileHeaderStatus />
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {currentUser.role === 'admin' && (
            <button
              type="button"
              onClick={handleResetAttendance}
              disabled={isResettingAttendance}
              className="surface px-3.5 py-2.5 rounded-xl border border-rose-200 hover:bg-rose-50 text-xs font-bold text-rose-600 transition flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-60"
              title="Hapus seluruh catatan presensi dari TiDB"
            >
              <Trash2 className="w-4 h-4" />
              <span>{isResettingAttendance ? 'Mereset...' : 'Reset Presensi'}</span>
            </button>
          )}
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

      {/* Aggregate Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <article className="surface soft-hover p-4 rounded-2xl border border-[#E4EAF0]">
          <div className="text-[10px] text-[#6F7F8D] font-bold uppercase tracking-wider mb-1">
            {isTrainee ? 'Tingkat Kehadiran' : 'Rata-rata Kelas'}
          </div>
          <div className="text-2xl font-bold text-[#123B59] tabular-nums">{aggregates.avgRate}%</div>
          <div className="text-[10px] text-[#4C83B5] font-semibold mt-1">
            {aggregates.avgRate >= 80 ? '✓ Memenuhi Standar' : '⚠ Perlu Ditingkatkan'}
          </div>
        </article>

        <article className="surface soft-hover p-4 rounded-2xl border border-[#E4EAF0]">
          <div className="text-[10px] text-[#4C83B5] font-bold uppercase tracking-wider mb-1 flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-[#4C83B5]"></span>
            <span>Hadir Tepat (H)</span>
          </div>
          <div className="text-2xl font-bold text-[#28618F] tabular-nums">{aggregates.totalHadir}</div>
          <div className="text-[10px] text-[#6F7F8D] mt-1">Sesi terjadwal</div>
        </article>

        <article className="surface soft-hover p-4 rounded-2xl border border-[#E4EAF0]">
          <div className="text-[10px] text-[#C05621] font-bold uppercase tracking-wider mb-1 flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
            <span>Terlambat (T)</span>
          </div>
          <div className="text-2xl font-bold text-[#C05621] tabular-nums">{aggregates.totalTelat}</div>
          <div className="text-[10px] text-[#6F7F8D] mt-1">Check-in lewat batas</div>
        </article>

        <article className="surface soft-hover p-4 rounded-2xl border border-[#E4EAF0]">
          <div className="text-[10px] text-[#4C83B5] font-bold uppercase tracking-wider mb-1 flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-[#A9C7DE]"></span>
            <span>Izin (I)</span>
          </div>
          <div className="text-2xl font-bold text-[#4C83B5] tabular-nums">{aggregates.totalIzin}</div>
          <div className="text-[10px] text-[#6F7F8D] mt-1">Disetujui mentor</div>
        </article>

        <article className="surface soft-hover p-4 rounded-2xl border border-[#E4EAF0]">
          <div className="text-[10px] text-[#4C83B5] font-bold uppercase tracking-wider mb-1 flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-[#4C83B5]"></span>
            <span>Sakit (S)</span>
          </div>
          <div className="text-2xl font-bold text-[#4C83B5] tabular-nums">{aggregates.totalSakit}</div>
          <div className="text-[10px] text-[#6F7F8D] mt-1">Dengan bukti surat</div>
        </article>

        <article className="surface soft-hover p-4 rounded-2xl border border-[#E4EAF0]">
          <div className="text-[10px] text-[#D95B83] font-bold uppercase tracking-wider mb-1 flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-[#D95B83]"></span>
            <span>Alpha (A)</span>
          </div>
          <div className="text-2xl font-bold text-[#B84469] tabular-nums">{aggregates.totalAlpha}</div>
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
              {(currentUser.role === 'admin' || isDzikri) && (
                <option value="all">{isDzikri ? 'Semua Program Smart Creative' : 'Semua Program Kejuruan'}</option>
              )}
              {kejuruanFilterOptions
                .filter(option => currentUser.role === 'admin' || mentorKejuruanIds.includes(option.programId))
                .map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
            </select>
          ) : null}

          {!isTrainee && (
            <>
              <select
                value={selectedBatchId}
                onChange={e => setSelectedBatchId(e.target.value)}
                aria-label="Filter batch"
                className="text-xs py-2 px-3 rounded-xl border border-[#E4EAF0] bg-[#F8FAFB] text-[#123B59] font-bold outline-none max-w-xs"
              >
                <option value="all">Semua Batch</option>
                {batchOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
                <option value="unassigned">Belum ada batch</option>
              </select>
              <select
                value={selectedEnrollmentStatus}
                onChange={e => setSelectedEnrollmentStatus(e.target.value)}
                aria-label="Filter status kepesertaan"
                className="text-xs py-2 px-3 rounded-xl border border-[#E4EAF0] bg-[#F8FAFB] text-[#123B59] font-bold outline-none"
              >
                <option value="all">Semua Status Batch</option>
                <option value="active">Aktif</option>
                <option value="graduated">Lulus</option>
                <option value="withdrawn">Mengundurkan diri</option>
                <option value="unassigned">Belum ditetapkan</option>
              </select>
            </>
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

      {/* Tabel Statistik */}
      <div className="surface rounded-2xl border border-[#E4EAF0] overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-[#F8FAFB] text-[#6F7F8D] text-[10px] border-b border-[#E4EAF0]">
                {!isTrainee && <th className="py-3 px-3 w-10 text-center font-bold uppercase">No</th>}
                {!isTrainee && (
                  <SortableTh label="Nama Peserta" sortKey="name" sort={sort} onSort={handleSort} className="min-w-[100px]" />
                )}
                {!isTrainee && (
                  <SortableTh label="Kejuruan" sortKey="kejuruan" sort={sort} onSort={handleSort} className="min-w-[140px]" />
                )}
                <SortableTh label="Hadir" sortKey="hadir" sort={sort} onSort={handleSort} align="center" className="text-[#28618F] w-16" />
                <SortableTh label="Telat" sortKey="terlambat" sort={sort} onSort={handleSort} align="center" className="text-[#C05621] w-16" />
                <SortableTh label="Izin" sortKey="izin" sort={sort} onSort={handleSort} align="center" className="text-[#4C83B5] w-16" />
                <SortableTh label="Sakit" sortKey="sakit" sort={sort} onSort={handleSort} align="center" className="text-[#4C83B5] w-16" />
                <SortableTh label="Alpha" sortKey="alpha" sort={sort} onSort={handleSort} align="center" className="text-[#B84469] w-16" />
                {!isTrainee && (
                  <SortableTh label="Batch" sortKey="batch" sort={sort} onSort={handleSort} align="center" className="w-24" />
                )}
                {!isTrainee && (
                  <SortableTh label="Status" sortKey="status" sort={sort} onSort={handleSort} align="center" className="w-24" />
                )}
                <SortableTh label="Kehadiran (%)" sortKey="attendancePercentage" sort={sort} onSort={handleSort} align="right" className="min-w-[140px]" />
                {selectedDayNumber && (
                  <th className="py-3 px-3 text-center bg-[#EAF2F8] text-[#28618F] font-bold min-w-[100px]">
                    Tgl {selectedDayNumber}
                  </th>
                )}
                <th className="py-3 px-3 w-28 text-center font-bold uppercase">Detail Hari</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E4EAF0]">
              {paginatedSummaries.length === 0 ? (
                <tr>
                  <td colSpan={tableColumnCount} className="py-8 text-center text-[#6F7F8D] italic">
                    Tidak ada data peserta yang cocok dengan filter pencarian.
                  </td>
                </tr>
              ) : (
                paginatedSummaries.map((item, idx) => {
                  const isExpanded = selectedDayFilter === 'all-days' || !!expandedUserIds[item.trainee.id];
                  const specificDayStatus = selectedDayNumber ? item.dailyStatus[selectedDayNumber] : null;

                  return (
                    <React.Fragment key={item.trainee.id}>
                      <tr className="hover:bg-[#F8FAFB]/60 transition">
                        {!isTrainee && (
                          <>
                            <td className="py-3 px-3 text-center text-[#6F7F8D] tabular-nums font-semibold">
                              {startIndex + idx + 1}
                            </td>
                            <td className="py-3 px-3">
                              <div className="font-bold text-[#123B59]">{item.trainee.name}</div>
                              <div className="text-[10px] text-[#6F7F8D] font-mono">{item.trainee.nim}</div>
                            </td>
                            <td className="py-3 px-3 text-[#123B59] font-medium truncate max-w-[100px]">
                              {item.trainee.kejuruanName || '-'}
                            </td>
                          </>
                        )}

                        {/* Hadir */}
                        <td className="py-3 px-3 text-center font-bold text-[#28618F] tabular-nums">{item.hadir}</td>

                        {/* Telat */}
                        <td className="py-3 px-3 text-center font-bold text-[#C05621] tabular-nums">{item.terlambat}</td>

                        {/* Izin */}
                        <td className="py-3 px-3 text-center font-bold text-[#4C83B5] tabular-nums">{item.izin}</td>

                        {/* Sakit */}
                        <td className="py-3 px-3 text-center font-bold text-[#4C83B5] tabular-nums">{item.sakit}</td>

                        {/* Alpha */}
                        <td className="py-3 px-3 text-center font-bold text-[#B84469] tabular-nums">{item.alpha}</td>

                        {/* Batch */}
                        {!isTrainee && (
                          <td className="py-3 px-3 text-center text-[#123B59] font-semibold">
                            {item.trainee.batchName || 'Belum ditetapkan'}
                          </td>
                        )}

                        {/* Status */}
                        {!isTrainee && (
                          <td className="py-3 px-3 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              item.trainee.enrollmentStatus === 'active'
                                ? 'bg-[#EAF2F8] text-[#28618F]'
                                : item.trainee.enrollmentStatus === 'graduated'
                                ? 'bg-emerald-50 text-emerald-700'
                                : item.trainee.enrollmentStatus === 'withdrawn'
                                ? 'bg-[#FCF3F6] text-[#B84469]'
                                : 'bg-[#F4F6F8] text-[#6F7F8D]'
                            }`}>
                              {item.trainee.enrollmentStatus
                                ? ENROLLMENT_STATUS_LABELS[item.trainee.enrollmentStatus]
                                : 'Belum ditetapkan'}
                            </span>
                          </td>
                        )}

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

                        {/* Toggle detail tanggal */}
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
                            {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                          </button>
                        </td>
                      </tr>

                      {/* Expansion: rincian tanggal */}
                      {isExpanded && (
                        <tr className="bg-[#F8FAFB] border-b border-[#E4EAF0]">
                          <td colSpan={tableColumnCount} className="p-4 pl-10">
                            <div className="space-y-2">
                              <div className="flex items-center justify-between text-[11px] text-[#6F7F8D]">
                                <span className="font-bold text-[#123B59]">
                                  Rincian Tanggal {recapData.monthName} {selectedYear}
                                  {!isTrainee && ` (${item.trainee.name})`}:
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
                              <div className="grid grid-cols-7 sm:grid-cols-10 md:grid-cols-[repeat(16,minmax(0,1fr))] gap-1 pt-1">
                                {Array.from({ length: recapData.daysInMonth }, (_, i) => i + 1).map(day => {
                                  const status = item.dailyStatus[day];
                                  const isSelectedDay = selectedDayNumber === day;
                                  const dateStr = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                                  const dayReport = dailyReports.find(
                                    r => r.traineeId === item.trainee.id && r.date === dateStr
                                  );

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
                                      } ${isSelectedDay ? 'ring-2 ring-[#4C83B5]' : ''} ${
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

        {!isTrainee && (
          <Pagination
            page={currentPage}
            totalPages={totalPages}
            totalItems={totalItems}
            pageSize={pageSize}
            startIndex={startIndex}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        )}
      </div>
    </div>
  );
};