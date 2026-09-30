import React, { useState, useMemo, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { MobileHeaderStatus } from '../MobileHeaderStatus';
import {
  Users,
  UserPlus,
  Plus,
  Search,
  Filter,
  X,
  GraduationCap,
  FileSpreadsheet,
  Upload,
  Download,
  KeyRound,
  Copy,
  Check,
  RefreshCw,
  Eye,
  EyeOff,
  AlertCircle,
  FileCheck2,
  Trash2,
  ShieldCheck,
  UserCheck,
  Loader2
} from 'lucide-react';
import { Kejuruan, User, Role } from '../../types';
import {
  exportUsersToExcel,
  downloadUserImportTemplate,
  parseUsersFromExcelFile,
  generate8DigitLoginCode,
  generateDefaultPassword
} from '../../utils/userExcelUtils';

export const TraineeManagementView: React.FC = () => {
  const {
    currentUser,
    users,
    kejuruanList,
    addUser,
    deleteUser,
    deleteUsersByRole,
    addKejuruan,
    importUsers,
    regenerateUserCredentials
  } = useApp();

  const [activeRoleFilter, setActiveRoleFilter] = useState<'all' | 'trainee' | 'mentor'>('all');
  const [selectedKejuruan, setSelectedKejuruan] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modals
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState<boolean>(false);
  const [isAddKjModalOpen, setIsAddKjModalOpen] = useState<boolean>(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState<boolean>(false);
  const [isClearModalOpen, setIsClearModalOpen] = useState<boolean>(false);
  const [clearRoleTarget, setClearRoleTarget] = useState<'trainee' | 'mentor' | 'all'>('trainee');
  const [confirmWord, setConfirmWord] = useState<string>('');
  const [isProcessingClear, setIsProcessingClear] = useState<boolean>(false);

  // Copied feedback
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedType, setCopiedType] = useState<'code' | 'pass' | null>(null);

  // Password visibility map
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});

  // Notification Banner
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // New User Form State
  const [newUserName, setNewUserName] = useState('');
  const [newUserNim, setNewUserNim] = useState('');
  const [newUserKejuruanId, setNewUserKejuruanId] = useState(kejuruanList[0]?.id || '');
  const [newUserKejuruanName, setNewUserKejuruanName] = useState(kejuruanList[0]?.name || '');
  const [newUserRole, setNewUserRole] = useState<'trainee' | 'mentor'>('trainee');
  const [newUserPassword, setNewUserPassword] = useState(generateDefaultPassword());

  // New Kejuruan Form State
  const [newKjName, setNewKjName] = useState('');
  const [newKjCode, setNewKjCode] = useState('');
  const [newKjCategory, setNewKjCategory] = useState('');
  const [newKjColor, setNewKjColor] = useState('#2563eb');
  const [newKjMentorName, setNewKjMentorName] = useState('');
  const [newKjDesc, setNewKjDesc] = useState('');

  // Import State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importingFile, setImportingFile] = useState<File | null>(null);
  const [parsedImportUsers, setParsedImportUsers] = useState<Partial<User>[]>([]);
  const [importError, setImportError] = useState<string | null>(null);
  const [isProcessingImport, setIsProcessingImport] = useState(false);
  const [importTargetRole, setImportTargetRole] = useState<'auto' | 'trainee' | 'mentor'>('auto');

  const trainees = useMemo(() => users.filter(u => u.role === 'trainee'), [users]);
  const mentors = useMemo(() => users.filter(u => u.role === 'mentor'), [users]);
  const normalizeKejuruanName = (name?: string) => name?.trim().toLocaleLowerCase('id-ID') || '';

  const userKejuruanOptions = useMemo(() => {
    const programs = new Map<string, string>();
    users
      .filter(user => user.role === 'trainee' || user.role === 'mentor')
      .forEach(user => {
        const masterProgram = kejuruanList.find(program => program.id === user.kejuruanId);
        const name = user.kejuruanName?.trim() || masterProgram?.name?.trim();
        const key = normalizeKejuruanName(name);
        if (key && name) programs.set(key, name);
      });

    return [...programs.entries()]
      .map(([value, name]) => ({ value, name }))
      .sort((a, b) => a.name.localeCompare(b.name, 'id'));
  }, [users, kejuruanList]);

  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      // Role filter
      if (activeRoleFilter !== 'all' && u.role !== activeRoleFilter) {
        return false;
      }
      // Kejuruan filter
      const masterProgram = kejuruanList.find(program => program.id === u.kejuruanId);
      const userProgram = normalizeKejuruanName(u.kejuruanName || masterProgram?.name);
      if (selectedKejuruan !== 'all' && userProgram !== selectedKejuruan) {
        return false;
      }
      // Search
      const q = searchQuery.toLowerCase();
      const matchSearch =
        u.name.toLowerCase().includes(q) ||
        u.nim.toLowerCase().includes(q) ||
        (u.loginCode && u.loginCode.includes(q)) ||
        (u.kejuruanName || '').toLowerCase().includes(q);

      return matchSearch;
    });
  }, [users, kejuruanList, activeRoleFilter, selectedKejuruan, searchQuery]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  const copyToClipboard = (text: string, id: string, type: 'code' | 'pass') => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setCopiedType(type);
    showToast(`Tersalin ke clipboard: ${text}`);
    setTimeout(() => {
      setCopiedId(null);
      setCopiedType(null);
    }, 2000);
  };

  const togglePasswordVisibility = (userId: string) => {
    setVisiblePasswords(prev => ({
      ...prev,
      [userId]: !prev[userId]
    }));
  };

  const handleOpenAddUserModal = (role: 'trainee' | 'mentor' = 'trainee') => {
    setNewUserRole(role);
    setNewUserNim(generate8DigitLoginCode());
    setNewUserPassword(generateDefaultPassword());
    setNewUserName('');
    setNewUserKejuruanId(kejuruanList[0]?.id || '');
    setNewUserKejuruanName(kejuruanList[0]?.name || '');
    setIsAddUserModalOpen(true);
  };

  const [isSubmittingUser, setIsSubmittingUser] = useState(false);

  const handleRegenerateCredentialsForUser = async (userId: string, userName: string) => {
    const creds = await regenerateUserCredentials(userId);
    if (!creds.success) {
      showToast(`Gagal memperbarui kredensial ${userName}: ${creds.message || 'database tidak dapat diperbarui.'}`);
      return;
    }
    showToast(`Kredensial baru untuk ${userName}: Kode ${creds.loginCode} · PW: ${creds.password}`);
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserName.trim()) return;

    const kj = kejuruanList.find(k => k.id === newUserKejuruanId);
    if (!/^\d{8}$/.test(newUserNim) || !/^\d{8}$/.test(newUserPassword)) {
      showToast('NIM/Kode Login dan sandi harus masing-masing 8 digit angka.');
      return;
    }
    setIsSubmittingUser(true);

    const res = await addUser({
      name: newUserName,
      role: newUserRole,
      nim: newUserNim,
      kejuruanId: newUserKejuruanId,
      kejuruanName: kj?.subPrograms?.includes(newUserKejuruanName) ? newUserKejuruanName : kj?.name || '',
      phone: '',
      loginCode: newUserNim,
      password: newUserPassword,
      status: 'active',
      joinedDate: new Date().toISOString().split('T')[0],
      avatar: `https://images.unsplash.com/photo-${newUserRole === 'mentor' ? '1534528741775-53994a69daeb' : '1535713875002-d1d0cf377fde'}?w=150`
    });

    setIsSubmittingUser(false);
    if (res.success) {
      showToast(res.message);
      setIsAddUserModalOpen(false);
    } else {
      showToast(`Gagal: ${res.message}`);
    }
  };

  const handleCreateKejuruan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKjName.trim() || !newKjCode.trim()) return;

    addKejuruan({
      name: newKjName,
      code: newKjCode.toUpperCase(),
      category: newKjCategory || 'Teknologi',
      color: newKjColor,
      mentorName: newKjMentorName || 'Instruktur Kejuruan',
      description: newKjDesc || 'Program kejuruan vokasi industri terapan.'
    });

    showToast(`Kejuruan ${newKjName} (${newKjCode}) berhasil ditambahkan!`);
    setIsAddKjModalOpen(false);
    setNewKjName('');
    setNewKjCode('');
    setNewKjDesc('');
    setNewKjMentorName('');
  };

  // Excel Export
  const handleExportExcel = () => {
    exportUsersToExcel(users, kejuruanList, activeRoleFilter);
    showToast('File Excel data akun peserta & mentor berhasil diunduh!');
  };

  // Excel Import Handling with explicit role separation
  const handleFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
    roleOverride?: 'auto' | 'trainee' | 'mentor'
  ) => {
    const file = e.target.files?.[0] || importingFile;
    if (!file) return;

    const roleToUse = roleOverride || importTargetRole;
    setImportingFile(file);
    setImportError(null);
    setIsProcessingImport(true);

    const res = await parseUsersFromExcelFile(file, kejuruanList, roleToUse);
    setIsProcessingImport(false);

    if (!res.success || !res.users) {
      setImportError(res.error || 'Gagal membaca file Excel.');
      setParsedImportUsers([]);
    } else {
      setParsedImportUsers(res.users);
      setImportError(null);
    }
  };

  const handleTargetRoleChange = async (newRole: 'auto' | 'trainee' | 'mentor') => {
    setImportTargetRole(newRole);
    if (importingFile) {
      setIsProcessingImport(true);
      const res = await parseUsersFromExcelFile(importingFile, kejuruanList, newRole);
      setIsProcessingImport(false);
      if (res.success && res.users) {
        setParsedImportUsers(res.users);
        setImportError(null);
      }
    } else if (parsedImportUsers.length > 0 && newRole !== 'auto') {
      setParsedImportUsers(prev =>
        prev.map(u => ({ ...u, role: newRole }))
      );
    }
  };

  const handleOpenImportModal = (role?: 'auto' | 'trainee' | 'mentor') => {
    const chosen = role || (activeRoleFilter === 'mentor' ? 'mentor' : activeRoleFilter === 'trainee' ? 'trainee' : 'auto');
    setImportTargetRole(chosen);
    setImportingFile(null);
    setParsedImportUsers([]);
    setImportError(null);
    setIsImportModalOpen(true);
  };

  const handleApplyImport = async () => {
    if (parsedImportUsers.length === 0) return;
    setIsProcessingImport(true);
    const result = await importUsers(parsedImportUsers);
    setIsProcessingImport(false);
    showToast(result.message);
    if (!result.success) {
      setImportError(result.message);
      return;
    }
    setIsImportModalOpen(false);
    setImportingFile(null);
    setParsedImportUsers([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const previewTrainees = useMemo(
    () => parsedImportUsers.filter(u => u.role === 'trainee').length,
    [parsedImportUsers]
  );
  const previewMentors = useMemo(
    () => parsedImportUsers.filter(u => u.role === 'mentor').length,
    [parsedImportUsers]
  );
  const previewAdmins = useMemo(
    () => parsedImportUsers.filter(u => u.role === 'admin').length,
    [parsedImportUsers]
  );

  const targetCount = useMemo(() => {
    if (clearRoleTarget === 'trainee') return trainees.length;
    if (clearRoleTarget === 'mentor') return mentors.length;
    return trainees.length + mentors.length;
  }, [clearRoleTarget, trainees.length, mentors.length]);

  const handleOpenClearModal = (role?: 'trainee' | 'mentor' | 'all') => {
    const chosenRole = role || (activeRoleFilter === 'mentor' ? 'mentor' : activeRoleFilter === 'trainee' ? 'trainee' : 'all');
    setClearRoleTarget(chosenRole);
    setConfirmWord('');
    setIsClearModalOpen(true);
  };

  const handleExecuteClear = async () => {
    if (confirmWord.trim() !== 'HAPUS') return;
    setIsProcessingClear(true);
    const res = await deleteUsersByRole(clearRoleTarget);
    setIsProcessingClear(false);
    setIsClearModalOpen(false);
    setConfirmWord('');
    showToast(res.message);
  };

  return (
    <div className="space-y-6">
      {/* Toast banner */}
      {toastMessage && (
        <div className="fixed bottom-7 left-1/2 -translate-x-1/2 z-50 bg-[#0D2F47] text-white px-5 py-3 rounded-xl shadow-xl text-xs font-bold flex items-center gap-2 animate-in fade-in">
          <FileCheck2 className="w-4 h-4 text-[#A9C7DE]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col lg:items-start gap-4 pb-4 border-b border-[#E4EAF0]">
        <div>
          <p className="text-[10px] font-bold tracking-[.14em] text-[#4C83B5] uppercase">
            ADMINISTRASI & MANAJEMEN AKUN
          </p>
          <h1 className="mt-1 text-2xl lg:text-3xl font-bold tracking-tight text-[#123B59]">
            Kelola Akun Peserta & Instruktur
          </h1>
          <MobileHeaderStatus />
        </div>

        {/* Action Buttons: Add, Export, Import, Kejuruan, and Clear All */}
        <div className="flex w-full flex-wrap items-center gap-2">
          {currentUser?.role === 'admin' && (
            <button
              onClick={() => handleOpenClearModal()}
              className="surface px-3.5 py-2.5 rounded-xl border border-rose-200 hover:bg-rose-50 text-xs font-bold text-rose-600 transition flex items-center gap-1.5 cursor-pointer shadow-xs"
              title="Hapus massal akun peserta atau mentor"
            >
              <Trash2 className="w-4 h-4 text-rose-500" />
              <span>Hapus Semua</span>
            </button>
          )}

          <button
            onClick={handleExportExcel}
            className="surface px-3.5 py-2.5 rounded-xl border border-[#E4EAF0] hover:bg-[#F8FAFB] text-xs font-bold text-[#123B59] transition flex items-center gap-1.5 cursor-pointer shadow-xs"
            title="Ekspor data akun & kode login ke file Excel"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>Ekspor Excel</span>
          </button>

          <button
            onClick={() => handleOpenImportModal()}
            className="surface px-3.5 py-2.5 rounded-xl border border-[#E4EAF0] hover:bg-[#F8FAFB] text-xs font-bold text-[#123B59] transition flex items-center gap-1.5 cursor-pointer shadow-xs"
            title="Impor peserta & mentor dari file Excel"
          >
            <Upload className="w-4 h-4 text-[#4C83B5]" />
            <span>Impor Excel</span>
          </button>

          <button
            onClick={() => handleOpenAddUserModal('trainee')}
            className="px-4 py-2.5 rounded-xl bg-[#123B59] hover:bg-[#0D2F47] text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm hover:-translate-y-0.5"
          >
            <UserPlus className="w-4 h-4 text-[#A9C7DE]" />
            <span>Tambah Akun</span>
          </button>

          <button
            onClick={() => setIsAddKjModalOpen(true)}
            className="surface px-3.5 py-2.5 rounded-xl border border-[#E4EAF0] hover:bg-[#F8FAFB] text-xs font-bold text-[#123B59] transition flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <Plus className="w-4 h-4 text-[#6F7F8D]" />
            <span>Kejuruan</span>
          </button>
        </div>
      </div>

      {/* Role Filter Tabs Strip */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap items-center gap-1 bg-[#F4F6F8] p-1 rounded-xl border border-[#E4EAF0]">
            <button
              type="button"
              onClick={() => setActiveRoleFilter('all')}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                activeRoleFilter === 'all'
                  ? 'bg-[#123B59] text-white shadow-xs'
                  : 'text-[#6F7F8D] hover:text-[#123B59]'
              }`}
            >
              Semua Akun ({users.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveRoleFilter('trainee')}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                activeRoleFilter === 'trainee'
                  ? 'bg-[#123B59] text-white shadow-xs'
                  : 'text-[#6F7F8D] hover:text-[#123B59]'
              }`}
            >
              <GraduationCap className="w-3.5 h-3.5" />
              <span>Peserta Magang ({trainees.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveRoleFilter('mentor')}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                activeRoleFilter === 'mentor'
                  ? 'bg-[#123B59] text-white shadow-xs'
                  : 'text-[#6F7F8D] hover:text-[#123B59]'
              }`}
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>Instruktur Mentor ({mentors.length})</span>
            </button>
          </div>

          {/* Quick Clear Button when filtered */}
          {currentUser?.role === 'admin' && activeRoleFilter === 'trainee' && trainees.length > 0 && (
            <button
              type="button"
              onClick={() => handleOpenClearModal('trainee')}
              className="text-[11px] font-bold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 px-3 py-1.5 rounded-xl flex items-center gap-1.5 cursor-pointer transition shadow-2xs"
              title="Hapus semua akun peserta magang"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-500" />
              <span>Hapus Semua Peserta ({trainees.length})</span>
            </button>
          )}

          {currentUser?.role === 'admin' && activeRoleFilter === 'mentor' && mentors.length > 0 && (
            <button
              type="button"
              onClick={() => handleOpenClearModal('mentor')}
              className="text-[11px] font-bold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 px-3 py-1.5 rounded-xl flex items-center gap-1.5 cursor-pointer transition shadow-2xs"
              title="Hapus semua akun instruktur mentor"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-500" />
              <span>Hapus Semua Mentor ({mentors.length})</span>
            </button>
          )}
        </div>

      </div>

      {/* Filter and Search Bar */}
      <div className="surface p-4 rounded-2xl border border-[#E4EAF0] flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <span className="text-xs font-bold text-[#123B59]">Filter Kejuruan:</span>
          <select
            value={selectedKejuruan}
            onChange={e => setSelectedKejuruan(e.target.value)}
            className="max-w-full text-xs py-2 px-3 rounded-xl border border-[#E4EAF0] bg-[#F8FAFB] text-[#123B59] font-bold outline-none focus:border-[#4C83B5]"
          >
            <option value="all">Semua Program Kejuruan</option>
            {userKejuruanOptions.map(program => (
              <option key={program.value} value={program.value}>
                {program.name}
              </option>
            ))}
          </select>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-3.5 h-3.5 text-[#6F7F8D] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
                            placeholder="Cari nama, NIM, atau kode 8-digit..."
            className="w-full text-xs pl-9 pr-3 py-2 rounded-xl border border-[#E4EAF0] bg-[#F8FAFB] text-[#123B59] outline-none focus:border-[#4C83B5]"
          />
        </div>
      </div>

      {/* Main Accounts Table with 8-Digit Codes and Passwords */}
      <div className="surface rounded-2xl border border-[#E4EAF0] overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-[#F8FAFB] border-b border-[#E4EAF0] text-[#6F7F8D] text-[10px] font-bold tracking-wide uppercase">
                <th className="py-3 px-3.5 w-10 text-center">No</th>
                <th className="py-3 px-3 min-w-[200px]">Nama Pengguna</th>
                <th className="py-3 px-3 w-28">Peran (Role)</th>
                <th className="py-3 px-3 w-36">NIM / Kode Login</th>
                <th className="py-3 px-3 min-w-[150px]">Kejuruan</th>
                <th className="py-3 px-3 min-w-[130px] bg-[#F4F6F8]">
                  Sandi 8 Digit
                </th>
                <th className="py-3 px-3 w-24 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E4EAF0]">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-[#6F7F8D] italic">
                    Tidak ada data akun yang cocok dengan filter pencarian.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user, idx) => {
                  const isPasswordVisible = !!visiblePasswords[user.id];
                  const isCodeCopied = copiedId === user.id && copiedType === 'code';
                  const isPassCopied = copiedId === user.id && copiedType === 'pass';

                  return (
                    <tr key={user.id} className="hover:bg-[#F8FAFB]/60 transition">
                      <td className="py-3 px-3.5 text-center text-[#6F7F8D] tabular-nums font-semibold">
                        {idx + 1}
                      </td>

                      {/* User Info */}
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2.5">
                          <img
                            src={user.avatar}
                            alt={user.name}
                            className="w-8 h-8 rounded-xl object-cover border border-[#E4EAF0] shrink-0"
                          />
                          <div className="min-w-0">
                            <div className="font-bold text-[#123B59] truncate">
                              {user.name}
                            </div>
                            <div className="text-[10px] text-[#6F7F8D] truncate">
                              Bergabung {user.joinedDate}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Role */}
                      <td className="py-3 px-3">
                        {user.role === 'admin' ? (
                          <span className="px-2.5 py-1 rounded-full bg-[#123B59] text-white font-bold text-[10px]">
                            Admin
                          </span>
                        ) : user.role === 'mentor' ? (
                          <span className="px-2.5 py-1 rounded-full bg-[#EAF2F8] text-[#28618F] font-bold text-[10px]">
                            Instruktur
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full bg-[#EEF5FA] text-[#4C83B5] font-bold text-[10px]">
                            Peserta
                          </span>
                        )}
                      </td>

                      {/* Single 8-digit account identifier */}
                      <td className="py-3 px-3 font-mono text-[11px] text-[#123B59] font-semibold">
                        <div className="inline-flex items-center gap-1.5">
                          <span>{user.loginCode || user.nim}</span>
                          <button type="button" onClick={() => copyToClipboard(user.loginCode || user.nim, user.id, 'code')} className="text-[#6F7F8D] hover:text-[#28618F] cursor-pointer" title="Salin NIM/Kode Login">
                            {isCodeCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </td>

                      {/* Kejuruan */}
                      <td className="py-3 px-3 text-[#123B59] font-medium truncate max-w-[180px]">
                        {user.kejuruanName || '-'}
                      </td>

                      {/* Password */}
                      <td className="py-3 px-3 bg-[#F8FAFB]/50">
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white border border-[#E4EAF0] shadow-2xs font-mono text-xs text-[#123B59] font-semibold">
                          <span>{isPasswordVisible ? user.password || 'Belum tersedia' : '••••••••'}</span>
                          {user.password && <button
                            type="button"
                            onClick={() => togglePasswordVisibility(user.id)}
                            className="text-[#6F7F8D] hover:text-[#123B59] cursor-pointer p-0.5"
                            title={isPasswordVisible ? 'Sembunyikan password' : 'Lihat password'}
                          >
                            {isPasswordVisible ? (
                              <EyeOff className="w-3.5 h-3.5" />
                            ) : (
                              <Eye className="w-3.5 h-3.5" />
                            )}
                          </button>}
                          {user.password && <button
                            type="button"
                            onClick={() => user.password && copyToClipboard(user.password, user.id, 'pass')}
                            className="text-[#6F7F8D] hover:text-[#123B59] cursor-pointer p-0.5"
                            title="Salin password"
                          >
                            {isPassCopied ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-3 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleRegenerateCredentialsForUser(user.id, user.name)}
                            className="p-1.5 rounded-lg hover:bg-[#EAF2F8] text-[#6F7F8D] hover:text-[#28618F] cursor-pointer transition"
                            title="Buat ulang NIM/Kode dan sandi 8 digit"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                          </button>
                          {user.role !== 'admin' && (
                            <button
                              type="button"
                              onClick={async () => {
                                if (confirm(`Hapus akun ${user.name}?`)) {
                                  const res = await deleteUser(user.id);
                                  showToast(res.message);
                                }
                              }}
                              className="p-1.5 rounded-lg hover:bg-[#FCF3F6] text-[#6F7F8D] hover:text-[#B84469] cursor-pointer transition"
                              title="Hapus akun"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL 1: ADD USER (TRAINEE / MENTOR) */}
      {isAddUserModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0D2F47]/45 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="surface rounded-2xl border border-[#E4EAF0] w-full max-w-lg p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#E4EAF0] pb-3">
              <div>
                <p className="text-[10px] font-bold tracking-[.13em] text-[#4C83B5] uppercase">
                  TAMBAH PENGGUNA
                </p>
                <h3 className="text-base font-bold text-[#123B59]">
                  Tambah Akun Pengguna Baru
                </h3>
              </div>
              <button
                onClick={() => setIsAddUserModalOpen(false)}
                className="text-[#6F7F8D] hover:text-[#123B59] p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-4 text-xs">
              <div>
                <div>
                  <label className="block text-[#123B59] font-bold mb-1">Peran Akun</label>
                  <select
                    value={newUserRole}
                    onChange={e => setNewUserRole(e.target.value as 'trainee' | 'mentor')}
                    className="w-full p-2.5 rounded-xl border border-[#E4EAF0] bg-[#F8FAFB] text-[#123B59] font-bold"
                  >
                    <option value="trainee">Peserta (Trainee)</option>
                    <option value="mentor">Instruktur (Mentor)</option>
                  </select>
                </div>

              </div>

              <div>
                <label className="block text-[#123B59] font-bold mb-1">Nama Lengkap</label>
                <input
                  type="text"
                  required
                  value={newUserName}
                  onChange={e => setNewUserName(e.target.value)}
                  placeholder="Contoh: Rian Pratama"
                  className="w-full p-2.5 rounded-xl border border-[#E4EAF0] bg-[#F8FAFB] text-[#123B59] font-semibold"
                />
              </div>

              <div>
                <label className="block text-[#123B59] font-bold mb-1">Program Kejuruan</label>
                <select
                  value={newUserKejuruanId}
                  onChange={e => {
                    const selected = kejuruanList.find(program => program.id === e.target.value);
                    setNewUserKejuruanId(e.target.value);
                    setNewUserKejuruanName(selected?.subPrograms?.[0] || selected?.name || '');
                  }}
                  className="w-full p-2.5 rounded-xl border border-[#E4EAF0] bg-[#F8FAFB] text-[#123B59] font-semibold"
                >
                  {kejuruanList.map(k => (
                    <option key={k.id} value={k.id}>
                      {k.code} - {k.name}
                    </option>
                  ))}
                </select>
                {kejuruanList.find(program => program.id === newUserKejuruanId)?.subPrograms?.length ? (
                  <select
                    value={newUserKejuruanName}
                    onChange={e => setNewUserKejuruanName(e.target.value)}
                    className="mt-2 w-full p-2.5 rounded-xl border border-[#E4EAF0] bg-[#F8FAFB] text-[#123B59] font-semibold"
                  >
                    {kejuruanList.find(program => program.id === newUserKejuruanId)?.subPrograms?.map(name => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                ) : null}
              </div>

              {/* 8-Digit Login Code & Password generation box */}
              <div className="p-3.5 rounded-2xl bg-[#EEF6FB] border border-[#C8DCEB] space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#123B59] text-[11px] flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5 text-[#4C83B5]" />
                    <span>Kredensial login (masing-masing 8 digit)</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setNewUserNim(generate8DigitLoginCode());
                      setNewUserPassword(generateDefaultPassword());
                    }}
                    className="text-[11px] text-[#4C83B5] hover:underline flex items-center gap-1 cursor-pointer font-bold"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Acak ulang</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-2">
                  <div>
                    <label className="block text-[10px] text-[#6F7F8D] font-bold mb-1">NIM / Kode Login (8 Digit)</label>
                    <input type="text" required inputMode="numeric" pattern="[0-9]{8}" maxLength={8} value={newUserNim} onChange={e => setNewUserNim(e.target.value.replace(/\D/g, ''))} placeholder="Contoh: 12345678" className="w-full p-2 rounded-xl border border-[#A9C7DE] bg-white font-mono font-bold tracking-wider text-[#28618F]" />
                  </div>
                  <div>
                    <label className="block text-[10px] text-[#6F7F8D] font-bold mb-1">
                      Sandi (8 Digit)
                    </label>
                    <input
                      type="text"
                      required
                      inputMode="numeric"
                      pattern="[0-9]{8}"
                      maxLength={8}
                      value={newUserPassword}
                      onChange={e => setNewUserPassword(e.target.value.replace(/\D/g, ''))}
                      className="w-full p-2 rounded-xl border border-[#A9C7DE] bg-white font-mono font-bold text-[#123B59]"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-[#E4EAF0]">
                <button
                  type="button"
                  onClick={() => setIsAddUserModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-[#E4EAF0] text-[#6F7F8D] hover:bg-[#F8FAFB] font-bold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#123B59] hover:bg-[#0D2F47] text-white font-bold cursor-pointer shadow-sm"
                >
                  Simpan Akun
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: IMPORT EXCEL */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0D2F47]/45 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="surface rounded-2xl border border-[#E4EAF0] w-full max-w-2xl p-6 space-y-4 shadow-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-[#E4EAF0] pb-3">
              <div>
                <p className="text-[10px] font-bold tracking-[.13em] text-[#4C83B5] uppercase">
                  IMPOR DATA MASSAL
                </p>
                <h3 className="text-base font-bold text-[#123B59] flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                  <span>Impor Akun Pengguna dari Excel</span>
                </h3>
              </div>
              <button
                onClick={() => setIsImportModalOpen(false)}
                className="text-[#6F7F8D] hover:text-[#123B59] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto space-y-4 pr-1 flex-1 text-xs">
              {/* Target Role Selector Tabs */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[11px] font-bold text-[#123B59]">
                    Kategori Akun yang Diimpor:
                  </label>
                  <span className="text-[10px] text-[#6F7F8D]">
                    {importTargetRole === 'trainee'
                      ? 'Semua data akan disimpan sebagai Peserta Magang'
                      : importTargetRole === 'mentor'
                      ? 'Semua data akan disimpan sebagai Instruktur Mentor'
                      : 'Peran dibaca otomatis dari kolom "Peran" / sheet Excel'}
                  </span>
                </div>
                <div className="p-1 bg-[#F4F6F8] rounded-xl border border-[#E4EAF0] grid grid-cols-3 gap-1">
                  <button
                    type="button"
                    onClick={() => handleTargetRoleChange('trainee')}
                    className={`py-2 px-2 text-xs font-bold rounded-lg transition cursor-pointer flex items-center justify-center gap-1.5 ${
                      importTargetRole === 'trainee'
                        ? 'bg-[#123B59] text-white shadow-xs'
                        : 'text-[#6F7F8D] hover:text-[#123B59]'
                    }`}
                  >
                    <GraduationCap className="w-3.5 h-3.5" />
                    <span>Khusus Peserta</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleTargetRoleChange('mentor')}
                    className={`py-2 px-2 text-xs font-bold rounded-lg transition cursor-pointer flex items-center justify-center gap-1.5 ${
                      importTargetRole === 'mentor'
                        ? 'bg-[#123B59] text-white shadow-xs'
                        : 'text-[#6F7F8D] hover:text-[#123B59]'
                    }`}
                  >
                    <UserCheck className="w-3.5 h-3.5" />
                    <span>Khusus Mentor</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleTargetRoleChange('auto')}
                    className={`py-2 px-2 text-xs font-bold rounded-lg transition cursor-pointer flex items-center justify-center gap-1.5 ${
                      importTargetRole === 'auto'
                        ? 'bg-[#123B59] text-white shadow-xs'
                        : 'text-[#6F7F8D] hover:text-[#123B59]'
                    }`}
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Otomatis (Kolom/Sheet)</span>
                  </button>
                </div>
              </div>

              {/* Template Download Card */}
              <div className="p-3.5 rounded-2xl bg-[#F8FAFB] border border-[#E4EAF0] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="font-bold text-[#123B59]">
                    Template Excel {importTargetRole === 'trainee' ? 'Peserta Magang' : importTargetRole === 'mentor' ? 'Instruktur Mentor' : 'Campuran'}
                  </div>
                  <div className="text-[11px] text-[#6F7F8D] mt-0.5">
                    Gunakan template resmi kami agar format kolom langsung sesuai dan terpisah rapi.
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => downloadUserImportTemplate(kejuruanList, importTargetRole)}
                    className="surface inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#C8DCEB] bg-white hover:bg-[#EAF2F8] text-[#123B59] text-[11px] font-bold cursor-pointer shadow-xs"
                    title="Unduh format template"
                  >
                    <Download className="w-3.5 h-3.5 text-[#4C83B5]" />
                    <span>Unduh Template ({importTargetRole === 'trainee' ? 'Peserta' : importTargetRole === 'mentor' ? 'Mentor' : 'Lengkap'})</span>
                  </button>
                </div>
              </div>

              {/* Upload Dropzone */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-[#A9C7DE] hover:border-[#123B59] rounded-2xl p-6 text-center cursor-pointer bg-[#F8FAFB] transition"
              >
                <Upload className="w-7 h-7 mx-auto text-[#4C83B5] mb-1.5" />
                <div className="font-bold text-[#123B59]">
                  {importingFile ? importingFile.name : 'Pilih atau Tarik Berkas Excel ke Sini'}
                </div>
                <p className="text-[11px] text-[#6F7F8D] mt-1">
                  Mendukung .xlsx, .xls, .csv &middot; Mode: <strong className="text-[#123B59]">{importTargetRole === 'trainee' ? 'Khusus Peserta Magang' : importTargetRole === 'mentor' ? 'Khusus Instruktur Mentor' : 'Deteksi Otomatis'}</strong>
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>

              {/* Error feedback */}
              {importError && (
                <div className="p-3.5 rounded-xl bg-[#FCF3F6] border border-[#E3C4D0] text-[#B84469] text-xs font-bold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-[#D95B83]" />
                  <span>{importError}</span>
                </div>
              )}

              {/* Preview Table of Parsed Users */}
              {parsedImportUsers.length > 0 && (
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-xs">
                      <span className="font-bold text-[#123B59]">
                        Pratinjau Data ({parsedImportUsers.length} Akun):
                      </span>{' '}
                      <span className="inline-flex items-center gap-1 font-mono text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                        {previewTrainees} Peserta
                      </span>{' '}
                      <span className="inline-flex items-center gap-1 font-mono text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                        {previewMentors} Mentor
                      </span>
                      <span className="inline-flex items-center gap-1 font-mono text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                        {previewAdmins} Admin
                      </span>
                    </div>

                    {/* Quick batch toggle buttons */}
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleTargetRoleChange('trainee')}
                        className="text-[10px] font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded-lg border border-blue-200 cursor-pointer"
                        title="Ubah semua baris di bawah menjadi Peserta"
                      >
                        Semua Peserta
                      </button>
                      <button
                        type="button"
                        onClick={() => handleTargetRoleChange('mentor')}
                        className="text-[10px] font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 px-2 py-1 rounded-lg border border-purple-200 cursor-pointer"
                        title="Ubah semua baris di bawah menjadi Mentor"
                      >
                        Semua Mentor
                      </button>
                    </div>
                  </div>

                  <div className="max-h-56 overflow-y-auto border border-[#E4EAF0] rounded-xl surface">
                    <table className="w-full text-left text-[11px]">
                      <thead className="bg-[#F8FAFB] sticky top-0 border-b border-[#E4EAF0] text-[#6F7F8D] font-bold">
                        <tr>
                          <th className="py-2.5 px-3 w-8">No</th>
                          <th className="py-2.5 px-3 min-w-[140px]">Nama</th>
                          <th className="py-2.5 px-3 min-w-[130px]">Peran (Role)</th>
                          <th className="py-2.5 px-3 min-w-[150px]">NIM / Kode Login</th>
                          <th className="py-2.5 px-3 min-w-[110px]">Kejuruan</th>
                          <th className="py-2.5 px-3 font-mono min-w-[90px]">Sandi 8 Digit</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E4EAF0]">
                        {parsedImportUsers.map((u, i) => (
                          <tr key={i} className="hover:bg-[#F8FAFB]/60 transition">
                            <td className="py-2 px-3 text-[#6F7F8D]">{i + 1}</td>
                            <td className="py-2 px-3 font-bold text-[#123B59]">
                              {u.name}
                            </td>
                            {/* Interactive Peran Dropdown */}
                            <td className="py-2 px-3">
                              <select
                                value={u.role || 'trainee'}
                                onChange={e => {
                                  const newRole = e.target.value as Role;
                                  setParsedImportUsers(prev => {
                                    const next = [...prev];
                                    const targetUser = next[i];
                                    next[i] = {
                                      ...targetUser,
                                      role: newRole,
                                    };
                                    return next;
                                  });
                                }}
                                className={`text-[11px] font-bold py-1 px-2 rounded-lg border outline-none cursor-pointer ${
                                  u.role === 'mentor'
                                    ? 'bg-purple-50 text-purple-800 border-purple-300'
                                    : 'bg-blue-50 text-blue-800 border-blue-300'
                                }`}
                              >
                                <option value="trainee">🎓 Peserta (Trainee)</option>
                                <option value="mentor">👨‍🏫 Instruktur (Mentor)</option>
                                <option value="admin">Administrator (Admin)</option>
                              </select>
                            </td>
                            <td className="py-2 px-3 font-mono text-[#6F7F8D]">{u.loginCode || u.nim}</td>
                            <td className="py-2 px-3 text-[#6F7F8D]">{u.kejuruanName}</td>
                            <td className="py-2 px-3 font-mono text-[#6F7F8D]">{u.password}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-[#E4EAF0] flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsImportModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-[#E4EAF0] text-[#6F7F8D] hover:bg-[#F8FAFB] font-bold cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={parsedImportUsers.length === 0 || isProcessingImport}
                onClick={handleApplyImport}
                className="px-5 py-2 rounded-xl bg-[#123B59] hover:bg-[#0D2F47] disabled:opacity-50 text-white font-bold cursor-pointer shadow-sm flex items-center gap-2"
              >
                {isProcessingImport ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Menyimpan ke TiDB...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4 text-emerald-400" />
                    <span>
                      Terapkan &amp; Simpan ({previewTrainees} Peserta, {previewMentors} Mentor, {previewAdmins} Admin)
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: ADD KEJURUAN */}
      {isAddKjModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0D2F47]/45 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="surface rounded-2xl border border-[#E4EAF0] w-full max-w-md p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#E4EAF0] pb-3">
              <div>
                <p className="text-[10px] font-bold tracking-[.13em] text-[#4C83B5] uppercase">
                  MASTER DATA
                </p>
                <h3 className="text-base font-bold text-[#123B59]">
                  Tambah Program Kejuruan Baru
                </h3>
              </div>
              <button
                onClick={() => setIsAddKjModalOpen(false)}
                className="text-[#6F7F8D] hover:text-[#123B59] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateKejuruan} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-[#123B59] font-bold mb-1">Nama Kejuruan</label>
                <input
                  type="text"
                  required
                  value={newKjName}
                  onChange={e => setNewKjName(e.target.value)}
                  placeholder="Contoh: Digital Marketing & Content Creator"
                  className="w-full p-2.5 rounded-xl border border-[#E4EAF0] bg-[#F8FAFB] text-[#123B59] font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[#123B59] font-bold mb-1">Kode Kelas</label>
                  <input
                    type="text"
                    required
                    value={newKjCode}
                    onChange={e => setNewKjCode(e.target.value)}
                    placeholder="DM-01"
                    className="w-full p-2.5 rounded-xl border border-[#E4EAF0] bg-[#F8FAFB] text-[#123B59] font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[#123B59] font-bold mb-1">Nama Mentor</label>
                  <input
                    type="text"
                    value={newKjMentorName}
                    onChange={e => setNewKjMentorName(e.target.value)}
                    placeholder="Nama Instruktur"
                    className="w-full p-2.5 rounded-xl border border-[#E4EAF0] bg-[#F8FAFB] text-[#123B59] font-semibold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[#123B59] font-bold mb-1">Deskripsi Singkat</label>
                <textarea
                  value={newKjDesc}
                  onChange={e => setNewKjDesc(e.target.value)}
                  placeholder="Kurikulum atau fokus pembelajaran..."
                  rows={2}
                  className="w-full p-2.5 rounded-xl border border-[#E4EAF0] bg-[#F8FAFB] text-[#123B59]"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-[#E4EAF0]">
                <button
                  type="button"
                  onClick={() => setIsAddKjModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-[#E4EAF0] text-[#6F7F8D] hover:bg-[#F8FAFB] font-bold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#123B59] hover:bg-[#0D2F47] text-white font-bold cursor-pointer shadow-sm"
                >
                  Simpan Kejuruan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: HAPUS SEMUA AKUN (ADMIN ONLY) */}
      {isClearModalOpen && currentUser?.role === 'admin' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0D2F47]/50 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="surface rounded-2xl border border-rose-200 w-full max-w-lg p-6 space-y-4 shadow-2xl bg-white">
            <div className="flex items-center justify-between border-b border-[#E4EAF0] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-rose-100 flex items-center justify-center text-rose-600 shrink-0">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] font-bold tracking-[.13em] text-rose-600 uppercase">
                    TINDAKAN BERBAHAYA &middot; KHUSUS ADMINISTRATOR
                  </p>
                  <h3 className="text-base font-bold text-[#123B59]">
                    Hapus Semua Akun Pengguna
                  </h3>
                </div>
              </div>
              <button
                onClick={() => setIsClearModalOpen(false)}
                className="text-[#6F7F8D] hover:text-[#123B59] p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <p className="text-[#6F7F8D]">
                Pilih kategori akun yang ingin dihapus massal dari database TiDB Cloud. Tindakan ini permanen dan tidak dapat dibatalkan.
              </p>

              {/* Selection Options */}
              <div className="space-y-2">
                <label
                  onClick={() => setClearRoleTarget('trainee')}
                  className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition ${
                    clearRoleTarget === 'trainee'
                      ? 'border-rose-400 bg-rose-50/70 text-[#123B59]'
                      : 'border-[#E4EAF0] hover:bg-[#F8FAFB] text-[#6F7F8D]'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <input
                      type="radio"
                      name="clearRole"
                      checked={clearRoleTarget === 'trainee'}
                      onChange={() => setClearRoleTarget('trainee')}
                      className="text-rose-600 focus:ring-rose-500"
                    />
                    <div>
                      <div className="font-bold text-[#123B59] flex items-center gap-1.5">
                        <GraduationCap className="w-4 h-4 text-[#4C83B5]" />
                        <span>Hapus Semua Peserta Magang</span>
                      </div>
                      <p className="text-[11px] text-[#6F7F8D]">
                        Menghapus seluruh akun peserta magang ({trainees.length} akun).
                      </p>
                    </div>
                  </div>
                  <span className="font-mono font-bold text-xs px-2.5 py-0.5 rounded-full bg-blue-100 text-[#28618F]">
                    {trainees.length} Peserta
                  </span>
                </label>

                <label
                  onClick={() => setClearRoleTarget('mentor')}
                  className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition ${
                    clearRoleTarget === 'mentor'
                      ? 'border-rose-400 bg-rose-50/70 text-[#123B59]'
                      : 'border-[#E4EAF0] hover:bg-[#F8FAFB] text-[#6F7F8D]'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <input
                      type="radio"
                      name="clearRole"
                      checked={clearRoleTarget === 'mentor'}
                      onChange={() => setClearRoleTarget('mentor')}
                      className="text-rose-600 focus:ring-rose-500"
                    />
                    <div>
                      <div className="font-bold text-[#123B59] flex items-center gap-1.5">
                        <UserCheck className="w-4 h-4 text-[#4C83B5]" />
                        <span>Hapus Semua Instruktur Mentor</span>
                      </div>
                      <p className="text-[11px] text-[#6F7F8D]">
                        Menghapus seluruh akun instruktur mentor ({mentors.length} akun).
                      </p>
                    </div>
                  </div>
                  <span className="font-mono font-bold text-xs px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-800">
                    {mentors.length} Mentor
                  </span>
                </label>

                <label
                  onClick={() => setClearRoleTarget('all')}
                  className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition ${
                    clearRoleTarget === 'all'
                      ? 'border-rose-400 bg-rose-50/70 text-[#123B59]'
                      : 'border-[#E4EAF0] hover:bg-[#F8FAFB] text-[#6F7F8D]'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <input
                      type="radio"
                      name="clearRole"
                      checked={clearRoleTarget === 'all'}
                      onChange={() => setClearRoleTarget('all')}
                      className="text-rose-600 focus:ring-rose-500"
                    />
                    <div>
                      <div className="font-bold text-[#123B59] flex items-center gap-1.5">
                        <Users className="w-4 h-4 text-rose-600" />
                        <span>Hapus Semua (Peserta &amp; Mentor)</span>
                      </div>
                      <p className="text-[11px] text-[#6F7F8D]">
                        Menghapus semua akun peserta dan mentor sekaligus ({trainees.length + mentors.length} akun).
                      </p>
                    </div>
                  </div>
                  <span className="font-mono font-bold text-xs px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-700">
                    {trainees.length + mentors.length} Akun
                  </span>
                </label>
              </div>

              {/* Safety notice for Admin account */}
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
                <div className="text-[11px] leading-relaxed">
                  <span className="font-bold">Akun Administrator Terlindungi:</span> Akun Administrator utama (
                  {users.find(u => u.role === 'admin')?.name || 'Admin'}) tidak akan pernah terhapus dari TiDB.
                </div>
              </div>

              {/* Security confirmation input */}
              <div className="space-y-1.5 pt-2">
                <label className="block text-[#123B59] font-bold text-xs">
                  Ketik kata <span className="font-mono text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200 font-extrabold">HAPUS</span> untuk konfirmasi:
                </label>
                <input
                  type="text"
                  value={confirmWord}
                  onChange={e => setConfirmWord(e.target.value.toUpperCase())}
                  placeholder="Ketik HAPUS"
                  className="w-full p-2.5 rounded-xl border border-rose-200 bg-[#FCF3F6] font-mono font-bold text-sm tracking-widest text-rose-700 outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-200"
                />
              </div>

              {/* Action buttons */}
              <div className="pt-3 border-t border-[#E4EAF0] flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsClearModalOpen(false)}
                  disabled={isProcessingClear}
                  className="px-4 py-2 rounded-xl border border-[#E4EAF0] text-[#6F7F8D] hover:bg-[#F8FAFB] font-bold cursor-pointer disabled:opacity-50"
                >
                  Batal
                </button>
                <button
                  type="button"
                  disabled={confirmWord.trim() !== 'HAPUS' || targetCount === 0 || isProcessingClear}
                  onClick={handleExecuteClear}
                  className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 disabled:pointer-events-none text-white font-bold cursor-pointer shadow-sm flex items-center gap-2"
                >
                  {isProcessingClear ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Menghapus dari TiDB...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      <span>Hapus {targetCount} Akun Sekarang</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
