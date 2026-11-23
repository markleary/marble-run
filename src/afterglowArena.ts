import * as THREE from 'three'
import type { CourseTrack } from './courseGeometry'
import { canvasTexture, material, SceneryBatch, type Material } from './sceneryKit'

const tau = Math.PI * 2

/** A panoramic city silhouette stays on the horizon in every broadcast shot. */
function cityPanorama() {
  const map = canvasTexture(2048, 512, c => {
    const sky = c.createLinearGradient(0, 0, 0, 512)
    sky.addColorStop(0, '#070719'); sky.addColorStop(.40, '#111030'); sky.addColorStop(.48, '#382052')
    sky.addColorStop(.54, '#73365e'); sky.addColorStop(.60, '#302048'); sky.addColorStop(1, '#0b0c24')
    c.fillStyle = sky; c.fillRect(0, 0, 2048, 512)
    let seed = 97831
    const random = () => (seed = (Math.imul(1664525, seed) + 1013904223) >>> 0) / 0x100000000
    for (let i = 0; i < 480; i++) {
      c.fillStyle = `rgba(220,207,255,${.17 + .50 * random()})`
      const x = random() * 2048, y = 48 + random() * 208, size = .5 + random()
      c.fillRect(x, y, size, size)
    }
    for (let tier = 0; tier < 2; tier++) {
      for (let x = 0; x < 2048;) {
        const w = 4 + Math.floor(random() * 14)
        const roof = 273 - 9 * tier - random() ** 1.7 * (tier ? 36 : 49)
        c.fillStyle = tier ? '#15132b' : '#362442'
        c.fillRect(x, roof, w + 1, 512 - roof)
        if (w > 11) {
          c.fillRect(x + 2, roof - 2, w - 4, 3)
          if (roof < 242) { c.fillRect(x + 4, roof - 8, 1.2, 6); c.fillStyle = '#ff697e'; c.fillRect(x + 4, roof - 9, 1.2, 1) }
        }
        for (let j = 2; j < w - 1; j += 3) for (let y = roof + 2; y < 288; y += 3.8) {
          if (random() < .32) {
            c.fillStyle = random() < .73 ? '#706386' : '#c99196'; c.fillRect(x + j, y, 1.1, 1.2)
          }
        }
        x += w
      }
    }
  })
  map.wrapS = THREE.RepeatWrapping
  const dome = new THREE.Mesh(new THREE.SphereGeometry(175, 64, 26), new THREE.MeshBasicMaterial({
    map, side: THREE.BackSide, depthTest: false, depthWrite: false, fog: false, toneMapped: false,
  }))
  dome.renderOrder = -100
  return dome
}

function dialFace() {
  return canvasTexture(1536, 1024, c => {
    c.fillStyle = '#101123'; c.fillRect(0, 0, 1536, 1024)
    for (let x = 0; x <= 1536; x += 32) for (let y = 0; y <= 1024; y += 32) {
      c.fillStyle = '#191b35'; c.fillRect(x, y, 31, 31)
      c.fillStyle = '#32334d'; c.fillRect(x + 2, y + 2, 1.6, 1.6)
    }
    const cx = 768, cy = 515
    for (const [radius, stroke, color] of [[448, 6, '#67427c'], [439, 2, '#9c5ab7'], [427, 1, '#4b456e'],
      [322, 4, '#377088'], [314, 1, '#34667b'], [300, 2, '#3a4964']] as const) {
      c.beginPath(); c.ellipse(cx, cy, radius * 1.52, radius, 0, 0, tau)
      c.strokeStyle = color; c.lineWidth = stroke; c.stroke()
    }
    for (let i = 0; i < 180; i++) {
      const a = i * tau / 180, major = i % 15 === 0, minor = i % 5 === 0
      const mark = major ? 24 : minor ? 12 : 5
      c.beginPath(); c.moveTo(cx + 427 * 1.52 * Math.cos(a), cy + 427 * Math.sin(a))
      c.lineTo(cx + (427 - mark) * 1.52 * Math.cos(a), cy + (427 - mark) * Math.sin(a))
      c.strokeStyle = major ? '#cb92ad' : '#5b416e'; c.lineWidth = major ? 3 : 1.7; c.stroke()
    }
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = 'bold 21px monospace'; c.fillStyle = '#937495'
    for (let i = 0; i < 12; i++) {
      const a = Math.PI + tau * i / 12, x = cx + 575 * Math.cos(a), y = cy + 381 * Math.sin(a)
      c.save(); c.translate(x, y); c.rotate(a + Math.PI * .5); c.fillText((88 + 1.8 * i).toFixed(1), 0, 0); c.restore()
    }
  })
}

