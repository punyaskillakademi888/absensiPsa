import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import psaLogo from '../../assets/2D PSA LOGO.png';
import {
  KeyRound,
  Eye,
  EyeOff,
  AlertCircle,
  ArrowRight,
  Lock,
  Database,
  Loader2
} from 'lucide-react';

export const LoginView: React.FC = () => {
  const { loginWithCode, tidbStatus } = useApp();

  // Trainee / Mentor state
  const [loginCode, setLoginCode] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    if (!loginCode.trim()) {
      setErrorMessage('Silakan masukkan 8-digit kode login atau NIM Anda.');
      return;
    }
    if (!password.trim()) {
      setErrorMessage('Silakan masukkan password akun Anda.');
      return;
    }
    setIsSubmitting(true);
    try {
      const result = await loginWithCode(loginCode.trim(), password);
      if (!result.success) {
        setErrorMessage(result.message);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal memproses login ke database.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F4F6F8] flex flex-col justify-center items-center p-4 sm:p-6 font-sans">
      <div className="w-full max-w-md space-y-5">
        {/* App Branding */}
        <div className="text-center space-y-2">
          <div className="login-brand-lockup flex items-center justify-center gap-3.5 rounded-2xl bg-[#123B59] px-5 py-4 shadow-lg shadow-[#123B59]/15">
            <img src={psaLogo} alt="Logo PSA" className="login-brand-logo" />
            <div className="login-brand-copy text-left">
              <div>PSA</div>
              <p>Punya Skill Akademi</p>
            </div>
          </div>
          <p className="text-[10px] font-bold tracking-[.16em] text-[#4C83B5] uppercase pt-1">
            PRESENSI MAGANG HARIAN
          </p>
          <p className="text-xs text-[#6F7F8D]">
            Sistem Autentikasi JWT 3-Role (Admin &middot; Mentor &middot; Peserta)
          </p>

          {/* Database & JWT Status Chip */}
          <div className="inline-flex max-w-full flex-wrap items-center justify-center gap-2 px-3 py-1 bg-white rounded-2xl sm:rounded-full border border-[#DCE4EC] text-[11px] shadow-xs">
            <Database className="w-3.5 h-3.5 text-[#123B59]" />
            <span className="font-semibold text-[#123B59]">TiDB Cloud</span>
            <span className={`inline-flex items-center gap-1 font-mono text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${
              tidbStatus === 'connected'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : tidbStatus === 'connecting'
                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                  : 'bg-rose-50 text-rose-700 border-rose-200'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${
                tidbStatus === 'connected' ? 'bg-emerald-500 animate-pulse' : tidbStatus === 'connecting' ? 'bg-amber-500 animate-pulse' : 'bg-rose-500'
              }`}></span>
              {tidbStatus === 'connected' ? 'Connected' : tidbStatus}
            </span>
            <span className="text-[#A9B8C5]">&bull;</span>
            <span className="font-mono text-[10px] font-bold text-[#4C83B5] bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
              JWT Enabled
            </span>
          </div>
        </div>

        {tidbStatus === 'offline' && (
          <div className="p-3.5 rounded-xl border border-[#E3C4D0] bg-[#FCF3F6] text-xs text-[#B84469] font-medium">
            Backend belum terhubung. Buka <span className="font-mono">/api/health</span> pada domain Vercel ini, lalu pastikan environment JWT_SECRET dan TiDB sudah diisi lalu Redeploy.
          </div>
        )}

        {/* Surface Card Box */}
        <div className="surface rounded-2xl p-6 sm:p-7 shadow-xl space-y-5 bg-white border border-[#E4EAF0]">
          <div className="flex items-center gap-2 text-xs text-[#6F7F8D]">
            <KeyRound className="w-4 h-4 text-[#4C83B5]" />
            <span>Masuk dengan kode akun atau NIM. Role diverifikasi otomatis.</span>
          </div>

          {/* Error Notification */}
          {errorMessage && (
            <div className="p-3.5 rounded-xl border border-[#E3C4D0] bg-[#FCF3F6] flex items-start gap-2.5 text-xs text-[#B84469] font-medium">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-[#D95B83]" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Satu form untuk semua role; role berasal dari hasil verifikasi akun. */}
          {
            <form onSubmit={handleCodeSubmit} className="space-y-4 text-xs">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="font-bold text-[#123B59]">
                    Kode Login 8 Digit atau NIM
                  </label>
                  <span className="text-[10px] text-[#6F7F8D]">Semua role</span>
                </div>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-[#6F7F8D] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    maxLength={32}
                    value={loginCode}
                    onChange={e => setLoginCode(e.target.value)}
                    placeholder="Masukkan kode login 8 digit atau NIM"
                    className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-[#E4EAF0] bg-[#F8FAFB] text-[#123B59] font-mono text-sm tracking-wider outline-none focus:border-[#4C83B5] focus:ring-2 focus:ring-[#4C83B5]/20"
                    autoFocus
                  />
                </div>
                <p className="text-[11px] text-[#6F7F8D] mt-1">
                  Diverifikasi via database TiDB &amp; token JWT otomatis diterbitkan.
                </p>
              </div>

              <div>
                <label className="block font-bold text-[#123B59] mb-1.5">
                  Password Akun
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-[#6F7F8D] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Masukkan password akun Anda"
                    className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-[#E4EAF0] bg-[#F8FAFB] text-[#123B59] outline-none focus:border-[#4C83B5] focus:ring-2 focus:ring-[#4C83B5]/20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#6F7F8D] hover:text-[#123B59] cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3.5 rounded-xl bg-[#123B59] hover:bg-[#0D2F47] text-white font-bold transition cursor-pointer shadow-md flex items-center justify-center gap-2 hover:-translate-y-0.5 active:translate-y-0 text-sm disabled:opacity-75 disabled:pointer-events-none"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Memverifikasi TiDB &amp; JWT...</span>
                  </>
                ) : (
                  <>
                    <span>Masuk ke Sistem</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          }
        </div>

        {/* Footer info */}
        <div className="text-center text-xs text-[#6F7F8D] space-y-1">
          <p className="font-medium text-[#123B59]">
            Presensi Magang Harian &middot; Punya Skill Akademi 2026
          </p>
          <p className="text-[11px] text-[#8C9AA8]">
            Database: TiDB AWS Cloud ap-southeast-1 &middot; JWT HMAC-SHA256
          </p>
        </div>
      </div>
    </div>
  );
};
