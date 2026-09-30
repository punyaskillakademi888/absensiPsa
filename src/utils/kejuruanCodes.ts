import { Kejuruan } from '../types';

export interface KejuruanFilterOption {
  value: string;
  programId: string;
  name: string;
  label: string;
}

export const HIDDEN_ADMIN_DASHBOARD_PROGRAM_CODES = new Set([
  'CS-05',
  'DA-03',
  'DM-04',
  'UX-02',
  'WD-01',
]);

const legacyKejuruanCodes: Record<string, string> = {
  'IMP-1nl422t': 'SB-04',
  'IMP-1t5ojqc': 'ST-04',
  'IMP-hyd7hm': 'WEB-04',
};

export const canonicalKejuruanCode = (name: string, code: string) => {
  const normalizedName = name.trim().toLocaleLowerCase('id-ID');
  if (normalizedName.includes('pemasangan sistem integrasi bangunan cerdas')) return 'SB-04';
  if (normalizedName.includes('pembuatan sistem informasi pariwisata berbasis website')) return 'ST-04';
  if (normalizedName.includes('pengembangan web dengan node.js dan react')) return 'WEB-04';
  return legacyKejuruanCodes[code.trim()] || code;
};

export const canonicalizeKejuruanCatalog = (programs: Kejuruan[]): Kejuruan[] => {
  const isProgram = (program: Kejuruan, kind: 'SB' | 'ST' | 'WEB' | 'SC') => {
    const name = program.name.trim().toLocaleLowerCase('id-ID');
    const code = canonicalKejuruanCode(program.name, program.code).toUpperCase();
    if (kind === 'SB') return code === 'SB-04' || name.includes('pemasangan sistem integrasi bangunan cerdas');
    if (kind === 'ST') return code === 'ST-04' || name.includes('pembuatan sistem informasi pariwisata berbasis website');
    if (kind === 'WEB') return code === 'WEB-04' || name.includes('pengembangan web dengan node.js dan react');
    return program.category?.toLowerCase() === 'smart creative' || name === 'smart creative' ||
      name.includes('generative ai') || name.includes('konten visual untuk sosial media') ||
      name.includes('optimalisasi pemasaran melalui media sosial');
  };
  const choose = (kind: 'SB' | 'ST' | 'WEB' | 'SC') => {
    const matches = programs.filter(program => isProgram(program, kind));
    if (kind === 'SC') return matches.find(program => program.name.toLowerCase().includes('generative ai')) || matches[0];
    return matches[0];
  };
  const sb = choose('SB');
  const st = choose('ST');
  const web = choose('WEB');
  const smartCreative = choose('SC');

  return [
    ...(sb ? [{ ...sb, code: 'SB-04' }] : []),
    ...(st ? [{ ...st, code: 'ST-04' }] : []),
    ...(web ? [{ ...web, code: 'WEB-04' }] : []),
    ...(smartCreative ? [{
      ...smartCreative,
      name: 'Smart Creative',
      code: 'SC-04',
      category: 'Smart Creative',
      description: 'Program gabungan Generative AI, konten visual, dan pemasaran media sosial.',
      mentorName: 'Mas Dzikri',
      subPrograms: [
        'Pengoperasian Tools Generative AI untuk Konten Digital dan Bisnis',
        'Pembuatan Konten Visual untuk Sosial Media',
        'Optimalisasi Pemasaran Melalui Media Sosial',
      ],
    }] : []),
  ];
};

export const getKejuruanFilterOptions = (programs: Kejuruan[]): KejuruanFilterOption[] =>
  programs.flatMap(program => program.subPrograms?.length
    ? program.subPrograms.map(name => ({
        value: `subprogram:${program.id}:${encodeURIComponent(name)}`,
        programId: program.id,
        name,
        label: `${program.code} - ${name}`,
      }))
    : [{ value: program.id, programId: program.id, name: program.name, label: `${program.code} - ${program.name}` }]
  );

export const matchesKejuruanFilter = (
  value: string,
  programs: Kejuruan[],
  kejuruanId?: string,
  kejuruanName?: string,
) => {
  if (value === 'all') return true;
  if (value === 'smart-creative') {
    return programs.some(program => program.id === kejuruanId && program.category === 'Smart Creative') ||
      !!kejuruanName && getKejuruanFilterOptions(programs)
        .some(option => option.programId === programs.find(program => program.category === 'Smart Creative')?.id &&
          option.name.toLocaleLowerCase('id-ID') === kejuruanName.trim().toLocaleLowerCase('id-ID'));
  }
  const option = getKejuruanFilterOptions(programs).find(item => item.value === value);
  if (!option) return kejuruanId === value;
  if (value.startsWith('subprogram:') && kejuruanName) {
    return kejuruanName.trim().toLocaleLowerCase('id-ID') === option.name.toLocaleLowerCase('id-ID');
  }
  return kejuruanId === option.programId ||
    (!!kejuruanName && kejuruanName.trim().toLocaleLowerCase('id-ID') === option.name.toLocaleLowerCase('id-ID'));
};
