import prism from './courses/prism-layout.json'
import frostline from './courses/frostline-layout.json'
import type { CourseId } from './courses/catalog'

export type { CourseId } from './courses/catalog'
export type CourseSurface = 'lacquer' | 'wood' | 'ice'

/** Distances follow the horizontal centerline; positive lateral points to its right. */
export interface TrackSample {
  x: number
  y: number
  z: number
  tx: number
  tz: number
  rx: number
  rz: number
}

interface Section { name: string; start: number; end: number }
interface Deflector { s: number; lateral: number; radius: number; height: number }
interface CollisionMesh { vertices: Float32Array; indices: Uint32Array; surface: CourseSurface }
export interface CourseTrack {
  readonly id: CourseId
  readonly length: number
  readonly startS: number
  readonly finishS: number
  readonly halfWidth: number
  readonly laneWidth: number
  readonly laneCount: number
  readonly radius: number
  readonly seed: number
  readonly sections: Section[]
  readonly collisions: CollisionMesh[]
  readonly deflectors: Deflector[]
  sample(s: number, lateral?: number): TrackSample
  locate(x: number, z: number, hint?: number): { s: number; lateral: number }
  surfaceAt(s: number): CourseSurface
  divider(s: number): number
  wallHeight(s: number): number
}

interface PathPiece { start: number; end: number; x: number; z: number; angle: number; curvature: number }
interface Layout {
  runs: { curvature: number; length: number }[]
  origin: { x: number; z: number; angle: number }
  seed: number
  startS: number
  finishS: number
  halfWidth: number
  laneCount: number
  sections: Section[]
}
interface SurfaceSpan { start: number; end: number; surface: CourseSurface }
interface Profile {
  height(s: number, lateral: number): number
  divider(s: number): number
  spans: SurfaceSpan[]
  deflectors: Deflector[]
}
const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(value, high))
const ease = (a: number, b: number, value: number) => {
  const t = clamp((value - a) / (b - a), 0, 1)
  return t * t * (3 - 2 * t)
}
function bankAt(s: number, piece: PathPiece, gradient: number, blend = 4.5) {
  return gradient * ease(piece.start - blend, piece.start + blend, s) * (1 - ease(piece.end - blend, piece.end + blend, s))
}
// Smoothly connect the six channel elevations; the running surface and collider share this crown.
function launchTrim(across: number, trims: number[]) {
  const last = trims.length - 1
  const channel = clamp((across + 1) * trims.length / 2 - 0.5, 0, last)
  const left = Math.floor(channel), right = Math.min(left + 1, last)
  return trims[left] + ease(0, 1, channel - left) * (trims[right] - trims[left])
}
function position(piece: PathPiece, distance: number) {
  const angle = piece.angle + piece.curvature * distance
  const tx = Math.cos(angle)
  const tz = Math.sin(angle)
  if (piece.curvature === 0) return { x: piece.x + tx * distance, z: piece.z + tz * distance, tx, tz }
  return {
    x: piece.x + (tz - Math.sin(piece.angle)) / piece.curvature,
    z: piece.z + (Math.cos(piece.angle) - tx) / piece.curvature, tx, tz,
  }
}

function prismProfile(pieces: PathPiece[]): Profile {
  const { banks, sections } = prism
  const divider = (s: number) => 1 - ease(pieces[3].end - 7, pieces[3].end + 4, s)
  const timber = sections[4].start + 1.8
  return {
    divider, deflectors: [],
    spans: [{ start: 0, end: timber, surface: 'lacquer' }, { start: timber, end: sections[5].end, surface: 'wood' }],
    height(s, lateral) {
      const drop = 0.041 * s + 1.45 * (1 - Math.exp(-s / 8.5))
      const rollers = 0.115 * Math.sin((s - 4.5) * 2 * Math.PI / prism.rollerPitch) * ease(3, 8, s) * (1 - ease(19, 22, s))
      const bank = bankAt(s, pieces[1], banks.first) + bankAt(s, pieces[3], banks.second)
      const across = lateral / prism.halfWidth
      const launchGroove = banks.launchGrooveDepth * Math.exp(-(((across - 0.25) / banks.launchGrooveWidth) ** 2))
      const launchProfile = launchTrim(across, prism.launchTrims) + banks.launchTilt * across + banks.launchFlare * across ** 2 - launchGroove
        + banks.launchShoulder * (1 - ease(-0.49, 0.49, across))
      return 7.6 - drop + rollers + lateral * bank + (1 - ease(2, 20, s)) * launchProfile
    },
  }
}

