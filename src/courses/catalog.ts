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
  orrery: {
    title: 'Midnight Orrery',
    features: ['Swinging pendulums', 'Ecliptic underpass', 'Comet jumps'],
  },
  tideglass: {
    title: 'Tideglass Conservatory',
    features: ['Sea-glass flume', 'Standing waves', 'Twin sluice'],
  },
  kepler: {
    title: 'Kepler Relay',
    features: ['Gravity dive', 'Vacuum transfer', 'Aurora glass flume'],
  },
  spectral: {
    title: 'Spectral Relay',
    features: ['2+ min', 'Vertical drop', 'Magnetic fields', 'Split checkpoints'],
  },
  crux: {
    title: 'Crux Mountain Masters',
    features: ['2+ min', 'Gap jumps', 'Blade slalom', 'Knockout gates'],
  },
  afterglow: {
    title: 'Afterglow FM',
    features: ['60–90 sec', 'Crossfader pucks', 'Carrier spiral', 'Mono bridge'],
  },
} as const;

export type CourseId = keyof typeof courses;
export const courseIds: readonly CourseId[] = ['prism', 'frostline', 'timber', 'wireworks', 'orrery', 'tideglass', 'kepler', 'crux', 'spectral', 'afterglow'];
export const fieldSizes = [2, 3, 4, 5, 6];
