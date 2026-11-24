import type { CourseTrack } from '../courseGeometry'

export const checkpointRack = {
  funnelLength: 16,
  throatHalfWidth: 1.12,
  seatOffset: 4.8,
  barOffset: 5.38,
  launchEnd: 10,
  launchSpeed: 7.8,
  slotSpacing: 1.4,
  railHeight: .55,
  pocketTravelSeconds: .5,
}

export function checkpointRackSlot(capacity: number, arrivalIndex: number) {
  return (arrivalIndex - (capacity - 1) / 2) * checkpointRack.slotSpacing
}

/** Rail centerlines in track coordinates relative to the mechanical fork at the throat. */
export function checkpointFunnelRails(halfWidth: number) {
  return [-1, 1].map(side => ({
    start: { s: -checkpointRack.funnelLength, lateral: side * (halfWidth + checkpointRack.railHeight / 2) },
    end: { s: 0, lateral: side * checkpointRack.throatHalfWidth },
  }))
}

/** The upper guards catch marbles riding up on the lower rails. The slender
 * first-station guard sits outboard of the original passing lanes. */
export function checkpointFunnelTubes(track: CourseTrack, throat: number, number: number) {
  const radius = checkpointRack.railHeight / 2
  const tubes = []
  for (const { start, end } of checkpointFunnelRails(track.halfWidth)) {
    const point = (fraction: number, lift: number, outboard = 0) => {
      const s = throat + start.s + (end.s - start.s) * fraction
      const lateral = start.lateral + (end.lateral - start.lateral) * fraction + Math.sign(end.lateral) * outboard
      const p = track.sample(s, lateral)
      return { x: p.x, y: p.y + lift, z: p.z }
    }
    const spans = number > 1 ? 4 : 1
    for (let i = 0; i < spans; i++) {
      const a = i / spans, b = (i + 1) / spans
      tubes.push({ start: point(a, radius), end: point(b, radius), radius, upper: false })
      if (number > 1) tubes.push({ start: point(a, 1.09), end: point(b, 1.09), radius: .215, upper: true })
    }
    if (number === 1) {
      for (let i = 0; i < 4; i++) {
        tubes.push({ start: point(i / 4, 1.04, .22), end: point((i + 1) / 4, 1.04, .22), radius: .13, upper: true })
      }
    }
  }
  return tubes
}
