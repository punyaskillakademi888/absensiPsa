import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { MobileHeaderStatus } from '../MobileHeaderStatus';
import { User, MissionSubmission, TraineeHallOfFameEntry } from '../../types';
import { api } from '../../services/api';
import {
  Trophy,
  Medal,
  Award,
  Crown,
  Sparkles,
  CheckCircle2,
  ChevronRight,
  ExternalLink,
  Flame,
  Star,
  Users,
  Eye,
  X
} from 'lucide-react';

interface TraineeRanking {
  user: Pick<User, 'id' | 'nim' | 'name' | 'avatar' | 'kejuruanId' | 'kejuruanName'>;
  totalPoints: number;
  completedMissionsCount: number;
  approvedSubmissions: MissionSubmission[];
  rank: number;
  badgeLevel: {
    title: string;
    color: string;
    bg: string;
    border: string;
  };
}

export const HallOfFameView: React.FC = () => {
  const { users, missionSubmissions, currentUser, setActiveTab } = useApp();

  const [selectedTraineeDetail, setSelectedTraineeDetail] = useState<TraineeRanking | null>(null);
  const [leaderboardTrainees, setLeaderboardTrainees] = useState<TraineeHallOfFameEntry[] | null>(null);
  const [leaderboardStatus, setLeaderboardStatus] = useState<'loading' | 'loaded' | 'error'>('loading');

  useEffect(() => {
    if (currentUser.role !== 'trainee') {
      setLeaderboardStatus('loaded');
      return;
    }

    let active = true;
    setLeaderboardStatus('loading');
    api.getTraineeHallOfFame()
      .then(result => {
        if (!active) return;
        setLeaderboardTrainees(result.trainees);
        setLeaderboardStatus('loaded');
      })
      .catch(error => {
        console.warn('Could not fetch trainee leaderboard:', error);
        if (active) setLeaderboardStatus('error');
      });

    return () => { active = false; };
  }, [currentUser.role]);

  // All trainees
  const trainees = useMemo(() => {
    return users.filter(u => u.role === 'trainee');
  }, [users]);

  // Compute rankings
  const rankings: TraineeRanking[] = useMemo(() => {
    const rankingTrainees = currentUser.role === 'trainee'
      ? leaderboardTrainees || []
      : trainees;
    const list = rankingTrainees.map(trainee => {
      const isLeaderboardEntry = 'totalPoints' in trainee;
      const user: TraineeRanking['user'] = isLeaderboardEntry
        ? {
            id: trainee.id,
            nim: trainee.nim,
            name: trainee.name,
            avatar: trainee.avatar,
            kejuruanId: trainee.kejuruanId,
            kejuruanName: trainee.kejuruanName,
          }
        : trainee;
      const userApprovedSubmissions = missionSubmissions.filter(
        s => s.traineeId === user.id && s.status === 'approved'
      );

      const totalPoints = isLeaderboardEntry
        ? trainee.totalPoints
        : userApprovedSubmissions.reduce((sum, s) => sum + s.points, 0);
      const completedMissionsCount = isLeaderboardEntry
        ? trainee.completedMissionsCount
        : userApprovedSubmissions.length;

      // Determine badge tier based on points
      let badgeLevel = {
        title: 'Peserta Baru',
        color: 'text-[#6F7F8D]',
        bg: 'bg-[#F4F6F8]',
        border: 'border-[#E4EAF0]'
      };

      if (totalPoints >= 350) {
        badgeLevel = {
          title: 'Master Vokasi 🏆',
          color: 'text-amber-700',
          bg: 'bg-amber-50',
          border: 'border-amber-300'
        };
      } else if (totalPoints >= 200) {
        badgeLevel = {
          title: 'Expert Vokasi 🌟',
          color: 'text-purple-700',
          bg: 'bg-purple-50',
          border: 'border-purple-300'
        };
      } else if (totalPoints >= 100) {
        badgeLevel = {
          title: 'Aspirant Vokasi 🚀',
          color: 'text-[#28618F]',
          bg: 'bg-[#EAF2F8]',
          border: 'border-[#A9C7DE]'
        };
      } else if (totalPoints > 0) {
        badgeLevel = {
          title: 'Aktif Berprogres 🌱',
          color: 'text-emerald-700',
          bg: 'bg-emerald-50',
          border: 'border-emerald-300'
        };
      }

      return {
        user,
        totalPoints,
        completedMissionsCount,
        approvedSubmissions: userApprovedSubmissions,
        rank: 0,
        badgeLevel
      };
    });

    // Sort descending by points, then by completed missions count
    list.sort((a, b) => {
      if (b.totalPoints !== a.totalPoints) {
        return b.totalPoints - a.totalPoints;
      }
      return b.completedMissionsCount - a.completedMissionsCount;
    });

    // Assign rank
    return list.map((item, idx) => ({
      ...item,
      rank: idx + 1
    }));
  }, [currentUser.role, leaderboardTrainees, trainees, missionSubmissions]);

  // Current logged in trainee's standing
  const myRanking = useMemo(() => {
    if (currentUser.role !== 'trainee') return null;
    return rankings.find(r => r.user.id === currentUser.id) || null;
  }, [rankings, currentUser]);

  // Top 3 Podium
  const top1 = rankings[0];
  const top2 = rankings[1];
  const top3 = rankings[2];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col items-start gap-4">
        <div>
          <p className="text-[10px] font-bold tracking-[.14em] text-[#4C83B5] uppercase mb-1">
            Papan Prestasi
          </p>
          <h1 className="text-xl sm:text-2xl font-bold text-[#123B59]">
            Hall of Fame &amp; Leaderboard
          </h1>
          <p className="text-xs text-[#6F7F8D] mt-0.5">
            Papan peringkat seluruh peserta pelatihan vokasi dengan perolehan poin misi tertinggi.
          </p>
          <MobileHeaderStatus />
        </div>

        {currentUser.role === 'trainee' && myRanking && (
          <div className="surface flex items-center gap-3 px-4 py-2.5 rounded-2xl">
            <div className="text-center">
              <span className="text-[10px] text-[#6F7F8D] block font-semibold uppercase tracking-wider">
                Peringkat Anda
              </span>
              <span className="text-lg font-black text-amber-600 font-mono">
                #{myRanking.rank}
              </span>
            </div>
            <div className="h-6 w-px bg-[#E4EAF0]" />
            <div>
              <span className="text-[10px] text-[#6F7F8D] block font-semibold uppercase tracking-wider">
                Total Poin
              </span>
              <span className="text-sm font-bold text-[#123B59] font-mono">
                {myRanking.totalPoints} Pts
              </span>
            </div>
            <div className="h-6 w-px bg-[#E4EAF0]" />
            <div>
              <span className="text-[10px] text-[#6F7F8D] block font-semibold uppercase tracking-wider">
                Tingkat
              </span>
              <span className={`text-xs font-bold ${myRanking.badgeLevel.color}`}>
                {myRanking.badgeLevel.title}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* TOP 3 PODIUM HERO SECTION */}
      {rankings.length >= 3 && (
        <div className="bg-[#123B59] rounded-2xl p-6 sm:p-8 relative overflow-hidden">
          {/* Ambient Glow */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-48 bg-[#4C83B5]/20 blur-3xl pointer-events-none rounded-full" />

          <div className="text-center mb-6 relative z-10">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-[#A9C7DE] text-xs font-semibold mb-2 border border-white/10">
              <Crown className="w-3.5 h-3.5 text-amber-400" />
              <span>Podium Prestasi Vokasi Terbaik</span>
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-white">
              Tiga Peserta dengan Poin Tertinggi
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-4xl mx-auto items-end relative z-10">
            {/* Rank 2 (Silver) */}
            {top2 && (
              <div className="order-2 md:order-1 bg-white/10 backdrop-blur-md rounded-2xl p-5 border border-white/10 flex flex-col items-center text-center hover:bg-white/15 transition soft-hover">
                <div className="relative mb-3">
                  <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-[#A9C7DE] p-0.5 shadow-md">
                    <img
                      src={top2.user.avatar}
                      alt={top2.user.name}
                      className="w-full h-full object-cover rounded-full"
                    />
                  </div>
                  <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-[#A9C7DE] text-[#123B59] font-black text-xs flex items-center justify-center shadow-md">
                    2
                  </span>
                </div>
                <h3 className="font-bold text-sm text-white truncate max-w-full">
                  {top2.user.name}
                </h3>
                <span className="text-[11px] text-[#A9C7DE] truncate max-w-full mt-0.5">
                  {top2.user.kejuruanName}
                </span>
                <div className="mt-3 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-white text-xs font-mono font-bold">
                  {top2.totalPoints} Pts
                </div>
                <span className="text-[10px] text-[#A9C7DE] mt-1">
                  {top2.completedMissionsCount} Misi Selesai
                </span>
              </div>
            )}

            {/* Rank 1 (Gold) */}
            {top1 && (
              <div className="order-1 md:order-2 bg-gradient-to-b from-amber-500/20 to-white/5 backdrop-blur-md rounded-2xl p-6 border-2 border-amber-400/60 flex flex-col items-center text-center shadow-xl relative -mt-2">
                <Crown className="w-8 h-8 text-amber-400 mb-1 drop-shadow-md animate-bounce" />
                <div className="relative mb-3">
                  <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-amber-400 p-0.5 shadow-lg">
                    <img
                      src={top1.user.avatar}
                      alt={top1.user.name}
                      className="w-full h-full object-cover rounded-full"
                    />
                  </div>
                  <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-7 h-7 rounded-full bg-amber-400 text-amber-950 font-black text-xs flex items-center justify-center shadow-lg">
                    1
                  </span>
                </div>
                <h3 className="font-bold text-base text-amber-300 truncate max-w-full">
                  {top1.user.name}
                </h3>
                <span className="text-xs text-[#A9C7DE] truncate max-w-full mt-0.5">
                  {top1.user.kejuruanName}
                </span>
                <div className="mt-3 px-4 py-1.5 rounded-full bg-amber-400 text-amber-950 text-sm font-mono font-black shadow-md">
                  {top1.totalPoints} Pts
                </div>
                <span className="text-[11px] text-amber-300/80 mt-1.5 font-medium">
                  🌟 {top1.completedMissionsCount} Misi Selesai
                </span>
              </div>
            )}

            {/* Rank 3 (Bronze) */}
            {top3 && (
              <div className="order-3 bg-white/10 backdrop-blur-md rounded-2xl p-5 border border-white/10 flex flex-col items-center text-center hover:bg-white/15 transition soft-hover">
                <div className="relative mb-3">
                  <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-amber-700 p-0.5 shadow-md">
                    <img
                      src={top3.user.avatar}
                      alt={top3.user.name}
                      className="w-full h-full object-cover rounded-full"
                    />
                  </div>
                  <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-amber-700 text-white font-bold text-xs flex items-center justify-center shadow-md">
                    3
                  </span>
                </div>
                <h3 className="font-bold text-sm text-white truncate max-w-full">
                  {top3.user.name}
                </h3>
                <span className="text-[11px] text-[#A9C7DE] truncate max-w-full mt-0.5">
                  {top3.user.kejuruanName}
                </span>
                <div className="mt-3 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-white text-xs font-mono font-bold">
                  {top3.totalPoints} Pts
                </div>
                <span className="text-[10px] text-[#A9C7DE] mt-1">
                  {top3.completedMissionsCount} Misi Selesai
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* RANKINGS TABLE */}
      <div className="surface rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[#E4EAF0] text-[#6F7F8D] text-[11px] font-semibold bg-[#F8FAFB]">
                <th className="py-3 px-4 w-16 text-center">Rank</th>
                <th className="py-3 px-4">Peserta Pelatihan</th>
                <th className="py-3 px-3">Kejuruan Vokasi</th>
                <th className="py-3 px-3 min-w-[150px]">Tingkat Prestasi</th>
                <th className="py-3 px-3 text-center">Misi Selesai</th>
                <th className="py-3 px-4 text-right">Total Poin</th>
                <th className="py-3 px-4 text-right">Detail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E4EAF0]">
              {rankings.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-[#6F7F8D]">
                    {currentUser.role === 'trainee' && leaderboardStatus === 'loading'
                      ? 'Memuat peringkat peserta...'
                      : currentUser.role === 'trainee' && leaderboardStatus === 'error'
                        ? 'Peringkat peserta belum dapat dimuat. Coba muat ulang halaman.'
                        : 'Belum ada peserta untuk ditampilkan.'}
                  </td>
                </tr>
              ) : (
                rankings.map(ranking => {
                  const isCurrent = currentUser.id === ranking.user.id;
                  const isTop1 = ranking.rank === 1;
                  const isTop2 = ranking.rank === 2;
                  const isTop3 = ranking.rank === 3;

                  return (
                    <tr
                      key={ranking.user.id}
                      className={`transition ${
                        isCurrent
                          ? 'bg-[#EAF2F8]'
                          : 'hover:bg-[#F4F6F8]'
                      }`}
                    >
                      {/* Rank Column */}
                      <td className="py-3 px-4 text-center">
                        {isTop1 ? (
                          <span className="w-6 h-6 rounded-full bg-amber-400 text-amber-950 font-black text-xs inline-flex items-center justify-center shadow-sm">
                            1
                          </span>
                        ) : isTop2 ? (
                          <span className="w-6 h-6 rounded-full bg-[#A9C7DE] text-[#123B59] font-bold text-xs inline-flex items-center justify-center shadow-sm">
                            2
                          </span>
                        ) : isTop3 ? (
                          <span className="w-6 h-6 rounded-full bg-amber-700 text-white font-bold text-xs inline-flex items-center justify-center shadow-sm">
                            3
                          </span>
                        ) : (
                          <span className="font-mono text-[#A9C7DE] text-xs">
                            #{ranking.rank}
                          </span>
                        )}
                      </td>

                      {/* User Profile */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <img
                            src={ranking.user.avatar}
                            alt={ranking.user.name}
                            className="w-8 h-8 rounded-full object-cover border border-[#E4EAF0]"
                          />
                          <div>
                            <div className="font-semibold text-[#123B59] flex items-center gap-1.5">
                              <span>{ranking.user.name}</span>
                              {isCurrent && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#123B59] text-white">
                                  Anda
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-[#A9C7DE] font-mono">
                              {ranking.user.nim}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Kejuruan */}
                      <td className="py-3 px-3">
                        <span className="text-[#6F7F8D]">
                          {ranking.user.kejuruanName || '-'}
                        </span>
                      </td>

                      {/* Badge / Level */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center whitespace-nowrap px-2 py-0.5 rounded-md text-[11px] font-semibold border ${ranking.badgeLevel.bg} ${ranking.badgeLevel.color} ${ranking.badgeLevel.border}`}
                        >
                          {ranking.badgeLevel.title}
                        </span>
                      </td>

                      {/* Misi Selesai */}
                      <td className="py-3 px-3 text-center">
                        <span className="font-mono font-semibold text-[#123B59]">
                          {ranking.completedMissionsCount}
                        </span>
                        <span className="text-[10px] text-[#A9C7DE] block">misi tuntas</span>
                      </td>

                      {/* Points */}
                      <td className="py-3 px-4 text-right">
                        <span className="font-mono text-sm font-bold text-amber-600">
                          {ranking.totalPoints}
                        </span>
                        <span className="text-[10px] text-[#A9C7DE] block">Pts</span>
                      </td>

                      {/* Action */}
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => setSelectedTraineeDetail(ranking)}
                          className="px-2.5 py-1 rounded-lg border border-[#E4EAF0] bg-white hover:bg-[#EAF2F8] hover:border-[#4C83B5] text-xs font-semibold text-[#123B59] transition cursor-pointer"
                        >
                          {isCurrent ? 'Lihat Misi' : 'Ringkasan'}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* DETAIL MODAL: SHOW COMPLETED MISSIONS FOR TRAINEE */}
      {selectedTraineeDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0D2F47]/45 backdrop-blur-sm">
          <div className="surface rounded-2xl max-w-lg w-full overflow-hidden">
            <div className="p-4 border-b border-[#E4EAF0] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Trophy className="w-4 h-4 text-amber-500" />
                <h3 className="font-bold text-sm text-[#123B59]">
                  Riwayat Misi &amp; Poin Peserta
                </h3>
              </div>
              <button
                onClick={() => setSelectedTraineeDetail(null)}
                className="p-1 rounded-lg text-[#6F7F8D] hover:text-[#123B59] hover:bg-[#F4F6F8] transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Profile Card */}
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#EAF2F8] border border-[#A9C7DE]/40">
                <div className="flex items-center gap-3">
                  <img
                    src={selectedTraineeDetail.user.avatar}
                    alt={selectedTraineeDetail.user.name}
                    className="w-10 h-10 rounded-full object-cover border border-[#E4EAF0]"
                  />
                  <div>
                    <div className="font-bold text-xs text-[#123B59]">
                      {selectedTraineeDetail.user.name}
                    </div>
                    <div className="text-[11px] text-[#4C83B5]">
                      {selectedTraineeDetail.user.nim} &middot;{' '}
                      {selectedTraineeDetail.user.kejuruanName}
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[10px] text-[#6F7F8D] block font-semibold uppercase">
                    Peringkat #{selectedTraineeDetail.rank}
                  </span>
                  <span className="font-mono text-base font-black text-amber-600">
                    {selectedTraineeDetail.totalPoints} Pts
                  </span>
                </div>
              </div>

              {/* Badge Level */}
              <div className="flex items-center gap-2">
                <span
                  className={`px-3 py-1 rounded-full text-xs font-semibold border ${selectedTraineeDetail.badgeLevel.bg} ${selectedTraineeDetail.badgeLevel.color} ${selectedTraineeDetail.badgeLevel.border}`}
                >
                  {selectedTraineeDetail.badgeLevel.title}
                </span>
              </div>

              {/* Completed Missions List */}
              <div>
                <h4 className="font-semibold text-xs text-[#123B59] mb-2">
                  Daftar Misi yang Diselesaikan ({selectedTraineeDetail.approvedSubmissions.length})
                </h4>

                {selectedTraineeDetail.approvedSubmissions.length === 0 ? (
                  <div className="p-6 text-center text-[#6F7F8D] text-xs bg-[#F4F6F8] rounded-xl border border-[#E4EAF0]">
                    {selectedTraineeDetail.user.id === currentUser.id
                      ? 'Peserta belum menyelesaikan misi apapun.'
                      : 'Rincian misi peserta lain tidak ditampilkan.'}
                  </div>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                    {selectedTraineeDetail.approvedSubmissions.map(sub => (
                      <div
                        key={sub.id}
                        className="p-3 rounded-xl border border-[#E4EAF0] bg-[#F4F6F8]"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="font-semibold text-xs text-[#123B59]">
                              {sub.missionTitle}
                            </div>
                            <div className="text-[10px] text-[#A9C7DE] mt-0.5">
                              Disetujui oleh: {sub.reviewedBy || 'Mentor Kejuruan'} &middot;{' '}
                              {sub.reviewedAt?.split(' ')[0]}
                            </div>
                          </div>
                          <span className="px-2 py-0.5 rounded-full bg-amber-500 text-white font-mono font-bold text-xs shrink-0">
                            +{sub.points} Pts
                          </span>
                        </div>

                        {sub.feedback && (
                          <div className="mt-2 text-[11px] text-[#6F7F8D] bg-white p-2 rounded-lg border border-[#E4EAF0] italic">
                            "{sub.feedback}"
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-[#E4EAF0] text-right">
                <button
                  type="button"
                  onClick={() => setSelectedTraineeDetail(null)}
                  className="px-4 py-2 rounded-lg bg-[#123B59] hover:bg-[#0D2F47] text-white text-xs font-semibold transition cursor-pointer"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
