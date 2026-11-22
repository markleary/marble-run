import * as THREE from 'three'
import type { CourseTrack } from './track'
import { SceneryBatch, axisY, canvasTexture, material, type Material } from './sceneryKit'

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)
const tau = Math.PI * 2
const unit = v(1, 1, 1)

function arrayCells() {
  const map = canvasTexture(512, 256, ctx => {
    ctx.fillStyle = '#9d9bb3'; ctx.fillRect(0, 0, 512, 256)
    for (let y = 0; y < 4; y++) for (let x = 0; x < 8; x++) {
      const a = x * 64 + 2, b = y * 64 + 2
      ctx.fillStyle = ['#283757', '#26375d', '#36466c', '#38446a'][(x * 7 + y * 5) % 4]
      ctx.beginPath(); ctx.moveTo(a + 6, b); ctx.lineTo(a + 54, b); ctx.lineTo(a + 60, b + 6)
      ctx.lineTo(a + 60, b + 54); ctx.lineTo(a + 54, b + 60); ctx.lineTo(a + 6, b + 60)
      ctx.lineTo(a, b + 54); ctx.lineTo(a, b + 6); ctx.closePath(); ctx.fill()
      ctx.fillStyle = 'rgba(179,188,219,.43)'
      for (let j = 8; j < 56; j += 4) ctx.fillRect(a + 3, b + j, 54, .7)
      for (const j of [16, 41]) ctx.fillRect(a + j, b + 2, 1.3, 56)
    }
  })
  const panel = material('#eff4ff', .34, .44)
  panel.map = map
  panel.emissive.set('#7d87a5'); panel.emissiveMap = map; panel.emissiveIntensity = .27
  return panel
}

