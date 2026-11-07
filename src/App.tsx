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
import { MentorDailyReportView } from './components/DailyReport/MentorDailyReportView';
import { RewardStoreView } from './components/Rewards/RewardStoreView';
import { HeaderStatusContext } from './components/MobileHeaderStatus';
import psaLogo from './assets/2D PSA LOGO.png';
import {
  Menu,
  LayoutDashboard,
  CalendarCheck,
  FileText,
  UserRound,
  FileSpreadsheet,
} from 'lucide-react';

const MainLayout: React.FC = () => {
  const { currentUser, activeTab, setActiveTab, isAuthenticated, authReady } = useApp();

  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [liveClock, setLiveClock] = useState('00.00.00');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, '0');
      setLiveClock(`${pad(now.getHours())}.${pad(now.getMinutes())}.${pad(now.getSeconds())}`);
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

      case 'laporan-mentor':
        return currentUser.role === 'admin' || currentUser.role === 'mentor'
          ? <MentorDailyReportView />
          : <TraineeDashboard />;

      case 'hall-of-fame':
        return currentUser.role === 'admin' ? <MentorHallOfFameView /> : <HallOfFameView />;

      case 'reward-store':
        return <RewardStoreView />;

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
