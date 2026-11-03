import * as XLSX from 'xlsx';
import { User, Kejuruan, Role } from '../types';

/**
 * Generates an 8-digit random numeric code (e.g., "84920194")
 */
export function generate8DigitLoginCode(): string {
  // Generates an 8-digit integer string between 10000000 and 99999999
  const num = Math.floor(10000000 + Math.random() * 90000000);
  return num.toString();
}

/**
 * Generates an eight-digit numeric password.
 */
export function generateDefaultPassword(): string {
  return Math.floor(10000000 + Math.random() * 90000000).toString();
}

function readEightDigitValue(value: unknown): string {
  if (typeof value === 'number' && Number.isInteger(value) && value >= 0 && value < 100000000) {
    return String(value).padStart(8, '0');
  }
  return value == null ? '' : String(value).trim();
}

function importedKejuruanId(programName: string): string {
  let hash = 2166136261;
  for (const char of programName.trim().toLowerCase()) {
    hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  }
  return `kj-import-${(hash >>> 0).toString(36)}`;
}

/**
 * Export Trainees, Mentors, or All Users to Excel format (.xlsx)
 */
export function exportUsersToExcel(
  users: User[],
  kejuruanList: Kejuruan[],
  filterRole: 'all' | 'trainee' | 'mentor' = 'all'
): void {
  const targetUsers = users.filter(u => u.role !== 'admin' && (filterRole === 'all' || u.role === filterRole));

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([
    ['Nama Lengkap', 'NIM / Kode Login (8 Digit)', 'Sandi (8 Digit)', 'Program Kejuruan', 'Role'],
    ...targetUsers.map(user => [
      user.name,
      user.loginCode || user.nim || '',
      // Password tidak dikirim oleh API karena hanya hash yang tersimpan.
      user.password || '',
      user.kejuruanName || '',
      user.role
    ])
  ]);
  ws['!cols'] = [{ wch: 28 }, { wch: 28 }, { wch: 20 }, { wch: 30 }, { wch: 16 }];
  for (let row = 2; row <= targetUsers.length + 1; row++) {
    const cell = ws[`B${row}`];
    if (cell) cell.z = '@';
  }
  XLSX.utils.book_append_sheet(wb, ws, 'Data Pengguna');

  const fileLabel = filterRole === 'trainee' ? 'Peserta' : filterRole === 'mentor' ? 'Mentor' : 'Semua_Pengguna';
  const fileName = `HadirKu_Data_Akun_${fileLabel}_${new Date().toISOString().split('T')[0]}.xlsx`;

  XLSX.writeFile(wb, fileName);
}

/**
 * Download a blank sample Excel template for bulk import
 * Supports role-specific templates ('trainee', 'mentor', or 'all')
 */
export function downloadUserImportTemplate(
  kejuruanList: Kejuruan[],
  targetRole: 'all' | 'auto' | 'trainee' | 'mentor' = 'all'
): void {
  const wb = XLSX.utils.book_new();
  const headers = ['Nama Lengkap', 'NIM / Kode Login (8 Digit)', 'Sandi (8 Digit)', 'Program Kejuruan', 'Role'];
  const sheetName = targetRole === 'mentor' ? 'Mentor' : targetRole === 'trainee' ? 'Peserta' : 'Data Pengguna';
  const ws = XLSX.utils.aoa_to_sheet([headers]);
  ws['!cols'] = [{ wch: 28 }, { wch: 28 }, { wch: 20 }, { wch: 30 }, { wch: 16 }];
  XLSX.utils.book_append_sheet(wb, ws, sheetName);

  const referenceSheet = XLSX.utils.aoa_to_sheet([
    ['Kode Program', 'Program Kejuruan'],
    ...kejuruanList.map(program => [program.code, program.name]),
  ]);
  referenceSheet['!cols'] = [{ wch: 18 }, { wch: 32 }];
  XLSX.utils.book_append_sheet(wb, referenceSheet, 'Referensi Program');

  const fileName = targetRole === 'mentor'
    ? 'Template_Import_Mentor.xlsx'
    : targetRole === 'trainee'
    ? 'Template_Import_Peserta.xlsx'
    : 'Template_Import_Pengguna.xlsx';
  XLSX.writeFile(wb, fileName);
}

/**
 * Parse an Excel file (.xlsx / .xls / .csv) into User candidate objects
 * Supports explicit targetRole ('auto' | 'trainee' | 'mentor') to guarantee separation
 */
