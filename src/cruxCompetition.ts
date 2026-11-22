import type { CourseTrack } from './courseGeometry'
import { cruxCheckpoints, type CruxFormat } from './courses/cruxCheckpoints'
import { crossingTime } from './raceTiming'
import type { MarbleState } from './simulation'

interface Crossing { id: number; time: number }
export interface RaceCheckpoint {
  name: string
  cut: boolean
  field: number
  arrivals: Crossing[]
}

export function createCruxCompetition(track: CourseTrack, count: number, format: CruxFormat) {
  let field = count
  const timingLines = cruxCheckpoints(track.sections).filter(gate => gate.s > track.startS)
  const gates = timingLines.map(({ number, name, s }, index) => {
    // Put the cuts at the later gates in a smaller field. The last two always race to the stripe.
    const cut = format === 'knockout' && field > 2 && timingLines.length - index <= field - 2
    const gate = { number, name, s, line: track.sample(s), cut, field, arrivals: [] as Crossing[] }
    if (cut) field--
    return gate
  })
  const nextGate = Array<number>(count).fill(0)

  function step(marbles: MarbleState[], elapsed: number, dt: number, withdraw: (id: number) => void) {
    for (const marble of marbles) {
      const gate = gates[nextGate[marble.id]]
      if (!gate || marble.cutAt || Math.abs(marble.distance - gate.s) > 2 * track.radius) continue
      const time = crossingTime(marble, gate.line, track.radius, elapsed, dt)
      if (time === null) continue
      nextGate[marble.id]++
      gate.arrivals.push({ id: marble.id, time })
      // Sub-tick timing also determines the cut when multiple racers reach the gate together.
      gate.arrivals.sort((a, b) => a.time - b.time || a.id - b.id)
      if (gate.cut && gate.arrivals.length === gate.field) {
        const last = gate.arrivals[gate.field - 1]
        marbles[last.id].cutAt = gate.number
        withdraw(last.id)
      }
    }
  }
  return { gates, step }
}
