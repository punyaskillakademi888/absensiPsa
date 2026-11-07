import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, BookOpen, CheckCircle2, ClipboardList, LoaderCircle, Pencil, Search, Send, Trash2, X } from 'lucide-react';
import { api } from '../../services/api';
import { useApp } from '../../context/AppContext';
import { MentorDailyReport } from '../../types';
import { getTodayDateString } from '../../utils/dateUtils';
import { PageHeader } from '../PageHeader';

type ReportForm = Pick<MentorDailyReport, 'date' | 'activities' | 'achievements' | 'obstacles' | 'nextPlan'>;

const emptyForm = (): ReportForm => ({
  date: getTodayDateString(),
  activities: '',
  achievements: '',
  obstacles: '',
  nextPlan: '',
});

const formatDate = (date: string) => {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
};

export const MentorDailyReportView: React.FC = () => {
  const { currentUser } = useApp();
  const [reports, setReports] = useState<MentorDailyReport[]>([]);
  const [form, setForm] = useState<ReportForm>(emptyForm);
  const [editingReportId, setEditingReportId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingReportId, setDeletingReportId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const formRef = useRef<HTMLFormElement>(null);

  const loadReports = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.getMentorDailyReports();
      setReports(response.reports);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Gagal memuat laporan mentor.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadReports();
  }, [loadReports]);

  const visibleReports = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('id-ID');
    return reports.filter(report => {
      if (filterDate && report.date !== filterDate) return false;
      if (!query) return true;
      return [
        report.mentorName,
        report.mentorNim,
        report.kejuruanName || '',
        report.activities,
        report.achievements,
        report.obstacles,
        report.nextPlan,
      ].some(value => value.toLocaleLowerCase('id-ID').includes(query));
    });
  }, [reports, search, filterDate]);

  const saveReport = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const reportData = {
        ...form,
        activities: form.activities.trim(),
        achievements: form.achievements.trim(),
        obstacles: form.obstacles.trim(),
        nextPlan: form.nextPlan.trim(),
      };
      const response = editingReportId
        ? await api.updateMentorDailyReport(editingReportId, reportData)
        : await api.submitMentorDailyReport(reportData);
      setReports(previous => [
        response.report,
        ...previous.filter(report =>
          report.id !== response.report.id &&
          report.id !== editingReportId &&
          !(report.mentorId === response.report.mentorId && report.date === response.report.date)
        ),
      ].sort((a, b) => b.date.localeCompare(a.date) || b.submittedAt.localeCompare(a.submittedAt)));
      setNotice(response.message);
      window.alert(response.message);
      setEditingReportId(null);
      setForm(emptyForm());
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Gagal menyimpan laporan mentor.');
    } finally {
      setSaving(false);
    }
  };

  const editReport = (report: MentorDailyReport) => {
    setEditingReportId(report.id);
    setForm({
      date: report.date,
      activities: report.activities,
      achievements: report.achievements,
      obstacles: report.obstacles,
      nextPlan: report.nextPlan,
    });
    setError('');
    setNotice('');
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const deleteReport = async (report: MentorDailyReport) => {
    if (!window.confirm(`Hapus laporan tanggal ${formatDate(report.date)}? Tindakan ini tidak dapat dibatalkan.`)) return;
    setDeletingReportId(report.id);
    setError('');
    setNotice('');
    try {
      const response = await api.deleteMentorDailyReport(report.id);
      setReports(previous => previous.filter(item => item.id !== report.id));
      if (editingReportId === report.id) {
        setEditingReportId(null);
        setForm(emptyForm());
      }
      setNotice(response.message);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Gagal menghapus laporan mentor.');
    } finally {
      setDeletingReportId(null);
    }
  };

  const cancelEdit = () => {
    setEditingReportId(null);
    setForm(emptyForm());
    setNotice('');
    setError('');
  };

  return (
    <section className="w-full min-w-0 space-y-5">
      <PageHeader
        eyebrow="JURNAL MENTOR"
        title="Laporan Harian Mentor"
        description="Catat kegiatan dan perkembangan harian. Laporan dapat dibaca oleh admin dan seluruh mentor."
      />

      {error && (
        <div role="alert" className="flex items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
          <span className="flex items-center gap-2"><AlertCircle className="h-4 w-4 shrink-0" />{error}</span>
          {!loading && <button type="button" onClick={() => void loadReports()} className="shrink-0 font-bold underline">Coba lagi</button>}
        </div>
      )}
      {notice && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">{notice}</div>}

      <div className={`grid w-full min-w-0 items-start gap-5 ${currentUser.role === 'mentor' ? 'lg:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)]' : 'grid-cols-1'}`}>
        <section className="min-w-0 space-y-3">
          <div className="flex flex-col gap-3 rounded-2xl border border-[#E4EAF0] bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="flex items-center gap-2 font-bold text-[#123B59]"><BookOpen className="h-4 w-4" /> Laporan Mentor</h2>
              <p className="mt-1 text-xs text-[#6F7F8D]">{visibleReports.length} laporan dapat diakses oleh mentor dan admin</p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <label className="relative">
                <span className="sr-only">Cari laporan mentor</span>
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8A9AA8]" />
                <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Cari mentor atau isi laporan" className="w-full rounded-xl border border-[#DCE4EA] py-2 pl-9 pr-3 text-sm text-[#123B59] outline-none focus:border-[#4C83B5] sm:w-56" />
              </label>
              <label>
                <span className="sr-only">Filter tanggal laporan</span>
                <input type="date" value={filterDate} onChange={event => setFilterDate(event.target.value)} className="w-full rounded-xl border border-[#DCE4EA] px-3 py-2 text-sm text-[#123B59] outline-none focus:border-[#4C83B5]" />
              </label>
            </div>
          </div>
          {loading ? (
            <div className="flex items-center justify-center gap-2 p-12 text-sm font-semibold text-[#6F7F8D]">
              <LoaderCircle className="h-5 w-5 animate-spin" /> Memuat laporan...
            </div>
          ) : visibleReports.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#C7D3DD] bg-white p-12 text-center text-sm text-[#6F7F8D]">
              <ClipboardList className="mx-auto mb-3 h-8 w-8 text-[#4C83B5]" />
              {reports.length ? 'Tidak ada laporan yang sesuai dengan pencarian.' : 'Belum ada laporan mentor.'}
            </div>
          ) : (
            <div className="space-y-3">
              {visibleReports.map(report => (
                <article key={report.id} className="space-y-4 rounded-2xl border border-[#E4EAF0] bg-white p-5 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h3 className="font-extrabold text-[#123B59]">{report.mentorName}</h3>
                      <p className="mt-1 text-xs text-[#6F7F8D]">
                        {formatDate(report.date)} · {report.kejuruanName || 'Mentor'}
                        {report.mentorId === currentUser.id && <span className="ml-2 font-bold text-[#4C83B5]">Laporan saya</span>}
                      </p>
                    </div>
                    {report.mentorId === currentUser.id && (
                      <div className="flex items-center gap-2">
                        {report.date === getTodayDateString() && <CheckCircle2 className="h-5 w-5 text-emerald-600" aria-label="Laporan hari ini tersimpan" />}
                        {currentUser.role === 'mentor' && (
                          <>
                            <button type="button" onClick={() => editReport(report)} className="inline-flex items-center gap-1.5 rounded-lg border border-[#DCE4EA] px-3 py-2 text-xs font-bold text-[#123B59] hover:bg-[#F4F6F8]" aria-label={`Edit laporan ${formatDate(report.date)}`}>
                              <Pencil className="h-3.5 w-3.5" /> Edit
                            </button>
                            <button type="button" disabled={deletingReportId === report.id} onClick={() => void deleteReport(report)} className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-50 disabled:opacity-60" aria-label={`Hapus laporan ${formatDate(report.date)}`}>
                              {deletingReportId === report.id ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                              Hapus
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {([
                      ['Kegiatan', report.activities],
                      ['Hasil / Capaian', report.achievements],
                      ['Kendala', report.obstacles],
                      ['Rencana Berikutnya', report.nextPlan],
                    ] as const).map(([label, content]) => (
                      <div key={label} className="rounded-xl bg-[#F7F9FB] p-3">
                        <p className="text-[11px] font-bold uppercase tracking-wide text-[#6F7F8D]">{label}</p>
                        <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-5 text-[#123B59]">{content || '—'}</p>
                      </div>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        {currentUser.role === 'mentor' && (
          <form ref={formRef} onSubmit={saveReport} className="min-w-0 space-y-4 rounded-2xl border border-[#E4EAF0] bg-white p-5 shadow-sm">
            <div>
              <h2 className="flex items-center gap-2 font-bold text-[#123B59]">
                <Send className="h-4 w-4" /> {editingReportId ? 'Edit Laporan' : 'Tambah Laporan'}
              </h2>
              <p className="mt-1 text-xs text-[#6F7F8D]">
                {editingReportId ? 'Perbarui isi laporan yang dipilih.' : 'Satu laporan per tanggal. Laporan yang sudah ada hanya dapat diubah melalui tombol Edit.'}
              </p>
            </div>
            <label className="block text-xs font-bold text-[#6F7F8D]">
              Tanggal laporan
              <input required type="date" max={getTodayDateString()} value={form.date} onChange={event => setForm(previous => ({ ...previous, date: event.target.value }))} className="mt-1.5 w-full rounded-xl border border-[#DCE4EA] px-3 py-2.5 text-sm font-medium text-[#123B59] outline-none focus:border-[#4C83B5]" />
            </label>
            {([
              ['activities', 'Kegiatan', true],
              ['achievements', 'Hasil / Capaian', false],
              ['obstacles', 'Kendala', false],
              ['nextPlan', 'Rencana Berikutnya', false],
            ] as const).map(([field, label, required]) => (
              <label key={field} className="block text-xs font-bold text-[#6F7F8D]">
                {label}
                <textarea required={required} maxLength={10000} rows={field === 'activities' ? 4 : 3} value={form[field]} onChange={event => setForm(previous => ({ ...previous, [field]: event.target.value }))} className="mt-1.5 w-full resize-y rounded-xl border border-[#DCE4EA] px-3 py-2.5 text-sm font-medium text-[#123B59] outline-none focus:border-[#4C83B5]" />
              </label>
            ))}
            <div className="flex gap-2">
              {editingReportId && (
                <button type="button" disabled={saving} onClick={cancelEdit} className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#DCE4EA] px-4 py-2.5 text-sm font-bold text-[#123B59] hover:bg-[#F4F6F8] disabled:opacity-60">
                  <X className="h-4 w-4" /> Batal
                </button>
              )}
              <button type="submit" disabled={saving || loading || !form.activities.trim()} className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#123B59] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#0D2F47] disabled:cursor-not-allowed disabled:opacity-60">
                {saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {saving ? 'Menyimpan...' : editingReportId ? 'Simpan Perubahan' : 'Kirim Laporan'}
              </button>
            </div>
          </form>
        )}
      </div>
    </section>
  );
};
