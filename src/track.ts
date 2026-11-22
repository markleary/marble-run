import layout from './courses/prism-layout.json'

/** Distances are in world units along the horizontal centerline. Y points up. */
export interface TrackSample {
  x: number
  y: number
  z: number
  tx: number
  tz: number
  rx: number
  rz: number
}

export interface PrismTrack {
  readonly length: number
  readonly startS: number
  readonly finishS: number
  readonly halfWidth: number
  readonly laneWidth: number
  readonly radius: number
  readonly seed: number
  readonly sections: { name: string; start: number; end: number }[]
  readonly collision: { vertices: Float32Array; indices: Uint32Array }
  sample(s: number, lateral?: number): TrackSample
  locate(x: number, z: number, hint?: number): { s: number; lateral: number }
  divider(s: number): number
  wallHeight(s: number): number
}

interface PathPiece {
  start: number
  end: number
  x: number
  z: number
  angle: number
  curvature: number
}

export const PRISM_SEED = layout.seed
const HALF_WIDTH = layout.halfWidth
const LANE = HALF_WIDTH / 2
const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(value, high))
const ease = (a: number, b: number, value: number) => {
  const t = clamp((value - a) / (b - a), 0, 1)
  return t * t * (3 - 2 * t)
}

function position(piece: PathPiece, distance: number) {
  const angle = piece.angle + piece.curvature * distance
  const tx = Math.cos(angle)
  const tz = Math.sin(angle)
  if (piece.curvature === 0) {
    return { x: piece.x + tx * distance, z: piece.z + tz * distance, tx, tz }
  }
  return {
    x: piece.x + (tz - Math.sin(piece.angle)) / piece.curvature,
    z: piece.z + (Math.cos(piece.angle) - tx) / piece.curvature,
    tx,
    tz,
  }
}

