import { buildCourse, clamp, ease, launchTrim, type CourseTrack, type Profile } from '../courseGeometry'
import layout from './crux-layout.json'
import { checkpointStations } from './checkpoints'
import { cruxObstacleBoards, cruxObstacleMesh, cruxObstacles } from './cruxObstacles'

const { halfWidth, sections, jumps } = layout
const stations = checkpointStations('crux', sections)
const gate = sections[0], runout = sections[sections.length - 1]
export const cruxJumps = jumps
type Jump = typeof jumps[number]

/** These are the only surfaces that can carry a marble; the gaps have no floor. */
export const cruxDeckSpans: Profile['spans'] = [
  { start: 0, end: gate.end, surface: 'wood' },
  ...jumps.map((jump, i) => ({
    start: i ? jumps[i - 1].landing : gate.end, end: jump.takeoff, surface: 'lacquer' as const,
  })),
  { start: jumps[jumps.length - 1].landing, end: runout.end, surface: 'wood' },
]

/** The airborne envelope is enclosed only on its two sides, through touchdown. */
export function cruxJumpShield(track: CourseTrack, jump: Jump, side: number) {
  const lip = track.sample(jump.takeoff, side * halfWidth)
  const catchEnd = track.sample(jump.catchEnd, side * halfWidth)
  return [
    { x: lip.x, y: catchEnd.y - .3, z: lip.z },
    { x: lip.x, y: lip.y + 7, z: lip.z },
    { x: catchEnd.x, y: catchEnd.y - .3, z: catchEnd.z },
    { x: catchEnd.x, y: lip.y + 7, z: catchEnd.z },
  ]
}

function jumpElevation(s: number) {
  let height = 0
  for (const jump of jumps) {
    if (s < jump.diveStart) break
    // A steep downhill feeds a curved kicker. Its final tangent sends the
    // marble upward under Rapier gravity; only the sampling line spans the gap.
    height -= jump.dive * ease(jump.diveStart, jump.rampStart, s)
    const foot = clamp((s - jump.rampStart) / (jump.takeoff - jump.rampStart), 0, 1)
    const transfer = ease(jump.takeoff, jump.landing, s)
    height += jump.rise * foot ** 2.1 * (1 - transfer) - jump.drop * transfer
    // The receiving slope follows the falling trajectory, then rolls smoothly
    // back into the straight. A fast landing keeps its forward momentum.
    const catchLength = jump.catchEnd - jump.landing
    const catchFraction = clamp((s - jump.landing) / catchLength, 0, 1)
    height -= .085 * catchLength * (catchFraction - .5 * catchFraction ** 2)
  }
  return height
}

function cruxProfile(): Profile {
  const bends = [2, 4, 6, 8, 10].map((i, index) => ({
    ...sections[i], side: index % 2 ? -1 : 1,
    // Start flattening these exits early to spread the pack across the obstacle board.
    rollOff: i === 4 ? 3.5 : i === 8 ? 4.5 : 0,
  }))
  const grade = .057
  const bank = 1.00
  const bankDrop = 1.45
  const apronDrop = 4.2
  const slalomDrop = 5.8, crossGalleryDrop = 2.2
  const top = 3 + stations.length * apronDrop + grade * runout.end + 3.4 - jumpElevation(runout.end)
    + 2 * bankDrop * bends.length + (slalomDrop + crossGalleryDrop)
  return {
    roundedLaneDepth: .12,
    collisionResolution: { rowSpacing: .56, bandsPerLane: 6 },
    divider: s => 1 - ease(8, gate.end, s),
    wallHeight: s => {
      for (const board of cruxObstacleBoards) {
        if (s >= board.start - 3 && s < board.end + 15) {
          const extension = board.id === 'return' ? 4.55 : 2.65
          return 2.15 + extension * (ease(board.start - 3, board.start, s) - ease(board.end + 10, board.end + 15, s))
        }
      }
      // Highball Bend carries the most speed, and a marble that crosses to the
      // outside can climb the full bank. Its taller shield holds that line.
      const highball = sections[6]
      return 2.15 + 1.6 * (ease(highball.start - 5, highball.start + 23, s) - ease(highball.end - 23, highball.end + 5, s))
    },
    spans: cruxDeckSpans,
    deflectors: [],
    height(s, lateral) {
      let cant = 0, bowl = 0, bendDrop = 0
      for (const bend of bends) {
        if (s < bend.start - 5) break
        const enter = ease(bend.start - 5, bend.start + 23, s)
        const leave = ease(bend.end - 23 - bend.rollOff, bend.end + 5 - bend.rollOff, s)
        const blend = enter - leave
        cant -= bend.side * bank * blend
        bowl += blend
        bendDrop += bankDrop * (enter + leave)
      }
      // Roll the banking through each direction change of the blade gallery.
      const slalom = layout.slalom, local = s - slalom.start
      const boardDrop = slalomDrop * ease(-5, 4 * slalom.arc + 5, local)
        + crossGalleryDrop * ease(layout.hook.linkStart - 19, layout.hook.linkEnd + 19, s)
      if (local > -3 && local < 4 * slalom.arc + 3) {
        const transition = (distance: number) => ease(distance - 3, distance + 3, local)
        cant += .035 * (transition(0) - 2 * transition(slalom.arc)
          + 2 * transition(3 * slalom.arc) - transition(4 * slalom.arc))
      }
      // Flatten the short cross-gallery between the two distinctly banked apexes.
      cant += .48 * (ease(layout.hook.linkStart - 20, layout.hook.linkStart + 5, s)
        - ease(layout.hook.linkEnd - 5, layout.hook.linkEnd + 20, s))
      // A broad, banked running surface supplies the turning force. The
      // outer shoulder curls progressively upward before the safety rail.
      const across = lateral / halfWidth
      const shoulder = bowl * (.70 * across ** 2 + .68 * across ** 6)
      const launch = s < gate.end ? (launchTrim(across, layout.launchTrims)
        + .10 * Math.sin(Math.PI * layout.laneCount * (1 + across))) * (1 - ease(2, gate.end, s)) : 0
      const launchDrop = 3.4 * (1 - Math.exp(-s / 9))
      // The holding rail opens onto a runout already falling away beneath
      // the seats. Released marbles accelerate immediately under gravity.
      let apron = 0
      for (const station of stations) apron += apronDrop * ease(station.s - 5, station.s + 23, s)
      return top - grade * s - launchDrop - bendDrop - boardDrop - apron + jumpElevation(s) + cant * lateral + shoulder + launch
    },
  }
}

export function buildCruxTrack() {
  const track = buildCourse('crux', layout, cruxProfile)
  for (const jump of jumps) {
    const vertices = [-1, 1].flatMap(side => cruxJumpShield(track, jump, side).flatMap(p => [p.x, p.y, p.z]))
    track.collisions.push({ surface: 'lacquer', vertices: new Float32Array(vertices),
      indices: new Uint32Array([0, 2, 1, 1, 2, 3, 4, 5, 6, 5, 7, 6]) })
  }
  for (const obstacle of cruxObstacles) track.collisions.push(cruxObstacleMesh(track, obstacle))
  return track
}
