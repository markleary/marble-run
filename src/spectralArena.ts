import * as THREE from 'three'
import type { CourseTrack } from './track'
import { SceneryBatch, canvasTexture, lifted, type Material } from './sceneryKit'

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

export function addSpectralArena(group: THREE.Group, track: CourseTrack, hull: Material, blue: Material) {
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

  batch.finish(group)
}
