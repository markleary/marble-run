import assert from 'node:assert/strict'
import type { CourseTrack } from '../src/track'

export function checkOrreryCrossing(track: CourseTrack) {
  // Intersect the two straight centerlines, then locate the marble on each deck independently.
  const gallery = track.sections.find(section => section.name === 'Escapement Gallery')!
  const underpass = track.sections.find(section => section.name === 'Ecliptic Underpass')!
  const top = track.sample(gallery.start), bottom = track.sample(underpass.start)
  const cross = (ax: number, az: number, bx: number, bz: number) => ax * bz - az * bx
  const dx = bottom.x - top.x, dz = bottom.z - top.z
  const determinant = cross(top.tx, top.tz, bottom.tx, bottom.tz)
  const upperS = gallery.start + cross(dx, dz, bottom.tx, bottom.tz) / determinant
  const lowerS = underpass.start + cross(dx, dz, top.tx, top.tz) / determinant
  assert.ok(upperS > gallery.start && upperS < gallery.end && lowerS > underpass.start && lowerS < underpass.end)
  assert.ok(track.sample(upperS).y - track.sample(lowerS).y > track.radius * 2 + track.wallHeight(lowerS))
  for (const s of [upperS, lowerS]) {
    const p = track.sample(s)
    assert.ok(Math.abs(track.locate(p.x, p.z, undefined, p.y + track.radius).s - s) < .02,
      'Ranking should distinguish the upper gallery and lower underpass.')
  }
}
