import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { MobileHeaderStatus } from '../MobileHeaderStatus';
import {
  FileText,
  CheckCircle2,
  XCircle,
  Clock,
  Paperclip,
  Check,
  X,
  Calendar,
  AlertCircle
} from 'lucide-react';
import { getTodayDateString, formatIndonesianDate } from '../../utils/dateUtils';

export const LeaveManagementView: React.FC = () => {
  const { currentUser, leaveRequests, submitLeaveRequest, reviewLeaveRequest } = useApp();

  const today = getTodayDateString();

  const [type, setType] = useState<'izin' | 'sakit'>('izin');
  const [startDate, setStartDate] = useState<string>(today);
  const [endDate, setEndDate] = useState<string>(today);
  const [reason, setReason] = useState<string>('');
  const [attachmentUrl, setAttachmentUrl] = useState('');
  const [submittedSuccess, setSubmittedSuccess] = useState<boolean>(false);
  const [submittedMessage, setSubmittedMessage] = useState('');

  const [selectedRequest, setSelectedRequest] = useState<string | null>(null);
  const [reviewNotes, setReviewNotes] = useState<string>('');

  const isTrainee = currentUser.role === 'trainee';

  const visibleRequests = leaveRequests.filter(l => {
    if (isTrainee) return l.userId === currentUser.id;
    if (currentUser.role === 'mentor') return l.kejuruanId === currentUser.kejuruanId;
    return true;
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      alert('Mohon tuliskan alasan permohonan izin/sakit.');
      return;
    }
    let normalizedAttachmentUrl: URL;
    try {
      normalizedAttachmentUrl = new URL(attachmentUrl.trim());
      if (!['http:', 'https:'].includes(normalizedAttachmentUrl.protocol)) throw new Error('Invalid protocol');
    } catch {
      alert('Masukkan tautan lampiran yang valid (https://...).');
      return;
    }

    try {
      const result = await submitLeaveRequest({ type, startDate, endDate, reason, attachmentUrl: normalizedAttachmentUrl.toString() });
      if (!result.success) {
        alert(result.message);
        return;
      }
      setSubmittedMessage(result.message);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Pengajuan gagal dikirim. Coba lagi.');
      return;
    }

    setSubmittedSuccess(true);
    setReason('');
    setAttachmentUrl('');
    setTimeout(() => setSubmittedSuccess(false), 3000);
  };

  const downloadLetterTemplate = () => {
    const escapeHtml = (value: string) => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char] || char));
    const documentHtml = `<!doctype html><html><head><meta charset="utf-8"><title>Template Surat Izin</title></head><body style="font-family:Arial,sans-serif;max-width:760px;margin:48px auto;line-height:1.7;color:#111"><p style="text-align:right">Bandung, ${escapeHtml(formatIndonesianDate(today))}</p><p>Kepada Yth.<br><b>Mentor/Pembimbing Punya Skill Akademi</b><br>di tempat</p><p><b>Perihal: Permohonan Izin Tidak Hadir</b></p><p>Dengan hormat,</p><p>Saya yang bertanda tangan di bawah ini:</p><table style="border-collapse:collapse"><tr><td style="padding:3px 16px 3px 0">Nama</td><td>: ${escapeHtml(currentUser.name)}</td></tr><tr><td style="padding:3px 16px 3px 0">NIM/Kode Peserta</td><td>: ${escapeHtml(currentUser.nim)}</td></tr><tr><td style="padding:3px 16px 3px 0">Program</td><td>: ${escapeHtml(currentUser.kejuruanName || '—')}</td></tr></table><p>Dengan ini mengajukan izin tidak hadir pada tanggal <b>${escapeHtml(formatIndonesianDate(startDate))}</b>${startDate !== endDate ? ` sampai dengan <b>${escapeHtml(formatIndonesianDate(endDate))}</b>` : ''} karena:</p><p style="min-height:72px;border-bottom:1px solid #888">${escapeHtml(reason.trim() || '[Tuliskan alasan izin]')}</p><p>Sebagai bahan pertimbangan, saya melampirkan dokumen pendukung. Saya akan bertanggung jawab untuk mengejar materi atau tugas yang tertinggal. Demikian permohonan ini saya sampaikan. Atas perhatian dan izin yang diberikan, saya ucapkan terima kasih.</p><p style="margin-top:52px">Hormat saya,</p><p style="margin-top:72px"><b>${escapeHtml(currentUser.name)}</b><br>${escapeHtml(currentUser.nim)}</p></body></html>`;
    const themedDocumentHtml = documentHtml
      .replace(
        '<body style="font-family:Arial,sans-serif;max-width:760px;margin:48px auto;line-height:1.7;color:#111">',
        '<body style="font-family:Arial,sans-serif;max-width:760px;margin:48px auto;line-height:1.7;color:#0D2F47"><h1 style="color:#0D2F47;font-size:20px;text-align:center">SURAT PERMOHONAN IZIN</h1>'
      )
      .replace(
        '</p></body></html>',
        '</p><p style="margin-top:52px;text-align:right">Mengetahui,<br>Koordinator Program Pelatihan<br><br><br><b>Abdul Rozzak Junaidi</b></p></body></html>'
      );
    const url = URL.createObjectURL(new Blob([themedDocumentHtml], { type: 'application/msword;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `Template_Surat_Izin_${currentUser.nim}.doc`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleReview = async (id: string, status: 'approved' | 'rejected') => {
    try {
      const result = await reviewLeaveRequest(id, status, reviewNotes || undefined);
      if (!result.success) {
        alert(result.message);
        return;
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Permohonan gagal diproses. Coba lagi.');
      return;
    }
    setSelectedRequest(null);
    setReviewNotes('');
  };

  return (
    <div className="space-y-6">
      {/* Header matching style.html */}
      <div>
        <p className="text-[10px] font-bold tracking-[.14em] text-[#4C83B5] uppercase">
          PENGAJUAN
        </p>
        <h1 className="mt-1 font-bold text-2xl lg:text-3xl text-[#123B59]">
          {isTrainee ? 'Ajukan Izin & Sakit' : currentUser.role === 'admin' ? 'Daftar Permohonan Izin' : 'Verifikasi Permohonan Izin'}
        </h1>
        <p className="mt-1 text-sm text-[#6F7F8D]">
          {isTrainee
            ? 'Formulir resmi ketidakhadiran peserta pelatihan & magang kejuruan.'
            : currentUser.role === 'admin' ? 'Lihat permohonan izin dan lampiran peserta.' : 'Tinjau dan setujui surat permohonan izin atau surat keterangan sakit peserta.'}
        </p>
        <MobileHeaderStatus />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_.9fr]">
        {/* Left Side: Form for Trainee, or Queue Metric for Mentor/Admin */}
        {isTrainee ? (
          <form onSubmit={handleSubmit} className="surface rounded-2xl p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#E4EAF0]">
              <h2 className="font-bold text-lg text-[#123B59]">
                Formulir Pengajuan
              </h2>
              <span className="rounded-full bg-[#EAF2F8] px-3 py-1 text-[10px] font-bold text-[#4C83B5]">
                BARU
              </span>
            </div>

            {submittedSuccess && (
              <div className="rounded-xl border border-[#C8DCEB] bg-[#EEF6FB] px-4 py-3 flex items-center gap-2.5 text-xs text-[#123B59] font-bold">
                <Check className="w-4 h-4 text-[#4C83B5] shrink-0" />
                <span>{submittedMessage}</span>
              </div>
            )}

            <div>
              <label className="text-xs font-bold text-[#123B59] uppercase tracking-wide">
                Kategori Permohonan
              </label>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setType('izin')}
                  className={`py-2 px-3 text-xs font-bold rounded-xl border transition cursor-pointer ${
                    type === 'izin'
                      ? 'border-[#4C83B5] bg-[#EAF2F8] text-[#28618F]'
                      : 'border-[#E4EAF0] bg-[#F8FAFB] text-[#6F7F8D] hover:bg-white'
                  }`}
                >
                  Izin Keperluan
                </button>
                <button
                  type="button"
                  onClick={() => setType('sakit')}
                  className={`py-2 px-3 text-xs font-bold rounded-xl border transition cursor-pointer ${
                    type === 'sakit'
                      ? 'border-[#4C83B5] bg-[#EEF5FA] text-[#4C83B5]'
                      : 'border-[#E4EAF0] bg-[#F8FAFB] text-[#6F7F8D] hover:bg-white'
                  }`}
                >
                  Sakit (Medis)
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-[#123B59]">
                  Dari Tanggal
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-[#E4EAF0] bg-[#F8FAFB] px-3.5 py-2.5 text-sm text-[#123B59] outline-none focus:border-[#4C83B5]"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-bold text-[#123B59]">
                  Sampai Tanggal
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  min={startDate}
                  className="mt-1.5 w-full rounded-xl border border-[#E4EAF0] bg-[#F8FAFB] px-3.5 py-2.5 text-sm text-[#123B59] outline-none focus:border-[#4C83B5]"
                  required
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-[#123B59]">
                Alasan Izin
              </label>
              <textarea
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="Tuliskan alasan singkat atau diagnosis dokter..."
                rows={4}
                className="mt-1.5 w-full rounded-xl border border-[#E4EAF0] bg-[#F8FAFB] px-3.5 py-2.5 text-sm text-[#123B59] outline-none focus:border-[#4C83B5]"
                required
              />
            </div>

            <div>
              <label className="text-xs font-bold text-[#123B59]">
                {type === 'sakit' ? 'Link Surat Keterangan Sakit (Wajib)' : 'Link Lampiran Surat Izin (Wajib)'}
              </label>
              <div className="mt-1.5">
                <input
                  type="url"
                  value={attachmentUrl}
                  onChange={e => setAttachmentUrl(e.target.value)}
                  placeholder="https://drive.google.com/..."
                  maxLength={2048}
                  required
                  className="block w-full rounded-xl border border-[#E4EAF0] bg-[#F8FAFB] px-3.5 py-2.5 text-sm text-[#123B59]"
                />
              </div>
              <p className="mt-1.5 text-xs text-[#6F7F8D]">
                Tempel tautan berbagi file (Drive/Cloudinary) dan pastikan mentor dapat membukanya. {type === 'sakit' ? 'Lampirkan surat keterangan dokter.' : 'Isi template surat izin, unggah ke penyimpanan pilihan Anda, lalu tempel tautannya di sini.'}
              </p>
              {type === 'izin' && <button type="button" onClick={downloadLetterTemplate} className="mt-3 inline-flex items-center gap-2 rounded-xl border border-[#C8DCEB] bg-[#EEF6FB] px-3.5 py-2.5 text-xs font-bold text-[#28618F] hover:bg-[#EAF2F8]">
                <FileText className="h-4 w-4" /> Unduh Template Surat Izin (.doc)
              </button>}
            </div>

            <button
              type="submit"
              className="mt-4 w-full rounded-xl bg-[#123B59] hover:bg-[#0D2F47] px-4 py-3.5 font-bold text-white transition hover:-translate-y-0.5 active:translate-y-0 cursor-pointer shadow-md text-sm"
            >
              Kirim Pengajuan Izin
            </button>
          </form>
        ) : (
          <div className="surface rounded-2xl p-5 sm:p-6 space-y-4">
            <h2 className="font-bold text-lg text-[#123B59]">
              Ringkasan Antrean Izin
            </h2>
            <div className="divide-y divide-[#E4EAF0] text-sm">
              <div className="py-3 flex items-center justify-between">
                <span className="text-[#6F7F8D]">Menunggu Verifikasi</span>
                <span className="font-bold text-amber-600 bg-amber-50 px-2.5 py-0.5 rounded-full text-xs">
                  {visibleRequests.filter(l => l.status === 'pending').length}
                </span>
              </div>
              <div className="py-3 flex items-center justify-between">
                <span className="text-[#6F7F8D]">Telah Disetujui</span>
                <span className="font-bold text-[#28618F] bg-[#EAF2F8] px-2.5 py-0.5 rounded-full text-xs">
                  {visibleRequests.filter(l => l.status === 'approved').length}
                </span>
              </div>
              <div className="py-3 flex items-center justify-between">
                <span className="text-[#6F7F8D]">Ditolak</span>
                <span className="font-bold text-[#B84469] bg-[#FCF3F6] px-2.5 py-0.5 rounded-full text-xs">
                  {visibleRequests.filter(l => l.status === 'rejected').length}
                </span>
              </div>
            </div>
            <p className="text-xs text-[#6F7F8D] pt-2 border-t border-[#E4EAF0] leading-relaxed">
              Persetujuan izin otomatis menandai status kehadiran siswa di rekapitulasi kehadiran dan modul pelaporan.
            </p>
          </div>
        )}

        {/* Right Side: Request List */}
        <div>
          <div className="flex items-center justify-between pb-3">
            <h2 className="font-bold text-xl text-[#123B59]">
              {isTrainee ? 'Pengajuan Saya' : 'Daftar Pengajuan Masuk'}
            </h2>
            <span className="rounded-full bg-[#EAF2F8] px-3 py-1 text-[10px] font-bold text-[#4C83B5]">
              {visibleRequests.length} PENGAJUAN
            </span>
          </div>

          <div className="space-y-3 mt-3">
            {visibleRequests.length === 0 ? (
              <div className="surface rounded-2xl p-10 text-center text-sm text-[#6F7F8D] italic">
                Belum ada pengajuan izin atau sakit.
              </div>
            ) : (
              visibleRequests.map(leave => {
                const isPending = leave.status === 'pending';
                const isApproved = leave.status === 'approved';
                const isRejected = leave.status === 'rejected';

                let badgeStyle = 'bg-[#EEF5FA] text-[#4C83B5]';
                let badgeLabel = 'Menunggu';
                if (isApproved) {
                  badgeStyle = 'bg-[#EAF2F8] text-[#28618F]';
                  badgeLabel = 'Disetujui';
                } else if (isRejected) {
                  badgeStyle = 'bg-[#FCF3F6] text-[#B84469]';
                  badgeLabel = 'Ditolak';
                }

                return (
                  <article key={leave.id} className="surface soft-hover rounded-xl p-4 border border-[#E4EAF0]">
                    <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-bold text-[#123B59]">
                            {formatIndonesianDate(leave.startDate)} {leave.startDate !== leave.endDate && `s/d ${formatIndonesianDate(leave.endDate)}`}
                          </p>
                          <span className="text-xs font-bold text-[#4C83B5] capitalize">
                            ({leave.type} - {leave.daysCount} hari)
                          </span>
                        </div>
                        <p className="text-xs text-[#6F7F8D] mt-0.5">
                          Oleh: <strong className="text-[#123B59]">{leave.userName}</strong> &middot; NIM: {leave.userNim}
                        </p>
                        <p className="mt-2 text-sm text-[#123B59] bg-[#F8FAFB] p-2.5 rounded-xl border border-[#E4EAF0]">
                          "{leave.reason}"
                        </p>
                        {(leave.attachmentUrl || leave.attachmentName) && (
                          <p className="mt-2 text-xs text-[#4C83B5] flex items-center gap-1">
                            <Paperclip className="w-3 h-3" />
                            <span>Lampiran: </span>
                            {leave.attachmentUrl ? <a href={leave.attachmentUrl} target="_blank" rel="noreferrer" className="font-semibold hover:underline">Buka tautan lampiran</a> : <span>{leave.attachmentName}</span>}
                          </p>
                        )}
                        {leave.reviewedBy && (
                          <p className="mt-2 text-[11px] text-[#6F7F8D]">
                            Ditinjau oleh {leave.reviewedBy} ({leave.reviewedAt}) {leave.reviewNotes && `· Catatan: ${leave.reviewNotes}`}
                          </p>
                        )}
                      </div>

                      <span className={`h-fit self-start rounded-full px-2.5 py-1 text-[10px] font-bold shrink-0 ${badgeStyle}`}>
                        {badgeLabel}
                      </span>
                    </div>

                    {/* Mentor/Admin action controls */}
                    {currentUser.role === 'mentor' && isPending && (
                      <div className="mt-3 pt-3 border-t border-[#E4EAF0] flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2">
                        <input
                          type="text"
                          placeholder="Catatan verifikasi (opsional)..."
                          value={selectedRequest === leave.id ? reviewNotes : ''}
                          onChange={e => {
                            setSelectedRequest(leave.id);
                            setReviewNotes(e.target.value);
                          }}
                          className="text-xs px-3 py-2 rounded-xl border border-[#E4EAF0] bg-[#F8FAFB] text-[#123B59] flex-1 outline-none focus:border-[#4C83B5]"
                        />
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleReview(leave.id, 'approved')}
                            className="rounded-xl px-4 py-2 bg-[#123B59] hover:bg-[#0D2F47] text-white text-xs font-bold transition cursor-pointer"
                          >
                            Setujui
                          </button>
                          <button
                            type="button"
                            onClick={() => handleReview(leave.id, 'rejected')}
                            className="rounded-xl border border-[#E3C4D0] bg-[#FCF3F6] hover:bg-[#f9e7ee] text-[#B84469] px-4 py-2 text-xs font-bold transition cursor-pointer"
                          >
                            Tolak
                          </button>
                        </div>
                      </div>
                    )}
                  </article>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
