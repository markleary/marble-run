import layout from './wireworks-layout.json'
import { bankAt, buildCourse, clamp, ease } from '../courseGeometry'
import type { CollisionMesh, CourseTrack, Profile, TrackSample } from '../courseGeometry'

export type BranchSide = -1 | 1
export interface WireworksTrack extends CourseTrack {
  /** t=0 is the splitter edge, t=1 is the outside guard. */
  forkSample(s: number, side: BranchSide, t: number): TrackSample
  deckPoint(s: number, column: number): TrackSample
  railPoint(s: number, lane: number, side: BranchSide, angle: number): TrackSample
}

const { halfWidth, railGauge, railRadius, railEnd, forkStart, forkEnd } = layout
const forkLength = forkEnd - forkStart
const noseRadius = .29
const sides = [-1, 1] as const
export const receivingDeck = railEnd - 1.2

function branchOffset(station: number, side: BranchSide) {
  const route = layout.branches[side === -1 ? 0 : 1]
  const t = clamp((station - route.entry) / (route.exit - route.entry), 0, 1)
  return side * route.swell * Math.sin(Math.PI * t) ** 2
}

function stationFromProgress(progress: number, side: BranchSide) {
  const table = layout.branches[side === -1 ? 0 : 1].checkpoints
  let low = 0, high = table.length - 1
  while (high - low > 1) {
    const mid = (high + low) >> 1
    if (table[mid] <= progress) low = mid
    else high = mid
  }
  return (low + (progress - table[low]) / (table[high] - table[low])) / (table.length - 1)
}
function progressFromStation(station: number, side: BranchSide) {
  const table = layout.branches[side === -1 ? 0 : 1].checkpoints
  const index = station * (table.length - 1)
  const low = Math.min(table.length - 2, Math.floor(index))
  return table[low] + (index - low) * (table[low + 1] - table[low])
}

/** Regular cross sections form one connected metal or wood contact mesh.
 *  Columns proceed from the low-lateral side to the high-lateral side. */
function ribbonMesh(start: number, end: number, columns: number, point: (s: number, col: number) => TrackSample,
  surface: CollisionMesh['surface']): CollisionMesh {
  const rows = Math.ceil((end - start) / .24)
  const vertices: number[] = [], indices: number[] = []
  for (let i = 0; i <= rows; i++) {
    const s = i === rows ? end : start + (end - start) * i / rows
    for (let col = 0; col < columns; col++) {
      const p = point(s, col)
      vertices.push(p.x, p.y, p.z)
      if (i && col) {
        const a = (i - 1) * columns + col - 1
        indices.push(a, a + 1, a + columns, a + 1, a + columns + 1, a + columns)
      }
    }
  }
  return { surface, vertices: new Float32Array(vertices), indices: new Uint32Array(indices) }
}

