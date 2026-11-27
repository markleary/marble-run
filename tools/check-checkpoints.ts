import assert from 'node:assert/strict'
import { compareRacePosition } from '../src/raceTiming'
import { checkpointRack, checkpointRackSlot } from '../src/courses/checkpointRack'
import { FIXED_DT, RaceSimulation } from '../src/simulation'
import type { CourseTrack } from '../src/track'
import { watchSpectralFan } from './check-spectral'

function checkPhotoCut(track: CourseTrack) {
  const race = new RaceSimulation(track, 6, 1, 'knockout')
  try {
    const competition = race.competition!
    const gate = competition.gates.find(gate => gate.cut)!
    function cross(id: number, s: number, fraction: number) {
      const marble = race.marbles[id]
      const { x, y, z, tx, tz } = track.sample(s)
      const before = track.radius + .08 * fraction
      marble.distance = s
      marble.previousPosition = { x: x - tx * before, y, z: z - tz * before }
      marble.position = { x: x - tx * (before - .08), y, z: z - tz * (before - .08) }
    }
    // Enter 5,4,3,2,1,0, then let 0 pass 1 inside the funnel and reach the fork first.
    for (const open of competition.gates) {
      if (open === gate) break
      for (const marble of race.marbles) cross(marble.id, open.entryS, .5)
      competition.step(race.marbles, .5, FIXED_DT)
      assert.ok(race.marbles.every(m => m.cutAt === undefined))
    }
    for (const marble of race.marbles) cross(marble.id, gate.entryS, .8 - .1 * marble.id)
    competition.step(race.marbles, 1, FIXED_DT)
    assert.deepEqual(gate.arrivals.map(a => a.id), [5, 4, 3, 2, 1, 0])
    assert.ok(race.marbles.every(m => m.cutAt === undefined))
    cross(0, gate.s, .2)
    cross(1, gate.s, .8)
    competition.step(race.marbles, 4, FIXED_DT)
    assert.deepEqual(race.marbles.filter(m => m.cutAt !== undefined).map(m => m.id), [0])
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
        assert.ok(Math.abs(marble.distance - gate.s - checkpointRack.seatOffset) < .16,
          'Every qualifier must restart from its pad on the release tick.')
      }
    }
    if (gate.phase !== 'loading') continue
    const capacity = gate.field - 1
    const qualifiers = gate.arrivals.slice(0, capacity).map(crossing => race.marbles[crossing.id])
    for (const [slot, marble] of qualifiers.entries()) {
      assert.equal(marble.stagingAt, gate.number)
      assert.equal(marble.rackSlot, slot)
      assert.ok(marble.distance < gate.s + checkpointRack.barOffset, 'A qualifier passed a closed release bar.')
      if (gate.seated.includes(marble.id)) {
        const seat = track.sample(gate.s + checkpointRack.seatOffset, checkpointRackSlot(capacity, slot))
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
    gate, s: gate.s - checkpointRack.funnelLength, stripe: track.sample(gate.s - checkpointRack.funnelLength),
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
          assert.ok(Math.abs(atThroat) <= checkpointRack.throatHalfWidth,
            `${track.id} seed ${race.seed}, CP ${gate.number}: marble ${marble.id} crossed outside the throat at ${atThroat}.`)
          through.add(marble.id)
        }
      }
      if (gate.releasedAt !== null) {
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

/** Follow the actual rolling body around the switch and into its pocket. */
function watchSidePockets(track: CourseTrack, race: RaceSimulation) {
  const cuts = race.competition!.gates.filter(g => g.cut).map(gate => ({
    gate, furthest: -Infinity, onBelt: false,
  }))
  let current = 0
  return () => {
    const cut = cuts[current]
    if (!cut || cut.gate.divertedAt === null) return
    const { gate } = cut
    const marble = race.marbles[gate.arrivals[gate.field - 1].id]
    const dx = marble.position.x - gate.line.x, dz = marble.position.z - gate.line.z
    const along = dx * gate.line.tx + dz * gate.line.tz, side = dx * gate.line.rx + dz * gate.line.rz
    const label = track.id + ' seed ' + race.seed + ' field ' + gate.field + ' CP ' + gate.number
    cut.furthest = Math.max(cut.furthest, along)
    // Allow ordinary sphere contact at the fork, but reject an upstream return.
    assert.ok(cut.furthest - along < track.radius, label + ' pulled the last marble back toward the throat.')
    for (const other of race.marbles) {
      if (other.cutAt !== undefined) continue
      const a = marble.position, b = other.position
      assert.ok(Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) >= 1.8 * track.radius,
        label + ' passed through another racer on the switch belt.')
    }
    if (!cut.onBelt && side < -checkpointRack.throatHalfWidth && race.rollingSurface(marble, 'support')) cut.onBelt = true
    if (gate.pocketAt === null) {
      assert.ok(race.elapsed - gate.divertedAt! < 8, label + ' did not collect the last marble.')
      return
    }
    const cup = track.sample(gate.s + checkpointRack.pocketOffset, -track.halfWidth + checkpointRack.pocketSideInset)
    assert.ok(cut.onBelt, label + ' must roll sideways on the deck into the trap.')
    assert.ok(Math.hypot(marble.position.x - cup.x, marble.position.z - cup.z) < .27
      && Math.abs(marble.position.y - cup.y - track.radius) < .12, label + ' missed the ground-level pocket.')
    current++
  }
}

