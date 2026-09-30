import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import {
  LayoutDashboard,
  CalendarCheck,
  FileSpreadsheet,
  Users,
  FileText,
  Sliders,
  CheckCircle2,
  X,
  LogOut,
  Trophy,
  Target,
  Clock,
  BookOpen,
  UserRound,
  Sun,
  Moon,
  Monitor,
  Check
} from 'lucide-react';
import { INDONESIAN_DAYS, INDONESIAN_MONTHS, getTodayDateString } from '../utils/dateUtils';
import { getMentorKejuruanIds } from '../utils/mentorKejuruan';
import psaLogo from '../assets/2D PSA LOGO.png';
import { ThemePreference, useTheme } from '../context/ThemeContext';

interface SidebarProps {
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  mobileOpen,
  onCloseMobile
}) => {
  const {
    currentUser,
    users,
    kejuruanList,
    activeTab,
    setActiveTab,
    leaveRequests,
    attendanceRecords,
    missionSubmissions,
    dailyReports,
    logout
  } = useApp();
  const { preference, resolvedTheme, setPreference } = useTheme();
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState<string>('');
  const [currentDateString, setCurrentDateString] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const seconds = String(now.getSeconds()).padStart(2, '0');
      setCurrentTime(`${hours}.${minutes}.${seconds}`);

      const dayName = INDONESIAN_DAYS[now.getDay()];
      const day = now.getDate();
      const monthName = INDONESIAN_MONTHS[now.getMonth()];
      const year = now.getFullYear();
      setCurrentDateString(`${dayName}, ${day} ${monthName} ${year}`);
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!mobileOpen) return;

    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseMobile();
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [mobileOpen]);

  const todayStr = getTodayDateString();
  const mentorKejuruanIds = getMentorKejuruanIds(currentUser, kejuruanList);
  const mentorProgramNames = kejuruanList
    .filter(program => mentorKejuruanIds.includes(program.id))
    .map(program => program.name.trim().toLowerCase());
  const mentorTraineeIds = new Set(users
    .filter(user => user.role === 'trainee' && (
      mentorKejuruanIds.includes(user.kejuruanId || '') ||
      mentorProgramNames.includes(user.kejuruanName?.trim().toLowerCase() || '')
    ))
    .map(user => user.id));

  // Pending counts
  const pendingLeavesCount = leaveRequests.filter(l => {
    if (currentUser.role === 'admin') return l.status === 'pending';
    if (currentUser.role === 'mentor') return l.status === 'pending' && mentorKejuruanIds.includes(l.kejuruanId);
    return false;
  }).length;

  const pendingMissionsCount = missionSubmissions.filter(s => {
    if (currentUser.role === 'admin') return s.status === 'pending';
    if (currentUser.role === 'mentor') return s.status === 'pending' && mentorKejuruanIds.includes(s.kejuruanId);
    return false;
  }).length;

  const pendingMentorVerifications = attendanceRecords.filter(r => {
    return r.date === todayStr && r.userRole === 'mentor' && r.verificationStatus === 'pending';
  }).length;

  const pendingTraineeVerifications = attendanceRecords.filter(r => {
    return (
      r.date === todayStr &&
      (mentorKejuruanIds.includes(r.kejuruanId) ||
        mentorProgramNames.includes(r.kejuruanName?.trim().toLowerCase() || '') ||
        mentorTraineeIds.has(r.userId)) &&
      (r.userRole === 'trainee' || !r.userRole) &&
      r.verificationStatus === 'pending'
    );
  }).length;

  const pendingDailyReportsCount = dailyReports.filter(r => {
    if (currentUser.role === 'admin') return r.status === 'pending';
    if (currentUser.role === 'mentor') return r.status === 'pending' && mentorKejuruanIds.includes(r.kejuruanId);
    return false;
  }).length;

  const roleLabel =
    currentUser.role === 'admin'
      ? 'Administrator'
      : currentUser.role === 'mentor'
      ? 'Instruktur / Mentor'
      : 'Peserta Magang';

  const navItems = () => {
    if (currentUser.role === 'admin') {
      return [
        { id: 'verifikasi-mentor', label: 'Verifikasi Mentor', icon: CheckCircle2, badge: pendingMentorVerifications },
        { id: 'laporan-harian', label: 'Laporan Harian', icon: BookOpen, badge: pendingDailyReportsCount },
        { id: 'misi', label: 'Misi & Tugas Kejuruan', icon: Target, badge: pendingMissionsCount },
        { id: 'hall-of-fame', label: 'Hall of Fame Mentor', icon: Trophy },
        { id: 'rekap', label: 'Rekapitulasi Presensi', icon: FileSpreadsheet },
        { id: 'peserta', label: 'Peserta & Kejuruan', icon: Users },
        { id: 'izin', label: 'Izin & Sakit', icon: FileText, badge: pendingLeavesCount },
        { id: 'pengaturan', label: 'Pengaturan Sistem', icon: Sliders },
        { id: 'profil', label: 'Profil Saya', icon: UserRound }
      ];
    } else if (currentUser.role === 'mentor') {
      return [
        { id: 'presensi', label: 'Verifikasi Peserta', icon: CalendarCheck, badge: pendingTraineeVerifications },
        { id: 'laporan-harian', label: 'Laporan Harian', icon: BookOpen, badge: pendingDailyReportsCount },
        { id: 'misi', label: 'Misi Kejuruan', icon: Target, badge: pendingMissionsCount },
        { id: 'hall-of-fame', label: 'Hall of Fame', icon: Trophy },
        { id: 'rekap', label: 'Rekap Bulanan', icon: FileSpreadsheet },
        { id: 'izin', label: 'Verifikasi Izin', icon: FileText, badge: pendingLeavesCount },
        { id: 'profil', label: 'Profil Saya', icon: UserRound }
      ];
    } else {
      return [
        { id: 'dashboard', label: 'Dashboard Presensi', icon: LayoutDashboard },
        { id: 'laporan-harian', label: 'Laporan Harian', icon: BookOpen },
        { id: 'misi', label: 'Misi Kejuruan', icon: Target },
        { id: 'hall-of-fame', label: 'Hall of Fame', icon: Trophy },
        { id: 'rekap', label: 'Rekap Kehadiran', icon: FileSpreadsheet },
        { id: 'izin', label: 'Pengajuan Izin', icon: FileText },
        { id: 'profil', label: 'Profil Saya', icon: UserRound }
      ];
    }
  };

  const handleNavClick = (tabId: string) => {
    setActiveTab(tabId);
    onCloseMobile();
  };

  const sidebarInner = (
    <div className="sidebar-inner flex h-full w-full min-w-0 select-none flex-col overflow-hidden bg-[#123B59] p-5 text-white">
      {/* Brand Header */}
      <div className="sidebar-brand-header relative z-40 -mx-5 -mt-5 mb-0 flex min-h-[88px] shrink-0 items-center bg-[#123B59] px-5 pb-1 pt-3">
        <button
          type="button"
          onClick={() =>
            handleNavClick(
              currentUser.role === 'admin'
                ? 'verifikasi-mentor'
                : currentUser.role === 'mentor'
                ? 'presensi'
                : 'dashboard'
            )
          }
          className="brand-lockup flex min-w-0 items-center gap-2.5 text-left hover:opacity-90 transition cursor-pointer group"
          title="Ke Halaman Utama"
        >
          <img src={psaLogo} alt="Logo PSA" className="sidebar-logo" />
          <span className="brand-copy">
            <strong>PSA</strong>
            <small>Punya Skill Akademi</small>
          </span>
        </button>

        <div className="sidebar-header-controls absolute right-5 top-3 z-10 flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => setThemeMenuOpen(open => !open)}
            className="sidebar-theme-toggle rounded-lg p-2 text-white/75 transition hover:bg-white/10 hover:text-white cursor-pointer"
            aria-label="Atur tema tampilan"
            aria-expanded={themeMenuOpen}
            title="Pengaturan tema"
          >
            {resolvedTheme === 'dark' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
          </button>

          {/* Close button for mobile drawer */}
          <button
            type="button"
            onClick={onCloseMobile}
            className="lg:hidden p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10 cursor-pointer"
            aria-label="Tutup Menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {themeMenuOpen && (
          <div className="theme-menu absolute right-5 top-[calc(100%+8px)] z-50 w-52 rounded-xl border border-white/15 bg-[#0D2F47] p-1.5 shadow-2xl">
            <p className="px-2.5 pb-1.5 pt-1 text-[9px] font-bold tracking-[.12em] text-[#A9C7DE]">TEMA TAMPILAN</p>
            {([
              ['light', 'Terang', Sun],
              ['dark', 'Gelap', Moon],
              ['system', 'Ikuti Sistem', Monitor]
            ] as const).map(([value, label, Icon]) => (
              <button
                key={value}
                type="button"
                onClick={() => {
                  setPreference(value as ThemePreference);
                  setThemeMenuOpen(false);
                }}
                className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition cursor-pointer ${
                  preference === value ? 'bg-white/15 text-white' : 'text-white/70 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0 text-[#A9C7DE]" />
                <span className="min-w-0 flex-1">
                  <span className="block text-[11px] font-bold">{label}</span>
                </span>
                {preference === value && <Check className="h-3.5 w-3.5 shrink-0 text-[#A9C7DE]" />}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="sidebar-scroll-area flex min-h-0 flex-1 flex-col overflow-y-auto">
      {/* User Section / Card */}
      <section className="mt-2 rounded-2xl border border-white/10 bg-white/[.07] p-3.5">
        <div className="flex items-center gap-3">
          {currentUser.avatar ? (
            <img
              src={currentUser.avatar}
              alt={currentUser.name}
              className="h-10 w-10 rounded-xl object-cover shrink-0 border border-white/20"
            />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#4C83B5] font-bold text-white shrink-0">
              {currentUser.name.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-white">{currentUser.name}</p>
            <p className="truncate text-xs text-white/55">
              {currentUser.kejuruanName || (currentUser.role === 'admin' ? 'Pusat Pelatihan' : 'Kejuruan Vokasi')}
            </p>
          </div>
        </div>

        <div className="mt-3 flex flex-col items-start gap-1.5 border-t border-white/10 pt-3">
          <span className="text-[9px] font-bold tracking-[.13em] text-[#A9C7DE]">PERAN AKTIF</span>
          <span className="inline-flex whitespace-nowrap rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-bold text-white">
            {roleLabel}
          </span>
        </div>

        <div className="mt-2.5 pt-2 border-t border-white/10 flex items-center justify-between text-[10px] font-mono">
          <span className="flex items-center gap-1.5 text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            TiDB Cloud
          </span>
          <span className="px-1.5 py-0.5 rounded bg-white/10 text-[#A9C7DE] text-[9px] font-bold">
            JWT: {currentUser.role.toUpperCase()}
          </span>
        </div>
      </section>

      {/* Navigation Menu */}
      <nav className="mt-5 space-y-1.5 flex-1" aria-label="Menu dashboard">
        {navItems().map(item => {
          const isActive =
            activeTab === item.id ||
            (currentUser.role === 'mentor' && item.id === 'presensi' && activeTab === 'dashboard') ||
            (currentUser.role === 'admin' && item.id === 'verifikasi-mentor' && activeTab === 'dashboard');
          const Icon = item.icon;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleNavClick(item.id)}
              className={`side-nav-item w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-left text-sm font-semibold transition cursor-pointer ${
                isActive ? 'is-active' : ''
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <Icon className={`side-icon h-4 w-4 shrink-0 ${isActive ? 'text-[#A9C7DE]' : ''}`} />
                <span className="truncate">{item.label}</span>
              </div>

              {item.badge !== undefined && item.badge > 0 && (
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-[#D95B83] text-white shrink-0">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Logout Footer */}
      <div className="mt-3 pt-3 border-t border-white/10 flex items-center justify-between text-xs text-white/60">
        {currentUser.loginCode && (
          <span className="font-mono text-[10px]">
            Kode: <strong className="text-white">{currentUser.loginCode}</strong>
          </span>
        )}
        <button
          type="button"
          onClick={() => {
            logout();
            onCloseMobile();
          }}
          className="inline-flex items-center gap-1.5 text-white/70 hover:text-[#D95B83] transition cursor-pointer ml-auto text-xs font-medium"
          title="Keluar dari akun"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Keluar</span>
        </button>
      </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Fixed Sidebar (Matching style.html .desktop-sidebar) */}
      <aside
        className="hidden lg:flex fixed left-5 top-5 bottom-5 w-[240px] bg-[#123B59] rounded-[20px] shadow-[0_18px_42px_rgba(13,47,71,0.17)] z-30 overflow-hidden"
        aria-label="Navigasi utama"
      >
        {sidebarInner}
      </aside>

      {/* Mobile Drawer Overlay */}
      <div
        className={`mobile-drawer lg:hidden fixed inset-0 z-50 flex ${mobileOpen ? 'is-open' : ''}`}
        aria-hidden={!mobileOpen}
      >
        <div
          className="mobile-drawer-backdrop fixed inset-0"
          onClick={onCloseMobile}
        />
        <div className="mobile-drawer-panel relative z-10 h-full w-[min(300px,calc(100vw-2rem))] overflow-hidden rounded-r-3xl shadow-2xl">
          {sidebarInner}
        </div>
      </div>
    </>
  );
};
