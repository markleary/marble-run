import { writeFile } from 'node:fs/promises'

// The glasshouse has three parallel galleries joined by turns around its water gardens.
const seed = 0x54494445
let state = seed
function random() {
  state = (Math.imul(1664525, state) + 1013904223) >>> 0
  return state / 0x100000000
}
const straight = length => ({ length, curvature: 0 })
const arc = (radius, degrees) => ({ length: radius * Math.abs(degrees) * Math.PI / 180, curvature: Math.sign(degrees) / radius })
const runs = [
  straight(14), arc(11, 36), arc(11, -36), straight(9), arc(9.5, 180),
  straight(37), arc(9.25, -180), straight(21), arc(11, -38), arc(11, 38), straight(19),
]
let length = 0
const ends = runs.map(run => length += run.length)
const boundaries = [0, ends[0], ends[3], ends[4], ends[5], ends[6], ends[7], ends[9], length]
const names = ['Palm Court Gate', 'Propagation Esses', 'Lily Basin', 'Standing Wave Gallery',
  'Fernbank Turn', 'Twin Frond Sluice', 'Mist Garden', 'Estuary Landing']
const sections = names.map((name, i) => ({ name, start: boundaries[i], end: boundaries[i + 1] }))
const layout = {
  seed, origin: { x: -25, z: -21, angle: 0 }, laneCount: 6, halfWidth: 4.1,
  startS: 1.1, finishS: length - 4.4, sections, runs,
  waveTravel: 1.82 + random() * .2, waveCycles: 1.38 + random() * .1,
  launchTrims: [1.1, .85, .64, .48, .28, .10],
}
await writeFile(new URL('../src/courses/tideglass-layout.json', import.meta.url), JSON.stringify(layout, null, 2) + '\n')
