import type { CourseTrack, TrackSample } from './courseGeometry'
import type { CruxFormat } from './courses/cruxCheckpoints'
import { crossingTime } from './raceTiming'
import type { MarbleState } from './simulation'

interface Crossing { id: number; time: number }
export interface RaceCheckpoint {
  number: number
  name: string
  s: number
  line: TrackSample
  entryS: number
  entryLine: TrackSample
  cut: boolean
  field: number
  arrivals: Crossing[]
  phase: 'bypass' | 'ready' | 'loading' | 'released'
  seated: number[]
  divertedAt: number | null
  pocketAt: number | null
  releasedAt: number | null
}

export function createCheckpointRace(track: CourseTrack, count: number,
  lines: readonly Pick<RaceCheckpoint, 'number' | 'name' | 's' | 'entryS'>[], format: CruxFormat = 'endurance') {
  let field = count
  const timingLines = lines.filter(gate => gate.entryS > track.startS)
  const gates: RaceCheckpoint[] = timingLines.map(({ number, name, s, entryS }, index): RaceCheckpoint => {
    // Put the cuts at the later gates in a smaller field. The last two always race to the stripe.
    const cut = format === 'knockout' && field > 2 && timingLines.length - index <= field - 2
    const gate: RaceCheckpoint = {
      number, name, s, line: track.sample(s), entryS, entryLine: track.sample(entryS), cut, field, arrivals: [],
      phase: cut ? 'ready' : 'bypass', seated: [], divertedAt: null, pocketAt: null, releasedAt: null,
    }
    if (cut) field--
    return gate
  })
  const nextGate = Array<number>(count).fill(0)
  const crossings: { gate: RaceCheckpoint; id: number; time: number }[] = []

  function step(marbles: MarbleState[], elapsed: number, dt: number, withdraw: (id: number) => void) {
    crossings.length = 0
    for (const marble of marbles) {
      const gate = gates[nextGate[marble.id]]
      if (!gate || marble.cutAt || marble.stagingAt || Math.abs(marble.distance - gate.entryS) > 2 * track.radius) continue
      const time = crossingTime(marble, gate.entryLine, track.radius, elapsed, dt)
      if (time === null) continue
      nextGate[marble.id]++
      crossings.push({ gate, id: marble.id, time })
    }
    // Assign the actual stalls only after comparing every nose in this tick.
    crossings.sort((a, b) => a.time - b.time || a.id - b.id)
    for (const { gate, id, time } of crossings) {
      const slot = gate.arrivals.length
      gate.arrivals.push({ id, time })
      if (!gate.cut) continue
      gate.phase = 'loading'
      if (slot < gate.field - 1) {
        marbles[id].stagingAt = gate.number
        marbles[id].rackSlot = slot
      }
    }
    // A pass on the brake rollers can change arrival at the fork, but every
    // qualifying place already belongs to the racer that earned it at entry.
    for (const gate of gates) {
      if (gate.phase !== 'loading' || gate.arrivals.length !== gate.field) continue
      const last = marbles[gate.arrivals[gate.field - 1].id]
      if (last.cutAt || Math.abs(last.distance - gate.s) > 2 * track.radius) continue
      const time = crossingTime(last, gate.line, track.radius, elapsed, dt)
      if (time === null) continue
      gate.divertedAt = time
      last.cutAt = gate.number
      withdraw(last.id)
    }
  }
  return { gates, step }
}
