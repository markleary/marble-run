import { writeFile } from 'node:fs/promises'

const seed = 0x464d3937
let state = seed
function random() {
  state = (Math.imul(1664525, state) + 1013904223) >>> 0
  return state / 0x100000000
}
const line = length => ({ length, curvature: 0 })
const arc = (radius, degrees) => ({ length: radius * Math.abs(degrees) * Math.PI / 180, curvature: Math.sign(degrees) / radius })
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

section('Dial-In Grid', line(19))
section('Crossfader Alley', line(36))
section('Carrier Spiral', arc(13.8, 270))
section('Mono Bridge', line(43))
section('Sideband Turn', arc(13.3, -180))
section('Stereo Return', line(47), arc(17, -180))
section('Sign-Off Sprint', line(43))

const faders = [0, 1, 2].map(i => ({
  s: sections[1].start + 6 + i * 10, radius: .55, height: .76,
  center: [-.5, .55, -.45][i], travel: 1.48,
  period: [4.2, 5.6, 4.8][i], phase: random() * Math.PI * 2,
}))
const layout = {
  seed, origin: { x: -28, z: -14, angle: 0 }, laneCount: 6, halfWidth: 4.2,
  startS: 1.1, finishS: length - 6, sections, runs, faders,
  bridgeScale: .37, launchTrims: [-.12, .12, .36, .38, .19, -.20],
}
await writeFile(new URL('../src/courses/afterglow-layout.json', import.meta.url), JSON.stringify(layout, null, 2) + '\n')
