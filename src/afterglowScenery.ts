import * as THREE from 'three'
import type { CourseTrack, TrackSample } from './courseGeometry'
import { faders, faderPose } from './courses/afterglow'
import { addAfterglowArena } from './afterglowArena'
import { axisY, canvasTexture, lifted, material, SceneryBatch, type Material } from './sceneryKit'

const spectrum = ['#ff2858', '#ff9228', '#e1fb48', '#28e6a0', '#438eff', '#d842ff']
const laneLight = ['#ff6a90', '#ffbd6e', '#f6f495', '#99f5d0', '#89c7ff', '#e697ff']
const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)

function neon(color: string) {
  const m = material(color, .43, .06)
  m.emissive.set(color); m.emissiveIntensity = .64
  return m
}

/** One wrap lays a continuous six-channel lightbox over both the wide bends and the mono throat. */
function spectrumDeck(track: CourseTrack) {
  const map = canvasTexture(128, 768, c => {
    for (let i = 0; i < spectrum.length; i++) {
      const y = i * 128
      c.fillStyle = '#121326'; c.fillRect(0, y, 128, 128)
      const face = c.createLinearGradient(0, y + 5, 0, y + 124)
      face.addColorStop(0, laneLight[i]); face.addColorStop(.10, spectrum[i]); face.addColorStop(.79, spectrum[i]); face.addColorStop(1, laneLight[i])
      c.fillStyle = face; c.fillRect(0, y + 5, 128, 117)
      c.fillStyle = laneLight[i]; c.fillRect(0, y + 8, 128, 1.6); c.fillRect(0, y + 118, 128, 1)
      c.fillStyle = '#fffbef'; c.beginPath(); c.ellipse(64, y + 64, 3.8, 4.5, 0, 0, Math.PI * 2); c.fill()
    }
  })
  map.wrapS = THREE.RepeatWrapping
  const m = material('#747080', .72, 0)
  m.map = m.emissiveMap = map; m.emissive.set('#ffffff'); m.emissiveIntensity = .76
  m.envMapIntensity = .06; m.toneMapped = false
  // Keep the surface indexed: every render cell follows the same crowned floor
  // used by Rapier, with common UV rows and normals through the narrowing.
  const columns = track.laneCount * 8, rows = Math.ceil(track.length / .35)
  const geom = new THREE.PlaneGeometry(1, 1, columns, rows)
  const xyz = geom.getAttribute('position'), uv = geom.getAttribute('uv')
  for (let j = 0; j <= rows; j++) {
    const s = track.length * j / rows
    for (let i = 0; i <= columns; i++) {
      const frac = i / columns, n = i + (columns + 1) * j
      const p = track.sample(s, track.halfWidth * (1 - 2 * frac))
      xyz.setXYZ(n, p.x, p.y, p.z); uv.setXY(n, s / 1.3, frac)
    }
  }
  geom.computeVertexNormals()
  const mesh = new THREE.Mesh(geom, m)
  mesh.castShadow = mesh.receiveShadow = true
  return mesh
}

function lightbox(group: THREE.Group, batch: SceneryBatch, track: CourseTrack, s: number, finish: boolean, shell: Material, accent: Material) {
  const map = canvasTexture(1024, 144, c => {
    c.fillStyle = '#0b0a1c'; c.fillRect(0, 0, 1024, 144)
    const strip = c.createLinearGradient(0, 0, 1024, 0)
    spectrum.forEach((color, i) => strip.addColorStop(i / (spectrum.length - 1), color))
    c.fillStyle = strip; c.fillRect(0, 0, 1024, 6); c.fillRect(0, 138, 1024, 6)
    for (let i = 0; i < 9; i++) {
      const h = 12 + 45 * (1 + Math.sin(i * 1.7)) / 2
      c.fillRect(30 + i * 9, 71 - h / 2, 5, h)
    }
    c.font = 'italic 900 57px Arial, sans-serif'; c.fillStyle = '#fff7ff'; c.fillText('AFTERGLOW', 136, 92, 345)
    c.fillStyle = '#81f9ff'; c.font = 'bold 37px monospace'; c.fillText('FM', 500, 91)
    c.strokeStyle = '#494061'; c.lineWidth = 2; c.beginPath(); c.moveTo(615, 29); c.lineTo(593, 116); c.stroke()
    c.fillStyle = finish ? '#99f4f1' : '#ffa8c9'; c.font = '900 57px Arial, sans-serif'; c.textAlign = 'center'
    c.fillText(finish ? 'FINISH' : 'START', 811, 93)
  })
  const m = material('#ffffff', .58, 0); m.map = m.emissiveMap = map; m.emissive.set('#ffffff'); m.emissiveIntensity = .45
  const p = track.sample(s), direction = v(p.tx, 0, p.tz), yaw = Math.atan2(p.tx, p.tz)
  const width = 2 * track.halfWidth + .46, h = width * 144 / 1024
  const center = v(p.x, Math.max(track.sample(s, track.halfWidth).y, track.sample(s, -track.halfWidth).y) + 2.7, p.z)
  for (const sign of [-1, 1]) {
    const base = lifted(track.sample(s, sign * (track.halfWidth + .15)), -.26), top = base.clone(); top.y = center.y
    batch.rod(shell, base, top, .105, 8); batch.rod(accent, base.clone().lerp(top, .80), base.clone().lerp(top, .93), .109, 8)
  }
  batch.box(shell, center, [width + .16, h + .12, .21], yaw)
  for (const side of [-1, 1]) {
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(width, h), m)
    sign.position.copy(center).addScaledVector(direction, side * .11)
    sign.rotation.y = yaw + (side < 0 ? Math.PI : 0); group.add(sign)
  }
}

