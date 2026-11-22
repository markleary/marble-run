import assert from 'node:assert/strict'
import { jump } from '../src/courses/kepler-layout.json'
import { FIXED_DT, RaceSimulation } from '../src/simulation'
import type { CourseTrack } from '../src/track'

/** Follow each actual contact from the alloy lip to the first supporting glass contact. */
export function measureKeplerTransfer(race: RaceSimulation) {
  const flights = race.marbles.map(() => ({ frames: 0, rose: false, fell: false, landed: false }))
  function observe() {
    for (const marble of race.marbles) {
      const flight = flights[marble.id]
      if (flight.landed || marble.distance < jump.takeoff || marble.distance > jump.landing + 24) continue
      const surface = race.rollingSurface(marble, 'support')
      if (!surface) {
        flight.frames++
        const dy = marble.position.y - marble.previousPosition.y
        if (dy > .002) flight.rose = true
        if (dy < -.002 && flight.rose) flight.fell = true
      } else if (surface === 'glass') {
        assert.ok(marble.distance >= jump.landing, 'Receiver contact must be downstream of the vacuum gap.')
        flight.landed = true
      } else {
        assert.ok(marble.distance < jump.takeoff + .5 && !flight.fell, 'There must be no floor across the transfer.')
        flight.frames = 0
        flight.rose = false
      }
    }
  }
  function seconds(seed: number) {
    return flights.map((flight, i) => {
      const duration = flight.frames * FIXED_DT
      assert.ok(flight.rose && flight.fell && flight.landed && duration >= 2,
        `Seed ${seed}, slot ${race.marbles[i].slot}: expected an ascending and descending flight of at least 2s ending on glass (${duration.toFixed(2)}s).`)
      return duration
    })
  }
  return { observe, seconds }
}

export function checkKeplerReceiver(track: CourseTrack) {
  // These two grid slots arrive at race speed and used to hit the outside guards of both return bends.
  const seed = 2
  const race = new RaceSimulation(track, 2, seed)
  const turn = track.sections.find(section => section.name === 'Orbital Return')!
  const passes = race.marbles.map(() => ({ entry: 0, minRetention: 1, minClearance: Infinity, exited: false }))
  try {
    race.release()
    while (!race.failure && !race.finished && passes.some(pass => !pass.exited)) {
      race.step()
      for (const marble of race.marbles) {
        const pass = passes[marble.id]
        if (pass.exited || marble.distance < turn.start) continue
        const frame = track.sample(marble.distance)
        const dx = marble.position.x - marble.previousPosition.x
        const dz = marble.position.z - marble.previousPosition.z
        const forward = (dx * frame.tx + dz * frame.tz) / FIXED_DT
        if (!pass.entry) pass.entry = forward
        pass.minRetention = Math.min(pass.minRetention, forward / pass.entry)
        const lateral = (marble.position.x - frame.x) * frame.rx + (marble.position.z - frame.z) * frame.rz
        pass.minClearance = Math.min(pass.minClearance, track.halfWidth - Math.abs(lateral) - track.radius)
        pass.exited = marble.distance >= turn.end
      }
    }
    assert.ok(!race.failure, race.failure ?? undefined)
    for (const [id, pass] of passes.entries()) {
      const label = 'Kepler seed ' + seed + ', slot ' + (race.marbles[id].slot + 1)
      assert.ok(pass.exited && pass.entry > 0, label + ' must traverse both glass bends.')
      assert.ok(pass.minRetention >= .90, label + ' retained only ' + (pass.minRetention * 100).toFixed(1) + '% of entry speed.')
      assert.ok(pass.minClearance > .02, label + ' reached the vertical rim of the glass flume.')
    }
    console.log(JSON.stringify({ course: track.id, seed,
      returnMinSpeedRetention: passes.map(pass => +pass.minRetention.toFixed(3)),
      returnMinRimClearance: passes.map(pass => +pass.minClearance.toFixed(3)),
    }))
  } finally {
    race.dispose()
  }
}