export function buildWireworksTrack(): WireworksTrack {
  const length = layout.sections.at(-1)!.end
  const base = buildCourse('wireworks', layout, pieces => ({
    divider: () => 0, deflectors: [],
    // The wire and the two sides of the fork have their own contact meshes.
    spans: [],
    height(s, l) {
      // Each pair starts level across its two wires. The longer outside lines
      // start higher, then shed their extra height before the first bend.
      const lane = clamp(Math.floor((l + halfWidth) * layout.laneCount / (2 * halfWidth)), 0, layout.laneCount - 1)
      const across = (lane + .5) * 2 / layout.laneCount - 1
      const gate = -layout.gateHeightStagger * across * (1 - ease(0, layout.sections[0].end, s))
      const drop = .055 * s + .115 * clamp(s - (forkEnd - 7), 0, 13) + 1.55 * (1 - Math.exp(-s / 9)) + .32 * ease(8, 27, s)
      const bank = bankAt(s, pieces[1], -.12) + bankAt(s, pieces[5], -.15)
      return 10.8 - drop + l * bank + gate
    },
  } satisfies Profile))
  const atStation = (station: number, side: BranchSide, t: number) => {
    const physicalS = forkStart + station * forkLength
    const shifted = branchOffset(station, side)
    const routeL = side * (noseRadius + (halfWidth - noseRadius) * t)
    const p = base.sample(physicalS, routeL)
    // Shift the whole deck, including both walls, away from the central tower.
    p.x += p.rx * shifted
    p.z += p.rz * shifted
    // Bank the longer sweep toward the tower. The shoulder meets the shared
    // decks level at both ends and stays flush with the splitter along t=0.
    if (side === 1) p.y += layout.outerBankRise * t * Math.sin(Math.PI * station) ** 2
    return p
  }
  const forkSample = (s: number, side: BranchSide, t: number) =>
    atStation(stationFromProgress(clamp((s - forkStart) / forkLength, 0, 1), side), side, t)
  const sample = (s: number, l = 0): TrackSample => {
    if (s <= forkStart || s >= forkEnd || l === 0) return base.sample(s, l)
    return forkSample(s, l < 0 ? -1 : 1, (Math.abs(l) - noseRadius) / (halfWidth - noseRadius))
  }
  const locate: CourseTrack['locate'] = (x, z, hint, y) => {
    const p = base.locate(x, z, hint, y)
    if (p.s <= forkStart || p.s >= forkEnd) return p
    const station = (p.s - forkStart) / forkLength
    const side = p.lateral < 0 ? -1 : 1
    return { s: forkStart + forkLength * progressFromStation(station, side), lateral: p.lateral - branchOffset(station, side) }
  }
  const railPoint = (s: number, lane: number, side: BranchSide, angle: number): TrackSample => {
    const laneL = (lane + .5) * base.laneWidth - halfWidth
    const p = base.sample(s, laneL + side * railGauge / 2)
    // The supported ball's bottom meets the timber at the transfer. The ends of
    // the rails then sink into milled pockets in the wooden receiving deck.
    const ballSeat = Math.sqrt((base.radius + railRadius) ** 2 - (railGauge / 2) ** 2) - base.radius
    const across = railRadius * Math.sin(angle)
    p.x += p.rx * across
    p.z += p.rz * across
    p.y += railRadius * Math.cos(angle) - ballSeat - .14 * ease(receivingDeck, railEnd, s)
    return p
  }
  const collisions = [...base.collisions]
  for (let lane = 0; lane < base.laneCount; lane++) for (const side of sides) {
    collisions.push(ribbonMesh(0, railEnd, 13, (s, col) => railPoint(s, lane, side, col * Math.PI / 6), 'wire'))
  }
  const deckStrip = (s: number, col: number) => {
    const station = clamp((s - forkStart) / forkLength, 0, 1)
    const fork = s > forkStart && s < forkEnd
    if (col <= 11 || col >= 17) {
      const left = col <= 11
      const t = left ? clamp(11 - col, 0, 10) / 10 : clamp(col - 17, 0, 10) / 10
      const side = left ? -1 : 1
      const p = fork ? atStation(station, side, t) : base.sample(s, side * (noseRadius + t * (halfWidth - noseRadius)))
      if (col === 0 || col === 28) p.y += base.wallHeight(s)
      return p
    }
    const left = -noseRadius + branchOffset(station, -1), right = noseRadius + branchOffset(station, 1)
    // The splitter is a continuous convex sill. Its crown grows from the catch
    // deck at the nose and disappears into the banked reunion at the tail.
    const t = (col - 11) / 6, width = right - left
    const p = base.sample(s, left + t * width)
    p.y += Math.min(1.25, (width - noseRadius * 2) * .87) * Math.sin(Math.PI * t) ** .46
    return p
  }
  collisions.push(ribbonMesh(receivingDeck, forkStart, 29, deckStrip, 'wood'))
  collisions.push(ribbonMesh(forkStart, length, 29, deckStrip, 'lacquer'))
  const endWall = [-halfWidth, halfWidth].flatMap(l => {
    const p = base.sample(length, l)
    return [p.x, p.y - .05, p.z, p.x, p.y + 1.25, p.z]
  })
  collisions.push({ surface: 'lacquer', vertices: new Float32Array(endWall), indices: new Uint32Array([0, 2, 1, 1, 2, 3]) })
  return { ...base, collisions, forkSample, deckPoint: deckStrip, railPoint, sample, locate,
    surfaceAt: s => s < receivingDeck ? 'wire' : s < forkStart ? 'wood' : 'lacquer' }
}
