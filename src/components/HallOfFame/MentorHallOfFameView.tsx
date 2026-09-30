import React, { useMemo } from 'react';
import { Award, CalendarCheck2, Trophy } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { MobileHeaderStatus } from '../MobileHeaderStatus';

export const MentorHallOfFameView: React.FC = () => {
  const { users, attendanceRecords } = useApp();

  const rankings = useMemo(() => users
    .filter(user => user.role === 'mentor')
    .map(mentor => {
      const verifiedRecords = attendanceRecords.filter(record =>
        record.userId === mentor.id &&
        record.verificationStatus === 'verified' &&
        (record.status === 'hadir' || record.status === 'terlambat')
      );
      return {
        mentor,
        total: verifiedRecords.length,
        onTime: verifiedRecords.filter(record => record.status === 'hadir').length,
        late: verifiedRecords.filter(record => record.status === 'terlambat').length
      };
    })
    .sort((a, b) => b.total - a.total || a.mentor.name.localeCompare(b.mentor.name)),
  [users, attendanceRecords]);

  return (
    <div className="space-y-6">
      <header className="border-b border-[#E4EAF0] pb-4">
        <p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#4C83B5]">APRESIASI INSTRUKTUR</p>
        <h1 className="mt-1 text-2xl font-bold text-[#123B59]">Hall of Fame Mentor</h1>
        <p className="mt-1 text-sm text-[#6F7F8D]">Peringkat mentor berdasarkan jumlah presensi yang telah diverifikasi admin.</p>
        <MobileHeaderStatus />
      </header>

      <section className="surface overflow-hidden rounded-2xl border border-[#E4EAF0]">
        <div className="flex items-center gap-2 border-b border-[#E4EAF0] bg-[#F8FAFB] px-5 py-4">
          <Trophy className="h-5 w-5 text-amber-500" />
          <h2 className="font-bold text-[#123B59]">Peringkat Kehadiran Mentor</h2>
        </div>
        {rankings.length ? (
          <div className="divide-y divide-[#E4EAF0]">
            {rankings.map((item, index) => (
              <article key={item.mentor.id} className="flex flex-wrap items-center gap-4 px-5 py-4">
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-black ${index === 0 ? 'bg-amber-100 text-amber-700' : 'bg-[#F4F6F8] text-[#6F7F8D]'}`}>
                  {index === 0 ? <Award className="h-5 w-5" /> : `#${index + 1}`}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-[#123B59]">{item.mentor.name}</p>
                  <p className="mt-0.5 text-xs text-[#6F7F8D]">{item.mentor.kejuruanName || 'Mentor'} · {item.mentor.nim}</p>
                </div>
                <div className="flex items-center gap-2 rounded-xl bg-[#EAF2F8] px-3 py-2 text-[#28618F]">
                  <CalendarCheck2 className="h-4 w-4" />
                  <span className="text-sm font-bold">{item.total} presensi</span>
                </div>
                <p className="w-full pl-14 text-xs text-[#6F7F8D] sm:w-auto sm:pl-0">{item.onTime} tepat waktu · {item.late} terlambat</p>
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
