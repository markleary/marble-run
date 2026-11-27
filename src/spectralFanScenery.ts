import * as THREE from 'three'
import { spectralFan, spectralFanAngle, spectralFanBlade, spectralFanFrame, spectralFanHubBaseY } from './courses/spectralFan'
import { SceneryBatch, canvasTexture, material, type Material } from './sceneryKit'
import type { CourseTrack, TrackSample } from './courseGeometry'

/** Brushed cap with six enamel inlays and recessed vents around its shoulder. */
function hubCap() {
  const map = canvasTexture(512, 512, c => {
    c.translate(256, 256)
    const finish = c.createLinearGradient(-170, -220, 185, 215)
    finish.addColorStop(0, '#f1f5fc'); finish.addColorStop(.52, '#b2c3d8'); finish.addColorStop(1, '#8195af')
    c.fillStyle = finish; c.fillRect(-256, -256, 512, 512)
    const ring = (r: number, width: number, color: string, from = 0, to = 2 * Math.PI) => {
      c.beginPath(); c.arc(0, 0, r, from, to); c.lineWidth = width; c.strokeStyle = color; c.stroke()
    }
    ring(249, 8, '#647890')
    ring(240, 2, '#e4eff9')
    c.lineCap = 'round'
    const enamel = ['#f5699c', '#ffb23f', '#eedd56', '#49de9d', '#48d6fb', '#a991ff']
    for (let i = 0; i < 12; i++) {
      const angle = i * Math.PI / 6
      ring(202, 13, '#162438', angle + .07, angle + .42)
      ring(202, 3, '#70839a', angle + .09, angle + .39)
      if (i % 2 === 0) ring(169, 8, enamel[i / 2], angle + .15, angle + .56)
      if (i % 3 === 0) {
        const x = 222 * Math.cos(angle), y = 222 * Math.sin(angle)
        c.beginPath(); c.arc(x, y, 5.5, 0, 2 * Math.PI); c.fillStyle = '#72849b'; c.fill()
        c.fillStyle = '#334358'; c.fillRect(x - 3.5, y - 1, 7, 2)
      }
    }
    ring(137, 1.5, '#a0afc0')
    ring(133, 1, '#d4dfe9')
  })
  const metal = material('#ffffff', .34, .52)
  metal.map = map
  return metal
}

/** Circular machining marks in world space stay concentric as the lane opens out. */
function fanBed(group: THREE.Group, track: CourseTrack, center: TrackSample) {
  const { startS, endS, radius } = spectralFan
  const map = canvasTexture(512, 512, c => {
    c.translate(256, 256)
    const lacquer = c.createRadialGradient(0, 0, 20, 0, 0, 258)
    lacquer.addColorStop(0, '#333d52'); lacquer.addColorStop(.83, '#1d2439'); lacquer.addColorStop(1, '#151d31')
    c.fillStyle = lacquer; c.fillRect(-256, -256, 512, 512)
    for (const r of [64, 66, 128, 179, 235, 238, 251]) {
      c.beginPath(); c.arc(0, 0, r, 0, 2 * Math.PI)
      c.lineWidth = r === 238 ? 2 : 1
      c.strokeStyle = r === 238 ? '#42516c' : '#344057'; c.stroke()
    }
    // Fixed index marks make the distance traveled by each pocket readable.
    for (let i = 0; i < 72; i++) {
      c.save(); c.rotate(i * Math.PI / 36)
      c.fillStyle = i % 6 ? '#435370' : '#88a7cb'
      const length = i % 6 ? 4 : 9
      c.fillRect(239, -1, length, 2); c.restore()
    }
  })
  const bed = material('#a6b3c7', .65, .13)
  bed.envMapIntensity = .22
  bed.map = map
  const plate = new SceneryBatch(.23, { indexed: true })
  plate.surface(bed, startS, endS, (s, t) => track.sample(s, (2 * t - 1) * track.halfWidth), 2 * radius, 24)
  const table = new THREE.Group()
  plate.finish(table)
  for (const mesh of table.children as THREE.Mesh[]) {
    const position = mesh.geometry.getAttribute('position'), uv = mesh.geometry.getAttribute('uv')
    for (let i = 0; i < position.count; i++) {
      uv.setXY(i, .5 + (position.getX(i) - center.x) / (2 * radius), .5 + (position.getZ(i) - center.z) / (2 * radius))
    }
  }
  group.add(table)
}

function feedBelt(group: THREE.Group, track: CourseTrack, start: number, end: number, speed: number) {
  const map = canvasTexture(256, 256, c => {
    c.fillStyle = '#253249'; c.fillRect(0, 0, 256, 256)
    for (let x = 0; x < 256; x += 32) {
      c.fillStyle = '#152035'; c.fillRect(x, 0, 2, 256)
      c.fillStyle = '#34445c'; c.fillRect(x + 2, 0, 1, 256)
    }
    for (const y of [28, 228]) {
      c.beginPath()
      c.moveTo(91, y - 7); c.lineTo(110, y - 7); c.lineTo(128, y)
      c.lineTo(110, y + 7); c.lineTo(91, y + 7); c.lineTo(109, y); c.closePath()
      c.fillStyle = '#6dd4ec'; c.fill()
    }
  })
  const width = 2 * track.halfWidth
  // SceneryBatch maps one U repeat every four units along the running surface.
  map.wrapS = THREE.RepeatWrapping
  map.repeat.y = 1.6 / width
  const rubber = material('#c8d2da', .74, .12)
  rubber.map = rubber.emissiveMap = map
  rubber.emissive.set('#799eba'); rubber.emissiveIntensity = .28
  const batch = new SceneryBatch(.3, { indexed: true })
  batch.surface(rubber, start, end, (s, t) => track.sample(s, (2 * t - 1) * track.halfWidth), width, 16)
  batch.finish(group)
  return (seconds: number) => { map.offset.x = -seconds * speed / 4 }
}

