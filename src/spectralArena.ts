import * as THREE from 'three'
import type { CourseTrack } from './track'
import { SceneryBatch, canvasTexture, lifted, material, type Material } from './sceneryKit'

function pixelFloor() {
  const map = canvasTexture(256, 256, c => {
    c.fillStyle = '#10182c'
    c.fillRect(0, 0, 256, 256)
    c.fillStyle = '#1c2841'
    c.fillRect(0, 0, 256, 2)
    c.fillRect(0, 0, 2, 256)
    for (let x = 16; x < 256; x += 32) for (let y = 16; y < 256; y += 32) {
      c.fillStyle = '#1b3e82'
      c.fillRect(x - 2, y - 2, 4, 4)
      c.fillStyle = '#71a7f8'
      c.fillRect(x - 1, y - 1, 2, 2)
    }
    c.fillStyle = '#26758c'
    c.fillRect(120, 126, 16, 3)
    c.fillRect(126, 120, 3, 16)
  })
  map.wrapS = map.wrapT = THREE.RepeatWrapping
  return map
}

function galleryPanel() {
  const map = canvasTexture(512, 512, c => {
    const sky = c.createLinearGradient(0, 0, 0, 512)
    sky.addColorStop(0, '#0b1020')
    sky.addColorStop(.42, '#19203f')
    sky.addColorStop(1, '#080f21')
    c.fillStyle = sky
    c.fillRect(0, 0, 512, 512)
    // Rows of LEDs in the louvers resolve into a colored spectrum from a distance.
    for (let x = 0; x < 512; x += 8) {
      const band = (1 + Math.sin(x / 512 * 4 * Math.PI)) * .5
      const crest = 128 + 84 * band + 12 * Math.sin(x / 512 * 14 * Math.PI)
      for (let y = 94; y < 422; y += 8) {
        const alpha = Math.max(.09, .75 - Math.abs(crest - y) / 170)
        c.fillStyle = 'hsla(' + (193 + 67 * band) + ',92%,57%,' + alpha + ')'
        c.fillRect(x + 2, y, 3, 2)
      }
    }
    for (const y of [68, 70, 434, 450]) {
      c.fillStyle = '#35476e'
      c.fillRect(0, y, 512, 1)
    }
    for (const x of [24, 280]) {
      c.fillStyle = '#222e4c'
      c.fillRect(x, 38, 178, 5)
      c.fillStyle = '#669ddd'
      c.fillRect(x + 8, 39, 75, 2)
    }
  })
  map.wrapS = THREE.RepeatWrapping
  return map
}

export function spectralTurbine(track: CourseTrack) {
  const halo = track.sections[2], s = (halo.start + halo.end) / 2
  const p = track.sample(s), a = track.sample(s - 1), b = track.sample(s + 1)
  const turn = Math.atan2(a.tx * b.tz - a.tz * b.tx, a.tx * b.tx + a.tz * b.tz)
  const radius = 2 / turn
  return {
    hub: new THREE.Vector3(p.x + radius * p.rx, p.y - 3.5, p.z + radius * p.rz),
    fanRadius: Math.min(Math.abs(radius) - track.halfWidth - 1.8, 15),
  }
}

