import { User, Kejuruan, AttendanceRecord, LeaveRequest, AttendanceSettings } from '../types';
import { getTodayDateString } from '../utils/dateUtils';

export const INITIAL_KEJURUAN: Kejuruan[] = [
  {
    id: 'kj-1',
    name: 'Pembuatan Sistem Informasi Pariwisata Berbasis Website',
    code: 'ST-04',
    category: 'Teknologi Informasi dan Pariwisata',
    color: '#2563eb', // blue
    description: 'Pembuatan sistem informasi pariwisata berbasis website.',
    mentorName: 'Ayu / Vanesha'
  },
  {
    id: 'kj-2',
    name: 'Pengembangan Web dengan Node.js dan React',
    code: 'WEB-04',
    category: 'Teknologi Informasi',
    color: '#8b5cf6', // purple
    description: 'Pengembangan aplikasi web menggunakan Node.js dan React.',
    mentorName: 'Fadil'
  },
  {
    id: 'kj-3',
    name: 'Smart Creative',
    code: 'SC-04',
    category: 'Smart Creative',
    color: '#059669', // emerald
    description: 'Program gabungan Generative AI, konten visual, dan pemasaran media sosial.',
    mentorName: 'Mas Dzikri',
    subPrograms: [
      'Pengoperasian Tools Generative AI untuk Konten Digital dan Bisnis',
      'Pembuatan Konten Visual untuk Sosial Media',
      'Optimalisasi Pemasaran Melalui Media Sosial',
    ]
  },
  {
    id: 'kj-6',
    name: 'Pemasangan Sistem Integrasi Bangunan Cerdas',
    code: 'SB-04',
    category: 'Teknologi Bangunan Cerdas',
    color: '#0891b2',
    description: 'Pemasangan sistem integrasi bangunan cerdas.',
    mentorName: 'Davy'
  }
];

