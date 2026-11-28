import type { CourseTrack } from '../courseGeometry'
import layout from './santa-layout.json'

// Both workshop conveyors run at the same speed. The parcel sorter has a grippier belt.
export const santaBeltSpeed = 3.7
const [, candyBelt, , parcelBelt] = layout.sections
export function santaBeltTraction(s: number) {
  if (s >= candyBelt.start && s <= candyBelt.end) return 1.4
  if (s >= parcelBelt.start && s <= parcelBelt.end) return 1.7
  return 0
}

/** Dimensions are shared by the sugar arms, lift mechanisms and their collision shapes. */
export const pinwheel = {
  arms: 3, reach: 1.17, stickRadius: .17, tipRadius: .24, axleRadius: .39, axleHeight: .68, armY: .30,
}
export const parcel = {
  width: 1.38, depth: 1.18, height: 1.14, bevel: .10, knotRadius: .15,
  bowSpan: .23, bowRadius: .10, bowHeight: .125,
}

export function santaMachines(track: CourseTrack) {
  const sweets = track.sections[1].start, wrapping = track.sections[3].start
  const wheels = [
    { offset: 7, lateral: -1.55, period: 7.2, phase: .3 },
    { offset: 17, lateral: 1.55, period: -6.85, phase: 1.4 },
    { offset: 27, lateral: -.20, period: 7.65, phase: 2.1 },
  ].map(w => ({ ...w, at: track.sample(sweets + w.offset, w.lateral) }))
  const boxes = [
    { offset: 9, lateral: -2.4, yaw: .18, period: 4.8, phase: 1.1 },
    { offset: 10.6, lateral: .70, yaw: -.19, period: 4.8, phase: 1.1 + Math.PI },
    { offset: 23, lateral: 2.4, yaw: .21, period: 5.2, phase: 2.6 },
    { offset: 24.7, lateral: -.75, yaw: -.22, period: 5.2, phase: 2.6 + Math.PI },
    { offset: 37, lateral: -2.20, yaw: .23, period: 4.5, phase: 0 },
    { offset: 38.6, lateral: .82, yaw: -.21, period: 4.5, phase: Math.PI },
  ].map(b => {
    const s = wrapping + b.offset, at = track.sample(s, b.lateral)
    return { ...b, s, at, yaw: b.yaw - Math.atan2(at.tz, at.tx) }
  })
  return { wheels, boxes }
}

type Clockwork = { period: number; phase: number }
/** A rematch cues the workshop clock to a different point in its interlocking cycles. */
export const santaCue = (seed: number) => ((Math.imul(seed, 2654435761) >>> 0) / 0x100000000) * 72
export const pinwheelAngle = (wheel: Clockwork, seconds: number) => wheel.phase + seconds * 2 * Math.PI / wheel.period

/** A cam retracts the sugar mold into its well long enough for a stopped pack to roll through. */
export function pinwheelLift(wheel: Clockwork, seconds: number) {
  const stroke = (seconds + .15 * wheel.phase) % 10.5
  const t = Math.max(0, Math.min(1, (stroke - 2.8) / 1.6, (10.15 - stroke) / 1.6))
  return -1.18 * t * t * (3 - 2 * t)
}

/** Height of the parcel center above the floor. The wrapping bow clears the deck at full retraction. */
export function parcelHeight(box: Clockwork, seconds: number) {
  const raised = .5 - .5 * Math.cos(box.phase + seconds * 2 * Math.PI / box.period)
  return -.50 - parcel.height / 2 + 1.70 * raised
}