export function addKeplerStation(group: THREE.Group, track: CourseTrack, batch: SceneryBatch, hull: Material,
  frame: Material, gold: Material, lamp: Material) {
  const panel = arrayCells()
  const dark = material('#172a45', .53, .28)
  const foil = material('#c8954d', .42, .55)
  const point = (s: number, lateral: number, up: number) => {
    const p = track.sample(s)
    return v(p.x + p.rx * lateral, p.y + up, p.z + p.rz * lateral)
  }
  // Articulated photovoltaic blankets hang well below the three-quarter race cameras.
  // Gaps between the modules expose the gold booms and their diagonal stays.
  function solarWing(center: THREE.Vector3, yaw: number, lean: number, size: number) {
    const rotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(lean, yaw, 0, 'YXZ'))
    const at = (x: number, y: number, z: number) => v(x, y, z).multiplyScalar(size).applyQuaternion(rotation).add(center)
    const box = (mat: Material, x: number, y: number, z: number, dx: number, dy: number, dz: number) =>
      batch.add(mat, new THREE.BoxGeometry(dx * size, dy * size, dz * size),
        new THREE.Matrix4().compose(at(x, y, z), rotation, unit))
    batch.rod(gold, at(-5.5, -.11, 0), at(5.5, -.11, 0), size * .11)
    for (const side of [-1, 1]) {
      for (const x of [1.85, 4.18]) for (const z of [-1.03, 1.03]) {
        box(frame, side * x, 0, z, 2.20, .13, 1.94)
        box(panel, side * x, .078, z, 2.10, .025, 1.84)
      }
      batch.rod(frame, at(side * .9, -.65, 0), at(side * 4.8, -.09, 0), size * .07)
    }
  }
  const array = track.sections[1]
  for (let i = 0; i < 3; i++) {
    const s = array.start + 6 + i * 9.4
    const anchor = point(s, -track.halfWidth, -.54), center = point(s, -(track.halfWidth + 5.4), -1.16)
    batch.rod(frame, anchor, center, .19)
    batch.rod(gold, center, center.clone().addScaledVector(axisY, 1.13), .17)
    solarWing(center.clone().addScaledVector(axisY, 1.22), .14, .38, .85)
  }

  // The parabolic face and the feed horn share a moving mount inside Magnetosphere.
  const magnet = track.sections[2]
  const start = track.sample(magnet.start), end = track.sample(magnet.end)
  const pedestal = v((start.x + end.x) / 2, (start.y + end.y) / 2 - 2.0, (start.z + end.z) / 2)
  const tower = (up: number) => pedestal.clone().addScaledVector(axisY, up)
  batch.rod(foil, tower(-3.5), tower(-.1), 2.05, 12)
  for (const y of [-3.5, -2.9, -.65, -.2]) batch.rod(frame, tower(y), tower(y + .18), 2.16, 12)
  for (let i = 0; i < 12; i++) {
    const a = i * tau / 12
    const p = tower(-3.14).add(v(2.04 * Math.cos(a), 0, 2.04 * Math.sin(a)))
    batch.rod(hull, p, p.clone().addScaledVector(axisY, 2.61), .057)
  }
  batch.rod(gold, tower(-.1), tower(.75), .84)
  batch.rod(frame, tower(.75), point((magnet.start + magnet.end) / 2, track.halfWidth, -.98), .15)
  const azimuth = new THREE.Group()
  azimuth.position.copy(tower(.78))
  const dish = new THREE.Group(), dishBatch = new SceneryBatch()
  dish.rotation.z = -.48
  const profile = Array.from({ length: 15 }, (_, i) => {
    const r = i / 14 * 4.15
    return new THREE.Vector2(Math.max(.008, r), .076 * r * r)
  })
  const face = new THREE.LatheGeometry(profile, 64)
  dishBatch.add(hull, face)
  const dishPoint = (r: number, angle: number, up = 0) => v(r * Math.cos(angle), .076 * r * r + up, r * Math.sin(angle))
  for (let i = 0; i < 16; i++) {
    const angle = tau * i / 16
    for (let j = 0; j < 4; j++) {
      dishBatch.rod(frame, dishPoint(j + .15, angle, -.1), dishPoint(j + 1.15, angle, -.095), .045, 5)
      dishBatch.rod(gold, dishPoint(j + .15, angle, .02), dishPoint(j + 1.15, angle, .02), .012, 5)
    }
    const a = dishPoint(4.15, angle), b = dishPoint(4.15, angle + tau / 16)
    dishBatch.rod(foil, a, b, .072)
    if (i % 4 === 0) dishBatch.rod(dark, a, v(0, 3.66, 0), .07, 6)
  }
  dishBatch.rod(gold, v(0, 3.49, 0), v(0, 3.91, 0), .19)
  dishBatch.finish(dish)
  azimuth.add(dish)
  group.add(azimuth)

  // A pressure vessel, docking collars and heat radiator mark the aft side of the relay.
  const turn = track.sections[4]
  const p = point((turn.start + turn.end) / 2, -12.6, -3.8)
  const body = (x: number, y = 0, z = 0) => p.clone().add(v(x, y, z))
  batch.rod(hull, body(-4.7), body(4.7), 1.62, 32)
  for (const angle of [.25, .51, 1.02, 1.49, 1.72, 2.25, 2.61]) {
    const y = 1.49 * Math.sin(angle), z = 1.49 * Math.cos(angle)
    batch.rod(dark, body(-4.68, y, z), body(4.68, y, z), .15)
  }
  for (const x of [-4.6, -2.6, 0, 2.6, 4.5]) batch.rod(frame, body(x - .11), body(x + .11), 1.7, 32)
  for (const side of [-1, 1]) {
    batch.rod(foil, body(side * 4.72), body(side * 5.20), 1.44, 12)
    batch.rod(dark, body(side * 5.20), body(side * 5.32), 1.01, 16)
    const center = body(0, -.95, side * 5.25)
    batch.rod(foil, body(0, -.65, side * 1.42), center, .22)
    solarWing(center, -.13, -.22, .96)
  }
  for (const x of [-3.67, -1.4, 1.36, 3.66]) {
    batch.box(dark, body(x, .71, 1.46), [1.19, .58, .12])
    batch.box(lamp, body(x, .73, 1.55), [.89, .27, .068])
  }

  return (time: number) => { azimuth.rotation.y = .56 + time * .115 }
}