export function addSpectralArena(group: THREE.Group, track: CourseTrack, hull: Material, blue: Material, white: Material) {
  const bounds = new THREE.Box3()
  for (let s = 0; s < track.length + 2; s += 2) {
    for (const side of [-1, 1]) bounds.expandByPoint(lifted(track.sample(s, side * track.halfWidth), 0))
  }
  const floorY = bounds.min.y - 6
  const center = bounds.getCenter(new THREE.Vector3())
  const grid = pixelFloor()
  const size = Math.max(bounds.max.x - bounds.min.x, bounds.max.z - bounds.min.z) + 260
  grid.repeat.setScalar(size / 17)
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshBasicMaterial({ map: grid }))
  floor.rotation.x = -Math.PI / 2
  floor.position.set(center.x, floorY, center.z)
  group.add(floor)

  // A single-sided perimeter lets the overview camera see into the arena.
  const wallHeight = bounds.max.y - floorY + 28
  const panel = new THREE.MeshBasicMaterial({ map: galleryPanel() })
  for (let i = 0; i < 4; i++) {
    const alongX = i % 2 === 0
    const width = (alongX ? bounds.max.x - bounds.min.x : bounds.max.z - bounds.min.z) + 105
    const depth = (alongX ? bounds.max.z - bounds.min.z : bounds.max.x - bounds.min.x) / 2 + 52.5
    const shape = new THREE.PlaneGeometry(width, wallHeight)
    const uv = shape.getAttribute('uv')
    for (let j = 0; j < uv.count; j++) uv.setX(j, uv.getX(j) * width / 48)
    const wall = new THREE.Mesh(shape, panel), yaw = i * Math.PI / 2
    wall.position.set(center.x - depth * Math.sin(yaw), floorY + wallHeight / 2, center.z - depth * Math.cos(yaw))
    wall.rotation.y = yaw
    group.add(wall)
  }

  const batch = new SceneryBatch(.32, { indexed: true })
  // Each cantilever keeps the glowing spine visible through the open space below the track.
  for (let s = track.sections[0].end + 5; s < track.length; s += 22) {
    const p = track.sample(s)
    const beamY = Math.min(p.y, track.sample(s, -track.halfWidth).y, track.sample(s, track.halfWidth).y) - .85
    const point = (lateral: number, y: number) => new THREE.Vector3(p.x + lateral * p.rx, y, p.z + lateral * p.rz)
    const foot = point(0, floorY), neck = point(0, beamY - .7)
    const yaw = -Math.atan2(p.tz, p.tx)
    batch.box(hull, foot.clone().lerp(neck, .5), [1.12, neck.y - floorY, 1.44], yaw)
    batch.box(hull, point(0, floorY + .23), [2.90, .46, 2.90], yaw)
    batch.box(blue, point(0, floorY + .48), [2.19, .10, 2.19], yaw)
    for (const side of [-1, 1]) {
      const a = point(side * .71, floorY + .6), b = point(side * .71, neck.y)
      batch.rod(blue, a, b, .057, 5)
      batch.rod(hull, neck, point(side * (track.halfWidth - .40), beamY), .20, 6)
    }
  }

  // Fit the turbine hub inside the circular part of the Halo Carousel.
  const { hub, fanRadius } = spectralTurbine(track)
  const rotor = new THREE.Group()
  rotor.position.copy(hub)
  if (fanRadius > 2 && Number.isFinite(fanRadius)) {
    const point = (dy: number) => new THREE.Vector3(hub.x, hub.y + dy, hub.z)
    batch.rod(hull, new THREE.Vector3(hub.x, floorY, hub.z), point(-.75), fanRadius * .40, 16)
    batch.rod(blue, point(-.95), point(-.65), fanRadius * .44, 32)
    batch.rod(hull, point(-.65), point(-.2), fanRadius, 64)
    const iris = new SceneryBatch(.32, { indexed: true }), nickel = material('#8397b2', .28, .72)
    for (let i = 0; i < 12; i++) {
      const angle = i * Math.PI / 6
      const blade = (r: number, sweep: number, y: number) =>
        new THREE.Vector3(Math.cos(angle + sweep) * r * fanRadius, y, Math.sin(angle + sweep) * r * fanRadius)
      const corners = [blade(.19, -.13, 0), blade(.86, .38, 0), blade(.88, .53, .21), blade(.19, .22, .12)]
      const geo = new THREE.BufferGeometry()
      geo.setAttribute('position', new THREE.Float32BufferAttribute(corners.flatMap(v => v.toArray()), 3))
      geo.setAttribute('uv', new THREE.Float32BufferAttribute([0,0,1,0,1,1,0,1], 2))
      geo.setIndex([0, 2, 1, 0, 3, 2])
      iris.add(nickel, geo)
      iris.rod(i % 3 ? blue : white, corners[1], corners[0], .055, 5)
    }
    iris.rod(blue, new THREE.Vector3(), new THREE.Vector3(0, .26, 0), .22 * fanRadius, 32)
    iris.rod(hull, new THREE.Vector3(0, .27, 0), new THREE.Vector3(0, .43, 0), .18 * fanRadius, 32)
    iris.finish(rotor)
    group.add(rotor)
  }
  batch.finish(group)
  return (seconds: number) => { rotor.rotation.y = seconds * .49 }
}