export const INITIAL_USERS: User[] = [
  // Admin
  {
    id: 'user-admin-1',
    nim: 'ADM-2026-001',
    name: 'Bambang Sudirman, M.Kom',
    role: 'admin',
    avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80',
    phone: '0812-3456-7890',
    status: 'active',
    joinedDate: '2025-01-10',
    loginCode: '10000001',
    password: 'admin123'
  },
  // Mentors
  {
    id: 'user-mentor-1',
    nim: 'MNT-WD-01',
    name: 'Siti Nurhaliza, S.Kom',
    role: 'mentor',
    avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
    phone: '0813-2345-6781',
    kejuruanId: 'kj-1',
    kejuruanName: 'Web Development & Cloud',
    status: 'active',
    joinedDate: '2025-02-01',
    loginCode: '82049182',
    password: 'mentor123'
  },
  {
    id: 'user-mentor-2',
    nim: 'MNT-UX-02',
    name: 'Dimas Arya, M.Ds.',
    role: 'mentor',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    phone: '0813-8877-1234',
    kejuruanId: 'kj-2',
    kejuruanName: 'UI/UX & Product Design',
    status: 'active',
    joinedDate: '2025-02-01',
    loginCode: '49281726',
    password: 'mentor123'
  },
  {
    id: 'user-mentor-3',
    nim: 'MNT-DA-03',
    name: 'Rizky Ramadhan, M.Kom',
    role: 'mentor',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
    phone: '0813-9912-3456',
    kejuruanId: 'kj-3',
    kejuruanName: 'Data Analytics & AI',
    status: 'active',
    joinedDate: '2025-02-01',
    loginCode: '61928374',
    password: 'mentor123'
  },

  // Trainees (Peserta Pelatihan)
  // Web Dev trainees
  {
    id: 'user-trainee-1',
    nim: 'TRN-2026-001',
    name: 'Aditya Pratama Putra',
    role: 'trainee',
    avatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150&auto=format&fit=crop&q=80',
    phone: '0852-1122-3344',
    kejuruanId: 'kj-1',
    kejuruanName: 'Web Development & Cloud',
    status: 'active',
    joinedDate: '2026-01-15',
    loginCode: '18492041',
    password: '123456'
  },
  {
    id: 'user-trainee-2',
    nim: 'TRN-2026-002',
    name: 'Farhan Zulkarnain',
    role: 'trainee',
    avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&auto=format&fit=crop&q=80',
    phone: '0852-9988-7766',
    kejuruanId: 'kj-1',
    kejuruanName: 'Web Development & Cloud',
    status: 'active',
    joinedDate: '2026-01-15',
    loginCode: '29481029',
    password: '123456'
  },
  {
    id: 'user-trainee-3',
    nim: 'TRN-2026-003',
    name: 'Aulia Rahmadani',
    role: 'trainee',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
    phone: '0853-4433-2211',
    kejuruanId: 'kj-1',
    kejuruanName: 'Web Development & Cloud',
    status: 'active',
    joinedDate: '2026-01-15',
    loginCode: '39481726',
    password: '123456'
  },
  {
    id: 'user-trainee-4',
    nim: 'TRN-2026-004',
    name: 'Kevin Jonathan',
    role: 'trainee',
    avatar: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=150&auto=format&fit=crop&q=80',
    phone: '0812-5544-3322',
    kejuruanId: 'kj-1',
    kejuruanName: 'Web Development & Cloud',
    status: 'active',
    joinedDate: '2026-01-15',
    loginCode: '48291048',
    password: '123456'
  },

  // UI/UX trainees
  {
    id: 'user-trainee-5',
    nim: 'TRN-2026-005',
    name: 'Anisa Maharani',
    role: 'trainee',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    phone: '0813-6677-8899',
    kejuruanId: 'kj-2',
    kejuruanName: 'UI/UX & Product Design',
    status: 'active',
    joinedDate: '2026-01-15',
    loginCode: '58291047',
    password: '123456'
  },
  {
    id: 'user-trainee-6',
    nim: 'TRN-2026-006',
    name: 'Bagus Tri Atmojo',
    role: 'trainee',
    avatar: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150&auto=format&fit=crop&q=80',
    phone: '0821-4433-5566',
    kejuruanId: 'kj-2',
    kejuruanName: 'UI/UX & Product Design',
    status: 'active',
    joinedDate: '2026-01-15',
    loginCode: '67192840',
    password: '123456'
  },
  {
    id: 'user-trainee-7',
    nim: 'TRN-2026-007',
    name: 'Dewi Lestari Safitri',
    role: 'trainee',
    avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80',
    phone: '0857-1199-2288',
    kejuruanId: 'kj-2',
    kejuruanName: 'UI/UX & Product Design',
    status: 'active',
    joinedDate: '2026-01-15',
    loginCode: '71829401',
    password: '123456'
  },

  // Data Analytics trainees
  {
    id: 'user-trainee-8',
    nim: 'TRN-2026-008',
    name: 'Reza Hendrawan',
    role: 'trainee',
    avatar: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=150&auto=format&fit=crop&q=80',
    phone: '0878-3344-5566',
    kejuruanId: 'kj-3',
    kejuruanName: 'Data Analytics & AI',
    status: 'active',
    joinedDate: '2026-01-15',
    loginCode: '82940192',
    password: '123456'
  },
  {
    id: 'user-trainee-9',
    nim: 'TRN-2026-009',
    name: 'Clarissa Natalia',
    role: 'trainee',
    avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80',
    phone: '0896-1234-5678',
    kejuruanId: 'kj-3',
    kejuruanName: 'Data Analytics & AI',
    status: 'active',
    joinedDate: '2026-01-15',
    loginCode: '91827364',
    password: '123456'
  },

  // Digital Marketing trainees
  {
    id: 'user-trainee-10',
    nim: 'TRN-2026-010',
    name: 'Ilham Kusuma',
    role: 'trainee',
    avatar: 'https://images.unsplash.com/photo-1501196354995-cbb51c65aaea?w=150&auto=format&fit=crop&q=80',
    phone: '0851-9988-1122',
    kejuruanId: 'kj-4',
    kejuruanName: 'Digital Marketing & Growth',
    status: 'active',
    joinedDate: '2026-01-15',
    loginCode: '83726194',
    password: '123456'
  },
  {
    id: 'user-trainee-11',
    nim: 'TRN-2026-011',
    name: 'Zahra Amelia',
    role: 'trainee',
    avatar: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=150&auto=format&fit=crop&q=80',
    phone: '0812-8877-6655',
    kejuruanId: 'kj-4',
    kejuruanName: 'Digital Marketing & Growth',
    status: 'active',
    joinedDate: '2026-01-15',
    loginCode: '74839201',
    password: '123456'
  },

  // Cyber Security trainee
  {
    id: 'user-trainee-12',
    nim: 'TRN-2026-012',
    name: 'Yoga Saputra',
    role: 'trainee',
    avatar: 'https://images.unsplash.com/photo-1463453091185-61582044d556?w=150&auto=format&fit=crop&q=80',
    phone: '0822-1144-7788',
    kejuruanId: 'kj-5',
    kejuruanName: 'Cyber Security & Network',
    status: 'active',
    joinedDate: '2026-01-15',
    loginCode: '65928374',
    password: '123456'
  }
];

