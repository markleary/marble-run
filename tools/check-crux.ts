import assert from 'node:assert/strict'
import { compareRacePosition } from '../src/raceTiming'
import { FIXED_DT, RaceSimulation } from '../src/simulation'
import type { CourseTrack } from '../src/track'

function checkPhotoCut(track: CourseTrack) {
  const race = new RaceSimulation(track, 6, 1, 'knockout')
  try {
    const competition = race.competition!
    const gate = competition.gates[0]
    const { tx, tz } = gate.line
    for (const marble of race.marbles) {
      const { x, y, z } = track.sample(gate.s, (marble.slot + .5) * track.laneWidth - track.halfWidth)
      // All six noses cross this tick. The first marble visited by the loop arrives last.
      const before = track.radius + .065 - .01 * marble.id
      marble.distance = gate.s
      marble.previousPosition = { x: x - tx * before, y, z: z - tz * before }
      marble.position = { x: x - tx * (before - .08), y, z: z - tz * (before - .08) }
    }
    const withdrawn: number[] = []
    competition.step(race.marbles, 1, FIXED_DT, id => withdrawn.push(id))
    assert.deepEqual(gate.arrivals.map(a => a.id), [5, 4, 3, 2, 1, 0])
    assert.deepEqual(withdrawn, [0])
  } finally {
    race.dispose()
  }
}

export function checkCruxKnockouts(track: CourseTrack, firstSeed: number, repetitions: number) {
  checkPhotoCut(track)
  for (let count = 2; count <= track.laneCount; count++) {
    const winners: number[] = []
    const wins = Array<number>(track.laneCount).fill(0)
    for (let seed = firstSeed; seed < firstSeed + repetitions; seed++) {
      const race = new RaceSimulation(track, count, seed, 'knockout')
      try {
        race.release()
        while (!race.finished && !race.failure) race.step()
        assert.ok(race.finished, `Crux knockout with ${count} racers, seed ${seed}: ${race.failure}`)
        const order = [...race.marbles].sort(compareRacePosition)
        assert.equal(order.filter(m => m.finishTime !== null).length, 2)
        assert.ok(order[0].finishTime! >= 120 && order[0].finishTime! <= order[1].finishTime!)
        winners.push(order[0].finishTime!)
        wins[order[0].slot]++
        const stillRacing = new Set(race.marbles.map(m => m.id))
        for (const [i, gate] of race.competition!.gates.entries()) {
          assert.equal(gate.field, stillRacing.size)
          assert.equal(gate.arrivals.length, gate.field)
          assert.deepEqual(new Set(gate.arrivals.map(a => a.id)), stillRacing)
          assert.deepEqual(gate.arrivals, [...gate.arrivals].sort((a,b) => a.time - b.time || a.id - b.id))
          if (gate.cut) {
            const last = gate.arrivals.at(-1)!
            assert.equal(order[gate.field - 1].id, last.id)
            assert.equal(order[gate.field - 1].cutAt, i + 1)
            assert.equal(order[gate.field - 1].finishTime, null)
            stillRacing.delete(last.id)
          }
        }
        assert.deepEqual(stillRacing, new Set(order.slice(0, 2).map(m => m.id)))
      } finally {
        race.dispose()
      }
    }
    console.log(JSON.stringify({ course: 'crux', format: 'knockout', count, heats: repetitions, winningSlots: wins,
      winningSeconds: [Math.min(...winners), Math.max(...winners)].map(t => +t.toFixed(2)) }))
  }
}
