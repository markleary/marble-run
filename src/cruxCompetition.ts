import type { CourseTrack, TrackSample } from './courseGeometry'
import { cruxCheckpoints, type CruxFormat } from './courses/cruxCheckpoints'
import { crossingTime } from './raceTiming'
import type { MarbleState } from './simulation'

interface Crossing { id: number; time: number }
export interface RaceCheckpoint {
  number: number
  name: string
  s: number
  line: TrackSample
  cut: boolean
  field: number
  arrivals: Crossing[]
  phase: 'bypass' | 'ready' | 'loading' | 'released'
  seated: number[]
  releasedAt: number | null
}

export function createCruxCompetition(track: CourseTrack, count: number, format: CruxFormat) {
  let field = count
  const timingLines = cruxCheckpoints(track.sections).filter(gate => gate.s > track.startS)
  const gates: RaceCheckpoint[] = timingLines.map(({ number, name, s }, index): RaceCheckpoint => {
    // Put the cuts at the later gates in a smaller field. The last two always race to the stripe.
    const cut = format === 'knockout' && field > 2 && timingLines.length - index <= field - 2
    const gate: RaceCheckpoint = {
      number, name, s, line: track.sample(s), cut, field, arrivals: [],
      phase: cut ? 'ready' : 'bypass', seated: [], releasedAt: null,
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
      if (!gate || marble.cutAt || marble.stagingAt || Math.abs(marble.distance - gate.s) > 2 * track.radius) continue
      const time = crossingTime(marble, gate.line, track.radius, elapsed, dt)
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
      if (slot === gate.field - 1) {
        marbles[id].cutAt = gate.number
        withdraw(id)
      } else {
        marbles[id].stagingAt = gate.number
        marbles[id].rackSlot = slot
      }
    }
  }
  return { gates, step }
}
