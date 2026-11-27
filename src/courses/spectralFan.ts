import { ease, type CourseTrack } from '../courseGeometry'
import layout from './spectral-layout.json'

export const spectralFan = layout.fan
export const spectralFanHubBaseY = -.012
const { centerS, radius, bladeRadius } = spectralFan

// The inlet crosses a chord offset from the axle. A flared receiving chute
// collects both sides of the cap and tapers back to track width on the apron.
function halfChord(s: number) {
  const along = s - centerS
  return Math.sqrt(Math.max(0, radius * radius - along * along))
}
export function spectralFanWidthScale(s: number) {
  if (s <= spectralFan.startS || s >= spectralFan.endS + 17) return 1
  const chord = halfChord(s)
  return (Math.max(outletEdge(s), spectralFan.offset + chord)
    - Math.min(-layout.halfWidth, spectralFan.offset - chord)) / (2 * layout.halfWidth)
}
export function spectralFanLateralShift(s: number) {
  if (s <= spectralFan.startS || s >= spectralFan.endS + 17) return 0
  const chord = halfChord(s)
  return (Math.max(outletEdge(s), spectralFan.offset + chord)
    + Math.min(-layout.halfWidth, spectralFan.offset - chord)) / 2
}
function outletEdge(s: number) {
  return layout.halfWidth + 12 * ease(centerS, centerS + 6, s) * (1 - ease(spectralFan.endS, spectralFan.endS + 17, s))
}

export function spectralFanFrame(track: CourseTrack) {
  const center = track.sample(centerS)
  // Rotate local up onto the table normal; local X and Z span the pitched deck.
  const halfAngle = Math.atan(spectralFan.grade) / 2
  const sin = Math.sin(halfAngle)
  return { center, tilt: { x: center.tz * sin, y: 0, z: -center.tx * sin, w: Math.cos(halfAngle) } }
}

export const spectralFanAngle = (seconds: number) => seconds * spectralFan.angularSpeed

// The tapered ends of a swept paddle meet the outer rim. Near-vertical faces
// extend more than two marble diameters above the bed to retain the pocket.
const outline = [[.14, -.021], [.54, -.008], [.86, .063], [.989, .133],
  [.980, .162], [.915, .184], [.14, .042]]
const crown = [[.15, .003], [.54, .017], [.85, .088], [.962, .141],
  [.954, .148], [.911, .158], [.15, .023]]
function fanBladeMesh() {
  const vertices: number[] = [], indices: number[] = []
  for (const [level, ring] of [outline, crown].entries()) {
    for (const [i, [x, z]] of ring.entries()) {
      const [baseX, baseZ] = outline[i]
      vertices.push((.86 * baseX + .14 * x) * bladeRadius, level ? spectralFan.bladeHeight : -.08,
        (.86 * baseZ + .14 * z) * bladeRadius)
    }
  }
  const n = outline.length
  for (let i = 0; i < n; i++) {
    const next = (i + 1) % n
    indices.push(i, n + i, next, next, n + i, n + next)
  }
  for (let i = 1; i < n - 1; i++) indices.push(n, n + i + 1, n + i, 0, i, i + 1)
  return { vertices: new Float32Array(vertices), indices: new Uint32Array(indices) }
}
export const spectralFanBlade = fanBladeMesh()
