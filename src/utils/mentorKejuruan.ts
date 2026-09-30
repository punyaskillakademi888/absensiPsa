import { Kejuruan, User } from '../types';

export const getMentorKejuruanIds = (user: User, kejuruanList: Kejuruan[]): string[] => {
  if (user.role !== 'mentor') return [];
  const mentorName = user.name.toLowerCase();

  if (mentorName.includes('dzikri')) {
    const smartCreativePrograms = kejuruanList.filter(program =>
      program.category === 'Smart Creative' ||
      program.name.includes('Generative AI') ||
      program.name.includes('Konten Visual untuk Sosial Media') ||
      program.name.includes('Optimalisasi Pemasaran Melalui Media Sosial')
    );
    if (smartCreativePrograms.length > 0) return smartCreativePrograms.map(program => program.id);
  }

  const mentorProgram = mentorName.includes('ayu') || mentorName.includes('vanesha')
    ? kejuruanList.find(program => program.name.toLowerCase().includes('sistem informasi pariwisata'))
    : mentorName.includes('fadil')
    ? kejuruanList.find(program => program.name.toLowerCase().includes('node.js') || program.name.toLowerCase().includes('react'))
    : mentorName.includes('davy')
    ? kejuruanList.find(program => program.name.toLowerCase().includes('integrasi bangunan cerdas'))
    : undefined;
  if (mentorProgram) return [mentorProgram.id];

  const assignedProgram = kejuruanList.find(program => program.id === user.kejuruanId) ||
    kejuruanList.find(program =>
      !!user.kejuruanName && program.name.trim().toLowerCase() === user.kejuruanName.trim().toLowerCase()
    );
  return assignedProgram ? [assignedProgram.id] : [];
};