function frostProfile(pieces: PathPiece[]): Profile {
  const sections = frostline.sections
  const timber = sections[2]
  const field = sections[3]
  const divider = (s: number) => 1 - ease(5, sections[0].end, s)
  return {
    divider, deflectors: frostline.deflectors,
    spans: [
      { start: 0, end: sections[0].end, surface: 'wood' },
      { start: sections[1].start, end: timber.start, surface: 'ice' },
      { start: timber.start, end: field.start, surface: 'wood' },
      { start: field.start, end: sections[5].start, surface: 'ice' },
      { start: sections[5].start, end: sections[5].end, surface: 'wood' },
    ],
    height(s, lateral) {
      const fieldDrop = 0.115 * clamp(s - (field.start - 2), 0, field.end - field.start + 2)
      const drop = 0.043 * s + 1.08 * (1 - Math.exp(-s / 6.5)) + fieldDrop
      // Integrate a varying downhill grade: each crest can release a ball from rest.
      const phase = clamp((s - timber.start) / frostline.rollerPitch, 0, 3) * 2 * Math.PI
      const rollerDrop = 0.059 * (phase - Math.sin(phase))
      const bank = bankAt(s, pieces[1], -0.044, 5.4) + bankAt(s, pieces[2], 0.049, 5.4)
        + bankAt(s, pieces[4], -0.066, 5.6) + bankAt(s, pieces[6], -0.07, 5.6)
      // A small crossfall and the downhill pitch shed slow marbles around the round deflectors.
      const crossfall = 0.018 * Math.sin((s - field.start) * 0.22) * ease(field.start - 2, field.start + 2, s)
        * (1 - ease(field.end - 2, field.end + 2, s))
      const gate = (1 - ease(1.8, 17, s)) * launchTrim(lateral / frostline.halfWidth, frostline.launchTrims)
      return 10.8 - drop - rollerDrop + lateral * (bank + crossfall) + gate
    },
  }
}

