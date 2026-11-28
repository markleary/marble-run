import * as THREE from 'three'
import type { CourseTrack } from './track'
import type { ChristmasPaint } from './santaVillage'
import { christmasStar } from './santaVillage'
import { canvasTexture, material, SceneryBatch, type Material } from './sceneryKit'

const pt = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)
const lift = (p: THREE.Vector3, y: number) => pt(p.x, p.y + y, p.z)

function bulb(batch: SceneryBatch, m: Material, at: THREE.Vector3, radius: number, height = radius) {
  const shape = new THREE.SphereGeometry(1, 9, 6)
  shape.scale(radius, height, radius)
  shape.translate(at.x, at.y, at.z)
  batch.add(m, shape)
}
function carolBell(batch: SceneryBatch, p: ChristmasPaint, at: THREE.Vector3, size: number, tilt: number) {
  const lathe = [
    [0.04, 0.9],
    [0.16, 0.87],
    [0.24, 0.77],
    [0.29, 0.6],
    [0.3, 0.39],
    [0.35, 0.23],
    [0.46, 0.1],
    [0.49, 0.07],
    [0.49, 0.02],
    [0.45, 0],
    [0.36, 0.07],
    [0.27, 0.17],
  ].map(([r, y]) => new THREE.Vector2(r * size, y * size))
  const body = new THREE.LatheGeometry(lathe, 20)
  body.rotateZ(tilt)
  body.translate(at.x, at.y, at.z)
  batch.add(p.brass, body)
  const lip = new THREE.TorusGeometry(0.469 * size, 0.025 * size, 6, 20)
  lip.rotateX(Math.PI / 2)
  lip.rotateZ(tilt)
  lip.translate(at.x, at.y + 0.03 * size, at.z)
  batch.add(p.gold, lip)
  bulb(batch, p.brass, lift(at, -0.077 * size), 0.13 * size)
}
function lightCable(
  batch: SceneryBatch,
  p: ChristmasPaint,
  a: THREE.Vector3,
  b: THREE.Vector3,
  sag: number,
  glows: THREE.Vector3[],
) {
  const point = (t: number) => {
    const q = a.clone().lerp(b, t)
    q.y -= sag * 4 * t * (1 - t)
    return q
  }
  const count = Math.max(5, Math.ceil(a.distanceTo(b) / 0.94))
  for (let i = 0; i < count; i++) {
    const q = point((i + 0.5) / count)
    batch.rod(p.spruce, point(i / count), point((i + 1) / count), 0.044, 5)
    batch.rod(p.dark, q, lift(q, -0.09), 0.025, 5)
    const bulbAt = lift(q, -0.17)
    bulb(batch, i % 4 === 1 ? p.scarletLight : i % 4 === 3 ? p.mintLight : p.lantern, bulbAt, 0.099, 0.16)
    if (i % 2 === 0) glows.push(bulbAt)
  }
}
function bow(batch: SceneryBatch, p: ChristmasPaint, at: THREE.Vector3, size: number, yaw: number) {
  for (const side of [-1, 1]) {
    const loop = new THREE.TorusGeometry(size * 0.36, size * 0.107, 6, 12)
    loop.scale(1, 0.65, 1)
    loop.rotateZ(side * 0.38)
    loop.translate(side * size * 0.31, size * 0.14, 0)
    loop.rotateY(yaw)
    loop.translate(at.x, at.y, at.z)
    batch.add(p.red, loop)
    const tail = new THREE.BoxGeometry(size * 0.25, size * 0.66, size * 0.09)
    tail.rotateZ(side * -0.39)
    tail.translate(side * size * 0.23, -size * 0.25, 0)
    tail.rotateY(yaw)
    tail.translate(at.x, at.y, at.z)
    batch.add(p.red, tail)
  }
  bulb(batch, p.berry, at, size * 0.19)
}
function postEmblem() {
  const face = canvasTexture(512, 320, (c) => {
    c.fillStyle = '#862a36'
    c.fillRect(0, 0, 512, 320)
    for (const [d, w] of [
      [8, 5],
      [20, 1.7],
    ]) {
      c.lineWidth = w
      c.strokeStyle = '#e0b576'
      c.strokeRect(d, d, 512 - d * 2, 320 - d * 2)
    }
    c.fillStyle = '#ffecca'
    c.textAlign = 'center'
    c.font = 'bold 23px Georgia,serif'
    c.fillText('N O R T H   P O L E', 256, 68)
    c.font = 'italic bold 82px Georgia,serif'
    c.fillText('Air Mail', 256, 157)
    c.lineWidth = 3
    c.strokeStyle = '#efca8c'
    c.strokeRect(206, 192, 100, 57)
    c.beginPath()
    c.moveTo(206, 192)
    c.lineTo(256, 226)
    c.lineTo(306, 192)
    c.stroke()
    for (const sign of [-1, 1])
      for (let i = 0; i < 3; i++) {
        c.beginPath()
        c.moveTo(256 + sign * 61, 199 + i * 16)
        c.quadraticCurveTo(256 + sign * 104, 194 + i * 16, 256 + sign * (131 - i * 13), 183 + i * 16)
        c.stroke()
      }
    c.fillStyle = '#efca8c'
    c.font = 'bold 17px Georgia,serif'
    c.fillText('LETTERS  •  PARCELS', 256, 292)
  })
  const enamel = material('#fff2d8', 0.46)
  enamel.map = enamel.emissiveMap = face
  enamel.emissive.set('#ffffff')
  enamel.emissiveIntensity = 0.32
  return enamel
}