export function addAfterglowArena(group: THREE.Group, batch: SceneryBatch, track: CourseTrack,
  floorY: number, bounds: THREE.Box3, shell: Material, pink: Material, cyan: Material) {
  const sky = cityPanorama()
  group.add(sky)
  const base = new THREE.Mesh(new THREE.PlaneGeometry(1800, 1800), new THREE.MeshBasicMaterial({ color: '#100e22' }))
  base.rotation.x = -Math.PI / 2; base.position.y = floorY - 1.55; group.add(base)
  const face = dialFace(), paint = material('#888198', .89, 0)
  paint.map = paint.emissiveMap = face; paint.emissive.set('#ffffff'); paint.emissiveIntensity = .34; paint.envMapIntensity = .12
  const center = bounds.getCenter(new THREE.Vector3()), size = bounds.getSize(new THREE.Vector3())
  const width = Math.max(size.x + 24, (size.z + 24) * 1.5)
  const table = new THREE.Mesh(new THREE.CircleGeometry(1, 128), paint)
  table.scale.set(width * .5, width / 3, 1); table.rotation.x = -Math.PI / 2
  table.position.set(center.x, floorY, center.z); table.receiveShadow = true; group.add(table)
  const plinth = new THREE.CylinderGeometry(1, .985, 1.45, 128, 1, true)
  plinth.scale(width / 2, 1, width / 3)
  batch.add(shell, plinth, new THREE.Matrix4().makeTranslation(center.x, floorY - .73, center.z))

  // Skip the foreground apron: low bands of buildings rise around the distant
  // sides of the dial, so a tracking camera sees the city below the horizon.
  const windows = canvasTexture(128, 192, c => {
    c.fillStyle = '#121426'; c.fillRect(0, 0, 128, 192)
    for (let j = 0; j < 16; j++) for (let i = 0; i < 10; i++) {
      const pick = (17 * i + 7 * j + i * j) % 13
      c.fillStyle = pick < 3 ? '#977fa7' : pick < 5 ? '#497681' : '#28283e'
      c.fillRect(4 + i * 12.4, 4 + j * 11.8, 5, 2.2)
    }
    c.fillStyle = '#544568'; c.fillRect(0, 0, 128, 3)
  })
  const facade = material('#bcb2cb', .78, .05)
  facade.map = facade.emissiveMap = windows; facade.emissive.set('#ffffff'); facade.emissiveIntensity = .28
  for (let i = 0; i < 60; i++) {
    const angle = i * tau / 60, depth = 1 + (i * 17 % 9) * .015
    const bx = center.x + Math.cos(angle) * (width * .59 + 15) * depth
    const bz = center.z + Math.sin(angle) * (width * .44 + 15) * depth
    const bh = 4 + (i * i * 7 + 3 * i + 11) % 13
    const bw = 2.6 + (i * 13 % 16) / 4, yaw = -.3 - angle
    const ground = base.position.y
    batch.box(facade, new THREE.Vector3(bx, ground + bh / 2, bz), [bw, bh, bw * .67], yaw)
    batch.box(shell, new THREE.Vector3(bx, ground + bh + .13, bz), [bw + .12, .26, bw * .67 + .12], yaw)
    if (bh > 12) batch.box(facade, new THREE.Vector3(bx, ground + bh + .85, bz), [bw * .60, 1.5, bw * .44], yaw)
  }

  // The mast occupies the open eye of the 270-degree spiral. Averaging the
  // endpoints of a half revolution gives its center for any baked turn radius.
  const spiral = track.sections[2], a = track.sample(spiral.start), b = track.sample(spiral.start + (spiral.end - spiral.start) * 2 / 3)
  const x = (a.x + b.x) / 2, z = (a.z + b.z) / 2
  const height = Math.min(18, Math.max(9, .92 * (b.y - floorY)))
  const at = (dx: number, dy: number, dz: number) => new THREE.Vector3(x + dx, floorY + dy, z + dz)
  const mastMetal = material('#55506e', .36, .48)
  for (const signX of [-1, 1]) for (const signZ of [-1, 1]) {
    const base = at(1.45 * signX, .14, 1.45 * signZ), shoulder = at(.45 * signX, height * .67, .45 * signZ)
    batch.box(shell, base, [.72, .28, .72]); batch.rod(mastMetal, base, shoulder, .12)
    batch.rod(mastMetal, shoulder, at(0, height, 0), .09)
    for (let i = 0; i < 4; i++) {
      const t = i / 4, t1 = (i + 1) / 4
      const start = base.clone().lerp(shoulder, t), end = base.clone().lerp(shoulder, t1)
      const dx = (1.45 - t1) * signX, dz = (1.45 - t1) * signZ
      batch.rod(mastMetal, start, at(-dx, end.y - floorY, dz), .053)
      batch.rod(mastMetal, start, at(dx, end.y - floorY, -dz), .053)
    }
  }
  // Two open pairs of radio waves make a readable silhouette against the city.
  batch.rod(pink, at(0, height - 1, 0), at(0, height + 1.3, 0), .095)
  for (const side of [-1, 1]) for (const r of [.9, 1.48]) {
    const rotation = new THREE.Euler(0, -.32, (side < 0 ? Math.PI : 0) - Math.PI / 3)
    batch.add(r < 1 ? pink : cyan, new THREE.TorusGeometry(r, .075, 8, 28, Math.PI * 2 / 3),
      new THREE.Matrix4().makeRotationFromEuler(rotation).setPosition(at(0, height + .48, 0)))
  }
  return (camera: THREE.Camera) => { sky.position.copy(camera.position) }
}