function buildCourse(id: CourseId, layout: Layout, makeProfile: (pieces: PathPiece[]) => Profile): CourseTrack {
  const { halfWidth, laneCount, startS, finishS } = layout
  const laneWidth = 2 * halfWidth / laneCount
  let length = 0
  let { x, z, angle } = layout.origin
  const pieces: PathPiece[] = []
  for (const run of layout.runs) {
    const piece = { start: length, end: length + run.length, x, z, angle, curvature: run.curvature }
    pieces.push(piece)
    const end = position(piece, run.length)
    x = end.x
    z = end.z
    length = piece.end
    angle += run.curvature * run.length
  }
  const profile = makeProfile(pieces)
  const { divider, spans } = profile
  const wallHeight = (s: number) => (id === 'prism' ? 0.73 : 0.88) + 0.12 * ease(finishS + 0.4, length, s)
  const sample = (distance: number, lateral = 0): TrackSample => {
    const s = clamp(distance, 0, length)
    const piece = pieces.find(part => s <= part.end) ?? pieces[pieces.length - 1]
    const point = position(piece, s - piece.start)
    const rx = -point.tz, rz = point.tx
    const groove = 0.05 * (1 + Math.cos(2 * Math.PI * (lateral + halfWidth) / laneWidth))
    const y = profile.height(s, lateral) + divider(s) * groove + 0.038 * Math.abs(lateral / halfWidth) ** 5
    return { x: point.x + lateral * rx, y, z: point.z + lateral * rz, tx: point.tx, tz: point.tz, rx, rz }
  }
  const locate = (x: number, z: number, hint?: number) => {
    let best = 0, bestD = Infinity, lateral = 0
    for (const piece of pieces) {
      if (hint !== undefined && (hint < piece.start - 8 || hint > piece.end + 8)) continue
      const arcLength = piece.end - piece.start
      let ds: number
      if (piece.curvature === 0) {
        ds = clamp((x - piece.x) * Math.cos(piece.angle) + (z - piece.z) * Math.sin(piece.angle), 0, arcLength)
      } else {
        const k = piece.curvature
        const cx = piece.x - Math.sin(piece.angle) / k, cz = piece.z + Math.cos(piece.angle) / k
        const angle = Math.atan2((x - cx) * k, -(z - cz) * k)
        const circle = 2 * Math.PI
        const delta = (((angle - piece.angle) * Math.sign(k)) % circle + circle) % circle
        const sweep = Math.abs(k) * arcLength
        if (delta <= sweep) ds = delta / Math.abs(k)
        else ds = circle - delta < delta - sweep ? 0 : arcLength
      }
      const p = position(piece, ds)
      const dx = x - p.x, dz = z - p.z
      const d2 = dx * dx + dz * dz
      if (d2 < bestD) {
        bestD = d2
        best = piece.start + ds
        lateral = -p.tz * dx + p.tx * dz
      }
    }
    return { s: best, lateral }
  }
  const cross: { lateral: number; lift: 'wall' | 'divider' | 0 }[] = [
    { lateral: -halfWidth, lift: 'wall' }, { lateral: -halfWidth, lift: 0 },
  ]
  for (let lane = 0; lane < laneCount; lane++) {
    const left = -halfWidth + lane * laneWidth
    for (const fraction of [0.12, 0.25, 0.5, 0.75, 0.88]) cross.push({ lateral: left + fraction * laneWidth, lift: 0 })
    const end = left + laneWidth
    if (lane < laneCount - 1) cross.push({ lateral: end - 0.045, lift: 0 }, { lateral: end, lift: 'divider' }, { lateral: end + 0.045, lift: 0 })
  }
  cross.push({ lateral: halfWidth, lift: 0 }, { lateral: halfWidth, lift: 'wall' })

  const collisions = spans.map(({ start, end, surface }) => {
    // Each contact surface owns a continuous strip. Adjacent materials share the exact boundary row.
    const rows = Math.ceil((end - start) / 0.31)
    const vertices: number[] = [], indices: number[] = []
    for (let i = 0; i <= rows; i++) {
      const s = i === rows ? end : start + (end - start) * i / rows
      for (const point of cross) {
        const p = sample(s, point.lateral)
        const lift = point.lift === 'wall' ? wallHeight(s) : point.lift === 'divider' ? divider(s) * 0.205 : 0
        vertices.push(p.x, p.y + lift, p.z)
      }
      if (i > 0) for (let j = 0; j < cross.length - 1; j++) {
        const a = (i - 1) * cross.length + j, b = a + 1, c = a + cross.length, d = c + 1
        indices.push(a, b, c, b, d, c)
      }
    }
    function bumper(s: number, reverse: boolean) {
      const first = vertices.length / 3
      for (const l of [-halfWidth, halfWidth]) {
        const p = sample(s, l)
        vertices.push(p.x, p.y - 0.04, p.z, p.x, p.y + 1.2, p.z)
      }
      if (reverse) indices.push(first, first + 1, first + 2, first + 1, first + 3, first + 2)
      else indices.push(first, first + 2, first + 1, first + 1, first + 2, first + 3)
    }
    if (start === 0) bumper(start, true)
    if (end === length) bumper(end, false)
    return { vertices: new Float32Array(vertices), indices: new Uint32Array(indices), surface }
  })
  return {
    id, length, startS, finishS, halfWidth, laneWidth, laneCount, radius: 0.39, seed: layout.seed,
    sections: layout.sections, deflectors: profile.deflectors, collisions, sample, locate, divider, wallHeight,
    surfaceAt(s) { return (spans.find(span => s < span.end) ?? spans[spans.length - 1]).surface },
  }
}

export const buildPrismTrack = () => buildCourse('prism', prism, prismProfile)
export const buildFrostlineTrack = () => buildCourse('frostline', frostline, frostProfile)
export const buildTrack = (id: CourseId) => id === 'frostline' ? buildFrostlineTrack() : buildPrismTrack()
