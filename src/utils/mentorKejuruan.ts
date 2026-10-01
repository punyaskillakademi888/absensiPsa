import { Kejuruan, User } from '../types';

export const getMentorKejuruanIds = (user: User, kejuruanList: Kejuruan[]): string[] => {
  if (user.role !== 'mentor' || !user.kejuruanId) return [];
  return kejuruanList.some(program => program.id === user.kejuruanId)
    ? [user.kejuruanId]
    : [];
};
