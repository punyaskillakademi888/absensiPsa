import React, { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { Check, Clock3, Gift, ImagePlus, LoaderCircle, PackageCheck, Pencil, ShoppingBag, Trash2, X } from 'lucide-react';
import { api } from '../../services/api';
import { useApp } from '../../context/AppContext';
import { RewardItem, RewardPointBalance, RewardRedemption, RewardRedemptionStatus } from '../../types';
import { PageHeader } from '../PageHeader';

type RewardForm = Omit<RewardItem, 'id' | 'createdAt' | 'updatedAt'>;

const emptyForm: RewardForm = {
  title: '',
  description: '',
  pointsCost: 50,
  stock: 1,
  imageUrl: '',
  imagePublicId: '',
  category: 'Merchandise',
  isActive: true,
};

const statusLabels: Record<RewardRedemptionStatus, string> = {
  pending: 'Menunggu Konfirmasi',
  ready: 'Siap Diambil',
  completed: 'Selesai',
  cancelled: 'Dibatalkan',
};

const points = (value: number) => new Intl.NumberFormat('id-ID').format(value);

const normalizeRewardImageUrl = (value: string) => {
  const rawUrl = value.trim();
  if (!rawUrl) return '';

  let url: URL;
  try {
    url = new URL(/^[a-z][a-z\d+.-]*:/i.test(rawUrl) ? rawUrl : `https://${rawUrl}`);
  } catch {
    throw new Error('URL gambar tidak valid. Masukkan tautan gambar atau tautan berbagi Google Drive.');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('URL gambar harus menggunakan HTTP atau HTTPS.');
  }

  if (url.hostname === 'drive.google.com') {
    const fileId = url.pathname.match(/\/file\/d\/([^/]+)/)?.[1] || url.searchParams.get('id');
    if (fileId) {
      return `https://drive.google.com/uc?export=view&id=${encodeURIComponent(fileId)}`;
    }
  }
  return url.toString();
};

export const RewardStoreView: React.FC = () => {
  const { currentUser } = useApp();
  const [items, setItems] = useState<RewardItem[]>([]);
  const [redemptions, setRedemptions] = useState<RewardRedemption[]>([]);
  const [balance, setBalance] = useState<RewardPointBalance | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [tab, setTab] = useState<'catalog' | 'history'>('catalog');
  const [editingItem, setEditingItem] = useState<RewardItem | null>(null);
  const [form, setForm] = useState<RewardForm>(emptyForm);
  const [selectedReward, setSelectedReward] = useState<RewardItem | null>(null);
  const [pendingStatus, setPendingStatus] = useState<{ redemption: RewardRedemption; status: RewardRedemptionStatus } | null>(null);
  const [statusNotes, setStatusNotes] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imagePreviewFailed, setImagePreviewFailed] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const isTrainee = currentUser.role === 'trainee';
  const canManage = !isTrainee;
  let previewImageUrl = '';
  let invalidPreviewUrl = false;
  try {
    previewImageUrl = normalizeRewardImageUrl(form.imageUrl);
  } catch {
    invalidPreviewUrl = Boolean(form.imageUrl.trim());
  }

  const loadData = useCallback(async () => {
    setError('');
    try {
      const [itemResponse, redemptionResponse, balanceResponse] = await Promise.all([
        api.getRewardItems(),
        api.getRewardRedemptions(),
        isTrainee ? api.getRewardBalance() : Promise.resolve(null),
      ]);
      setItems(itemResponse.items);
      setRedemptions(redemptionResponse.redemptions);
      setBalance(balanceResponse?.balance || null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Gagal memuat halaman penukaran poin.');
    } finally {
      setLoading(false);
    }
  }, [isTrainee]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const openNewItem = () => {
    setEditingItem(null);
    setForm(emptyForm);
    setImageFile(null);
    setImagePreviewFailed(false);
    setNotice('');
  };

  const openEditItem = (item: RewardItem) => {
    setEditingItem(item);
    setForm({
      title: item.title,
      description: item.description,
      pointsCost: item.pointsCost,
      stock: item.stock,
      imageUrl: item.imageUrl,
      imagePublicId: item.imagePublicId || '',
      category: item.category,
      isActive: item.isActive,
    });
    setImageFile(null);
    setImagePreviewFailed(false);
    setNotice('');
  };

  const saveItem = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');
    try {
      let updatedForm = { ...form, imageUrl: normalizeRewardImageUrl(form.imageUrl) };
      if (imageFile) {
        setUploadingImage(true);
        const uploaded = await api.uploadImageToCloudinary({ file: imageFile, folder: 'hadirku/rewards' });
        if (!uploaded.url) throw new Error(uploaded.message || 'URL gambar tidak diterima dari Cloudinary.');
        updatedForm = { ...form, imageUrl: uploaded.url, imagePublicId: uploaded.publicId || '' };
      }
      if (editingItem) await api.updateRewardItem(editingItem.id, updatedForm);
      else await api.createRewardItem(updatedForm);
      setNotice(editingItem ? 'Hadiah berhasil diperbarui.' : 'Hadiah berhasil ditambahkan.');
      setEditingItem(null);
      setForm(emptyForm);
      setImageFile(null);
      setImagePreviewFailed(false);
      await loadData();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Gagal menyimpan hadiah.');
    } finally {
      setSaving(false);
      setUploadingImage(false);
    }
  };

  const deleteItem = async (item: RewardItem) => {
    if (!window.confirm(`Hapus hadiah "${item.title}" dari katalog? Riwayat penukaran yang sudah ada tetap tersimpan.`)) return;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      await api.deleteRewardItem(item.id);
      setItems(previous => previous.filter(current => current.id !== item.id));
      if (editingItem?.id === item.id) {
        setEditingItem(null);
        setForm(emptyForm);
        setImageFile(null);
      }
      setNotice('Hadiah berhasil dihapus.');
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Gagal menghapus hadiah.');
    } finally {
      setSaving(false);
    }
  };

  const redeem = async () => {
    if (!selectedReward) return;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      await api.redeemReward(selectedReward.id, crypto.randomUUID());
      setSelectedReward(null);
      setNotice('Penukaran berhasil diajukan. Simpan kode pengambilan dari riwayat Anda.');
      await loadData();
    } catch (redeemError) {
      setError(redeemError instanceof Error ? redeemError.message : 'Penukaran gagal diproses.');
      setSelectedReward(null);
      await loadData();
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async () => {
    if (!pendingStatus) return;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      await api.updateRewardRedemption(pendingStatus.redemption.id, pendingStatus.status, statusNotes);
      setPendingStatus(null);
      setStatusNotes('');
      setNotice(`Status penukaran berhasil diubah menjadi ${statusLabels[pendingStatus.status]}.`);
      await loadData();
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : 'Gagal memperbarui status penukaran.');
    } finally {
      setSaving(false);
    }
  };

  const startStatusChange = (redemption: RewardRedemption, status: RewardRedemptionStatus) => {
    setPendingStatus({ redemption, status });
    setStatusNotes(status === 'cancelled' ? 'Dibatalkan oleh pengelola.' : '');
  };

  const statusBadge = (status: RewardRedemptionStatus) => (
    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${
      status === 'completed' ? 'bg-emerald-50 text-emerald-700' :
      status === 'cancelled' ? 'bg-rose-50 text-rose-700' :
      status === 'ready' ? 'bg-sky-50 text-sky-700' : 'bg-amber-50 text-amber-700'
    }`}>{statusLabels[status]}</span>
  );

  return (
    <section className="w-full min-w-0 space-y-5">
      <PageHeader
        eyebrow="REWARD STORE"
        title="Penukaran Poin"
        description={isTrainee
          ? 'Tukarkan poin hasil misi menjadi hadiah dan benefit pilihan.'
          : 'Kelola katalog hadiah dan proses permintaan penukaran peserta.'}
      >
        {balance && (
          <div className="min-w-48 rounded-2xl border border-white/15 bg-white/10 px-5 py-4 text-left">
            <p className="text-xs font-semibold text-sky-100">SALDO TERSEDIA</p>
            <p className="mt-1 text-3xl font-extrabold tabular-nums">{points(balance.availablePoints)} <span className="text-base">Pts</span></p>
            {balance.netBalance < 0 && (
              <p className="mt-1 text-xs text-white/70">Poin baru akan menutup penalti tertunda.</p>
            )}
          </div>
        )}
      </PageHeader>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex rounded-xl border border-[#E4EAF0] bg-white p-1 shadow-sm">
          <button type="button" onClick={() => setTab('catalog')} className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold transition ${tab === 'catalog' ? 'bg-[#123B59] text-white' : 'text-[#6F7F8D] hover:bg-[#F4F6F8]'}`}>
            <ShoppingBag className="h-4 w-4" /> Katalog Hadiah
          </button>
          <button type="button" onClick={() => setTab('history')} className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold transition ${tab === 'history' ? 'bg-[#123B59] text-white' : 'text-[#6F7F8D] hover:bg-[#F4F6F8]'}`}>
            <Clock3 className="h-4 w-4" /> {isTrainee ? 'Riwayat Saya' : 'Permintaan'} <span className="rounded-full bg-white/15 px-2 py-0.5 text-xs">{redemptions.filter(item => item.status === 'pending').length}</span>
          </button>
        </div>
        {/* {canManage && tab === 'catalog' && !editingItem && (
          // <button type="button" onClick={openNewItem} className="inline-flex items-center gap-2 rounded-xl bg-[#123B59] px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-[#0D2F47]">
          //   <Plus className="h-4 w-4" /> Tambah Hadiah
          // </button>
        )} */}
      </div>

      {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{error}</div>}
      {notice && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">{notice}</div>}

      {loading ? (
        <div className="flex items-center justify-center gap-3 rounded-2xl border border-[#E4EAF0] bg-white p-12 text-sm font-semibold text-[#6F7F8D]">
          <LoaderCircle className="h-5 w-5 animate-spin" /> Memuat reward store...
        </div>
      ) : tab === 'catalog' ? (
        <>
          {canManage && (
            <form onSubmit={saveItem} className="rounded-2xl border border-[#E4EAF0] bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-bold text-[#123B59]">{editingItem ? 'Edit Hadiah' : 'Tambah Hadiah Baru'}</h2>
                {editingItem && <button type="button" onClick={openNewItem} className="rounded-lg p-2 text-[#6F7F8D] hover:bg-[#F4F6F8]" aria-label="Batal mengedit"><X className="h-4 w-4" /></button>}
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <label className="text-xs font-bold text-[#6F7F8D]">Nama hadiah
                  <input required maxLength={150} value={form.title} onChange={event => setForm({ ...form, title: event.target.value })} className="mt-1.5 w-full rounded-xl border border-[#DCE4EA] px-3 py-2.5 text-sm font-medium text-[#123B59] outline-none focus:border-[#4C83B5]" />
                </label>
                <label className="text-xs font-bold text-[#6F7F8D]">Kategori
                  <input required maxLength={64} value={form.category} onChange={event => setForm({ ...form, category: event.target.value })} className="mt-1.5 w-full rounded-xl border border-[#DCE4EA] px-3 py-2.5 text-sm font-medium text-[#123B59] outline-none focus:border-[#4C83B5]" />
                </label>
                <label className="text-xs font-bold text-[#6F7F8D]">Harga poin
                  <input required type="number" min={1} step={1} value={form.pointsCost} onChange={event => setForm({ ...form, pointsCost: Number(event.target.value) })} className="mt-1.5 w-full rounded-xl border border-[#DCE4EA] px-3 py-2.5 text-sm font-medium text-[#123B59] outline-none focus:border-[#4C83B5]" />
                </label>
                <label className="text-xs font-bold text-[#6F7F8D]">Stok
                  <input required type="number" min={0} step={1} value={form.stock} onChange={event => setForm({ ...form, stock: Number(event.target.value) })} className="mt-1.5 w-full rounded-xl border border-[#DCE4EA] px-3 py-2.5 text-sm font-medium text-[#123B59] outline-none focus:border-[#4C83B5]" />
                </label>
                <label className="text-xs font-bold text-[#6F7F8D] sm:col-span-2">Deskripsi
                  <textarea rows={2} value={form.description} onChange={event => setForm({ ...form, description: event.target.value })} className="mt-1.5 w-full resize-y rounded-xl border border-[#DCE4EA] px-3 py-2.5 text-sm font-medium text-[#123B59] outline-none focus:border-[#4C83B5]" />
                </label>
                <div className="text-xs font-bold text-[#6F7F8D] sm:col-span-2">
                  <p>Masukan gambar</p>
                  {invalidPreviewUrl && <span role="alert" className="mt-2 block font-medium text-rose-700">Format URL tidak valid. Gunakan tautan HTTP/HTTPS.</span>}
                  {previewImageUrl && (
                    <div className="mt-2 overflow-hidden rounded-xl border border-[#DCE4EA] bg-[#F4F6F8]">
                      {imagePreviewFailed
                        ? <p role="status" className="p-3 text-xs font-medium text-rose-700">Gambar tidak dapat dimuat. Pastikan tautan dapat diakses publik dan mengarah ke gambar.</p>
                        : <img src={previewImageUrl} alt="Pratinjau hadiah" onError={() => setImagePreviewFailed(true)} className="h-36 w-full object-contain" />}
                    </div>
                  )}
                  <input
                    ref={imageInputRef}
                    type="file"
                    accept="image/*"
                    onChange={event => setImageFile(event.target.files?.[0] || null)}
                    className="sr-only"
                    tabIndex={-1}
                  />
                  <button
                    type="button"
                    onClick={() => imageInputRef.current?.click()}
                    className="mt-2 inline-flex items-center gap-2 rounded-lg border border-[#DCE4EA] bg-white px-3 py-2 text-xs font-semibold text-[#123B59] transition hover:bg-[#F4F6F8] focus:outline-none focus:ring-2 focus:ring-[#4C83B5] focus:ring-offset-1"
                  >
                    <ImagePlus className="h-4 w-4" />
                    Pilih gambar
                  </button>
                  {imageFile && <span className="ml-2 font-medium text-[#4C83B5]">{imageFile.name}</span>}
                </div>
                <label className="flex items-center gap-2 self-end pb-2 text-sm font-semibold text-[#123B59]">
                  <input type="checkbox" checked={form.isActive} onChange={event => setForm({ ...form, isActive: event.target.checked })} className="h-4 w-4 accent-[#123B59]" />
                  Tampilkan di katalog
                </label>
              </div>
              <div className="mt-4 flex justify-end">
                <button disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-[#123B59] px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60">
                  {saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  {uploadingImage ? 'Mengunggah gambar...' : saving ? 'Menyimpan...' : editingItem ? 'Simpan Perubahan' : 'Simpan Hadiah'}
                </button>
              </div>
            </form>
          )}

          {items.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#C7D3DD] bg-white p-12 text-center text-sm text-[#6F7F8D]">
              <Gift className="mx-auto mb-3 h-8 w-8 text-[#4C83B5]" />
              Belum ada hadiah di katalog.
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {items.map(item => {
                const shortfall = Math.max(0, item.pointsCost - (balance?.availablePoints || 0));
                const unavailable = !item.isActive || item.stock < 1;
                return (
                  <article key={item.id} className="overflow-hidden rounded-2xl border border-[#E4EAF0] bg-white shadow-sm">
                    <div className="relative flex h-48 items-center justify-center bg-[#EAF2F8]">
                      {item.imageUrl ? <img src={item.imageUrl} alt={item.title} className="h-full w-full object-cover" /> : <Gift className="h-12 w-12 text-[#4C83B5]" />}
                      <span className="absolute left-3 top-3 rounded-full bg-white/95 px-3 py-1 text-xs font-bold text-[#123B59]">{item.category}</span>
                      {item.stock < 1 && <span className="absolute bottom-3 right-3 rounded-full bg-rose-600 px-3 py-1 text-xs font-bold text-white">Stok Habis</span>}
                      {!item.isActive && <span className="absolute bottom-3 right-3 rounded-full bg-slate-700 px-3 py-1 text-xs font-bold text-white">Nonaktif</span>}
                    </div>
                    <div className="space-y-3 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h2 className="font-extrabold text-[#123B59]">{item.title}</h2>
                          <p className="mt-1 line-clamp-2 min-h-10 text-sm leading-5 text-[#6F7F8D]">{item.description || 'Hadiah reward store PSA.'}</p>
                        </div>
                        <span className="shrink-0 rounded-xl bg-[#EAF2F8] px-3 py-2 text-sm font-extrabold text-[#123B59]">{points(item.pointsCost)} Pts</span>
                      </div>
                      <div className="flex items-center justify-between border-t border-[#EEF1F4] pt-3">
                        <span className={`text-xs font-semibold ${item.stock ? 'text-[#6F7F8D]' : 'text-rose-600'}`}>
                          {item.stock > 0 ? `Tersedia ${item.stock} pcs` : 'Stok Habis'}
                        </span>
                        {canManage ? (
                          <div className="flex items-center gap-2">
                            <button type="button" onClick={() => openEditItem(item)} className="inline-flex items-center gap-1.5 rounded-lg border border-[#DCE4EA] px-3 py-2 text-xs font-bold text-[#123B59] hover:bg-[#F4F6F8]">
                              <Pencil className="h-3.5 w-3.5" /> Edit
                            </button>
                            <button type="button" disabled={saving} onClick={() => void deleteItem(item)} className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-50 disabled:opacity-60" aria-label={`Hapus hadiah ${item.title}`}>
                              <Trash2 className="h-3.5 w-3.5" /> Hapus
                            </button>
                          </div>
                        ) : (
                          <button type="button" disabled={unavailable || shortfall > 0} onClick={() => setSelectedReward(item)} className="rounded-xl bg-[#123B59] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#0D2F47] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600">
                            {item.stock < 1 ? 'Stok Habis' : !item.isActive ? 'Tidak Tersedia' : shortfall ? `Butuh ${points(shortfall)} Poin Lagi` : 'Tukar Sekarang'}
                          </button>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[#E4EAF0] bg-white shadow-sm">
          {redemptions.length === 0 ? (
            <div className="p-12 text-center text-sm text-[#6F7F8D]">Belum ada riwayat penukaran.</div>
          ) : (
            <div className="divide-y divide-[#EEF1F4]">
              {redemptions.map(redemption => (
                <article key={redemption.id} className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-extrabold text-[#123B59]">{redemption.rewardTitle}</h2>
                      {statusBadge(redemption.status)}
                    </div>
                    <p className="mt-1 text-sm text-[#6F7F8D]">
                      {isTrainee ? `Ditukar ${redemption.redeemedAt ? new Date(redemption.redeemedAt).toLocaleString('id-ID') : ''}` : `Peserta: ${redemption.traineeName}`}
                      {' · '}{points(redemption.pointsSpent)} poin
                    </p>
                    {redemption.notes && <p className="mt-1 text-xs text-[#6F7F8D]">Catatan: {redemption.notes}</p>}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {isTrainee && redemption.status !== 'cancelled' && (
                      <span className="rounded-lg border border-dashed border-[#4C83B5] bg-[#F4F8FB] px-3 py-2 text-xs font-extrabold tracking-wider text-[#123B59]">
                        Kode: {redemption.pickupCode}
                      </span>
                    )}
                    {canManage && redemption.status === 'pending' && (
                      <>
                        <button type="button" onClick={() => startStatusChange(redemption, 'ready')} className="rounded-lg bg-sky-600 px-3 py-2 text-xs font-bold text-white hover:bg-sky-700">Siap Diambil</button>
                        <button type="button" onClick={() => startStatusChange(redemption, 'cancelled')} className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-50">Batalkan</button>
                      </>
                    )}
                    {canManage && redemption.status === 'ready' && (
                      <>
                        <button type="button" onClick={() => startStatusChange(redemption, 'completed')} className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700"><PackageCheck className="h-4 w-4" /> Selesai</button>
                        <button type="button" onClick={() => startStatusChange(redemption, 'cancelled')} className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-50">Batalkan</button>
                      </>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      )}

      {selectedReward && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/50 p-4" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setSelectedReward(null); }}>
          <div role="dialog" aria-modal="true" aria-labelledby="redeem-title" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h2 id="redeem-title" className="text-lg font-extrabold text-[#123B59]">Konfirmasi Penukaran</h2>
            <p className="mt-3 text-sm leading-6 text-[#6F7F8D]">Apakah Anda yakin ingin menukar <strong className="text-[#123B59]">{points(selectedReward.pointsCost)} poin</strong> untuk <strong className="text-[#123B59]">{selectedReward.title}</strong>?</p>
            <p className="mt-3 rounded-xl bg-[#F4F6F8] p-3 text-sm font-semibold text-[#123B59]">Perkiraan saldo setelah penukaran: {points(Math.max(0, (balance?.availablePoints || 0) - selectedReward.pointsCost))} Pts</p>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" disabled={saving} onClick={() => setSelectedReward(null)} className="rounded-xl border border-[#DCE4EA] px-4 py-2.5 text-sm font-bold text-[#123B59]">Kembali</button>
              <button type="button" disabled={saving} onClick={() => void redeem()} className="rounded-xl bg-[#123B59] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60">{saving ? 'Memproses...' : 'Ya, Tukar'}</button>
            </div>
          </div>
        </div>
      )}

      {pendingStatus && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/50 p-4">
          <div role="dialog" aria-modal="true" aria-labelledby="status-title" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h2 id="status-title" className="text-lg font-extrabold text-[#123B59]">Ubah Status Penukaran</h2>
            <p className="mt-2 text-sm text-[#6F7F8D]">{pendingStatus.redemption.rewardTitle} · {statusLabels[pendingStatus.status]}</p>
            {pendingStatus.status === 'cancelled' && <p className="mt-3 rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-800">Poin peserta dan stok hadiah akan dikembalikan secara otomatis. Pembatalan tidak dapat dibatalkan.</p>}
            <label className="mt-4 block text-xs font-bold text-[#6F7F8D]">Catatan
              <textarea rows={3} value={statusNotes} onChange={event => setStatusNotes(event.target.value)} className="mt-1.5 w-full rounded-xl border border-[#DCE4EA] px-3 py-2.5 text-sm font-medium text-[#123B59] outline-none focus:border-[#4C83B5]" placeholder="Catatan untuk peserta (opsional)" />
            </label>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" disabled={saving} onClick={() => setPendingStatus(null)} className="rounded-xl border border-[#DCE4EA] px-4 py-2.5 text-sm font-bold text-[#123B59]">Kembali</button>
              <button type="button" disabled={saving} onClick={() => void updateStatus()} className={`rounded-xl px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60 ${pendingStatus.status === 'cancelled' ? 'bg-rose-600' : 'bg-[#123B59]'}`}>{saving ? 'Menyimpan...' : 'Konfirmasi'}</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
