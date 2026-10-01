import React, { useState, useEffect } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { ThemeProvider } from './context/ThemeContext';
import { Sidebar } from './components/Sidebar';
import { AdminDashboard } from './components/Dashboard/AdminDashboard';
import { MentorDashboard } from './components/Dashboard/MentorDashboard';
import { TraineeDashboard } from './components/Dashboard/TraineeDashboard';
import { MonthlyRecapView } from './components/Recap/MonthlyRecapView';
import { LeaveManagementView } from './components/Leave/LeaveManagementView';
import { TraineeManagementView } from './components/Trainee/TraineeManagementView';
import { SettingsView } from './components/Settings/SettingsView';
import { ProfileView } from './components/Profile/ProfileView';
import { LoginView } from './components/Auth/LoginView';
import { MissionManagementView } from './components/Missions/MissionManagementView';
import { HallOfFameView } from './components/HallOfFame/HallOfFameView';
import { MentorHallOfFameView } from './components/HallOfFame/MentorHallOfFameView';
import { DailyReportView } from './components/DailyReport/DailyReportView';
import { HeaderStatusContext } from './components/MobileHeaderStatus';
import psaLogo from './assets/2D PSA LOGO.png';
import {
  Menu,
  Clock,
  LayoutDashboard,
  CalendarCheck,
  FileText,
  UserRound,
  FileSpreadsheet,
} from 'lucide-react';
import { INDONESIAN_DAYS, INDONESIAN_MONTHS } from './utils/dateUtils';

