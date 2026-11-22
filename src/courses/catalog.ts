export const courses = {
  prism: {
    title: 'Prism Speedway',
    features: ['Rolling lanes', 'Rainbow hairpin', 'Timber merge'],
  },
  timber: {
    title: 'Timber Corkscrew',
    features: ['Open wooden helix', 'Trestle switchbacks', 'Felt finish'],
  },
  wireworks: {
    title: 'Wireworks Drop',
    features: ['Paired wire rails', 'Twin routes', 'Banked reunion'],
  },
  frostline: {
    title: 'Frostline Rally',
    features: ['Ice sweeper', 'Deflector field', 'Finish bridge'],
  },
} as const;

export type CourseId = keyof typeof courses;
export const courseIds: readonly CourseId[] = ['prism', 'frostline', 'timber', 'wireworks'];
export const fieldSizes = [2, 3, 4, 5, 6];
