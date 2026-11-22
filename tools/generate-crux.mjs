import { writeFile } from 'node:fs/promises'

const seed = 0x43525558
let state = seed
const random = () => {
  state = (Math.imul(1664525, state) + 1013904223) >>> 0
  return state / 0x100000000
}
const line = length => ({ length, curvature: 0 })
const turn = (radius, degrees) => ({ length: radius * Math.abs(degrees) * Math.PI / 180, curvature: Math.sign(degrees) / radius })
const sections = [], runs = []
let length = 0
function section(name, ...pieces) {
  const start = length
  for (const piece of pieces) {
    runs.push(piece)
    length += piece.length
  }
  sections.push({ name, start, end: length })
}

// Six traverses fold a long competition route into the width of a bouldering hall.
section('Belay Gate', line(14))
section('Speed Wall', line(40))
section('Chalk Turn', turn(8.5, 180))
section('Volume Alley', line(53))
section('Arête Hairpin', turn(8.5, -180))
section('Ribbon Traverse', line(12), turn(13, 30), turn(13, -60), turn(13, 30), line(16))
section('Highball Bend', turn(8.25, 180))
section('Slab Switches', line(54))
section('Compass Turn', turn(8.25, -180))
section('Final Traverse', line(16), turn(12, -28), turn(12, 56), turn(12, -28), line(13))
section('Summit Hook', turn(7.75, 180))
section('Summit Runout', line(60))

// Each volume is an oblique four-sided pyramid, with its diamond footprint
// skewed across the racing line. The three pairs leave a different line open down the hall.
const volumes = [
  [6.5, -2.15, 7.3, 2.65, .84, .16], [11, .95, 8.6, 3.35, 1.04, -.16],
  [22, 2.08, 8.3, 2.83, .94, -.13], [26, -.95, 7.2, 3.12, .79, .17],
  [38, -2.21, 7.8, 2.76, .82, -.15], [42, 1.16, 9.4, 3.3, .97, .14],
].map(([offset, lateral, length, width, height, skew]) => ({
  s: sections[3].start + offset, lateral, length, width, height: height + .06 * random(), skew,
}))

const layout = {
  seed, origin: { x: -26, z: -41, angle: 0 },
  laneCount: 6, halfWidth: 4, startS: 1.1, finishS: length - 4.5,
  launchTrims: [.635, .549, .446, .372, .269, .177],
  startingCamber: .25,
  slabCants: [.16, -.19, .18, -.15],
  volumes, sections, runs,
}
await writeFile(new URL('../src/courses/crux-layout.json', import.meta.url), JSON.stringify(layout, null, 2) + '\n')
