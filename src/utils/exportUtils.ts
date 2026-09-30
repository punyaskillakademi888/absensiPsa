import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { User, AttendanceRecord, Kejuruan } from '../types';
import { INDONESIAN_MONTHS, getDatesForMonth, getDaysInMonth, isWeekend } from './dateUtils';
import { matchesKejuruanFilter, getKejuruanFilterOptions } from './kejuruanCodes';
 
interface ExportParams {
  year: number;
  month: number; // 1-12
  selectedKejuruanId: string; // 'all' or kejuruan ID
  kejuruanList: Kejuruan[];
  trainees: User[];
  records: AttendanceRecord[];
}

export interface TraineeRecapSummary {
  trainee: User;
  dailyStatus: Record<number, string>; // day 1..31 -> 'H' | 'T' | 'I' | 'S' | 'A' | '-'
  hadir: number;
  terlambat: number;
  izin: number;
  sakit: number;
  alpha: number;
  totalWorkingDays: number;
  effectivePresent: number; // hadir + terlambat
  attendancePercentage: number;
}

export function computeMonthlyRecapData(params: ExportParams): {
  summaries: TraineeRecapSummary[];
  daysInMonth: number;
  workingDaysCount: number;
  monthName: string;
  kejuruanName: string;
} {
  const { year, month, selectedKejuruanId, kejuruanList, trainees, records } = params;
  const monthName = INDONESIAN_MONTHS[month - 1];
  const daysInMonth = getDaysInMonth(year, month);
  const dates = getDatesForMonth(year, month);

  // Filter trainees by selected Kejuruan
  const filteredTrainees = trainees.filter(t =>
    matchesKejuruanFilter(selectedKejuruanId, kejuruanList, t.kejuruanId, t.kejuruanName)
  );

  // Calculate working days in the month (excluding weekends)
  let workingDaysCount = 0;
  dates.forEach(d => {
    if (!isWeekend(d)) {
      workingDaysCount++;
    }
  });

  const selectedOption = getKejuruanFilterOptions(kejuruanList).find(option => option.value === selectedKejuruanId);
  const kejuruanObj = kejuruanList.find(k => k.id === (selectedOption?.programId || selectedKejuruanId));
  const kejuruanName =
    selectedKejuruanId === 'all'
      ? trainees.length === 1 && trainees[0].kejuruanName
        ? trainees[0].kejuruanName
        : 'Semua Kejuruan'
      : selectedOption?.name || kejuruanObj?.name || 'Kejuruan';

  // Compute stats per trainee
  const summaries: TraineeRecapSummary[] = filteredTrainees.map(trainee => {
    let hadir = 0;
    let terlambat = 0;
    let izin = 0;
    let sakit = 0;
    let alpha = 0;
    const dailyStatus: Record<number, string> = {};

    for (let day = 1; day <= daysInMonth; day++) {
      const dayStr = String(day).padStart(2, '0');
      const monthStr = String(month).padStart(2, '0');
      const dateStr = `${year}-${monthStr}-${dayStr}`;
      const isDayWeekend = isWeekend(dateStr);

      if (isDayWeekend) {
        dailyStatus[day] = 'L'; // Libur akhir pekan
        continue;
      }

      // Find record for this trainee & date
      const record = records.find(r => r.userId === trainee.id && r.date === dateStr);

      if (!record) {
        // If it's a past working day, count as Alpha or not yet recorded
        const todayStr = new Date().toISOString().split('T')[0];
        if (dateStr <= todayStr) {
          alpha++;
          dailyStatus[day] = 'A';
        } else {
          dailyStatus[day] = '-';
        }
      } else {
        switch (record.status) {
          case 'hadir':
            hadir++;
            dailyStatus[day] = 'H';
            break;
          case 'terlambat':
            terlambat++;
            dailyStatus[day] = 'T';
            break;
          case 'izin':
            izin++;
            dailyStatus[day] = 'I';
            break;
          case 'sakit':
            sakit++;
            dailyStatus[day] = 'S';
            break;
          case 'alpha':
            alpha++;
            dailyStatus[day] = 'A';
            break;
          default:
            dailyStatus[day] = '-';
        }
      }
    }

    const effectivePresent = hadir + terlambat;
    const effectiveTotal = workingDaysCount > 0 ? workingDaysCount : 1;
    const attendancePercentage = Math.round((effectivePresent / effectiveTotal) * 100);

    return {
      trainee,
      dailyStatus,
      hadir,
      terlambat,
      izin,
      sakit,
      alpha,
      totalWorkingDays: workingDaysCount,
      effectivePresent,
      attendancePercentage
    };
  });

  return {
    summaries,
    daysInMonth,
    workingDaysCount,
    monthName,
    kejuruanName
  };
}

