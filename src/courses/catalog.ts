export const courses = {
  prism: {
    title: 'Prism Speedway',
    features: ['Rolling lanes', 'Rainbow hairpin', 'Timber merge'],
  },
  frostline: {
    title: 'Frostline Rally',
    features: ['Ice sweeper', 'Deflector field', 'Finish bridge'],
  },
} as const;

export type CourseId = keyof typeof courses;
export const courseIds: readonly CourseId[] = ['prism', 'frostline'];
export const fieldSizes = [2, 3, 4, 5, 6];