const MainLayout: React.FC = () => {
  const { currentUser, activeTab, setActiveTab, isAuthenticated, authReady } = useApp();

  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [liveClock, setLiveClock] = useState('00.00.00');
  const [headerDate, setHeaderDate] = useState('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, '0');
      setLiveClock(`${pad(now.getHours())}.${pad(now.getMinutes())}.${pad(now.getSeconds())}`);

      const dayName = INDONESIAN_DAYS[now.getDay()];
      const day = now.getDate();
      const monthName = INDONESIAN_MONTHS[now.getMonth()];
      const year = now.getFullYear();
      setHeaderDate(`${dayName}, ${day} ${monthName} ${year}`);
    };

    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  if (!authReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFB] text-[#123B59]">
        <div className="flex items-center gap-3 rounded-2xl border border-[#E4EAF0] bg-white px-5 py-4 shadow-sm">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-[#4C83B5] border-t-transparent" />
          <span className="text-sm font-semibold">Memeriksa sesi login...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginView />;
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        if (currentUser.role === 'admin') {
          return <AdminDashboard />;
        } else if (currentUser.role === 'mentor') {
          return <MentorDashboard />;
        } else {
          return <TraineeDashboard />;
        }

      case 'verifikasi-mentor':
        return <AdminDashboard />;

      case 'presensi':
        if (currentUser.role === 'mentor') {
          return <MentorDashboard />;
        }
        return <TraineeDashboard />;

      case 'misi':
        if (currentUser.role === 'admin') return <AdminDashboard />;
        return <MissionManagementView />;

      case 'laporan-harian':
        return <DailyReportView />;

      case 'hall-of-fame':
        return currentUser.role === 'admin' ? <MentorHallOfFameView /> : <HallOfFameView />;

      case 'rekap':
        return <MonthlyRecapView />;

      case 'izin':
        return <LeaveManagementView />;

      case 'peserta':
        return <TraineeManagementView />;

      case 'pengaturan':
        return <SettingsView />;

      case 'profil':
        return <ProfileView />;

      default:
        return <AdminDashboard />;
    }
  };

  const roleBadgeLabel =
    currentUser.role === 'admin'
      ? 'Administrator'
      : currentUser.role === 'mentor'
      ? 'Mentor'
      : 'Peserta';

  // Keep the welcome/date banner on attendance and mentor verification pages.
  // Other pages already have their own title and should not repeat the greeting.
  const showAttendanceHeader =
    activeTab === 'dashboard' || activeTab === 'presensi' || activeTab === 'verifikasi-mentor';

  return (
    <div className="min-h-screen bg-[#F4F6F8] text-[#123B59] flex flex-col font-sans">
      {/* Sidebar Navigation (Fixed on desktop, drawer on mobile) */}
      <Sidebar
        mobileOpen={mobileSidebarOpen}
        onCloseMobile={() => setMobileSidebarOpen(false)}
      />

      {/* Main Workspace Area (padded on left for fixed sidebar) */}
      <div className="flex-1 w-full lg:pl-[280px] p-4 sm:p-5 lg:p-6 pb-24 lg:pb-8 flex flex-col">
        {/* Keep only the mobile brand visible while scrolling. */}
        <div className="mobile-brand-header sticky top-0 z-40 -mx-4 px-4 py-2 bg-[#F4F6F8] sm:-mx-5 sm:px-5 lg:hidden flex min-w-0 items-center gap-2">
          <button
            onClick={() => setMobileSidebarOpen(true)}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white border border-[#E4EAF0] text-[#123B59] hover:bg-[#F8FAFB] transition cursor-pointer"
            aria-label="Buka Menu Navigasi"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="mobile-brand-lockup flex min-w-0 items-center gap-2">
            <img src={psaLogo} alt="" className="mobile-brand-logo" />
            <span className="mobile-brand-copy">
              <strong>PSA</strong>
              <small>Punya Skill Akademi</small>
            </span>
          </div>
        </div>
        {/* Top Header matching style.html */}
        <header
          className={`flex w-full flex-col justify-between gap-3 lg:gap-4 lg:flex-row lg:items-center ${
            showAttendanceHeader
              ? 'mb-4 lg:mb-6'
              : 'mb-4 h-auto overflow-visible lg:relative lg:z-10 lg:mb-0 lg:h-0'
          }`}
        >
          <div className="flex min-w-0 flex-col gap-3 lg:block">
            {/* Attendance title and greeting; detail pages use their own page heading. */}
            {showAttendanceHeader && (
              <div>
                <p className="text-[10px] font-bold tracking-[.14em] text-[#4C83B5]">
                  PRESENSI MAGANG HARIAN
                </p>
                <h1 className="mt-1 font-bold text-2xl lg:text-3xl text-[#123B59] tracking-tight">
                  Selamat datang, {currentUser.name}
                </h1>
                <p className="mt-0.5 text-sm text-[#6F7F8D]">{headerDate}</p>
              </div>
            )}

          </div>

          {/* Current time and authenticated role */}
          <div
            className={`surface flex w-fit max-w-full flex-wrap items-center gap-3 self-start rounded-2xl px-3.5 py-2.5 sm:self-end lg:flex-nowrap lg:self-auto ${
              showAttendanceHeader ? '' : 'hidden lg:flex'
            } ${
              showAttendanceHeader ? '' : 'lg:absolute lg:right-0 lg:top-0'
            }`}
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#EAF2F8] text-[#4C83B5]">
              <Clock className="h-4 w-4" />
            </span>
            <div className="pr-2">
              <p className="text-[9px] font-bold tracking-[.1em] text-[#6F7F8D]">
                WAKTU SAAT INI
              </p>
              <p className="text-base font-bold text-[#123B59] tabular-nums">
                {liveClock} WIB
              </p>
            </div>
            <span className="rounded-xl border border-[#E4EAF0] bg-[#F4F6F8] px-3 py-2 text-xs font-semibold text-[#123B59]">
              {roleBadgeLabel}
            </span>
          </div>
        </header>

        {/* Page Content View */}
        <HeaderStatusContext.Provider value={{ liveClock, roleBadgeLabel }}>
          <main key={activeTab} className="page-enter min-w-0 w-full flex-1">{renderContent()}</main>
        </HeaderStatusContext.Provider>

        {/* Footer */}
        <footer className="mt-10 pt-4 border-t border-[#E4EAF0] text-xs text-[#6F7F8D] flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>Punya Skill Akademi &copy; 2026 Sistem Presensi Magang & Vokasi</span>
        </footer>
      </div>

      {/* Mobile Bottom Navigation Bar (from style.html) */}
      <nav
        className="mobile-bottom-nav lg:hidden fixed bottom-0 left-0 z-30 w-full border-t border-[#E4EAF0] bg-white/95 px-3 pt-2 backdrop-blur-md"
        aria-label="Navigasi mobile"
      >
        <div className="grid grid-cols-4 gap-1 text-center">
          <button
            type="button"
            onClick={() =>
              setActiveTab(
                currentUser.role === 'admin'
                  ? 'verifikasi-mentor'
                  : currentUser.role === 'mentor'
                  ? 'presensi'
                  : 'dashboard'
              )
            }
            className={`mobile-nav-item flex flex-col items-center gap-1 rounded-xl py-1.5 text-[10px] font-bold transition cursor-pointer ${
              activeTab === 'dashboard' || activeTab === 'verifikasi-mentor' || activeTab === 'presensi'
                ? 'is-active text-[#4C83B5]'
                : 'text-[#6F7F8D]'
            }`}
          >
            <span className="mobile-icon rounded-xl p-1.5">
              <LayoutDashboard className="h-5 w-5" />
            </span>
            <span>Dashboard</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('laporan-harian')}
            className={`mobile-nav-item flex flex-col items-center gap-1 rounded-xl py-1.5 text-[10px] font-bold transition cursor-pointer ${
              activeTab === 'laporan-harian' ? 'is-active text-[#4C83B5]' : 'text-[#6F7F8D]'
            }`}
          >
            <span className="mobile-icon rounded-xl p-1.5">
              <FileText className="h-5 w-5" />
            </span>
            <span>Laporan</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('izin')}
            className={`mobile-nav-item flex flex-col items-center gap-1 rounded-xl py-1.5 text-[10px] font-bold transition cursor-pointer ${
              activeTab === 'izin' ? 'is-active text-[#4C83B5]' : 'text-[#6F7F8D]'
            }`}
          >
            <span className="mobile-icon rounded-xl p-1.5">
              <CalendarCheck className="h-5 w-5" />
            </span>
            <span>Izin</span>
          </button>

          <button
            type="button"
            onClick={() => setMobileSidebarOpen(true)}
            className={`mobile-nav-item flex flex-col items-center gap-1 rounded-xl py-1.5 text-[10px] font-bold transition cursor-pointer text-[#6F7F8D]`}
          >
            <span className="mobile-icon rounded-xl p-1.5">
              <UserRound className="h-5 w-5" />
            </span>
            <span>Menu & Profil</span>
          </button>
        </div>
      </nav>

    </div>
  );
};

export default function App() {
  return (
    <ThemeProvider>
      <AppProvider>
        <MainLayout />
      </AppProvider>
    </ThemeProvider>
  );
}
