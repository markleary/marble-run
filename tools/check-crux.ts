import assert from 'node:assert/strict'
import { compareRacePosition } from '../src/raceTiming'
import { cruxRack, cruxRackSlot } from '../src/courses/cruxCheckpoints'
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

function checkLoadingRacks(track: CourseTrack, race: RaceSimulation) {
  for (const gate of race.competition!.gates) {
    if (gate.releasedAt === race.elapsed) {
      for (const id of gate.seated) {
        const marble = race.marbles[id]
        assert.equal(marble.stagingAt, undefined)
        assert.equal(marble.rackSlot, undefined)
        assert.ok(Math.abs(marble.distance - gate.s - cruxRack.seatOffset) < .16,
          'Every qualifier must restart from its pad on the release tick.')
      }
    }
    if (gate.phase !== 'loading') continue
    const capacity = gate.field - 1
    for (const crossing of gate.arrivals) {
      if (crossing.time < race.elapsed - FIXED_DT) continue
      const { x, z } = race.marbles[crossing.id].position
      const lateral = (x - gate.line.x) * gate.line.rx + (z - gate.line.z) * gate.line.rz
      assert.ok(Math.abs(lateral) <= cruxRack.throatHalfWidth, 'A racer crossed outside the checkpoint throat.')
    }
    const qualifiers = gate.arrivals.slice(0, capacity).map(crossing => race.marbles[crossing.id])
    for (const [slot, marble] of qualifiers.entries()) {
      assert.equal(marble.stagingAt, gate.number)
      assert.equal(marble.rackSlot, slot)
      assert.ok(marble.distance < gate.s + cruxRack.barOffset, 'A qualifier passed a closed release bar.')
      if (gate.seated.includes(marble.id)) {
        const seat = track.sample(gate.s + cruxRack.seatOffset, cruxRackSlot(capacity, slot))
        assert.ok(Math.hypot(marble.position.x - seat.x, marble.position.z - seat.z) < .16,
          'A seated marble must occupy its assigned physical pad.')
      }
    }
    assert.deepEqual([...qualifiers].sort(compareRacePosition), qualifiers)
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
        while (!race.finished && !race.failure) {
          race.step()
          if (seed === firstSeed) checkLoadingRacks(track, race)
        }
        assert.ok(race.finished, `Crux knockout with ${count} racers, seed ${seed}: ${race.failure}`)
        const order = [...race.marbles].sort(compareRacePosition)
        assert.equal(order.filter(m => m.finishTime !== null).length, 2)
        assert.ok(order[0].finishTime! >= 120 && order[0].finishTime! <= order[1].finishTime!)
        winners.push(order[0].finishTime!)
        wins[order[0].slot]++
        const stillRacing = new Set(race.marbles.map(m => m.id))
        assert.equal(race.competition!.gates.filter(gate => gate.cut).length, count - 2)
        for (const [i, gate] of race.competition!.gates.entries()) {
          assert.equal(gate.field, stillRacing.size)
          assert.equal(gate.arrivals.length, gate.field)
          assert.deepEqual(new Set(gate.arrivals.map(a => a.id)), stillRacing)
          assert.deepEqual(gate.arrivals, [...gate.arrivals].sort((a,b) => a.time - b.time || a.id - b.id))
          if (gate.cut) {
            const last = gate.arrivals.at(-1)!
            assert.equal(gate.phase, 'released')
            assert.ok(gate.releasedAt !== null && gate.releasedAt > last.time)
            assert.deepEqual(new Set(gate.seated), new Set(gate.arrivals.slice(0, -1).map(a => a.id)))
            assert.equal(order[gate.field - 1].id, last.id)
            assert.equal(order[gate.field - 1].cutAt, i + 1)
            assert.equal(order[gate.field - 1].finishTime, null)
            stillRacing.delete(last.id)
          } else {
            assert.equal(gate.phase, 'bypass')
            assert.equal(gate.releasedAt, null)
            assert.deepEqual(gate.seated, [])
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
