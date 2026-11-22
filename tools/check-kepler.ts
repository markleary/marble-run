import assert from 'node:assert/strict'
import { jump } from '../src/courses/kepler-layout.json'
import { FIXED_DT, type RaceSimulation } from '../src/simulation'

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