function stripedColumn(color: string) {
  const map = canvasTexture(16, 128, c => {
    c.fillStyle = '#141226'; c.fillRect(0, 0, 16, 128)
    c.fillStyle = '#342c44'; c.fillRect(0, 59, 16, 3)
    c.fillStyle = color; c.fillRect(0, 28, 16, 17)
    c.fillStyle = '#fff7ff'; c.globalAlpha = .5; c.fillRect(0, 30, 16, 3)
  })
  map.wrapT = THREE.RepeatWrapping
  const m = material('#ded9e8', .51, .13)
  m.map = m.emissiveMap = map; m.emissive.set('#ffffff'); m.emissiveIntensity = .42
  return m
}

export function createAfterglowScenery(track: CourseTrack) {
  const group = new THREE.Group(), batch = new SceneryBatch()
  group.name = 'Afterglow FM'
  const shell = material('#18152b', .49, .36), rail = material('#29263f', .44, .31)
  const silver = material('#a9adc5', .32, .55), cyan = neon('#58efff'), pink = neon('#ff529e'), white = neon('#fff0dc')
  const w = track.halfWidth, at = (s: number, l: number, h = 0) => lifted(track.sample(s, l), h)
  const ribbon = (m: Material, a: number, b: number, l: number, r: number, h = 0, bands = 1) =>
    batch.surface(m, a, b, (s, t) => at(s, l + (r - l) * t, h), Math.abs(r - l), bands)
  const bounds = new THREE.Box3()
  const centerline: { s: number; center: TrackSample; width: number }[] = []
  for (let s = 0; s <= track.length + 1; s += 1) {
    const center = track.sample(s), left = at(s, -w), right = at(s, w)
    bounds.expandByPoint(left); bounds.expandByPoint(right)
    centerline.push({ s, center, width: Math.hypot(right.x - center.x, right.z - center.z) })
  }
  const floorY = bounds.min.y - 2.4
  const frameCamera = addAfterglowArena(group, batch, track, floorY, bounds, shell, pink, cyan)
  group.add(spectrumDeck(track))
  ribbon(shell, 0, track.length, -w, w, -.36, 12)
  const lip = neon('#f2b3eb')
  const glass = material('#4c5d8a', .43, .05)
  glass.transparent = true; glass.opacity = .23; glass.depthWrite = false; glass.forceSinglePass = true
  for (const side of [-1, 1]) {
    const edge = (s: number, offset: number, h: number) => {
      const p = track.sample(s, side * w)
      return v(p.x + p.rx * side * offset, p.y + h, p.z + p.rz * side * offset)
    }
    batch.strip(shell, 0, track.length, (s, k) => edge(s, .015, k ? -.36 : .115), .48)
    batch.strip(glass, 0, track.length, (s, k) => edge(s, .015, k ? .115 : track.wallHeight(s)), 1)
    batch.strip(rail, 0, track.length, (s, k) => edge(s, k ? .18 : -.025, track.wallHeight(s)), .205)
    batch.strip(side < 0 ? cyan : pink, 0, track.length, (s, k) => edge(s, .025, k ? -.17 : -.26), .09)
    batch.strip(lip, 0, track.length, (s, k) => edge(s, k ? -.029 : .029, track.wallHeight(s) + .008), .062)
    for (let s = .3; s < track.length; s += 2.1) {
      batch.strip(side < 0 ? cyan : pink, s, Math.min(track.length, s + .75), (d, k) => edge(d, -.018, track.wallHeight(d) - (k ? .24 : .19)), .05)
    }
  }
  const wraps = spectrum.map(stripedColumn)
  for (let s = 1, n = 0; s < track.length; s += 7.2, n++) {
    const feet = [-1, 1].map(side => at(s, side * w * .83, -.40))
    // An upper deck can pass directly over another flight. Bridge the opening
    // from neighboring columns instead of running a power pier through it.
    const obstructsLowerDeck = (p: THREE.Vector3) => centerline.some(({ s: d, center, width }) =>
      Math.abs(d - s) > 14 && center.y < p.y && Math.hypot(center.x - p.x, center.z - p.z) < width + 1.8)
    const soffit = Math.min(...Array.from({ length: 9 }, (_, i) => track.sample(s, w * (i / 4 - 1)).y)) - .52
    const ends = feet.map(p => v(p.x, soffit, p.z))
    batch.rod(rail, ends[0], ends[1], .15)
    for (const [j, p] of feet.entries()) {
      if (obstructsLowerDeck(p)) continue
      const height = soffit - floorY
      const geom = new THREE.CylinderGeometry(.22, .25, height, 10), uv = geom.getAttribute('uv')
      for (let i = 0; i < uv.count; i++) uv.setY(i, uv.getY(i) * height / 1.22)
      batch.add(wraps[(n + 3 * j) % wraps.length], geom, new THREE.Matrix4().makeTranslation(p.x, floorY + height / 2, p.z))
      batch.rod(rail, v(p.x, floorY + .01, p.z), v(p.x, floorY + .30, p.z), .50, 12)
      batch.rod(shell, ends[j].clone().addScaledVector(axisY, -.23), p, .31, 10)
    }
  }

  const pucks = faders.map((fader, i) => {
    const { s, center, travel, radius, height } = fader
    const lo = center - travel - .20, hi = center + travel + .20
    ribbon(shell, s - .13, s + .13, lo, hi, .018, 12)
    ribbon(silver, s - .065, s + .065, lo, hi, .022, 12)
    for (let tick = 0; tick <= 12; tick++) {
      const l = lo + (hi - lo) * tick / 12
      ribbon(shell, s + .17, s + (tick % 3 ? .29 : .42), l - .022, l + .022, .018)
    }
    const face = i === 0 ? pink : i === 1 ? cyan : neon('#ffb251')
    const puck = new THREE.Group(), pieces = new SceneryBatch()
    pieces.rod(shell, v(0, -.22, 0), v(0, height * .63, 0), radius, 28)
    pieces.rod(face, v(0, height * .18, 0), v(0, height * .37, 0), radius + .009, 28)
    const dome = new THREE.SphereGeometry(radius, 28, 12, 0, Math.PI * 2, 0, Math.PI / 2)
    dome.scale(1, height * .38 / radius, 1); dome.translate(0, height * .63, 0); pieces.add(rail, dome)
    pieces.rod(face, v(0, height - .01, 0), v(0, height + .006, 0), radius * .23, 20)
    pieces.finish(puck); group.add(puck); return puck
  })
  lightbox(group, batch, track, .24, false, shell, pink)
  lightbox(group, batch, track, track.finishS, true, shell, cyan)
  for (let col = 0; col < 16; col++) for (let row = 0; row < 2; row++) {
    const s = track.finishS + row * .25
    ribbon((col + row) % 2 ? white : shell, s, s + .25, -w + col * w / 8, -w + (col + 1) * w / 8, .025)
  }
  const end = track.sample(track.length)
  batch.box(shell, lifted(end, .53), [.20, 1.16, 2 * w + .12], -Math.atan2(end.tz, end.tx))
  batch.finish(group)
  // Smoky channel shields should transmit the course lights as well as the pack.
  group.children.forEach(mesh => { if (mesh instanceof THREE.Mesh && mesh.material === glass) mesh.castShadow = false })
  const setRaceTime = (time: number) => {
    pucks.forEach((puck, i) => { const p = faderPose(track, faders[i], time); puck.position.set(p.x, p.y, p.z) })
  }
  setRaceTime(0)
  return Object.assign(group, { setRaceTime, frameCamera })
}