export async function parseUsersFromExcelFile(
  file: File,
  kejuruanList: Kejuruan[],
  targetRole: 'auto' | 'trainee' | 'mentor' = 'auto'
): Promise<{ success: boolean; users?: Partial<User>[]; error?: string }> {
  try {
    const buffer = await file.arrayBuffer();
    const wb = XLSX.read(buffer, { type: 'array' });

    if (!wb.SheetNames || wb.SheetNames.length === 0) {
      return { success: false, error: 'File Excel tidak memiliki lembar kerja (sheet).' };
    }

    const parsedUsers: Partial<User>[] = [];

    // Parse all sheets or detect role by sheet name
    for (const sheetName of wb.SheetNames) {
      const ws = wb.Sheets[sheetName];
      if (!ws) continue;

      const rawRows = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { header: 1 });
      if (!rawRows || rawRows.length < 2) continue;

      // Detect sheet-level role from sheet name
      const sheetLower = sheetName.toLowerCase();
      let sheetRole: Role | null = null;
      if (sheetLower.includes('admin') || sheetLower.includes('administrator')) {
        sheetRole = 'admin';
      } else if (
        sheetLower.includes('mentor') ||
        sheetLower.includes('instruktur') ||
        sheetLower.includes('guru') ||
        sheetLower.includes('dosen') ||
        sheetLower.includes('pengajar')
      ) {
        sheetRole = 'mentor';
      } else if (
        sheetLower.includes('peserta') ||
        sheetLower.includes('siswa') ||
        sheetLower.includes('trainee') ||
        sheetLower.includes('magang')
      ) {
        sheetRole = 'trainee';
      }

      // Find the header row (look for "nama", "nim", "nip", "peran", "role")
      let headerRowIdx = -1;
      for (let i = 0; i < Math.min(rawRows.length, 12); i++) {
        const row = rawRows[i] as any[];
        if (Array.isArray(row)) {
          const text = row.map(c => String(c || '').toLowerCase()).join(' ');
          if (
            text.includes('nama') ||
            text.includes('nim') ||
            text.includes('nip') ||
            text.includes('peran') ||
            text.includes('role') ||
            text.includes('kejuruan')
          ) {
            headerRowIdx = i;
            break;
          }
        }
      }

      if (headerRowIdx === -1) continue;

      const headerRow = (rawRows[headerRowIdx] as any[]).map(c => String(c || '').trim().toLowerCase());

      // Comprehensive keyword matching for columns
      const findColIdx = (keywords: string[]) => {
        return headerRow.findIndex(h => keywords.some(k => h.includes(k)));
      };

      const nameIdx = findColIdx(['nama']);
      const combinedIdentifierIdx = findColIdx([
        'nim / kode login', 'nim/kode login', 'nim - kode login', 'nim / code', 'nim/code', 'kode login / nim'
      ]);
      const nimIdx = findColIdx(['nim', 'nip', 'nis', 'nomor induk', 'id']);
      const roleIdx = findColIdx(['peran', 'role', 'jabatan', 'kategori', 'tipe', 'posisi', 'sebagai', 'status peran']);
      const kjIdx = findColIdx(['program kejuruan', 'kejuruan', 'program', 'jurusan', 'kelas']);
      const codeIdx = findColIdx(['kode login', 'login code', 'kode 8 digit', 'code 8 digit', 'code', 'kode']);
      const identifierIdx = combinedIdentifierIdx !== -1
        ? combinedIdentifierIdx
        : codeIdx !== -1
        ? codeIdx
        : nimIdx;
      const passIdx = findColIdx(['password', 'kata sandi', 'sandi', 'pw', 'pass']);

      if (nameIdx === -1) continue;

      for (let r = headerRowIdx + 1; r < rawRows.length; r++) {
        const row = rawRows[r] as any[];
        if (!row || row.length === 0) continue;

        const rawName = row[nameIdx] ? String(row[nameIdx]).trim() : '';
        if (
          !rawName ||
          rawName.startsWith('CATATAN') ||
          rawName.startsWith('DAFTAR') ||
          rawName.startsWith('Petunjuk') ||
          rawName.startsWith('TEMPLATE')
        ) {
          continue;
        }

        // Determine Role with strict separation
        let finalRole: Role | null = targetRole === 'auto' ? sheetRole : targetRole;

        if (targetRole === 'mentor') {
          finalRole = 'mentor';
        } else if (targetRole === 'trainee') {
          finalRole = 'trainee';
        } else {
          // Auto detection mode
          if (roleIdx !== -1 && row[roleIdx]) {
            const rVal = String(row[roleIdx]).trim().toLowerCase();
            const adminKeywords = ['admin', 'administrator'];
            const mentorKeywords = ['mentor', 'instruktur', 'guru', 'pengajar', 'pembimbing', 'dosen', 'trainer', 'fasilitator', 'pendamping', 'mnt'];
            const traineeKeywords = ['trainee', 'peserta', 'siswa', 'murid', 'mahasiswa', 'magang', 'pelajar', 'trn'];

            if (adminKeywords.some(k => rVal.includes(k))) {
              finalRole = 'admin';
            } else if (mentorKeywords.some(k => rVal.includes(k))) {
              finalRole = 'mentor';
            } else if (traineeKeywords.some(k => rVal.includes(k))) {
              finalRole = 'trainee';
            } else if (sheetRole) {
              finalRole = sheetRole;
            } else {
              return { success: false, error: `Role "${rVal}" pada baris ${r + 1} harus mentor atau trainee.` };
            }
          } else if (sheetRole) {
            finalRole = sheetRole;
          } else if (identifierIdx !== -1 && row[identifierIdx]) {
            const nimVal = String(row[identifierIdx]).trim().toUpperCase();
            if (nimVal.startsWith('MNT') || nimVal.startsWith('MENTOR') || nimVal.startsWith('NIP')) {
              finalRole = 'mentor';
            } else if (nimVal.startsWith('TRN') || nimVal.startsWith('NIM') || nimVal.startsWith('NIS')) {
              finalRole = 'trainee';
            }
          }
        }

        if (!finalRole) {
          return {
            success: false,
            error: `Role tidak dapat dideteksi untuk baris ${r + 1}. Pilih mode Mentor/Peserta atau gunakan nama sheet Mentor/Peserta.`,
          };
        }

        // NIM / ID
        const rawIdentifier = identifierIdx !== -1 ? readEightDigitValue(row[identifierIdx]) : '';
        if (!/^\d{8}$/.test(rawIdentifier)) {
          return {
            success: false,
            error: `NIM/Kode Login pada baris ${r + 1} harus tepat 8 digit angka. Atur kolom sebagai teks agar nol di depan tidak hilang.`,
          };
        }

        // Kejuruan
        const programValue = kjIdx !== -1 && row[kjIdx] ? String(row[kjIdx]).trim() : '';
        const targetKj = programValue
          ? kejuruanList.find(k =>
              k.code.toLowerCase() === programValue.toLowerCase() ||
              k.name.toLowerCase() === programValue.toLowerCase() ||
              k.subPrograms?.some(name => name.toLowerCase() === programValue.toLowerCase()) ||
              programValue.toLowerCase().startsWith(`${k.code.toLowerCase()} -`) ||
              programValue.toLowerCase().startsWith(`${k.code.toLowerCase()} :`)
            )
          : undefined;
        if (!programValue && finalRole !== 'admin') {
          return {
            success: false,
            error: `Program Kejuruan pada baris ${r + 1} kosong. Isi nama program sesuai data Excel.`,
          };
        }
        // NIM and login code use the same eight-digit account identifier.
        const rawCode = rawIdentifier;

        // Password is an eight-digit numeric value.
        let rawPass = '';
        if (passIdx !== -1 && row[passIdx]) {
          rawPass = readEightDigitValue(row[passIdx]);
        }
        if (!/^\d{8}$/.test(rawPass)) {
          return { success: false, error: `Sandi pada baris ${r + 1} harus tepat 8 digit angka.` };
        }

        parsedUsers.push({
          name: rawName,
          nim: rawIdentifier,
          role: finalRole,
          kejuruanId: programValue ? (targetKj?.id || importedKejuruanId(programValue)) : undefined,
          kejuruanName: programValue
            ? (targetKj?.subPrograms?.find(name => name.toLowerCase() === programValue.toLowerCase()) || targetKj?.name || programValue)
            : undefined,
          loginCode: rawCode,
          password: rawPass,
          phone: '',
          status: 'active',
          joinedDate: new Date().toISOString().split('T')[0],
          avatar: `https://images.unsplash.com/photo-${
            finalRole === 'mentor' ? '1534528741775-53994a69daeb' : '1535713875002-d1d0cf377fde'
          }?w=150&auto=format&fit=crop&q=80`
        });
      }
    }

    if (parsedUsers.length === 0) {
      return { success: false, error: 'Tidak ada baris data pengguna yang valid untuk diimpor. Pastikan file memiliki baris data di bawah judul kolom.' };
    }

    return { success: true, users: parsedUsers };
  } catch (err: any) {
    return { success: false, error: err.message || 'Gagal membaca berkas Excel.' };
  }
}