/**
 * Export to Excel format (.xlsx)
 */
export function exportToExcel(params: ExportParams): void {
  const { summaries, daysInMonth, monthName, kejuruanName } = computeMonthlyRecapData(params);
  const { year, month } = params;

  // Build rows for Excel
  const isSingle = summaries.length === 1;
  const titleRow = [
    isSingle
      ? `SLIP REKAPITULASI KEHADIRAN BULANAN - ${summaries[0].trainee.name.toUpperCase()}`
      : 'LAPORAN REKAPITULASI KEHADIRAN BULANAN PESERTA'
  ];
  const subTitleRow = ['Punya Skill Akademi, Bandung'];
  const infoRow1 = isSingle
    ? [`Periode: ${monthName} ${year}`, ``, `Nama: ${summaries[0].trainee.name} (NIM: ${summaries[0].trainee.nim})`]
    : [`Periode: ${monthName} ${year}`, ``, `Kejuruan: ${kejuruanName}`];
  const infoRow2 = isSingle
    ? [`Tanggal Cetak: ${new Date().toLocaleDateString('id-ID')}`, ``, `Kejuruan: ${summaries[0].trainee.kejuruanName || kejuruanName}`]
    : [`Tanggal Cetak: ${new Date().toLocaleDateString('id-ID')}`, ``, `Total Peserta: ${summaries.length} Orang`];
  const blankRow: string[] = [];

  // Header columns
  const header = [
    'No',
    'NIM',
    'Nama Peserta',
    'Kejuruan',
    // Days 1..N
    ...Array.from({ length: daysInMonth }, (_, i) => `Tgl ${i + 1}`),
    'Hadir (H)',
    'Terlambat (T)',
    'Izin (I)',
    'Sakit (S)',
    'Alpha (A)',
    '% Kehadiran'
  ];

  const dataRows = summaries.map((s, idx) => {
    const dailyCols = Array.from({ length: daysInMonth }, (_, i) => {
      const code = s.dailyStatus[i + 1] || '-';
      return code;
    });

    return [
      idx + 1,
      s.trainee.nim,
      s.trainee.name,
      s.trainee.kejuruanName || '-',
      ...dailyCols,
      s.hadir,
      s.terlambat,
      s.izin,
      s.sakit,
      s.alpha,
      `${s.attendancePercentage}%`
    ];
  });

  // Footer legend & summary row
  const legendTitle = ['KETERANGAN KODE:'];
  const legendContent1 = ['H: Hadir Tepat Waktu', 'T: Terlambat', 'I: Izin', 'S: Sakit', 'A: Alpha / Tanpa Keterangan', 'L: Libur / Weekend'];

  const wsData = [
    titleRow,
    subTitleRow,
    blankRow,
    infoRow1,
    infoRow2,
    blankRow,
    header,
    ...dataRows,
    blankRow,
    legendTitle,
    legendContent1
  ];

  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Set column widths
  const colWidths = [
    { wch: 5 },  // No
    { wch: 15 }, // NIM
    { wch: 25 }, // Nama
    { wch: 24 }, // Kejuruan
    ...Array.from({ length: daysInMonth }, () => ({ wch: 5 })),
    { wch: 10 }, // H
    { wch: 12 }, // T
    { wch: 9 },  // I
    { wch: 9 },  // S
    { wch: 10 }, // A
    { wch: 13 }  // %
  ];
  ws['!cols'] = colWidths;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, `Rekap ${monthName.substring(0, 3)} ${year}`);

  const safeKejuruanName = kejuruanName.replace(/[^a-zA-Z0-9]/g, '_');
  const safeName = isSingle
    ? summaries[0].trainee.name.replace(/[^a-zA-Z0-9]/g, '_')
    : safeKejuruanName;
  const fileName = isSingle
    ? `Slip_Kehadiran_${safeName}_${monthName}_${year}.xlsx`
    : `Rekap_Kehadiran_${monthName}_${year}_${safeKejuruanName}.xlsx`;
  XLSX.writeFile(wb, fileName);
}

/**
 * Export to PDF format (.pdf)
 */
