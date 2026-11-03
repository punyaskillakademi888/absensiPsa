import React, { useEffect, useState } from 'react';
import { Award, RotateCcw, Trophy } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { api } from '../../services/api';
import { MentorHallOfFameEntry } from '../../types';
import { MobileHeaderStatus } from '../MobileHeaderStatus';

export const MentorHallOfFameView: React.FC = () => {
  const { currentUser, resetTraineeHallOfFamePoints } = useApp();
  const [rankings, setRankings] = useState<MentorHallOfFameEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [isResettingPoints, setIsResettingPoints] = useState(false);

  useEffect(() => {
    let active = true;
    const refresh = () => {
      api.getMentorHallOfFame()
        .then(result => {
          if (active) setRankings(result.mentors);
        })
        .catch(error => {
          if (active) setLoadError(error.message || 'Gagal memuat poin mentor.');
        })
        .finally(() => {
          if (active) setIsLoading(false);
        });
    };
    refresh();
    window.addEventListener('focus', refresh);
    const timer = window.setInterval(refresh, 30000);

    return () => {
      active = false;
      window.removeEventListener('focus', refresh);
      window.clearInterval(timer);
    };
  }, []);

  const handleResetTraineePoints = async () => {
    if (!window.confirm('Nolkan seluruh poin peserta di Hall of Fame? Riwayat submission dan presensi mentor tetap tersimpan.')) return;
    setIsResettingPoints(true);
    const result = await resetTraineeHallOfFamePoints();
    if (result.success) {
      try {
        const refreshed = await api.getMentorHallOfFame();
        setRankings(refreshed.mentors);
      } catch (error: any) {
        setLoadError(error.message || 'Poin direset, tetapi peringkat gagal dimuat ulang.');
      }
    }
    setIsResettingPoints(false);
    window.alert(result.message);
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-[#E4EAF0] pb-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#4C83B5]">APRESIASI INSTRUKTUR</p>
          <h1 className="mt-1 text-2xl font-bold text-[#123B59]">Hall of Fame Mentor</h1>
          <p className="mt-1 text-sm text-[#6F7F8D]">Poin mentor berasal dari tugas peserta yang disetujui, dibagi jumlah peserta aktif pada kejuruan misi.</p>
          <MobileHeaderStatus />
        </div>
        {currentUser.role === 'admin' && (
          <button
            type="button"
            onClick={handleResetTraineePoints}
            disabled={isResettingPoints}
            className="surface flex items-center gap-2 rounded-xl border border-rose-200 px-3.5 py-2.5 text-xs font-bold text-rose-600 transition hover:bg-rose-50 disabled:opacity-60"
            title="Nolkan poin trainee, tanpa menghapus riwayat submission"
          >
            <RotateCcw className="h-4 w-4" />
            <span>{isResettingPoints ? 'Mereset...' : 'Reset Poin Peserta'}</span>
          </button>
        )}
      </header>

      <section className="surface overflow-hidden rounded-2xl border border-[#E4EAF0]">
        <div className="flex items-center gap-2 border-b border-[#E4EAF0] bg-[#F8FAFB] px-5 py-4">
          <Trophy className="h-5 w-5 text-amber-500" />
          <h2 className="font-bold text-[#123B59]">Peringkat Poin Mentor</h2>
        </div>
        {loadError ? (
          <p className="px-5 py-10 text-center text-sm text-rose-600">{loadError}</p>
        ) : isLoading ? (
          <p className="px-5 py-10 text-center text-sm text-[#6F7F8D]">Memuat peringkat mentor...</p>
        ) : rankings.length ? (
          <div className="divide-y divide-[#E4EAF0]">
            {rankings.map((item, index) => (
              <article key={item.id} className="flex flex-wrap items-center gap-4 px-5 py-4">
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-black ${index === 0 ? 'bg-amber-100 text-amber-700' : 'bg-[#F4F6F8] text-[#6F7F8D]'}`}>
                  {index === 0 ? <Award className="h-5 w-5" /> : `#${index + 1}`}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-[#123B59]">{item.name}</p>
                  <p className="mt-0.5 text-xs text-[#6F7F8D]">{item.kejuruanName || 'Mentor'} · {item.nim}</p>
                </div>
                <div className="flex items-center gap-2 rounded-xl bg-[#EAF2F8] px-3 py-2 text-[#28618F]">
                  <Trophy className="h-4 w-4" />
                  <span className="text-sm font-bold">{item.totalPoints.toLocaleString('id-ID')} poin</span>
                </div>
                <p className="w-full pl-14 text-xs text-[#6F7F8D] sm:w-auto sm:pl-0">
                  {item.completedMissionsCount} tugas peserta disetujui
                </p>
              </article>
            ))}
          </div>
        ) : (
          <p className="px-5 py-10 text-center text-sm text-[#6F7F8D]">Belum ada data mentor untuk ditampilkan.</p>
        )}
      </section>
    </div>
  );
};
