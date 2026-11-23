import { writeFile } from 'node:fs/promises'

const seed = 0x43525558
let state = seed
function random() {
  state = (Math.imul(1664525, state) + 1013904223) >>> 0
  return state / 0x100000000
}
const line = length => ({ length, curvature: 0 })
// Approximate a clothoid at each end of the 180° sweeps. Increasing the
// curvature in small steps lets a fast marble enter the bend progressively.
function turnaround(radius, side) {
  const transition = [1, 3, 5, 7, 9].map(n => ({ length: 5, curvature: side * n / (10 * radius) }))
  const middle = { length: Math.PI * radius - 25, curvature: side / radius }
  return [...transition, middle, ...transition.toReversed()]
}
const sections = [], runs = []
let length = 0
function section(name, ...pieces) {
  const start = length
  runs.push(...pieces)
  length += pieces.reduce((total, piece) => total + piece.length, 0)
  sections.push({ name, start, end: length })
}

// The blade gallery slips sideways and back before its straight checkpoint apron.
const slalomArc = 8.2, slalomRadius = 32
const slalom = [-1, 1, 1, -1].map(side => ({ length: slalomArc, curvature: side / slalomRadius }))
// Two separately banked quarter turns make a squared-off return. Their cross
// gallery is wide enough for a freestanding elbow island and two passing lines.
const hookRadius = 23, hookLink = 15
const leadIn = [1, 3, 5].map(n => ({ length: 4, curvature: n / (6 * hookRadius) }))
const quarterTurn = [...leadIn, { length: Math.PI * hookRadius / 2 - 12, curvature: 1 / hookRadius }, ...leadIn.toReversed()]
const quarterLength = quarterTurn.reduce((sum, piece) => sum + piece.length, 0)

section('Belay Gate', line(18))
section('Headwall Launch', line(109))
section('Chalk Velodrome', ...turnaround(23, 1))
section('Dyno Straight', line(138))
section('Arête Hairpin', ...turnaround(24, -1))
section('Blade Slalom', line(5), ...slalom, line(81 - 4 * slalomArc))
section('Highball Bend', ...turnaround(23.5, 1))
section('Slab Flight', line(139))
section('Compass Turn', ...turnaround(24.5, -1))
section('Volume Traverse', line(88))
section('Double-Apex Hook', ...quarterTurn, line(hookLink), ...quarterTurn)
section('Summit Runout', line(107))

const jumps = [
  [1, 'Headwall Gap', 52, 5.2, 2.05, 6.1, 4.4],
  [3, 'Dyno Gap', 44, 5.6, 2.26, 6.9, 4.7],
  [7, 'Slab Gap', 44, 5.5, 2.10, 7.2, 4.8],
  [11, 'Summit Gap', 42, 5.8, 2.39, 7.6, 5.1],
].map(([sectionIndex, name, offset, runup, rise, gap, drop]) => {
  const takeoff = sections[sectionIndex].start + offset
  const rampStart = takeoff - runup, landing = takeoff + gap
  return {
    sectionIndex, name, diveStart: rampStart - 30, rampStart, takeoff, landing, catchEnd: landing + 44,
    dive: 5.2 + .35 * random(), rise, drop,
  }
})

const layout = {
  seed, origin: { x: -73, z: -121, angle: 0 }, laneCount: 6, halfWidth: 4.35,
  startS: 1.1, finishS: length - 9, launchTrims: [.75, .61, .47, .34, .22, .12],
  slalom: { start: sections[5].start + 5, arc: slalomArc },
  hook: { linkStart: sections[10].start + quarterLength, linkEnd: sections[10].start + quarterLength + hookLink },
  jumps, sections, runs,
}
await writeFile(new URL('../src/courses/crux-layout.json', import.meta.url), JSON.stringify(layout, null, 2) + '\n')