export function exportToPDF(params: ExportParams): void {
  const { summaries, monthName, kejuruanName, workingDaysCount } = computeMonthlyRecapData(params);
  const { year } = params;
  const isSingle = summaries.length === 1;

  // Use landscape A4 for wider monthly attendance table
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4'
  });

  // Header Banner styling
  doc.setFillColor(13, 47, 71); // #0D2F47
  doc.rect(0, 0, 297, 18, 'F');

  // Title
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('PUNYA SKILL AKADEMI - SISTEM ABSENSI & REKAPITULASI PELATIHAN KEJURUAN', 14, 11);

  // Subtitle / Info text
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(
    isSingle
      ? 'SLIP REKAPITULASI KEHADIRAN BULANAN (INDIVIDU)'
      : 'LAPORAN REKAPITULASI KEHADIRAN BULANAN',
    14,
    27
  );

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(`Periode Pelatihan : ${monthName} ${year}  |  Hari Kerja Efektif: ${workingDaysCount} Hari`, 14, 33);
  if (isSingle) {
    doc.text(`Nama Peserta      : ${summaries[0].trainee.name} (${summaries[0].trainee.nim})  |  Kejuruan: ${summaries[0].trainee.kejuruanName || kejuruanName}`, 14, 38);
    doc.text(`Tanggal Cetak     : ${new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`, 14, 43);
  } else {
    doc.text(`Kejuruan / Bidang : ${kejuruanName}  |  Total Peserta: ${summaries.length} Siswa`, 14, 38);
    doc.text(`Tanggal Cetak     : ${new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`, 14, 43);
  }

  // Table Data
  const tableHead = [
    ['No', 'NIM', 'Nama Peserta', 'Kejuruan', 'Hadir (H)', 'Telat (T)', 'Izin (I)', 'Sakit (S)', 'Alpha (A)', 'Tingkat Kehadiran', 'Predikat']
  ];

  const tableBody = summaries.map((s, idx) => {
    let predikat = 'Sangat Baik';
    if (s.attendancePercentage < 75) predikat = 'Perlu Perhatian';
    else if (s.attendancePercentage < 85) predikat = 'Cukup';
    else if (s.attendancePercentage < 95) predikat = 'Baik';

    return [
      idx + 1,
      s.trainee.nim,
      s.trainee.name,
      s.trainee.kejuruanName || '-',
      s.hadir,
      s.terlambat,
      s.izin,
      s.sakit,
      s.alpha,
      `${s.attendancePercentage}%`,
      predikat
    ];
  });

  autoTable(doc, {
    startY: 48,
    head: tableHead,
    body: tableBody,
    theme: 'grid',
    headStyles: {
      fillColor: [37, 99, 235],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8.5,
      halign: 'center'
    },
    bodyStyles: {
      fontSize: 8,
      cellPadding: 2
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 10 },
      1: { halign: 'center', cellWidth: 26 },
      2: { halign: 'left', cellWidth: 50 },
      3: { halign: 'left', cellWidth: 50 },
      4: { halign: 'center', cellWidth: 18 },
      5: { halign: 'center', cellWidth: 18 },
      6: { halign: 'center', cellWidth: 16 },
      7: { halign: 'center', cellWidth: 16 },
      8: { halign: 'center', cellWidth: 18 },
      9: { halign: 'center', cellWidth: 26 },
      10: { halign: 'center', cellWidth: 26 }
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252]
    }
  });

  // Calculate final Y position for signature block
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const finalY = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY + 12 : 150;
  
  // Signature Block
  if (finalY < 185) {
    doc.setFontSize(8.5);
    doc.setTextColor(51, 65, 85);
    doc.setFont('helvetica', 'normal');

    // Left Signature
    doc.text('Mengetahui,', 30, finalY);
    doc.text('Instruktur / Mentor Kejuruan', 30, finalY + 5);
    doc.line(30, finalY + 25, 80, finalY + 25);
    doc.text('( .................................................. )', 30, finalY + 29);

    // Right Signature
    doc.text('Disahkan Oleh,', 210, finalY);
    doc.text('Koordinator Program Pelatihan', 210, finalY + 5);
    doc.line(210, finalY + 25, 265, finalY + 25);
    doc.text('Abdul Rozzak Junaidi', 210, finalY + 29);
  }

  // Footer notes & page number
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text('Dokumen ini dicetak otomatis melalui Aplikasi HadirKu - Sistem Absensi Terpadu.', 14, 205);
    doc.text(`Halaman ${i} dari ${pageCount}`, 265, 205);
  }

  const safeKejuruanName = kejuruanName.replace(/[^a-zA-Z0-9]/g, '_');
  const safeName = isSingle
    ? summaries[0].trainee.name.replace(/[^a-zA-Z0-9]/g, '_')
    : safeKejuruanName;
  const fileName = isSingle
    ? `Slip_Kehadiran_${safeName}_${monthName}_${year}.pdf`
    : `Rekap_Kehadiran_${monthName}_${year}_${safeKejuruanName}.pdf`;
  doc.save(fileName);
}
