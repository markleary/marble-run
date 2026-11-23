import type { CollisionMesh, CourseTrack } from '../courseGeometry'
import layout from './crux-layout.json'

export type CruxBoardId = 'bumper' | 'blade' | 'volume' | 'return'
type Kind = 'bumper' | 'stud' | 'blade' | 'volume' | 'elbow'
type Point = [along: number, across: number]
type Ring = { points: Point[]; lift: number; lifts?: number[] }
export interface CruxObstacle {
  id: string
  board: CruxBoardId
  kind: Kind
  color: string
  s: number
  lateral: number
  height: number
  bolts: { s: number; lateral: number; lift: number }[]
  rings: Ring[]
  /** Blade and elbow rows follow a spine. Each row has a left and right edge. */
  strip?: boolean
  peak?: Point
}

const blue = '#3e4cc5', teal = '#269eb2', red = '#d54b33', yellow = '#d3b541'
const orange = '#d98935', green = '#379a54'
const bladeStart = layout.sections[5].start, holdStart = layout.sections[9].start
const elbowCenter = (layout.hook.linkStart + layout.hook.linkEnd) / 2
export const cruxObstacleBoards: { id: CruxBoardId; start: number; end: number }[] = [
  { id: 'bumper', start: 19, end: 33.4 },
  { id: 'blade', start: bladeStart + 8, end: bladeStart + 38.5 },
  { id: 'volume', start: holdStart + 8, end: holdStart + 38 },
  { id: 'return', start: elbowCenter - 12, end: elbowCenter + 12 },
]

const obstacles: CruxObstacle[] = []
function pad(board: CruxBoardId, id: string, kind: 'bumper' | 'stud' | 'volume', color: string,
  s: number, lateral: number, length: number, width: number, height: number, angle: number) {
  const cos = Math.cos(angle), sin = Math.sin(angle)
  const outline: Point[] = kind === 'stud'
    ? [[-.74, -1], [.75, -1], [1, -.70], [1, .65], [.70, 1], [-.74, 1], [-1, .70], [-1, -.66]]
    : kind === 'bumper' ? Array.from({ length: 20 }, (_, i) => [Math.cos(i * Math.PI / 10), Math.sin(i * Math.PI / 10)])
    : board === 'return' ? [[-1, -.63], [-.88, -.78], [.98, -.15], [.98, .04], [-.59, .94], [-.77, .88]]
    : [[-.94, -.28], [-.58, -.88], [.06, -1], [.74, -.69], [1, -.12], [.66, .75], [.02, 1], [-.74, .66]]
  const ring = (scale: number, lift: number, offset = 0): Ring => ({
    lift, points: outline.map(([a, b]) => {
      const x = (a * scale + offset) * length / 2, z = b * width * scale / 2
      return [x * cos - z * sin, x * sin + z * cos]
    }),
  })
  const rings = kind === 'bumper'
    ? [ring(1, -.075), ring(.99, .018 * height), ring(.83, .19 * height), ring(.60, .53 * height), ring(.32, .88 * height)]
    : kind === 'stud' ? [ring(1, -.08), ring(.99, .015), ring(.54, height)]
    : [ring(1, -.05), ring(.98, .055 * height), ring(.53, height * .72, .14)]
  const peak: Point | undefined = kind === 'stud' ? undefined : [.09 * length * cos, .09 * length * sin]
  obstacles.push({ id, kind, board, s, lateral, color, height, rings, peak,
    bolts: kind === 'stud' ? [{ s, lateral, lift: height }] : [] })
}

function rail(board: CruxBoardId, id: string, kind: 'blade' | 'elbow', color: string, s: number,
  lateral: number, spine: [along: number, across: number, halfWidth: number][], height: number, mounts: number[]) {
  const ring = (scale: number, lift: number): Ring => {
    const points: Point[] = []
    for (let i = 0; i < spine.length; i++) {
      const [along, lateral, halfWidth] = spine[i]
      const before = spine[Math.max(0, i - 1)], after = spine[Math.min(spine.length - 1, i + 1)]
      const dx = after[0] - before[0], dz = after[1] - before[1]
      const normalScale = halfWidth * scale / Math.hypot(dx, dz)
      points.push([along + dz * normalScale, lateral - dx * normalScale], [along - dz * normalScale, lateral + dx * normalScale])
    }
    const lifts = points.map((_, index) => {
      const row = Math.floor(index / 2)
      const factor = row === 0 || row === spine.length - 1 ? .035 / height : row === 1 ? .68 : 1
      return lift < 0 ? lift : lift * factor
    })
    return { points, lift, lifts }
  }
  const rings = kind === 'elbow'
    ? [ring(1.52, -.06), ring(1.5, .01), ring(.91, height * .65), ring(.74, height)]
    : [ring(1, -.06), ring(1, height - .065), ring(.84, height)]
  obstacles.push({ id, board, kind, color, s, lateral, height, rings, strip: true,
    bolts: mounts.map(i => ({ s: s + spine[i][0], lateral: lateral + spine[i][1], lift: height })) })
}

