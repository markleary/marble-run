import { hasCheckpoints } from './checkpoints';

// Mean time from release to the last finisher, seeds 1–100 at each field size (2–6).
// Checkpoint tracks use Endurance so the full field runs the entire course.
export const courses = {
  prism: {
    title: 'Prism Speedway',
    averageSeconds: 39.4,
    features: ['Rolling lanes', 'Rainbow hairpin', 'Timber merge'],
  },
  timber: {
    title: 'Timber Corkscrew',
    averageSeconds: 42.2,
    features: ['Open wooden helix', 'Trestle switchbacks', 'Felt finish'],
  },
  wireworks: {
    title: 'Wireworks Drop',
    averageSeconds: 37.5,
    features: ['Paired wire rails', 'Twin routes', 'Banked reunion'],
  },
  frostline: {
    title: 'Frostline Rally',
    averageSeconds: 49.8,
    features: ['Ice sweeper', 'Deflector field', 'Finish bridge'],
  },
  orrery: {
    title: 'Midnight Orrery',
    averageSeconds: 63.5,
    features: ['Swinging pendulums', 'Ecliptic underpass', 'Comet jumps'],
  },
  tideglass: {
    title: 'Tideglass Conservatory',
    averageSeconds: 62.4,
    features: ['Sea-glass flume', 'Standing waves', 'Twin sluice'],
  },
  kepler: {
    title: 'Kepler Relay',
    averageSeconds: 69.4,
    features: ['Gravity dive', 'Vacuum transfer', 'Aurora glass flume'],
  },
  spectral: {
    title: 'Spectral Relay',
    averageSeconds: 155.0,
    features: ['2+ min', 'Vertical drop', 'Spinning fan', 'Magnetic fields', 'Knockout gates'],
  },
  crux: {
    title: 'Crux Mountain Masters',
    averageSeconds: 149.2,
    features: ['2+ min', 'Gap jumps', 'Blade slalom', 'Knockout gates'],
  },
  afterglow: {
    title: 'Afterglow FM',
    averageSeconds: 78.5,
    features: ['60–90 sec Endurance', 'Crossfader pucks', 'Carrier spiral', 'Mono bridge', 'Knockout gates'],
  },
} as const;

export type CourseId = keyof typeof courses;
const byDuration = (Object.keys(courses) as CourseId[]).sort((a, b) => courses[a].averageSeconds - courses[b].averageSeconds);
export const standardCourseIds = byDuration.filter(id => !hasCheckpoints(id));
export const checkpointCourseIds = byDuration.filter(hasCheckpoints);
export const courseIds: readonly CourseId[] = [...standardCourseIds, ...checkpointCourseIds];
export const fieldSizes = [2, 3, 4, 5, 6];
