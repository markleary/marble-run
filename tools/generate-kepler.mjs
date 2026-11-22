import { writeFile } from 'node:fs/promises'

const seed = 0x4b504c52
let state = seed
function random() {
  state = (Math.imul(state, 1664525) + 1013904223) >>> 0
  return state / 0x100000000
}
const straight = length => ({ length, curvature: 0 })
const arc = (radius, degrees) => ({ length: radius * Math.abs(degrees) * Math.PI / 180, curvature: Math.sign(degrees) / radius })

// A station in three passes. The upper two passes frame the solar array.
// The third leaves the station on a straight transfer to a lower glass receiver.
const runs = [
  straight(17), arc(13, 43), arc(13, -43), straight(14),
  arc(12.8 + random() * .4, 180), straight(43), arc(12.3 + random() * .4, -180),
  straight(66), arc(16, 55), arc(16, -55), straight(25),
]
let length = 0
const ends = runs.map(run => length += run.length)
const jump = { diveStart: ends[6] + 6, rampStart: ends[6] + 22, takeoff: ends[6] + 27, landing: ends[6] + 35 }
const bounds = [0, ends[0], ends[3], ends[4], ends[5], jump.diveStart, jump.rampStart, jump.landing, ends[7], ends[9], length]
const names = ['Docking Cradle', 'Solar Array Esses', 'Magnetosphere', 'Telemetry Straight', 'Far Side Turn',
  'Gravity Dive', 'Vacuum Transfer', 'Aurora Catch', 'Orbital Return', 'Beacon Approach']
const sections = names.map((name, i) => ({ name, start: bounds[i], end: bounds[i + 1] }))
const layout = {
  seed, origin: { x: -37, z: -32, angle: 0 }, laneCount: 6, halfWidth: 4.15,
  startS: 1.1, finishS: length - 4.8, sections, runs, jump,
  launchTrims: [1.85, 1.4, 1.0, .48, .24, .06],
}
await writeFile(new URL('../src/courses/kepler-layout.json', import.meta.url), JSON.stringify(layout, null, 2) + '\n')
