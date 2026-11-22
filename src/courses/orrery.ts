import { bankAt, buildCourse, ease, launchTrim, type PathPiece, type Profile } from '../courseGeometry'
import layout from './orrery-layout.json'
import { catcherGuardLift, jumpHeight, jumpShieldCollision, orreryDeckSpans } from './orreryJumps'

function observatoryProfile(pieces: PathPiece[]): Profile {
  const gallery = layout.sections[3]
  return {
    layered: true,
    divider: s => 1 - ease(5, layout.sections[0].end + 1, s),
    deflectors: [],
    spans: orreryDeckSpans.map(span => ({ ...span, surface: 'lacquer' })),
    wallHeight: s => .94 + catcherGuardLift(s)
      + .25 * ease(gallery.start - 5, gallery.start, s) * (1 - ease(gallery.end + 2, gallery.end + 8, s)),
    height(s, lateral) {
      const bank = bankAt(s, pieces[1], -.073) + bankAt(s, pieces[2], .073)
        + bankAt(s, pieces[4], -.12, 6) + bankAt(s, pieces[6], -.12, 6)
        + bankAt(s, pieces[8], .075)
      const launch = (1 - ease(2, 15, s)) * launchTrim(lateral / layout.halfWidth, layout.launchTrims)
      const galleryDrop = .082 * Math.max(0, Math.min(s - gallery.start, gallery.end - gallery.start))
      // The inside bank rises back to level just ahead of the clock gallery.
      // Carry the gallery's steeper grade up that transition so a rebounding
      // marble can roll forward again even against the inside guard.
      const galleryApproach = .70 * (1 - ease(gallery.start - 9, gallery.start + 1, s))
      return 21.7 - .069 * s - galleryDrop + galleryApproach - 1.46 * (1 - Math.exp(-s / 6.5)) + lateral * bank + launch + jumpHeight(s)
    },
  }
}

export function buildOrreryTrack() {
  const track = buildCourse('orrery', layout, observatoryProfile)
  track.collisions.push(jumpShieldCollision(track))
  return track
}

// At the bottom of its arc the bob almost brushes the lacquer. As it swings
// across the lane it also lifts, offering a different gap on every approach.
export const bobRadius = .39
export const bobRestHeight = .45
export const pendulums = layout.pendulums
export const pendulumAngle = (pendulum: typeof pendulums[number], time: number) =>
  pendulum.amplitude * Math.sin(pendulum.phase + time * pendulum.angularSpeed)
