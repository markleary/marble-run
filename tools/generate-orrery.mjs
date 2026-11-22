import { writeFile } from 'node:fs/promises'

const seed = 0x53544152
let state = seed
function random() {
  state = (Math.imul(state, 1664525) + 1013904223) >>> 0
  return state / 0x100000000
}
const line = length => ({ length, curvature: 0 })
const turn = (radius, degrees) => ({ length: radius * Math.abs(degrees) * Math.PI / 180, curvature: Math.sign(degrees) / radius })
const orbitRadius = 9.8 + random() * .35
const returnRadius = 7.8 + random() * .25
const runs = [
  line(14), turn(11, 46), turn(11, -46), line(8),
  turn(orbitRadius, 180), line(31), turn(returnRadius, 220),
  line(32), turn(11, -55), line(32),
]
let length = 0
const ends = runs.map(run => length += run.length)
const jumps = [
  { takeoff: ends[8] + 8.5, landing: ends[8] + 9.65, runUp: 3.5, rise: 1.02, dip: 1.18 },
  { takeoff: ends[8] + 20.5, landing: ends[8] + 21.85, runUp: 3.7, rise: 1.14, dip: 1.26 },
]
const bounds = [0, ends[0], ends[3], ends[4], ends[5], ends[6], ends[7], jumps[1].landing + 3, length]
const sections = ['Sidereal Launch', 'Transit S-Bend', 'Solar Orbit', 'Escapement Gallery', 'Retrograde Hairpin', 'Ecliptic Underpass', 'Comet Skips', 'Dawn Straight']
  .map((name, index) => ({ name, start: bounds[index], end: bounds[index + 1] }))

// Each pendulum has its own length, escapement rate and phase. Replaying a
// seeded heat therefore reproduces every encounter with a swinging bob.
const pendulums = [-1.05, 1.05, -.3].map((lateral, i) => ({
  s: ends[4] + 5 + i * 10.2, lateral, length: [3.6, 3.88, 3.72][i],
  angularSpeed: [1.15, 1.23, 1.08][i], amplitude: .405, phase: random() * 2 * Math.PI,
}))
const layout = {
  seed, origin: { x: -26, z: -19, angle: 0 },
  laneCount: 6, halfWidth: 4.05, startS: 1.1, finishS: length - 4.3,
  launchTrims: [1.80, 1.40, .85, .35, .08, 0],
  orbitRadius, returnRadius, pendulums, jumps, runs, sections,
}
await writeFile(new URL('../src/courses/orrery-layout.json', import.meta.url), JSON.stringify(layout, null, 2) + '\n')