export const INITIAL_SETTINGS: AttendanceSettings = {
  startTime: '09:00',
  lateLimitTime: '09:00',
  // Default: 1 menit terlambat = 1 poin berkurang dari Hall of Fame peserta.
  latePointPenaltyPerMinute: 1,
  // Default: 1 hari kerja tidak absen = 1 poin berkurang dari Hall of Fame peserta.
  absentPointPenaltyPerDay: 1,
  endTime: '17:00',
  allowCheckoutStart: '16:00',
  workDays: [1, 2, 3, 4, 5], // Mon-Fri
  officeLocation: {
    lat: -6.921045982595817,
    lng: 107.67498836568335,
    name: 'Punya Skill Akademi HQ, Jl. Puri Ayu Pratama No.Kavling 9A, Sukamiskin, Arcamanik, Bandung',
    radiusMeters: 100
  }
};

// Generate realistic initial attendance records for mentors and trainees
export function generateInitialAttendance(): AttendanceRecord[] {
  const records: AttendanceRecord[] = [];
  const mentors = INITIAL_USERS.filter(u => u.role === 'mentor');
  const trainees = INITIAL_USERS.filter(u => u.role === 'trainee');
  const today = getTodayDateString();
  const [yearStr, monthStr, dayStr] = today.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const currentDay = parseInt(dayStr, 10);

  // Generate for day 1 to currentDay of this month
  for (let d = 1; d <= currentDay; d++) {
    const dStr = String(d).padStart(2, '0');
    const mStr = String(month).padStart(2, '0');
    const date = `${year}-${mStr}-${dStr}`;

    const dayOfWeek = new Date(year, month - 1, d).getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      continue; // Skip weekends
    }

    const isToday = d === currentDay;

    // 1. Generate Mentor Attendance (Verified by Admin)
    mentors.forEach((mentor, mIdx) => {
      if (isToday) {
        if (mIdx === 0) {
          // Siti Nurhaliza (WD-01): Checked in, pending Admin verification
          records.push({
            id: `att-${mentor.id}-${date}`,
            userId: mentor.id,
            userName: mentor.name,
            userNim: mentor.nim,
            userRole: 'mentor',
            kejuruanId: mentor.kejuruanId || 'kj-1',
            kejuruanName: mentor.kejuruanName || 'Web Development',
            date,
            checkInTime: '07:35:10',
            status: 'hadir',
            verificationStatus: 'pending',
            location: 'Ruang Lab Komputer 1',
            notes: 'Siap mengajar materi REST API & Database'
          });
        } else if (mIdx === 1) {
          // Dimas Arya (UX-02): Checked in, verified by Admin
          records.push({
            id: `att-${mentor.id}-${date}`,
            userId: mentor.id,
            userName: mentor.name,
            userNim: mentor.nim,
            userRole: 'mentor',
            kejuruanId: mentor.kejuruanId || 'kj-2',
            kejuruanName: mentor.kejuruanName || 'UI/UX Design',
            date,
            checkInTime: '07:42:15',
            status: 'hadir',
            verificationStatus: 'verified',
            verifiedBy: 'Bambang Sudirman, M.Kom (Admin)',
            verifiedAt: `${date} 07:50:00`,
            location: 'Studio Desain UI/UX',
            notes: 'Review tugas prototyping kelompok peserta'
          });
        } else if (mIdx === 2) {
          // Rizky Ramadhan (DA-03): Terlambat, pending Admin verification
          records.push({
            id: `att-${mentor.id}-${date}`,
            userId: mentor.id,
            userName: mentor.name,
            userNim: mentor.nim,
            userRole: 'mentor',
            kejuruanId: mentor.kejuruanId || 'kj-3',
            kejuruanName: mentor.kejuruanName || 'Data Analytics',
            date,
            checkInTime: '08:22:10',
            status: 'terlambat',
            verificationStatus: 'pending',
            location: 'Ruang Lab Data & AI',
            notes: 'Keterlambatan armada transportasi pagi'
          });
        } else if (mIdx === 3) {
          // Nadia Putri (DM-04): Izin, verified by Admin
          records.push({
            id: `att-${mentor.id}-${date}`,
            userId: mentor.id,
            userName: mentor.name,
            userNim: mentor.nim,
            userRole: 'mentor',
            kejuruanId: mentor.kejuruanId || 'kj-4',
            kejuruanName: mentor.kejuruanName || 'Digital Marketing',
            date,
            status: 'izin',
            verificationStatus: 'verified',
            verifiedBy: 'Bambang Sudirman, M.Kom (Admin)',
            verifiedAt: `${date} 07:30:00`,
            notes: 'Izin dinas seminar vokasi kementerian'
          });
        }
        // mIdx === 4: Not checked in yet today
      } else {
        // Past days for mentors: verified by Admin
        records.push({
          id: `att-${mentor.id}-${date}`,
          userId: mentor.id,
          userName: mentor.name,
          userNim: mentor.nim,
          userRole: 'mentor',
          kejuruanId: mentor.kejuruanId || 'kj-1',
          kejuruanName: mentor.kejuruanName || 'Umum',
          date,
          checkInTime: '07:40:00',
          checkOutTime: '17:05:00',
          status: 'hadir',
          verificationStatus: 'verified',
          verifiedBy: 'Bambang Sudirman, M.Kom (Admin)',
          verifiedAt: `${date} 08:00:00`,
          location: 'Punya Skill Akademi, Bandung',
          notes: 'Mengajar kelas kejuruan terjadwal'
        });
      }
    });

    // 2. Generate Trainee Attendance (Verified by Mentor)
    trainees.forEach((trainee, idx) => {
      // Find mentor for trainee
      const mentorObj = mentors.find(m => m.kejuruanId === trainee.kejuruanId);
      const mentorName = mentorObj?.name || 'Instruktur Kejuruan';

      const seed = (d * 17 + idx * 23) % 100;
      let status: 'hadir' | 'terlambat' | 'izin' | 'sakit' | 'alpha' = 'hadir';
      let checkInTime: string | undefined = undefined;
      let checkOutTime: string | undefined = undefined;
      let verificationStatus: 'pending' | 'verified' | 'rejected' = 'verified';
      let verifiedBy: string | undefined = mentorName;
      let notes = 'Hadir mengikuti sesi pelatihan onsite';

      if (isToday) {
        // Today's attendance state
        if (idx === 0) {
          // Trainee 1 (Aditya, WD-01): checked in, pending Mentor Siti verification
          status = 'hadir';
          checkInTime = '07:48:12';
          verificationStatus = 'pending';
          verifiedBy = undefined;
          notes = 'Sesi pagi: Implementasi State Management React';
        } else if (idx === 1) {
          // Trainee 2 (Farhan, WD-01): terlambat, pending Mentor Siti verification
          status = 'terlambat';
          checkInTime = '08:24:05';
          verificationStatus = 'pending';
          verifiedBy = undefined;
          notes = 'Terlambat kendala macet di jalan raya';
        } else if (idx === 4) {
          // Trainee 5 (Anisa, UX-02): verified by Mentor Dimas
          status = 'hadir';
          checkInTime = '07:55:40';
          verificationStatus = 'verified';
          verifiedBy = mentorName;
          notes = 'Mengerjakan wireframe prototyping Figma';
        } else if (idx === 5) {
          status = 'izin';
          verificationStatus = 'verified';
          verifiedBy = mentorName;
          notes = 'Izin urusan administrasi universitas (disetujui)';
        } else if (idx === 7) {
          // Trainee 8 (Reza, DA-03): checked in, pending Mentor Rizky verification
          status = 'hadir';
          checkInTime = '07:50:11';
          verificationStatus = 'pending';
          verifiedBy = undefined;
          notes = 'Analisis dataset e-commerce menggunakan Pandas';
        } else if (idx === 9) {
          status = 'sakit';
          verificationStatus = 'verified';
          verifiedBy = mentorName;
          notes = 'Demam dan flu (surat dokter terlampir)';
        } else if (idx % 2 === 0) {
          status = 'hadir';
          checkInTime = `07:${45 + (idx % 14)}:15`;
          verificationStatus = 'pending';
          verifiedBy = undefined;
        } else {
          // Some not checked in yet today
          return;
        }
      } else {
        // Past days
        if (seed < 72) {
          status = 'hadir';
          const min = String(40 + (seed % 19)).padStart(2, '0');
          checkInTime = `07:${min}:20`;
          checkOutTime = '17:05:30';
        } else if (seed < 86) {
          status = 'terlambat';
          const min = String(16 + (seed % 20)).padStart(2, '0');
          checkInTime = `08:${min}:45`;
          checkOutTime = '17:15:10';
          notes = 'Terlambat tiba karena kendala transportasi';
        } else if (seed < 92) {
          status = 'izin';
          notes = 'Izin keperluan keluarga / akademik';
        } else if (seed < 96) {
          status = 'sakit';
          notes = 'Sakit flu & istirahat';
        } else {
          status = 'alpha';
          notes = 'Tanpa keterangan';
        }
      }

      records.push({
        id: `att-${trainee.id}-${date}`,
        userId: trainee.id,
        userName: trainee.name,
        userNim: trainee.nim,
        userRole: 'trainee',
        kejuruanId: trainee.kejuruanId || 'kj-1',
        kejuruanName: trainee.kejuruanName || 'Umum',
        date,
        checkInTime,
        checkOutTime,
        status,
        verificationStatus,
        verifiedBy,
        verifiedAt: verifiedBy ? `${date} 09:00:00` : undefined,
        location: 'Punya Skill Akademi, Bandung',
        coordinates: { lat: -6.921045982595817, lng: 107.67498836568335 },
        notes
      });
    });
  }

  return records;
}

