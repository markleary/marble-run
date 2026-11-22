import { clamp, ease, type CourseTrack, type CollisionMesh } from '../courseGeometry'
import layout from './orrery-layout.json'

export const orreryJumps = layout.jumps
const end = layout.sections[layout.sections.length - 1].end
export const orreryDeckSpans = [
  ...orreryJumps.map((jump, i) => ({ start: i ? orreryJumps[i - 1].landing : 0, end: jump.takeoff })),
  { start: orreryJumps[orreryJumps.length - 1].landing, end },
]

export function catcherGuardLift(s: number) {
  for (const { landing } of orreryJumps) {
    if (s >= landing && s < landing + 7) return 1.75 * (1 - ease(landing + 3.8, landing + 7, s))
  }
  return 0
}

// The end posts suspend a clear side shield above each open gap. Both the mesh and
// Rapier use these four corners so an oblique landing stays inside the catch deck.
export function jumpShield(track: CourseTrack, jump: typeof orreryJumps[number], side: number) {
  const lip = track.sample(jump.takeoff, side * track.halfWidth)
  const catchDeck = track.sample(jump.landing, side * track.halfWidth)
  return [
    { x: lip.x, y: lip.y, z: lip.z },
    { x: lip.x, y: lip.y + track.wallHeight(jump.takeoff), z: lip.z },
    { x: catchDeck.x, y: catchDeck.y, z: catchDeck.z },
    { x: catchDeck.x, y: catchDeck.y + track.wallHeight(jump.landing), z: catchDeck.z },
  ]
}

export function jumpShieldCollision(track: CourseTrack): CollisionMesh {
  const vertices: number[] = [], indices: number[] = []
  for (const jump of orreryJumps) for (const side of [-1, 1]) {
    const first = vertices.length / 3
    for (const p of jumpShield(track, jump, side)) vertices.push(p.x, p.y, p.z)
    // Rapier fixes internal edges using the face normal. Both shields face the racing line.
    if (side < 0) indices.push(first, first + 2, first + 1, first + 1, first + 2, first + 3)
    else indices.push(first, first + 1, first + 2, first + 1, first + 3, first + 2)
  }
  return { vertices: new Float32Array(vertices), indices: new Uint32Array(indices), surface: 'lacquer' }
}

export function jumpHeight(s: number) {
  let height = 0
  for (const jump of orreryJumps) {
    const foot = jump.takeoff - jump.runUp
    // The dip supplies the run-up. A curved kicker points the marble upward at the lip.
    height -= jump.dip * ease(foot - 5, foot, s)
    const ramp = clamp((s - foot) / jump.runUp, 0, 1)
    // Only progress sampling crosses the gap. The visible deck and collision mesh both stop at the lip.
    height += jump.rise * ramp ** 2.7 * (1 - ease(jump.takeoff, jump.landing, s))
  }
  return height
}