export function addSpectralFan(group: THREE.Group, track: CourseTrack, hull: Material, blue: Material, nickel: Material) {
  const { startS, endS, centerS, radius, bladeCount, hubRadius, hubTopRadius, hubHeight } = spectralFan
  const { center, tilt } = spectralFanFrame(track)
  fanBed(group, track, center)
  const intake = feedBelt(group, track, startS - spectralFan.intakeLength, startS, spectralFan.intakeSpeed)
  const discharge = feedBelt(group, track, endS, endS + spectralFan.runoutLength, spectralFan.runoutSpeed)
  const frame = new THREE.Group()
  frame.position.copy(center); frame.quaternion.copy(tilt)
  const rotor = new THREE.Group()
  frame.add(rotor); group.add(frame)
  const hardware = new SceneryBatch(.23, { indexed: true })
  const axle = (y: number) => new THREE.Vector3(0, y, 0).applyQuaternion(frame.quaternion).add(frame.position)
  hardware.rod(hull, axle(-.81), axle(-.32), radius * .992, 96)
  hardware.rod(hull, axle(-1.7), axle(-.80), radius * .58, 64)
  hardware.rod(blue, axle(-1.78), axle(-1.62), radius * .54, 64)
  for (const side of [-1, 1]) {
    const edge = (s: number, lift: number, inset = 0) => {
      const p = track.sample(s, side * (track.halfWidth - inset))
      return new THREE.Vector3(p.x, p.y + lift, p.z)
    }
    hardware.strip(hull, startS, endS, (s, k) => edge(s, k ? .12 : -.84), .96)
    hardware.strip(blue, startS, endS, (s, k) => edge(s, k ? -.37 : -.49, -.008), .12)
    // Sight through the open guard between its short LED stanchions.
    hardware.strip(nickel, startS, endS, (s, k) => edge(s, track.wallHeight(s) - (k ? .04 : .17)), .13)
    hardware.strip(blue, startS, endS, (s, k) => edge(s, track.wallHeight(s), k ? .035 : -.035), .07)
    const mouth = Math.asin((track.halfWidth - side * spectralFan.offset) / radius)
    for (let i = 0; i <= 18; i++) {
      const angle = mouth + (Math.PI - 2 * mouth) * i / 18
      const s = centerS + radius * Math.cos(angle), guard = track.wallHeight(s)
      hardware.rod(hull, edge(s, .08), edge(s, guard), .127, 8)
      hardware.rod(blue, edge(s, guard - .29), edge(s, guard + .018), .132, 8)
    }
  }
  hardware.finish(group)

  const blades = new SceneryBatch(.32, { indexed: true })
  // The broad faces push the marble. Dark steel sides and silver crowns show
  // the depth of each pocket throughout its turn in the light.
  const blade = new THREE.BufferGeometry()
  blade.setAttribute('position', new THREE.BufferAttribute(spectralFanBlade.vertices, 3))
  blade.setIndex(new THREE.BufferAttribute(spectralFanBlade.indices, 1))
  const faces = blade.toNonIndexed()
  faces.computeVertexNormals()
  const normals = faces.getAttribute('normal'), colors: number[] = []
  const steel = new THREE.Color('#6890ab')
  for (let i = 0; i < normals.count; i++) {
    if (normals.getY(i) > .85) colors.push(1, 1, 1)
    else colors.push(steel.r, steel.g, steel.b)
  }
  faces.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  const paddleFinish = nickel.clone()
  paddleFinish.vertexColors = true
  const inlay = (a: THREE.Vector3, b: THREE.Vector3, width: number) => {
    const midpoint = a.clone().lerp(b, .5)
    midpoint.y += .003
    blades.box(blue, midpoint, [a.distanceTo(b), .003, width], -Math.atan2(b.z - a.z, b.x - a.x))
  }
  for (let i = 0; i < bladeCount; i++) {
    const rotation = new THREE.Matrix4().makeRotationY(i * 2 * Math.PI / bladeCount)
    blades.add(paddleFinish, faces.clone(), rotation)
    const vertex = (n: number) => new THREE.Vector3().fromArray(spectralFanBlade.vertices, n * 3).applyMatrix4(rotation)
    for (let edge = 7; edge < 10; edge++) inlay(vertex(edge), vertex(edge + 1), .07)
    const root = vertex(7).lerp(vertex(13), .5)
    const inlayTip = vertex(8).lerp(vertex(12), .15)
    inlay(root, root.clone().lerp(inlayTip, .48), .116)
  }
  faces.dispose(); blade.dispose()
  const skirt = (mat: Material, from: number, to: number) => {
    const r = (height: number) => THREE.MathUtils.lerp(hubRadius, hubTopRadius, height)
    const low = THREE.MathUtils.lerp(spectralFanHubBaseY, hubHeight, from)
    const high = THREE.MathUtils.lerp(spectralFanHubBaseY, hubHeight, to)
    const band = new THREE.CylinderGeometry(r(to), r(from), high - low, 32, 1, true)
    blades.add(mat, band, new THREE.Matrix4().makeTranslation(0, (low + high) / 2, 0))
  }
  skirt(hull, 0, .36)
  skirt(blue, .36, .71)
  skirt(nickel, .71, 1)
  blades.finish(rotor)
  const face = new THREE.Mesh(new THREE.CircleGeometry(hubTopRadius, 32), hubCap())
  face.rotation.x = -Math.PI / 2; face.position.y = hubHeight
  face.receiveShadow = true; rotor.add(face)
  return (seconds: number) => {
    rotor.rotation.y = spectralFanAngle(seconds)
    intake(seconds); discharge(seconds)
  }
}