export const INITIAL_LEAVE_REQUESTS: LeaveRequest[] = [
  {
    id: 'leave-1',
    userId: 'user-trainee-5',
    userName: 'Anisa Maharani',
    userNim: 'TRN-2026-005',
    kejuruanId: 'kj-2',
    kejuruanName: 'UI/UX & Product Design',
    type: 'izin',
    startDate: getTodayDateString(),
    endDate: getTodayDateString(),
    daysCount: 1,
    reason: 'Menghadiri sidang yudisium kelulusan di kampus asal.',
    attachmentName: 'surat_keterangan_kampus.pdf',
    status: 'approved',
    submittedAt: `${getTodayDateString()} 07:10:00`,
    reviewedBy: 'Dimas Arya, M.Ds.',
    reviewedAt: `${getTodayDateString()} 07:45:00`,
    reviewNotes: 'Disetujui. Selamat atas sidang yudisiumnya!'
  },
  {
    id: 'leave-2',
    userId: 'user-trainee-9',
    userName: 'Clarissa Natalia',
    userNim: 'TRN-2026-009',
    kejuruanId: 'kj-3',
    kejuruanName: 'Data Analytics & AI',
    type: 'sakit',
    startDate: getTodayDateString(),
    endDate: getTodayDateString(),
    daysCount: 1,
    reason: 'Kondisi badan kurang fit, gejala demam tinggi dan flu berat.',
    attachmentName: 'surat_dokter_klinik.pdf',
    status: 'pending',
    submittedAt: `${getTodayDateString()} 07:30:15`,
    reviewNotes: ''
  },
  {
    id: 'leave-3',
    userId: 'user-trainee-2',
    userName: 'Farhan Zulkarnain',
    userNim: 'TRN-2026-002',
    kejuruanId: 'kj-1',
    kejuruanName: 'Web Development & Cloud',
    type: 'izin',
    startDate: '2026-09-28',
    endDate: '2026-09-29',
    daysCount: 2,
    reason: 'Keperluan mendesak keluarga di luar kota.',
    attachmentName: 'surat_izin_wali.pdf',
    status: 'pending',
    submittedAt: `${getTodayDateString()} 08:15:00`
  }
];
