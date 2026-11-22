import assert from 'node:assert/strict'
import { orreryJumps } from '../src/courses/orreryJumps'
import { FIXED_DT, RaceSimulation } from '../src/simulation'
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

export function checkOrreryJumps(track: CourseTrack, seed: number) {
  const race = new RaceSimulation(track, track.laneCount, seed)
  const flights = race.marbles.map(() => orreryJumps.map(() => ({
    airFrames: 0, ascending: false, descending: false, landed: false,
  })))
  try {
    race.release()
    while (!race.finished && !race.failure) {
      race.step()
      for (const marble of race.marbles) {
        orreryJumps.forEach((jump, index) => {
          const flight = flights[marble.id][index]
          if (flight.landed || marble.distance < jump.takeoff || marble.distance > jump.landing + 6) return
          if (marble.distance >= jump.landing && race.rollingSurface(marble)) {
            // A marble can brush a side shield midflight. Only contact near the
            // receiving floor counts as touchdown.
            const center = track.sample(marble.distance)
            const lateral = (marble.position.x - center.x) * center.rx + (marble.position.z - center.z) * center.rz
            if (marble.position.y <= track.sample(marble.distance, lateral).y + track.radius + .07) {
              if (flight.descending) flight.landed = true
              return
            }
          }
          flight.airFrames++
          const dy = marble.position.y - marble.previousPosition.y
          if (dy > .002) flight.ascending = true
          if (dy < -.002 && flight.ascending) flight.descending = true
        })
      }
    }
    assert.ok(race.finished, race.failure ?? 'Jump test did not finish.')
    for (const [id, jumps] of flights.entries()) {
      for (const [index, flight] of jumps.entries()) {
        assert.ok(flight.airFrames * FIXED_DT > .3 && flight.landed,
          `Marble ${id} must rise off ramp ${index + 1}, fall and contact its receiving deck.`)
      }
    }
    console.log(JSON.stringify({ course: 'orrery', seed, jumpAirSeconds: orreryJumps.map((_, index) => {
      const times = flights.map(pair => pair[index].airFrames * FIXED_DT)
      return [Math.min(...times), Math.max(...times)].map(seconds => +seconds.toFixed(2))
    }) }))
  } finally {
    race.dispose()
  }
}