export function checkCheckpointKnockouts(track: CourseTrack, firstSeed: number, repetitions: number) {
  checkPhotoCut(track)
  // These two six-wide approaches previously carried a racer over CP1's outer rail.
  for (const seed of track.id === 'crux' ? [295, 375] : []) {
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
    let fanCrossings = 0
    for (let seed = firstSeed; seed < firstSeed + repetitions; seed++) {
      const race = new RaceSimulation(track, count, seed, 'knockout')
      try {
        const entrances = watchEntranceOrder(track, race)
        const checkPocket = watchSidePockets(track, race)
        const fan = track.id === 'spectral' ? watchSpectralFan(track, race) : undefined
        race.release()
        while (!race.finished && !race.failure) {
          race.step()
          entrances.observe()
          fan?.observe()
          checkPocket()
          if (seed === firstSeed) checkLoadingRacks(track, race)
        }
        assert.ok(race.finished, `${track.id} knockout with ${count} racers, seed ${seed}: ${race.failure}`)
        entrances.verify()
        if (fan) fanCrossings += fan.verify()
        const order = [...race.marbles].sort(compareRacePosition)
        const cuts = Math.min(count - 2, race.competition!.gates.length)
        assert.equal(order.filter(m => m.finishTime !== null).length, count - cuts)
        assert.ok(order[0].finishTime! > 0 && order[0].finishTime! <= order[1].finishTime!)
        if (track.id === 'crux' || track.id === 'spectral') assert.ok(order[0].finishTime! >= 120)
        winners.push(order[0].finishTime!)
        wins[order[0].slot]++
        const stillRacing = new Set(race.marbles.map(m => m.id))
        assert.equal(race.competition!.gates.filter(gate => gate.cut).length, cuts)
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
            assert.ok(gate.pocketAt !== null && gate.releasedAt >= gate.pocketAt + checkpointRack.releaseDelay)
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
        assert.deepEqual(stillRacing, new Set(order.slice(0, count - cuts).map(m => m.id)))
      } finally {
        race.dispose()
      }
    }
    console.log(JSON.stringify({ course: track.id, format: 'knockout', count, heats: repetitions, winningSlots: wins,
      ...(track.id === 'spectral' && { fanCrossings }),
      winningSeconds: [Math.min(...winners), Math.max(...winners)].map(t => +t.toFixed(2)) }))
  }
}