export function decorateSantaPromenade(
  batch: SceneryBatch,
  p: ChristmasPaint,
  track: CourseTrack,
  ground: (x: number, z: number) => number,
  group: THREE.Group,
) {
  const glows: THREE.Vector3[] = []
  const sidePost = (s: number, side: number, offset: number, h: number) => {
    const edge = track.sample(s, side * track.halfWidth)
    return pt(edge.x + side * offset * edge.rx, edge.y + h, edge.z + side * offset * edge.rz)
  }
  // Village shop lights trace the two edges of the pedestrian street beyond the traps.
  for (const z of [-16.3, -9.4]) {
    let last: THREE.Vector3 | undefined
    for (let x = -31; x <= 15; x += 8.6) {
      const foot = pt(x, ground(x, z), z),
        head = lift(foot, 4.3)
      batch.rod(p.dark, lift(foot, -0.29), head, 0.097, 8)
      batch.rod(p.brass, lift(foot, 2.95), lift(foot, 3.05), 0.116, 8)
      bulb(batch, p.lantern, head, 0.19, 0.25)
      glows.push(head)
      if (last) lightCable(batch, p, last, head, 0.73, glows)
      last = head
    }
  }

  // A freestanding carillon borders the icy straight. Pairs of gilded bells hang from
  // timber brackets and the string of lamps carries on through the Starlight Esses.
  const first = track.sections[5].start + 2.7,
    end = track.sections[7].start + 7
  let last: THREE.Vector3 | undefined
  for (let s = first, i = 0; s < end; s += 7.8, i++) {
    const side = -1,
      q = track.sample(s),
      root = sidePost(s, side, 2.7, 0)
    const foot = pt(root.x, ground(root.x, root.z) - 0.2, root.z),
      top = lift(root, 3.0 + 0.21 * Math.sin(i))
    const arm = sidePost(s, side, 1.2, top.y - root.y - 0.1)
    batch.rod(p.pine, foot, top, 0.16, 10)
    batch.rod(p.brass, lift(foot, 0.3), lift(foot, 0.58), 0.24, 10)
    batch.rod(p.brass, lift(top, -0.36), lift(top, -0.18), 0.2, 10)
    batch.rod(p.pine, lift(top, -0.16), arm, 0.11, 8)
    batch.rod(p.brass, lift(top, -1.03), arm, 0.067, 8)
    if (i < 4) {
      const bell = lift(arm, -1.27)
      const b1 = bell.clone().add(pt(q.tx * 0.28, 0, q.tz * 0.28)),
        b2 = bell.clone().add(pt(-q.tx * 0.31, 0.13, -q.tz * 0.31))
      carolBell(batch, p, b1, 1.04, 0.17)
      carolBell(batch, p, b2, 0.83, -0.23)
      bow(batch, p, lift(bell, 1.01), 0.8, -Math.atan2(q.tz, q.tx))
    } else {
      batch.rod(p.brass, arm, lift(arm, -0.38), 0.035, 6)
      christmasStar(batch, p, lift(arm, -0.85), 0.59, -Math.atan2(q.tz, q.tx))
    }
    const cap = lift(top, 0.19)
    bulb(batch, p.lantern, cap, 0.165, 0.21)
    glows.push(cap)
    if (last) lightCable(batch, p, last, top, 0.7, glows)
    last = top
  }

  // Double-sided sorting-office sign with two pigeonholes and bundled envelopes in the mail bins.
  const s = track.finishS - 9,
    q = track.sample(s),
    wall = sidePost(s, 1, 3.2, 0.78),
    yaw = -Math.atan2(q.tz, q.tx)
  const origin = pt(wall.x, ground(wall.x, wall.z), wall.z)
  const local = (x: number, y: number, z: number) =>
    pt(origin.x + q.tx * x + q.rx * z, origin.y + y, origin.z + q.tz * x + q.rz * z)
  const raise = wall.y - origin.y
  for (const x of [-2.16, 2.16]) {
    batch.rod(p.pine, local(x, -0.25, 0), local(x, raise + 2.24, 0), 0.17, 10)
    bulb(batch, p.gold, local(x, raise + 2.33, 0), 0.21)
  }
  const center = local(0, raise + 0.74, 0)
  batch.box(p.brass, center, [4.55, 2.73, 0.25], yaw)
  const sign = postEmblem()
  for (const side of [-1, 1]) {
    const g = new THREE.PlaneGeometry(4.35, 2.55)
    g.rotateY(yaw + (side < 0 ? Math.PI : 0))
    const at = local(0, raise + 0.74, side * 0.132)
    g.translate(at.x, at.y, at.z)
    batch.add(sign, g)
  }
  for (let i = 0; i < 2; i++) {
    const x = 3.48 + 1.46 * i
    batch.box(p.berry, local(x, 0.55, 0.06), [1.24, 1.34, 1.2], yaw)
    batch.box(p.brass, local(x, 1.22, 0.06), [1.33, 0.14, 1.32], yaw)
    batch.box(p.dark, local(x, 1.28, 0.06), [1.12, 0.065, 1.09], yaw)
    for (let j = 0; j < 3; j++) {
      const g = new THREE.BoxGeometry(0.82, 0.6, 0.055)
      g.rotateX(-0.26 + 0.16 * j)
      g.rotateZ(0.13 * Math.sin(i + j))
      g.rotateY(yaw)
      const card = local(x + 0.06 * Math.sin(j), 1.48, 0.3 - 0.28 * j)
      g.translate(card.x, card.y, card.z)
      batch.add(p.cream, g)
    }
  }

  // One additive point batch supplies a soft halo for all little bulbs, including on mobile.
  const halo = canvasTexture(32, 32, (c) => {
    const falloff = c.createRadialGradient(16, 16, 0, 16, 16, 16)
    falloff.addColorStop(0, 'rgba(255,239,181,.8)')
    falloff.addColorStop(0.24, 'rgba(255,207,119,.33)')
    falloff.addColorStop(1, 'rgba(255,191,91,0)')
    c.fillStyle = falloff
    c.fillRect(0, 0, 32, 32)
  })
  const geometry = new THREE.BufferGeometry().setFromPoints(glows)
  const lights = new THREE.Points(
    geometry,
    new THREE.PointsMaterial({
      map: halo,
      size: 1.25,
      opacity: 0.77,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  )
  group.add(lights)
}
