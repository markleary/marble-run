// Bake the drum, tangent exits and paired switchbacks independently of the race grid.
import { writeFile } from 'node:fs/promises'

const seed = 0x574f4f44
let state = seed
function random() {
  state = (Math.imul(state, 1664525) + 1013904223) >>> 0
  return state / 0x100000000
}
const straight = length => ({ length, curvature: 0 })
const arc = (radius, degrees) => ({ length: Math.abs(degrees) * Math.PI / 180 * radius, curvature: Math.sign(degrees) / radius })
const drumRadius = 7.8 + random() * .4
const turnDrop = 5.35 + random() * .25
const runs = [
  straight(12), ...Array.from({ length: 5 }, () => arc(drumRadius, 90)),
  straight(5 + Math.round(random() * 2)), arc(7.8, -128),
  straight(5 + Math.round(random() * 2)), arc(6.7, 96), straight(17),
]
let length = 0
const ends = runs.map(run => length += run.length)
const bounds = [0, ends[0], ends[3], ends[5], ends[9], ends[10] - 8, length]
const names = ["Joiner's Gate", 'High Spiral', 'Lower Spiral', 'Trestle Switchbacks', 'Reeding Run', 'Felt Finish']
const sections = names.map((name, i) => ({ name, start: bounds[i], end: bounds[i + 1] }))
const layout = {
  seed, origin: { x: -22, z: -12, angle: 0 }, laneCount: 6, halfWidth: 3.69, startS: 1.1, finishS: length - 3.2,
  drumRadius, turnDrop, launchTrims: [2.5, 2.1, 1.5, 1.0, .65, 0], runs, sections,
}
await writeFile(new URL('../src/courses/timber-layout.json', import.meta.url), JSON.stringify(layout, null, 2) + '\n')