// The first black panel mixes low bolted blocks with a domed running surface.
pad('bumper', 'gate-dome', 'bumper', yellow, 25.2, -1.42, 1.57, 1.57, .32, 0)
for (const [i, [s, l]] of [[22.2, 1.46], [27.2, 2.53], [30.7, -.35], [24.4, -3.41]].entries())
  pad('bumper', 'gate-stud-' + i, 'stud', orange, s, l, .73, .68, .105, .28 - .25 * i)

// Broad shoulders and long fine tips make four distinct passing channels.
for (const [i, l] of [-2.95, -.98, 1.04, 2.98].entries()) {
  const lean = [.22, -.17, .21, -.23][i]
  const spine: [number, number, number][] = [
    [-4.4, -lean, .055], [-3.15, -lean * .65, .28], [-2.10, -lean * .48, .38],
    [1.25, lean * .38, .34], [2.38, lean * .58, .22], [4.5, lean, .045],
  ]
  const center = bladeStart + 22 + [-1.1, .9, -.1, 1.7][i]
  rail('blade', 'slalom-blade-' + i, 'blade', [blue, teal, red, yellow][i], center, l, spine, .27, [2, 3])
}
pad('blade', 'slalom-block-blue', 'volume', blue, bladeStart + 12.2, 2.12, 1.60, 1.12, .29, -.43)
pad('blade', 'slalom-block-yellow', 'volume', yellow, bladeStart + 33.1, -1.72, 1.64, 1.22, .30, .5)

for (const [i, [d, l, length, width, height, angle]] of [
  [13.5, -2.37, 2.55, 1.86, .48, .21], [15.0, 1.25, 2.82, 1.98, .39, -.53],
  [20.4, 3.0, 2.30, 1.66, .37, .46], [22.1, -.46, 2.85, 1.85, .52, .67],
  [27.3, -2.55, 2.68, 1.68, .44, -.28], [29.5, 1.83, 2.75, 1.76, .49, -.41],
  [34.4, -.18, 2.36, 1.60, .37, .35],
].entries()) {
  const color = [blue, teal, yellow, red, orange, green, blue][i]
  pad('volume', 'hold-' + i, 'volume', color, holdStart + d, l, length, width, height, angle)
}

// The island bends across the intermediate gallery of the double-apex 180.
// Both ends are free so racers can take the inside opening or sweep outside.
rail('return', 'hook-elbow', 'elbow', red, elbowCenter, 1.55, [
  [-3.25, -.90, .15], [-2.95, -.87, .28], [-.42, -.82, .29], [-.08, -.74, .29],
  [.18, -.54, .29], [.37, -.27, .29], [1.33, 1.46, .28], [1.46, 1.65, .16],
], .21, [])
pad('return', 'hook-dome', 'bumper', yellow, elbowCenter - 7.4, -2.05, 1.72, 1.72, .30, 0)
pad('return', 'hook-left-tip', 'volume', green, elbowCenter - 4.8, 2.64, 1.68, 1.12, .25, -.53)
pad('return', 'hook-right-tip', 'volume', green, elbowCenter + 4.42, -2.03, 1.57, 1.07, .32, .45)
for (const [i, [d, l]] of [[3.95, 1.0], [6.65, -.06], [7.61, 2.31]].entries())
  pad('return', 'hook-stud-' + i, 'stud', orange, elbowCenter + d, l, .76, .70, .095, .12 + i * .3)

export const cruxObstacles: readonly CruxObstacle[] = obstacles

/** Lower rings extend beneath the raceway. The visible paint and physical
 * shell share the same vertices, sampled on the local bank and grade. */
export function cruxObstacleMesh(track: CourseTrack, obstacle: CruxObstacle): CollisionMesh {
  const vertices: number[] = [], indices: number[] = []
  const add = ([a, b]: Point, lift: number) => {
    const p = track.sample(obstacle.s + a, obstacle.lateral + b)
    vertices.push(p.x, p.y + lift, p.z)
  }
  for (const ring of obstacle.rings) {
    for (const [i, p] of ring.points.entries()) add(p, ring.lifts?.[i] ?? ring.lift)
  }
  const count = obstacle.rings[0].points.length
  const perimeter = Array.from({ length: count }, (_, i) => i)
  if (obstacle.strip) {
    // Strip vertices alternate between the left and right edges. Walk down
    // the left side and back along the right to close the outer skirt.
    const left = perimeter.filter(index => index % 2 === 0)
    const right = perimeter.filter(index => index % 2 === 1).reverse()
    perimeter.splice(0, count, ...left, ...right)
  }
  for (let level = 1; level < obstacle.rings.length; level++) {
    const lower = (level - 1) * count, upper = level * count
    for (const [i, a] of perimeter.entries()) {
      const b = perimeter[(i + 1) % count]
      indices.push(lower + a, upper + a, lower + b, lower + b, upper + a, upper + b)
    }
  }
  const top = (obstacle.rings.length - 1) * count
  if (obstacle.strip) {
    for (let i = 0; i < count - 2; i += 2) {
      const left = top + i, right = left + 1
      indices.push(left, right, left + 2, right, right + 2, left + 2)
    }
  } else {
    const peak = vertices.length / 3
    add(obstacle.peak ?? [0, 0], obstacle.height)
    for (let i = 0; i < count; i++) indices.push(peak, top + (i + 1) % count, top + i)
  }
  return { vertices: new Float32Array(vertices), indices: new Uint32Array(indices), surface: 'lacquer' }
}
