import assert from 'node:assert/strict'
import { Group, MeshStandardMaterial, Object3D, Vector3 } from 'three'
import { createCruxRejectChute } from '../src/cruxRejectChute'
import { compareRacePosition } from '../src/raceTiming'
import { cruxCheckpoints, cruxRack, cruxRackSlot } from '../src/courses/cruxCheckpoints'
import { FIXED_DT, RaceSimulation } from '../src/simulation'
import type { CourseTrack } from '../src/track'

function checkPhotoCut(track: CourseTrack) {
  const race = new RaceSimulation(track, 6, 1, 'knockout')
  try {
    const competition = race.competition!
    const gate = competition.gates[0]
    function cross(id: number, s: number, fraction: number) {
      const marble = race.marbles[id]
      const { x, y, z, tx, tz } = track.sample(s)
      const before = track.radius + .08 * fraction
      marble.distance = s
      marble.previousPosition = { x: x - tx * before, y, z: z - tz * before }
      marble.position = { x: x - tx * (before - .08), y, z: z - tz * (before - .08) }
    }
    // Enter 5,4,3,2,1,0, then let 0 pass 1 inside the funnel and reach the fork first.
    for (const marble of race.marbles) cross(marble.id, gate.entryS, .8 - .1 * marble.id)
    const withdrawn: number[] = []
    competition.step(race.marbles, 1, FIXED_DT, id => withdrawn.push(id))
    assert.deepEqual(gate.arrivals.map(a => a.id), [5, 4, 3, 2, 1, 0])
    assert.deepEqual(withdrawn, [])
    cross(0, gate.s, .2)
    cross(1, gate.s, .8)
    competition.step(race.marbles, 4, FIXED_DT, id => withdrawn.push(id))
    assert.deepEqual(withdrawn, [0])
    assert.equal(race.marbles[1].rackSlot, 4)
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
    if (gate.pocketAt !== null) assert.equal(gate.seated.length, capacity,
      'The last entrant must wait in the side guide until the qualifiers are all seated.')
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

/** Observe each nose at the painted entrance and mechanical throat, independently of the judge. */
function watchEntranceOrder(track: CourseTrack, race: RaceSimulation) {
  const records = race.competition!.gates.filter(g => g.cut).map(gate => ({
    gate, s: gate.s - cruxRack.funnelLength, stripe: track.sample(gate.s - cruxRack.funnelLength),
    times: new Map<number, number>(), through: new Set<number>(),
  }))
  let index = 0
  return {
    observe() {
      const record = records[index]
      if (!record) return
      const { gate, s, stripe, times, through } = record
      for (const marble of race.marbles) {
        const entrance = !times.has(marble.id) && Math.abs(marble.distance - s) < 2 * track.radius
        const throat = !through.has(marble.id) && Math.abs(marble.distance - gate.s) < 2 * track.radius
        if (!entrance && !throat) continue
        const line = entrance ? stripe : gate.line
        const depth = (p: typeof marble.position) => (p.x - line.x) * line.tx + (p.z - line.z) * line.tz + track.radius
        const before = depth(marble.previousPosition), after = depth(marble.position)
        if (before > 0 || after < 0 || after <= before) continue
        const fraction = -before / (after - before)
        if (entrance) {
          times.set(marble.id, race.elapsed - FIXED_DT * (1 - fraction))
        } else {
          const lateral = (p: typeof marble.position) => (p.x - line.x) * line.rx + (p.z - line.z) * line.rz
          const from = lateral(marble.previousPosition)
          const atThroat = from + fraction * (lateral(marble.position) - from)
          assert.ok(Math.abs(atThroat) <= cruxRack.throatHalfWidth,
            `Crux seed ${race.seed}, CP ${gate.number}: marble ${marble.id} crossed outside the throat at ${atThroat}.`)
          through.add(marble.id)
        }
      }
      if (gate.pocketAt !== null) {
        assert.equal(gate.seated.length, gate.field - 1)
        assert.equal(through.size, gate.field)
        index++
      }
    },
    verify() {
      assert.equal(index, records.length)
      for (const { gate, times } of records) {
        const ids = [...times].sort((a, b) => a[1] - b[1] || a[0] - b[0]).map(([id]) => id)
        assert.deepEqual(gate.arrivals.map(a => a.id), ids)
        assert.equal(race.marbles[ids.at(-1)!].cutAt, gate.number)
      }
    },
  }
}

/** Reproduce the displayed cut pose against interpolated qualifying bodies without a GPU. */
function checkChuteClearance(track: CourseTrack) {
  const material = new MeshStandardMaterial()
  const fixtures = cruxCheckpoints(track.sections).map(({ s }) =>
    createCruxRejectChute(track, s, new Group(), { rubber: material, stripe: material, chrome: material, label: material }))
  const cut = new Object3D(), qualifier = new Vector3()
  return (race: RaceSimulation) => {
    for (const gate of race.competition!.gates) {
      if (gate.divertedAt === null || gate.releasedAt !== null && race.elapsed > gate.releasedAt + .3) continue
      const last = race.marbles[gate.arrivals[gate.field - 1].id]
      for (const alpha of [.5, 1]) {
        const time = race.elapsed - (1 - alpha) * FIXED_DT
        fixtures[gate.number - 1].roll(cut, last, time, gate.divertedAt, gate.pocketAt, race.marbles, alpha)
        for (let i = 0; i < gate.field - 1; i++) {
          const marble = race.marbles[gate.arrivals[i].id]
          qualifier.lerpVectors(marble.previousPosition, marble.position, alpha)
          assert.ok(cut.position.distanceTo(qualifier) >= 2 * track.radius - .004,
            `Cut marble passed through a qualifier at CP ${gate.number}, seed ${race.seed}, time ${time}.`)
        }
      }
    }
  }
}

export function checkCruxKnockouts(track: CourseTrack, firstSeed: number, repetitions: number) {
  checkPhotoCut(track)
  const checkChute = checkChuteClearance(track)
  // These two six-wide approaches previously carried a racer over CP1's outer rail.
  for (const seed of [295, 375]) {
    const race = new RaceSimulation(track, 6, seed, 'knockout')
    try {
      const entrances = watchEntranceOrder(track, race)
      race.release()
      while (!race.failure && !race.finished && race.competition!.gates[0].pocketAt === null) {
        race.step()
        entrances.observe()
      }
      assert.ok(race.competition!.gates[0].pocketAt !== null, `CP1 must load the six-marble grid at seed ${seed}.`)
    } finally {
      race.dispose()
    }
  }
  for (let count = 2; count <= track.laneCount; count++) {
    const winners: number[] = []
    const wins = Array<number>(track.laneCount).fill(0)
    for (let seed = firstSeed; seed < firstSeed + repetitions; seed++) {
      const race = new RaceSimulation(track, count, seed, 'knockout')
      try {
        const entrances = watchEntranceOrder(track, race)
        race.release()
        while (!race.finished && !race.failure) {
          race.step()
          entrances.observe()
          checkChute(race)
          if (seed === firstSeed) checkLoadingRacks(track, race)
        }
        assert.ok(race.finished, `Crux knockout with ${count} racers, seed ${seed}: ${race.failure}`)
        entrances.verify()
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
            assert.ok(gate.divertedAt !== null && gate.divertedAt > last.time)
            assert.ok(gate.pocketAt !== null && gate.pocketAt >= gate.divertedAt)
            assert.ok(gate.pocketAt !== null && gate.releasedAt >= gate.pocketAt + cruxRack.pocketTravelSeconds)
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