/** The shipped seed fixes the roller spacing; every heat uses the same course. */
export function buildPrismTrack(): PrismTrack {
  const { runs, rollerPitch, startS, finishS, banks } = layout
  let distance = 0
  let { x, z, angle } = layout.origin
  const pieces: PathPiece[] = []
  for (const run of runs) {
    const piece = { start: distance, end: distance + run.length, x, z, angle, curvature: run.curvature }
    pieces.push(piece)
    const end = position(piece, run.length)
    x = end.x
    z = end.z
    distance += run.length
    angle += run.curvature * run.length
  }
  const length = distance
  const divider = (s: number) => 1 - ease(pieces[3].end - 7, pieces[3].end + 4, s)
  const wallHeight = (s: number) => 0.73 + 0.12 * ease(finishS + 0.4, length, s)
  const pieceAt = (s: number) => pieces.find(part => s <= part.end) ?? pieces[pieces.length - 1]
  const center = (s: number) => {
    const piece = pieceAt(s)
    return position(piece, s - piece.start)
  }
  const bendBank = (s: number, piece: PathPiece, gradient: number) =>
    gradient * ease(piece.start - 4.5, piece.start + 4.5, s) * (1 - ease(piece.end - 4.5, piece.end + 4.5, s))
  const sample = (distance: number, lateral = 0): TrackSample => {
    const s = clamp(distance, 0, length)
    const { x, z, tx, tz } = center(s)
    const rx = -tz, rz = tx
    const slope = 0.041
    const drop = slope * s + 1.45 * (1 - Math.exp(-s / 8.5))
    const rollers = 0.115 * Math.sin((s - 4.5) * 2 * Math.PI / rollerPitch) *
      ease(3, 8, s) * (1 - ease(19, 22, s))
    const bank = bendBank(s, pieces[1], banks.first) + bendBank(s, pieces[3], banks.second)
    const lanePhase = (lateral + HALF_WIDTH) / LANE
    const groove = 0.10 * (1 + Math.cos(2 * Math.PI * lanePhase)) * 0.5
    const edge = Math.abs(lateral / HALF_WIDTH) ** 5
    // The flared starting trough banks the outside channels into the rollers.
    const across = lateral / HALF_WIDTH
    const launchGroove = banks.launchGrooveDepth * Math.exp(-(((across - 0.25) / banks.launchGrooveWidth) ** 2))
    const launchProfile = banks.launchTilt * across + banks.launchFlare * across ** 2 - launchGroove + banks.launchShoulder * (1 - ease(-0.49, 0.49, across))
    const launchBank = (1 - ease(2, 20, s)) * launchProfile
    const height = launchBank + 7.6 - drop + rollers + lateral * bank + divider(s) * groove + 0.038 * edge
    return { x: x + lateral * rx, y: height, z: z + lateral * rz, tx, tz, rx, rz }
  }

  // Every strip shares vertices across its full length, including the outer guard faces.
  // The cross section resolves both the soft lane troughs and raised lane dividers.
  const cross: { lateral: number; lift: 'wall' | 'divider' | number }[] = [
    { lateral: -HALF_WIDTH, lift: 'wall' }, { lateral: -HALF_WIDTH, lift: 0 },
  ]
  for (let lane = 0; lane < 4; lane++) {
    const left = -HALF_WIDTH + lane * LANE
    for (const fraction of [0.12, 0.25, 0.5, 0.75, 0.88]) cross.push({ lateral: left + fraction * LANE, lift: 0 })
    const end = left + LANE
    if (lane < 3) {
      cross.push({ lateral: end - 0.045, lift: 0 }, { lateral: end, lift: 'divider' }, { lateral: end + 0.045, lift: 0 })
    }
  }
  cross.push({ lateral: HALF_WIDTH, lift: 0 }, { lateral: HALF_WIDTH, lift: 'wall' })
  const rows = Math.ceil(length / 0.31)
  const vertices: number[] = []
  const indices: number[] = []
  for (let i = 0; i <= rows; i++) {
    const s = length * i / rows
    for (const point of cross) {
      const p = sample(s, point.lateral)
      const lift = point.lift === 'wall' ? wallHeight(s) : point.lift === 'divider' ? divider(s) * 0.205 : point.lift
      vertices.push(p.x, p.y + lift, p.z)
    }
    if (i === 0) continue
    for (let j = 0; j < cross.length - 1; j++) {
      const a = (i - 1) * cross.length + j, b = a + 1, c = a + cross.length, d = c + 1
      indices.push(a, b, c, b, d, c)
    }
  }
  // End bumper catches settled finishers. The finish timing plane is four units upstream.
  const bumper = (s: number, reverse: boolean) => {
    const start = vertices.length / 3
    for (const l of [-HALF_WIDTH, HALF_WIDTH]) {
      const p = sample(s, l)
      vertices.push(p.x, p.y - 0.04, p.z, p.x, p.y + 1.2, p.z)
    }
    if (reverse) indices.push(start, start + 1, start + 2, start + 1, start + 3, start + 2)
    else indices.push(start, start + 2, start + 1, start + 1, start + 2, start + 3)
  }
  bumper(length, false)
  bumper(0, true)

  const locate = (x: number, z: number, hint?: number) => {
    let best = 0, bestD = Infinity, lateral = 0
    for (const piece of pieces) {
      if (hint !== undefined && (hint < piece.start - 8 || hint > piece.end + 8)) continue
      let ds: number
      if (piece.curvature === 0) {
        ds = (x - piece.x) * Math.cos(piece.angle) + (z - piece.z) * Math.sin(piece.angle)
      } else {
        const cx = piece.x - Math.sin(piece.angle) / piece.curvature
        const cz = piece.z + Math.cos(piece.angle) / piece.curvature
        const angle = Math.atan2((x - cx) * piece.curvature, -(z - cz) * piece.curvature)
        let delta = angle - piece.angle
        while (delta < -Math.PI / 2) delta += 2 * Math.PI
        while (delta > Math.PI * 1.5) delta -= 2 * Math.PI
        if (piece.curvature < 0 && delta > Math.PI / 2) delta -= Math.PI * 2
        ds = delta / piece.curvature
      }
      ds = clamp(ds, 0, piece.end - piece.start)
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
  return {
    length, startS, finishS, halfWidth: HALF_WIDTH, laneWidth: LANE, radius: 0.39, seed: PRISM_SEED,
    sections: layout.sections,
    collision: { vertices: new Float32Array(vertices), indices: new Uint32Array(indices) },
    sample, locate, divider, wallHeight,
  }
}
