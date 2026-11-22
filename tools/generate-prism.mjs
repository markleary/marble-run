// Build the approved modular course from its race-independent layout seed.
import { writeFile } from 'node:fs/promises'

const seed = 0x5052534d
let state = seed
const random = () => {
  state = (Math.imul(1664525, state) + 1013904223) >>> 0
  return state / 0x100000000
}

const rollerPitch = 7.6 + random() * 0.6
const rolloutLength = 23 + Math.round(random() * 4)
const radius = (62 + Math.round(random() * 6)) / 10
const finalLength = 28 + Math.round(random() * 6)
const turnLength = Math.PI * radius
const runs = [
  { length: rolloutLength, curvature: 0 },
  { length: turnLength, curvature: 1 / radius },
  { length: rolloutLength, curvature: 0 },
  { length: turnLength, curvature: -1 / radius },
  { length: finalLength, curvature: 0 },
]
const ends = []
let length = 0
for (const run of runs) ends.push(length += run.length)
const boundaries = [0, 9, ends[0], ends[1], ends[2], ends[3] + 4, length]
const sections = ['Launch Ramp', 'Prism Rollers', 'Spectrum Hairpin', 'Return Straight', 'Timber Merge', 'Finish Straight']
  .map((name, i) => ({ name, start: boundaries[i], end: boundaries[i + 1] }))
const manifest = {
  seed,
  origin: { x: -12, z: -2 * radius, angle: 0 },
  laneCount: 6,
  halfWidth: 3.96,
  startS: 1.1,
  finishS: length - 4.25,
  runs, sections,
  curveRadius: radius,
  rollerPitch,
  launchTrims: [0.30, 0.07, -0.04, -0.03, -0.02, 0.19],
  banks: { first: -0.09, second: 0.27, launchTilt: 0.27, launchFlare: 0.80, launchGrooveDepth: 0.068, launchGrooveWidth: 0.26, launchShoulder: 0.175 },
}
await writeFile(new URL('../src/courses/prism-layout.json', import.meta.url), JSON.stringify(manifest, null, 2) + '\n')
