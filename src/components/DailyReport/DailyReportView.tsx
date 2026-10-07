import React, { useState, useMemo, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { DailyReport } from '../../types';
import { api } from '../../services/api';
import {
  FileImage,
  Upload,
  CheckCircle2,
  Clock,
  AlertCircle,
  X,
  Check,
  Search,
  ChevronDown,
  CalendarDays,
  Eye,
  MessageSquare,
  ImageIcon,
  Send,
  ExternalLink
} from 'lucide-react';
import { getTodayDateString, INDONESIAN_MONTHS } from '../../utils/dateUtils';
import { getKejuruanFilterOptions, matchesKejuruanFilter } from '../../utils/kejuruanCodes';
import { MobileHeaderStatus } from '../MobileHeaderStatus';

// ─── Helpers ────────────────────────────────────────────────────────────────

const formatDateID = (dateStr: string) => {
  const [y, m, d] = dateStr.split('-').map(Number);
  return `${String(d).padStart(2, '0')} ${INDONESIAN_MONTHS[m - 1]} ${y}`;
};

const formatTimeShort = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
};

// ─── Component ───────────────────────────────────────────────────────────────

export const DailyReportView: React.FC = () => {
  const {
    currentUser,
    users,
    kejuruanList,
    dailyReports,
    attendanceRecords,
    submitDailyReport,
    reviewDailyReport
  } = useApp();

  const isTrainee = currentUser.role === 'trainee';
  const isMentor = currentUser.role === 'mentor';
  const isAdmin = currentUser.role === 'admin';

  const today = getTodayDateString();
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  // ── Trainee: Submit Form ──────────────────────────────────────────────────
  const [formDate, setFormDate] = useState(today);
  const [formDesc, setFormDesc] = useState('');
  const [formPhotoUrl, setFormPhotoUrl] = useState<string | undefined>();
  const [formPhotoName, setFormPhotoName] = useState<string | undefined>();
  const [formSubmissionLink, setFormSubmissionLink] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const myReportForDate = useMemo(
    () => dailyReports.find(r => r.traineeId === currentUser.id && r.date === formDate),
    [dailyReports, currentUser.id, formDate]
  );

  const myAllReports = useMemo(
    () =>
      dailyReports
        .filter(r => r.traineeId === currentUser.id)
        .sort((a, b) => b.date.localeCompare(a.date)),
    [dailyReports, currentUser.id]
  );

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setFormError('Hanya file gambar yang diperbolehkan (JPG, PNG, WEBP).');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setFormError('Ukuran foto maksimal 5 MB.');
      return;
    }
    setFormError(null);
    setFormPhotoName(file.name);
    try {
      setIsUploadingPhoto(true);
      const uploadResult = await api.uploadImageToCloudinary({
        file,
        folder: 'hadirku/reports',
      });

      if (!uploadResult.success || !uploadResult.url) {
        throw new Error(uploadResult.message || 'Gagal upload foto laporan.');
      }

      setFormPhotoUrl(uploadResult.url);
    } catch (error: any) {
      setFormError(error.message || 'Gagal mengupload foto laporan ke Cloudinary.');
      setFormPhotoUrl(undefined);
      setFormPhotoName(undefined);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formDesc.trim()) {
      setFormError('Deskripsi kegiatan wajib diisi.');
      return;
    }
    const res = submitDailyReport({
      date: formDate,
      description: formDesc.trim(),
      photoUrl: formPhotoUrl,
      photoName: formPhotoName,
      submissionLink: formSubmissionLink.trim() || undefined
    });
    if (res.success) {
      showToast(res.message);
      setFormDesc('');
      setFormPhotoUrl(undefined);
      setFormPhotoName(undefined);
      setFormSubmissionLink('');
      setFormError(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } else {
      setFormError(res.message);
    }
  };

  // ── Mentor/Admin: Review List ─────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [filterKejuruan, setFilterKejuruan] = useState('all');
  const [selectedReport, setSelectedReport] = useState<DailyReport | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [previewReport, setPreviewReport] = useState<DailyReport | null>(null);

  const relevantReports = useMemo(() => {
    return dailyReports
      .filter(r => {
        if (isMentor && currentUser.kejuruanId && r.kejuruanId !== currentUser.kejuruanId) return false;
        if (filterStatus !== 'all' && r.status !== filterStatus) return false;
        if (!matchesKejuruanFilter(filterKejuruan, kejuruanList, r.kejuruanId, r.kejuruanName)) return false;
        if (searchQuery) {
          const q = searchQuery.toLowerCase();
          if (
            !r.traineeName.toLowerCase().includes(q) &&
            !r.traineeNim.toLowerCase().includes(q) &&
            !r.description.toLowerCase().includes(q)
          ) return false;
        }
        return true;
      })
      .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
  }, [dailyReports, isMentor, currentUser.kejuruanId, filterStatus, filterKejuruan, searchQuery, kejuruanList]);

  const pendingCount = useMemo(
    () =>
      dailyReports.filter(r => {
        if (isMentor && currentUser.kejuruanId) return r.status === 'pending' && r.kejuruanId === currentUser.kejuruanId;
        return r.status === 'pending';
      }).length,
    [dailyReports, isMentor, currentUser.kejuruanId]
  );

  const handleOpenReview = (report: DailyReport) => {
    setSelectedReport(report);
    setReviewNotes(report.reviewNotes || '');
  };

  const [isSavingReview, setIsSavingReview] = useState(false);

  const handleConfirmReview = async (status: 'approved' | 'rejected') => {
    if (!selectedReport) return;
    setIsSavingReview(true);
    const result = await reviewDailyReport(selectedReport.id, status, reviewNotes.trim());
    setIsSavingReview(false);
    if (!result.success) {
      showToast(result.message);
      return;
    }
    showToast(
      status === 'approved'
        ? `Laporan ${selectedReport.traineeName} tanggal ${formatDateID(selectedReport.date)} disetujui.`
        : `Laporan ${selectedReport.traineeName} dikembalikan untuk diperbaiki.`
    );
    setSelectedReport(null);
  };

  // ─── Status Badge Helper ─────────────────────────────────────────────────
  const StatusBadge: React.FC<{ status: DailyReport['status'] }> = ({ status }) => {
    if (status === 'approved')
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <CheckCircle2 className="w-3 h-3" /> Disetujui
        </span>
      );
    if (status === 'rejected')
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-[#FCF3F6] text-[#B84469] border border-[#D95B83]/20">
          <AlertCircle className="w-3 h-3" /> Perlu Revisi
        </span>
      );
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-[#FFF5E6] text-[#C05621] border border-orange-200">
        <Clock className="w-3 h-3" /> Menunggu Review
      </span>
    );
  };

  // ─── TRAINEE VIEW ────────────────────────────────────────────────────────
  if (isTrainee) {
    return (
      <div className="space-y-6">
        {toastMsg && (
          <div className="fixed bottom-5 right-5 z-50 py-2.5 px-4 rounded-xl bg-[#0D2F47] text-white text-xs font-medium shadow-lg flex items-center gap-2">
            <Check className="w-3.5 h-3.5 text-emerald-400" />
            <span>{toastMsg}</span>
          </div>
        )}

        {/* Header */}
        <div>
          <p className="text-[10px] font-bold tracking-[.14em] text-[#4C83B5] uppercase mb-1">
            Jurnal Magang
          </p>
          <h1 className="text-xl sm:text-2xl font-bold text-[#123B59]">Laporan Harian</h1>
          <p className="text-xs text-[#6F7F8D] mt-0.5">
            Upload foto dan catatan kegiatan harian kamu untuk diverifikasi mentor.
          </p>
          <MobileHeaderStatus />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Submit Form */}
          <div className="lg:col-span-3">
            <div className="surface rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-[#E4EAF0]">
                <div className="flex items-center gap-2">
                  <Upload className="w-4 h-4 text-[#4C83B5]" />
                  <h2 className="text-sm font-bold text-[#123B59]">Kirim Laporan Harian</h2>
                </div>
                <p className="text-xs text-[#6F7F8D] mt-0.5">1 laporan per hari · foto wajib</p>
              </div>

              <form onSubmit={handleSubmit} className="p-5 space-y-4">
                {/* Date picker */}
                <div>
                  <label className="block text-xs font-semibold text-[#123B59] mb-1">
                    Tanggal Laporan
                  </label>
                  <input
                    type="date"
                    value={formDate}
                    max={today}
                    onChange={e => { setFormDate(e.target.value); setFormError(null); }}
                    className="w-full text-xs p-2.5 rounded-lg border border-[#E4EAF0] bg-white text-[#123B59] outline-none focus:ring-1 focus:ring-[#4C83B5]"
                  />
                </div>

                {/* Status indicator if report already exists */}
                {myReportForDate && (
                  <div className={`p-3 rounded-xl border text-xs flex items-start gap-2 ${
                    myReportForDate.status === 'approved'
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                      : myReportForDate.status === 'rejected'
                      ? 'bg-[#FCF3F6] border-[#D95B83]/20 text-[#B84469]'
                      : 'bg-[#FFF5E6] border-orange-200 text-[#C05621]'
                  }`}>
                    {myReportForDate.status === 'approved' && <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />}
                    {myReportForDate.status === 'rejected' && <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />}
                    {myReportForDate.status === 'pending' && <Clock className="w-4 h-4 shrink-0 mt-0.5" />}
                    <div>
                      {myReportForDate.status === 'approved' && <p className="font-semibold">Laporan tanggal ini sudah disetujui mentor.</p>}
                      {myReportForDate.status === 'pending' && <p className="font-semibold">Laporan tanggal ini sedang menunggu review mentor.</p>}
                      {myReportForDate.status === 'rejected' && (
                        <>
                          <p className="font-semibold">Laporan dikembalikan. Kamu bisa mengirim ulang.</p>
                          {myReportForDate.reviewNotes && (
                            <p className="mt-0.5 italic">Catatan mentor: "{myReportForDate.reviewNotes}"</p>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                )}

                {/* Photo upload */}
                <div>
                  <label className="block text-xs font-semibold text-[#123B59] mb-1">
                    Foto Laporan Kegiatan <span className="text-[#D95B83]">*</span>
                  </label>
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className={`relative border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition ${
                      formPhotoUrl
                        ? 'border-[#4C83B5] bg-[#EAF2F8]'
                        : 'border-[#E4EAF0] hover:border-[#4C83B5] hover:bg-[#F4F6F8]'
                    }`}
                  >
                    {formPhotoUrl ? (
                      <div className="space-y-2">
                        <img
                          src={formPhotoUrl}
                          alt="Preview foto laporan"
                          className="mx-auto max-h-48 rounded-lg object-cover shadow-sm"
                        />
                        <p className="text-[11px] text-[#4C83B5] font-medium">{formPhotoName}</p>
                        <button
                          type="button"
                          onClick={e => { e.stopPropagation(); setFormPhotoUrl(undefined); setFormPhotoName(undefined); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                          className="text-[10px] text-[#D95B83] hover:underline"
                        >
                          Ganti foto
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-1.5 py-4">
                        <ImageIcon className="w-8 h-8 text-[#A9C7DE] mx-auto" />
                        <p className="text-xs font-semibold text-[#6F7F8D]">Klik untuk pilih foto</p>
                        <p className="text-[10px] text-[#A9C7DE]">JPG, PNG, WEBP · maks. 5 MB</p>
                      </div>
                    )}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handlePhotoChange}
                    />
                  </div>
                </div>

                {/* Submission Link */}
                <div>
                  <label className="block text-xs font-semibold text-[#123B59] mb-1">
                    Tautan Kumpul Tugas <span className="text-[#A9C7DE] font-normal">(opsional)</span>
                  </label>
                  <div className="relative">
                    <ExternalLink className="w-3.5 h-3.5 text-[#A9C7DE] absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="url"
                      placeholder="https://github.com/... atau https://drive.google.com/..."
                      value={formSubmissionLink}
                      onChange={e => setFormSubmissionLink(e.target.value)}
                      className="w-full pl-8 pr-3 text-xs p-2.5 rounded-lg border border-[#E4EAF0] bg-white text-[#123B59] outline-none focus:ring-1 focus:ring-[#4C83B5] placeholder-[#A9C7DE] font-mono"
                    />
                  </div>
                  <p className="text-[10px] text-[#A9C7DE] mt-0.5">GitHub, Google Drive, Figma, Notion, dll.</p>
                </div>

                {/* Description */}
                <div>
                  <label className="block text-xs font-semibold text-[#123B59] mb-1">
                    Deskripsi Kegiatan Hari Ini <span className="text-[#D95B83]">*</span>
                  </label>
                  <textarea
                    rows={4}
                    placeholder="Ceritakan kegiatan yang kamu lakukan hari ini, hasil yang dicapai, dan kendala yang dihadapi..."
                    value={formDesc}
                    onChange={e => { setFormDesc(e.target.value); setFormError(null); }}
                    className="w-full text-xs p-2.5 rounded-lg border border-[#E4EAF0] bg-white text-[#123B59] outline-none focus:ring-1 focus:ring-[#4C83B5] placeholder-[#A9C7DE] resize-none"
                  />
                  <p className="text-[10px] text-[#A9C7DE] mt-0.5 text-right">{formDesc.length} karakter</p>
                </div>

                {formError && (
                  <div className="p-2.5 rounded-lg bg-[#FCF3F6] text-[#B84469] text-xs border border-[#D95B83]/20 flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    {formError}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={myReportForDate?.status === 'approved' || myReportForDate?.status === 'pending'}
                  className="w-full py-2.5 rounded-xl bg-[#123B59] hover:bg-[#0D2F47] disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold flex items-center justify-center gap-2 transition cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  {myReportForDate?.status === 'rejected'
                    ? 'Kirim Ulang Laporan'
                    : myReportForDate?.status === 'pending'
                    ? 'Sedang Ditinjau Mentor'
                    : myReportForDate?.status === 'approved'
                    ? 'Laporan Sudah Disetujui'
                    : 'Kirim Laporan ke Mentor'}
                </button>
              </form>
            </div>
          </div>

          {/* My Reports History */}
          <div className="lg:col-span-2">
            <div className="surface rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-[#E4EAF0] flex items-center justify-between">
                <h2 className="text-sm font-bold text-[#123B59]">Riwayat Laporan</h2>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#EAF2F8] text-[#28618F]">
                  {myAllReports.length} laporan
                </span>
              </div>
              <div className="divide-y divide-[#E4EAF0] max-h-[520px] overflow-y-auto">
                {myAllReports.length === 0 ? (
                  <div className="p-8 text-center text-[#A9C7DE] text-xs">
                    Belum ada laporan yang dikirim.
                  </div>
                ) : (
                  myAllReports.map(report => (
                    <div key={report.id} className="p-4 hover:bg-[#F4F6F8] transition">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <p className="text-xs font-bold text-[#123B59]">{formatDateID(report.date)}</p>
                          <p className="text-[10px] text-[#A9C7DE]">
                            Dikirim {formatTimeShort(report.submittedAt)}
                          </p>
                        </div>
                        <StatusBadge status={report.status} />
                      </div>
                      <p className="text-[11px] text-[#6F7F8D] line-clamp-2">{report.description}</p>
                      {report.photoUrl && (
                        <button
                          onClick={() => setPreviewReport(report)}
                          className="mt-2 flex items-center gap-1 text-[10px] text-[#4C83B5] hover:underline"
                        >
                          <ImageIcon className="w-3 h-3" /> Lihat Foto
                        </button>
                      )}
                      {report.reviewNotes && (
                        <div className="mt-2 p-2 rounded-lg bg-[#F4F6F8] border border-[#E4EAF0] text-[10px] text-[#6F7F8D] italic">
                          Catatan mentor: "{report.reviewNotes}"
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Photo Preview Modal */}
        {previewReport && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0D2F47]/70 backdrop-blur-sm">
            <div className="surface rounded-2xl max-w-lg w-full overflow-hidden">
              <div className="p-4 border-b border-[#E4EAF0] flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-sm text-[#123B59]">Foto Laporan</h3>
                  <p className="text-[11px] text-[#6F7F8D]">{formatDateID(previewReport.date)}</p>
                </div>
                <button onClick={() => setPreviewReport(null)} className="p-1 rounded-lg text-[#6F7F8D] hover:bg-[#F4F6F8] cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-4">
                <img src={previewReport.photoUrl} alt="Foto laporan" className="w-full rounded-xl object-contain max-h-80" />
                <p className="mt-3 text-xs text-[#6F7F8D]">{previewReport.description}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ─── MENTOR / ADMIN VIEW ─────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {toastMsg && (
        <div className="fixed bottom-5 right-5 z-50 py-2.5 px-4 rounded-xl bg-[#0D2F47] text-white text-xs font-medium shadow-lg flex items-center gap-2">
          <Check className="w-3.5 h-3.5 text-emerald-400" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold tracking-[.14em] text-[#4C83B5] uppercase mb-1">
            Verifikasi
          </p>
          <h1 className="text-xl sm:text-2xl font-bold text-[#123B59]">Laporan Harian Peserta</h1>
          <p className="text-xs text-[#6F7F8D] mt-0.5">
            Tinjau foto dan catatan kegiatan harian peserta, lalu berikan persetujuan atau catatan revisi.
          </p>
          <MobileHeaderStatus />
        </div>
        {pendingCount > 0 && (
          <div className="surface px-4 py-2.5 rounded-2xl flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-[#D95B83] animate-pulse" />
            <div>
              <p className="text-[10px] text-[#6F7F8D] font-semibold uppercase tracking-wider">Menunggu Review</p>
              <p className="text-lg font-black text-[#123B59] leading-none">{pendingCount}</p>
            </div>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="surface rounded-2xl p-3 flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-3">
        <div className="relative min-w-0 flex-1 sm:min-w-[200px] sm:max-w-xs">
          <Search className="w-3.5 h-3.5 text-[#A9C7DE] absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cari nama, NIM, atau deskripsi..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-[#E4EAF0] bg-[#F4F6F8] text-[#123B59] placeholder-[#A9C7DE] outline-none focus:ring-1 focus:ring-[#4C83B5]"
          />
        </div>

        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value as any)}
          className="text-xs py-1.5 px-2.5 rounded-lg border border-[#E4EAF0] bg-[#F4F6F8] text-[#123B59] outline-none"
        >
          <option value="all">Semua Status</option>
          <option value="pending">Menunggu Review</option>
          <option value="approved">Disetujui</option>
          <option value="rejected">Perlu Revisi</option>
        </select>

        {isAdmin && (
          <select
            value={filterKejuruan}
            onChange={e => setFilterKejuruan(e.target.value)}
            className="text-xs py-1.5 px-2.5 rounded-lg border border-[#E4EAF0] bg-[#F4F6F8] text-[#123B59] outline-none"
          >
            <option value="all">Semua Kejuruan</option>
            {getKejuruanFilterOptions(kejuruanList).map(option => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        )}

        <div className="text-[11px] text-[#6F7F8D] self-start whitespace-nowrap sm:ml-auto sm:self-center">
          {relevantReports.length} laporan
        </div>
      </div>

      {/* Reports Table */}
      <div className="surface rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[#E4EAF0] text-[#6F7F8D] text-[11px] font-semibold bg-[#F8FAFB]">
                <th className="py-3 px-4">Peserta</th>
                <th className="py-3 px-3">Tanggal</th>
                <th className="py-3 px-3">Deskripsi Kegiatan</th>
                <th className="py-3 px-3 text-center">Foto</th>
                <th className="py-3 px-3">Status</th>
                {isAdmin ? null : <th className="py-3 px-4 text-right">Aksi</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E4EAF0]">
              {relevantReports.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 5 : 6} className="py-12 text-center text-[#A9C7DE] text-xs">
                    Tidak ada laporan yang sesuai filter.
                  </td>
                </tr>
              ) : (
                relevantReports.map(report => (
                  <tr key={report.id} className="hover:bg-[#F4F6F8] transition">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        <img
                          src={report.traineeAvatar}
                          alt={report.traineeName}
                          className="w-8 h-8 rounded-full object-cover border border-[#E4EAF0]"
                        />
                        <div>
                          <div className="font-semibold text-[#123B59]">{report.traineeName}</div>
                          <div className="text-[10px] text-[#A9C7DE]">{report.traineeNim} · {report.kejuruanName}</div>
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-3">
                      <div className="font-medium text-[#123B59]">{formatDateID(report.date)}</div>
                      <div className="text-[10px] text-[#A9C7DE]">{formatTimeShort(report.submittedAt)}</div>
                    </td>

                    <td className="py-3 px-3 max-w-[260px]">
                      <p className="line-clamp-2 text-[#6F7F8D]">{report.description}</p>
                      {report.reviewNotes && (
                        <div className="mt-1 text-[10px] text-[#A9C7DE] italic">
                          Catatan: "{report.reviewNotes}"
                        </div>
                      )}
                    </td>

                    <td className="py-3 px-3 text-center">
                      {report.photoUrl ? (
                        <button
                          onClick={() => setPreviewReport(report)}
                          className="inline-flex flex-col items-center gap-1 group cursor-pointer"
                        >
                          <img
                            src={report.photoUrl}
                            alt="thumbnail"
                            className="w-12 h-10 rounded-lg object-cover border border-[#E4EAF0] group-hover:border-[#4C83B5] transition"
                          />
                          <span className="text-[10px] text-[#4C83B5]">Lihat</span>
                        </button>
                      ) : (
                        <span className="text-[10px] text-[#A9C7DE] italic">Tidak ada</span>
                      )}
                    </td>

                    <td className="py-3 px-3">
                      <StatusBadge status={report.status} />
                    </td>

                    {!isAdmin && (
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => handleOpenReview(report)}
                          className="px-3 py-1.5 rounded-lg border border-[#E4EAF0] bg-white hover:bg-[#EAF2F8] hover:border-[#4C83B5] text-xs font-semibold text-[#123B59] transition cursor-pointer"
                        >
                          {report.status === 'pending' ? 'Verifikasi' : 'Ubah Review'}
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Photo Preview Modal */}
      {previewReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0D2F47]/70 backdrop-blur-sm">
          <div className="surface rounded-2xl max-w-lg w-full overflow-hidden">
            <div className="p-4 border-b border-[#E4EAF0] flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-[#123B59]">Foto Laporan — {previewReport.traineeName}</h3>
                <p className="text-[11px] text-[#6F7F8D]">{formatDateID(previewReport.date)}</p>
              </div>
              <button onClick={() => setPreviewReport(null)} className="p-1 rounded-lg text-[#6F7F8D] hover:bg-[#F4F6F8] cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <img src={previewReport.photoUrl} alt="Foto laporan" className="w-full rounded-xl object-contain max-h-80" />
              <div className="p-3 rounded-xl bg-[#F4F6F8] border border-[#E4EAF0]">
                <p className="text-[10px] font-semibold text-[#4C83B5] uppercase tracking-wider mb-1">Deskripsi Kegiatan</p>
                <p className="text-xs text-[#6F7F8D]">{previewReport.description}</p>
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => setPreviewReport(null)} className="px-4 py-2 rounded-lg border border-[#E4EAF0] text-xs text-[#6F7F8D] hover:bg-[#F4F6F8] transition cursor-pointer">
                  Tutup
                </button>
                <button
                  onClick={() => { setPreviewReport(null); handleOpenReview(previewReport); }}
                  className="px-4 py-2 rounded-lg bg-[#123B59] hover:bg-[#0D2F47] text-white text-xs font-semibold transition cursor-pointer"
                >
                  Verifikasi Laporan
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Review Modal */}
      {selectedReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-2 sm:p-4 bg-[#0D2F47]/45 backdrop-blur-sm">
          <div className="surface flex max-h-[calc(100dvh-1rem)] w-full max-w-lg flex-col overflow-hidden rounded-2xl sm:max-h-[calc(100dvh-2rem)]">
            <div className="flex shrink-0 items-center justify-between border-b border-[#E4EAF0] p-4">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-[#4C83B5]" />
                <h3 className="font-bold text-sm text-[#123B59]">Verifikasi Laporan Harian</h3>
              </div>
              <button onClick={() => setSelectedReport(null)} className="p-1 rounded-lg text-[#6F7F8D] hover:bg-[#F4F6F8] cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-5 space-y-4">
              {/* Trainee info */}
              <div className="flex items-center gap-3 p-3 rounded-xl bg-[#EAF2F8] border border-[#A9C7DE]/40">
                <img src={selectedReport.traineeAvatar} alt={selectedReport.traineeName} className="w-10 h-10 rounded-full border border-[#E4EAF0]" />
                <div>
                  <div className="font-semibold text-xs text-[#123B59]">{selectedReport.traineeName}</div>
                  <div className="text-[11px] text-[#4C83B5]">{selectedReport.traineeNim} · {selectedReport.kejuruanName}</div>
                </div>
                <div className="ml-auto text-right">
                  <div className="text-[10px] text-[#6F7F8D]">Tanggal</div>
                  <div className="text-xs font-bold text-[#123B59]">{formatDateID(selectedReport.date)}</div>
                </div>
              </div>

              {/* Photo */}
              {selectedReport.photoUrl && (
                <div>
                  <p className="text-[10px] font-semibold text-[#A9C7DE] uppercase tracking-wider mb-1.5">Foto Laporan</p>
                  <img src={selectedReport.photoUrl} alt="Foto laporan" className="w-full rounded-xl object-contain max-h-52 border border-[#E4EAF0]" />
                </div>
              )}

              {/* Description */}
              <div>
                <p className="text-[10px] font-semibold text-[#A9C7DE] uppercase tracking-wider mb-1">Deskripsi Kegiatan</p>
                <div className="p-2.5 rounded-lg bg-[#F4F6F8] border border-[#E4EAF0] text-xs text-[#6F7F8D]">
                  {selectedReport.description}
                </div>
              </div>

              {/* Review notes */}
              <div>
                <label className="block text-xs font-semibold text-[#123B59] mb-1">
                  Catatan / Feedback untuk Peserta
                </label>
                <textarea
                  rows={3}
                  placeholder="Tulis apresiasi atau catatan perbaikan untuk peserta (opsional)..."
                  value={reviewNotes}
                  onChange={e => setReviewNotes(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-lg border border-[#E4EAF0] bg-white text-[#123B59] outline-none focus:ring-1 focus:ring-[#4C83B5] placeholder-[#A9C7DE]"
                />
              </div>

              <div className="flex flex-col-reverse gap-2 border-t border-[#E4EAF0] pt-3 sm:flex-row sm:items-center sm:justify-between">
                <button
                  type="button"
                  onClick={() => void handleConfirmReview('rejected')}
                  disabled={isSavingReview}
                  className="w-full px-3.5 py-2 rounded-lg bg-[#FCF3F6] hover:bg-[#D95B83] hover:text-white text-[#B84469] text-xs font-semibold transition cursor-pointer sm:w-auto"
                >
                  Kembalikan / Minta Revisi
                </button>
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedReport(null)}
                    className="px-3 py-2 rounded-lg border border-[#E4EAF0] text-xs text-[#6F7F8D] hover:bg-[#F4F6F8] transition cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleConfirmReview('approved')}
                    disabled={isSavingReview}
                    className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Setujui Laporan</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
