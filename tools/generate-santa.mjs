import { writeFile } from 'node:fs/promises'

const seed = 0x594f554c
let state = seed
function random() {
  state = (Math.imul(1664525, state) + 1013904223) >>> 0
  return state / 0x100000000
}
const straight = length => ({ length, curvature: 0 })
const arc = (radius, degrees) => ({
  length: radius * Math.abs(degrees) * Math.PI / 180, curvature: Math.sign(degrees) / radius,
})
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

section('Sleigh Shed', straight(17))
section('Peppermint Pinwheels', straight(35))
section('Tannenbaum Turn', arc(15, 180))
section('Pop-Up Parcel Works', straight(50))
section('Ribbon Curl', arc(13, -180))
section('Sleighbell Run', straight(32))
section('Starlight Esses', arc(17, -34), arc(17, 34))
section('North Pole Post', straight(44))

const layout = {
  seed, origin: { x: -28, z: -28, angle: 0 }, halfWidth: 4.2, laneCount: 6,
  startS: 1.1, finishS: length - 5.2, runs, sections,
  bellPitch: 6.8 + random() * .4,
  launchTrims: [.34, .22, .12, .04, -.04, -.12],
}
await writeFile(new URL('../src/courses/santa-layout.json', import.meta.url), JSON.stringify(layout, null, 2) + '\n')
