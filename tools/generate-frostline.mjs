// Bake the village course and peg placements once; starting grids use a separate race seed.
import { writeFile } from 'node:fs/promises'

const seed = 0x46524f53
let state = seed
function random() {
  state = (Math.imul(1664525, state) + 1013904223) >>> 0
  return state / 0x100000000
}
const straight = length => ({ length, curvature: 0 })
const arc = (radius, degrees) => ({ length: radius * Math.abs(degrees) * Math.PI / 180, curvature: Math.sign(degrees) / radius })
const runs = [
  straight(11), arc(8, 55), arc(9, -95), straight(10 + Math.round(random() * 2)),
  arc(8, 120), straight(18), arc(11, 100), straight(20),
]
let length = 0
const ends = runs.map(run => length += run.length)
const boundaries = [0, ends[0], ends[2], ends[4], ends[5], ends[6], length]
const names = ['Village Gate', 'Glacier Esses', 'Timber Rollers', 'Snowcap Slalom', 'Skating Turn', 'Finish Bridge']
const sections = names.map((name, i) => ({ name, start: boundaries[i], end: boundaries[i + 1] }))
// Rows alternate between three and two posts. Each opening is wider than two marbles.
const deflectors = []
for (const [row, offsets] of [[-2.16, 0, 2.16], [-1.25, 1.15], [-2.15, 0.02, 2.17], [-1.2, 1.3]].entries()) {
  for (const lateral of offsets) {
    deflectors.push({
      s: ends[4] + 2.15 + row * 4.5 + (random() - 0.5) * 0.65,
      lateral: lateral + (random() - 0.5) * 0.07,
      radius: 0.22 + random() * 0.025, height: 0.91,
    })
  }
}
const manifest = {
  seed, origin: { x: -24, z: -16, angle: 0 },
  laneCount: 6, halfWidth: 4.05, startS: 1.1, finishS: length - 4.25,
  launchTrims: [1.33, 1.06, 0.67, 0.28, 0.18, 0.11],
  rollerPitch: 5.4 + 0.7 * random(), runs, sections, deflectors,
}
await writeFile(new URL('../src/courses/frostline-layout.json', import.meta.url), JSON.stringify(manifest, null, 2) + '\n')
