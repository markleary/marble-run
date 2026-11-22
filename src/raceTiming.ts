import type { TrackSample } from './courseGeometry'
import type { MarbleState } from './simulation'

/** Leading edge crossing the timing plane, interpolated within the physics tick. */
export function crossingTime(marble: MarbleState, line: TrackSample, radius: number, elapsed: number, dt: number) {
  const previous = marble.previousPosition, current = marble.position
  const from = (previous.x - line.x) * line.tx + (previous.z - line.z) * line.tz + radius
  const to = (current.x - line.x) * line.tx + (current.z - line.z) * line.tz + radius
  return from <= 0 && to >= 0 && to > from ? elapsed - dt + dt * (-from / (to - from)) : null
}

export function compareRacePosition(a: MarbleState, b: MarbleState) {
  if (a.cutAt || b.cutAt) return (b.cutAt ?? Infinity) - (a.cutAt ?? Infinity)
  if (a.finishTime !== null || b.finishTime !== null) return (a.finishTime ?? Infinity) - (b.finishTime ?? Infinity)
  // The timing beam fixes qualifying order while the conveyor fans racers into their seats.
  if (a.stagingAt !== undefined || b.stagingAt !== undefined) return (a.rackSlot ?? Infinity) - (b.rackSlot ?? Infinity)
  return b.distance - a.distance
}
