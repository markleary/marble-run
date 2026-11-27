import { writeFile } from 'node:fs/promises'

const seed = 0x53504543
let state = seed
function random() {
  state = (Math.imul(1664525, state) + 1013904223) >>> 0
  return state / 0x100000000
}
const line = length => ({ length, curvature: 0 })
const arc = (radius, degrees) => ({ length: Math.abs(degrees) * Math.PI / 180 * radius, curvature: Math.sign(degrees) / radius })
const sections = [], runs = [], bends = []
let length = 0
function section(name, ...pieces) {
  const start = length
  for (const piece of pieces) {
    runs.push(piece)
    const end = length + piece.length
    if (piece.curvature) bends.push({ start: length, end, side: Math.sign(piece.curvature) })
    length = end
  }
  sections.push({ name, start, end: length })
}

// Distance down the shaft and around the cylindrical scoop follows its actual
// centerline. Beyond the scoop it follows the shared horizontal course sampler.
const drop = 22, radius = 14, exitGrade = .10
const end = drop + Math.atan2(1, exitGrade) * radius
section('Drop Shaft', line(end))
section('Afterimage Straight', line(88))
// The two banks feed opposite openings in a pitched circular fan housing.
// Their cant must finish blending before the blades meet the running surface.
const lead = arc(24, 135), fanRadius = 13, apron = 11
const centerS = length + lead.length + apron + fanRadius
const fan = { centerS, startS: centerS - fanRadius, endS: centerS + fanRadius,
  radius: fanRadius, offset: 4.1, grade: .15, hubRadius: 4.10, hubTopRadius: 4.03, hubHeight: 2.35,
  bladeRadius: 12.82, bladeHeight: 1.95, bladeCount: 8, angularSpeed: -.54, intakeLength: 12, runoutLength: 21, intakeSpeed: 7.6, runoutSpeed: 10 }
section('Halo Carousel', lead, line(2 * (apron + fanRadius)), arc(24, 135))
section('Induction Gallery', line(105))
section('Prism Switchbacks', arc(24, 100), line(28), arc(19, -100), line(22), arc(23, 90))
section('Chromatic Viaduct', line(94))
section('Flywheel Bend', arc(25, -180))
section('Polarity Inverter', line(88))
section('Diffraction Esses', arc(22, 65), line(18), arc(24, -130), line(18), arc(22, 65))
section('Terminal Sprint', line(122))

const fields = [3, 7].map((index, i) => ({
  start: sections[index].start + 8, end: sections[index].end - 6,
  pitch: i ? 20 : 27, phase: random() * 2 * Math.PI,
}))
const layout = {
  seed, origin: { x: -70, z: 55, angle: 0 }, laneCount: 6, halfWidth: 4.4,
  startS: 1.2, finishS: length - 12, launch: { drop, radius, end, exitGrade }, fan, sections, runs, bends, fields,
}
await writeFile(new URL('../src/courses/spectral-layout.json', import.meta.url), JSON.stringify(layout, null, 2) + '\n')
