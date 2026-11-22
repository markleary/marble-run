import assert from 'node:assert/strict'
import { FIXED_DT, RaceSimulation } from '../src/simulation'
import type { CourseTrack } from '../src/track'

interface Jump {
  takeoff: number
  landing: number
  catchEnd?: number
}

/** Watch the physical takeoff and landing on each receiving deck. */
export function checkCourseJumps(track: CourseTrack, seed: number, transfers: readonly Jump[]) {
  const race = new RaceSimulation(track, track.laneCount, seed)
  const flights = race.marbles.map(() => transfers.map(() => ({
    airFrames: 0, ascending: false, descending: false, landed: false,
  })))
  try {
    race.release()
    while (!race.finished && !race.failure) {
      race.step()
      for (const marble of race.marbles) {
        transfers.forEach((jump, index) => {
          const flight = flights[marble.id][index]
          if (flight.landed || marble.distance < jump.takeoff || marble.distance > (jump.catchEnd ?? jump.landing + 6)) return
          if (!race.rollingSurface(marble, 'support')) {
            flight.airFrames++
            const dy = marble.position.y - marble.previousPosition.y
            if (marble.distance < jump.landing && dy > .002) flight.ascending = true
            if (dy < -.002 && flight.ascending) flight.descending = true
            return
          }
          // The catch deck sits below the upper edge of its shield. Only
          // supporting contact close to that deck completes the landing.
          if (!flight.descending || marble.distance < jump.landing) return
          const center = track.sample(marble.distance)
          const lateral = (marble.position.x - center.x) * center.rx + (marble.position.z - center.z) * center.rz
          flight.landed = marble.position.y <= track.sample(marble.distance, lateral).y + track.radius + .07
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
    console.log(JSON.stringify({ course: track.id, seed, jumpAirSeconds: transfers.map((_, index) => {
      const times = flights.map(pair => pair[index].airFrames * FIXED_DT)
      return [Math.min(...times), Math.max(...times)].map(seconds => +seconds.toFixed(2))
    }) }))
  } finally {
    race.dispose()
  }
}
