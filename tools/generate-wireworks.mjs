// Bake both tower routes and their arc-length checkpoints from one exhibit design seed.
import { writeFile } from 'node:fs/promises'

const seed = 0x57495245
let state = seed
function random() {
  state = (Math.imul(state, 1664525) + 1013904223) >>> 0
  return state / 0x100000000
}
const straight = length => ({ length, curvature: 0 })
const arc = (r, degrees) => ({ length: r * degrees * Math.PI / 180, curvature: 1 / r })
const runs = [
  straight(9), arc(12.5, 90), straight(5), straight(7),
  straight(26 + Math.round(random() * 2)), arc(10.5, 104), straight(29 + Math.round(random() * 2)),
]
let length = 0
const ends = runs.map(run => length += run.length)
const boundaries = [0, ends[0], ends[2], ends[3], ends[4], ends[5], length]
const sections = ['Rivet Gate', 'Wire Drop', 'Catch Deck', 'Tower Fork', 'Banked Reunion', 'Timing Straight']
  .map((name, i) => ({ name, start: boundaries[i], end: boundaries[i + 1] }))
const forkLength = runs[4].length
function branch(swell, entry, exit) {
  const checkpoints = []
  let previous = 0, meters = 0
  // Each checkpoint maps distance along this physical branch to a common percentage of the fork.
  for (let i = 0; i <= 96; i++) {
    const fraction = i / 96
    const u = Math.min(1, Math.max(0, (fraction - entry) / (exit - entry)))
    const offset = swell * Math.sin(Math.PI * u) ** 2
    if (i > 0) meters += Math.hypot(forkLength / 96, offset - previous)
    checkpoints.push(meters)
    previous = offset
  }
  return { swell, entry, exit, meters, checkpoints: checkpoints.map(n => Number((n / meters).toFixed(8))) }
}
const manifest = {
  seed, origin: { x: -18, z: -27, angle: 0 }, laneCount: 6, halfWidth: 4.02, startS: 1.05,
  finishS: length - 4.1, railGauge: .54, railRadius: .088, railEnd: ends[2],
  forkStart: ends[3], forkEnd: ends[4],
  branches: [branch(2.55 + random() * .2, .06, .85), branch(4.5 + random() * .2, 0, 1)],
  gateHeightStagger: .63, outerBankRise: .65,
  sections, runs,
}
await writeFile(new URL('../src/courses/wireworks-layout.json', import.meta.url), JSON.stringify(manifest, null, 2) + '\n')
