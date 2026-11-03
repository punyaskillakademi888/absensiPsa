import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { MobileHeaderStatus } from '../MobileHeaderStatus';
import { api } from '../../services/api';
import { UserRound, LockKeyhole, CheckCircle2, BadgeCheck } from 'lucide-react';

export const ProfileView: React.FC = () => {
  const { currentUser, changePassword, updateMyAvatar } = useApp();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordStatus, setPasswordStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [avatarStatus, setAvatarStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setAvatarStatus({ type: 'error', message: 'Format file tidak valid. Silakan pilih gambar.' });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setAvatarStatus({ type: 'error', message: 'Ukuran foto profil maksimal 5 MB.' });
      return;
    }

    try {
      setIsUploadingAvatar(true);
      const uploadResult = await api.uploadImageToCloudinary({
        file,
        folder: 'hadirku/profile',
      });

      if (!uploadResult.success || !uploadResult.url) {
        throw new Error(uploadResult.message || 'Gagal mengupload foto profil.');
      }

      const saveResult = await updateMyAvatar(uploadResult.url);
      setAvatarStatus({
        type: saveResult.success ? 'success' : 'error',
        message: saveResult.success ? 'Foto profil berhasil diperbarui.' : saveResult.message,
      });

      if (saveResult.success) {
        event.target.value = '';
      }
    } catch (error: any) {
      setAvatarStatus({ type: 'error', message: error.message || 'Gagal mengupload foto profil.' });
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordStatus({ type: 'error', message: 'Semua kolom kata sandi wajib diisi.' });
      return;
    }

    if (!/^\d{8}$/.test(newPassword)) {
      setPasswordStatus({ type: 'error', message: 'Kata sandi baru harus 8 digit angka.' });
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordStatus({ type: 'error', message: 'Konfirmasi kata sandi baru tidak cocok.' });
      return;
    }

    const result = await changePassword(currentPassword, newPassword);
    setPasswordStatus({
      type: result.success ? 'success' : 'error',
      message: result.message,
    });

    if (result.success) {
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="pb-4 border-b border-[#E4EAF0]">
        <p className="text-[10px] font-bold tracking-[.14em] text-[#4C83B5] uppercase">
          PROFIL PENGGUNA
        </p>
        <h1 className="mt-1 text-2xl lg:text-3xl font-bold tracking-tight text-[#123B59]">
          Informasi Akun & Keamanan
        </h1>
        <p className="text-xs text-[#6F7F8D] mt-1">
          Kelola data diri Anda dan ubah kata sandi untuk semua role pengguna.
        </p>
        <MobileHeaderStatus />
      </div>

      <div className="surface rounded-2xl p-5 sm:p-6 border border-[#E4EAF0]">
        <div className="flex flex-col sm:flex-row items-start gap-4">
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-[#EAF2F8] text-[#123B59]">
            {currentUser.avatar ? (
              <img src={currentUser.avatar} alt={currentUser.name} className="h-20 w-20 rounded-2xl object-cover" />
            ) : (
              <UserRound className="h-8 w-8" />
            )}
          </div>

          <div className="flex-1">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-[#D9E4EE] bg-[#F8FAFB] px-3 py-2 text-xs font-bold text-[#123B59] hover:bg-[#EEF6FB]">
              <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
              <UserRound className="h-4 w-4" />
              {isUploadingAvatar ? 'Mengupload...' : 'Ubah Foto Profil'}
            </label>

            {avatarStatus && (
              <p className={`mt-2 text-xs font-semibold ${avatarStatus.type === 'success' ? 'text-[#1C7C54]' : 'text-[#B84469]'}`}>
                {avatarStatus.message}
              </p>
            )}
          </div>

          <div className="flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-2xl font-bold text-[#123B59]">{currentUser.name}</h2>
              <span className="rounded-full bg-[#EEF6FB] px-2.5 py-1 text-[10px] font-bold text-[#28618F] uppercase tracking-[.08em]">
                {currentUser.role}
              </span>
            </div>

            <div className="grid grid-cols-1 gap-3 text-xs text-[#6F7F8D]">
              <div className="flex items-center gap-2 rounded-xl bg-[#F8FAFB] border border-[#E4EAF0] px-3 py-2">
                <BadgeCheck className="h-4 w-4 text-[#4C83B5]" />
                <span>{currentUser.nim || currentUser.loginCode || 'No ID'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="surface rounded-2xl p-5 sm:p-6 border border-[#E4EAF0]">
        <div className="flex items-center gap-2 border-b border-[#E4EAF0] pb-3 mb-4">
          <span className="w-8 h-8 rounded-xl bg-[#EAF2F8] text-[#4C83B5] flex items-center justify-center">
            <LockKeyhole className="w-4 h-4" />
          </span>
          <h2 className="text-base font-bold text-[#123B59]">
            Ubah Kata Sandi
          </h2>
        </div>

        <form onSubmit={handlePasswordSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-[#123B59] font-bold mb-1.5 text-xs">
              Kata sandi lama
            </label>
            <input
              type="password"
              value={currentPassword}
              onChange={e => setCurrentPassword(e.target.value)}
              className="w-full p-2.5 rounded-xl border border-[#E4EAF0] bg-[#F8FAFB] text-[#123B59] font-bold outline-none focus:border-[#4C83B5]"
              placeholder="Masukkan sandi lama"
            />
          </div>

          <div>
            <label className="block text-[#123B59] font-bold mb-1.5 text-xs">
              Kata sandi baru
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              className="w-full p-2.5 rounded-xl border border-[#E4EAF0] bg-[#F8FAFB] text-[#123B59] font-bold outline-none focus:border-[#4C83B5]"
              placeholder="8 digit angka"
            />
          </div>

          <div>
            <label className="block text-[#123B59] font-bold mb-1.5 text-xs">
              Konfirmasi sandi baru
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              className="w-full p-2.5 rounded-xl border border-[#E4EAF0] bg-[#F8FAFB] text-[#123B59] font-bold outline-none focus:border-[#4C83B5]"
              placeholder="Ulangi sandi baru"
            />
          </div>

          <div className="md:col-span-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-xl bg-[#123B59] hover:bg-[#0D2F47] text-white px-4 py-2.5 text-xs font-bold transition"
            >
              <LockKeyhole className="w-4 h-4" />
              Ganti Kata Sandi
            </button>

            {passwordStatus && (
              <p className={`text-xs font-semibold ${passwordStatus.type === 'success' ? 'text-[#1C7C54]' : 'text-[#B84469]'}`}>
                {passwordStatus.message}
              </p>
            )}
          </div>
        </form>
      </div>

      {passwordStatus?.type === 'success' && (
        <div className="p-3.5 bg-[#EEF6FB] border border-[#C8DCEB] text-[#123B59] rounded-2xl text-xs font-bold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-[#4C83B5] shrink-0" />
          <span>Kata sandi berhasil diperbarui.</span>
        </div>
      )}
    </div>
  );
};
