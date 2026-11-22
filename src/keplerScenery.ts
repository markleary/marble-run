import * as THREE from 'three'
import type { CourseTrack } from './track'
import { keplerCurtain } from './courses/kepler'
import layout from './courses/kepler-layout.json'
import { SceneryBatch, axisY, canvasTexture, lifted, material, type Material } from './sceneryKit'
import { addKeplerStation } from './keplerStation'
import { addKeplerSky } from './keplerSky'

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)

function hullPlates() {
  const map = canvasTexture(512, 256, ctx => {
    ctx.fillStyle = '#c2c8c9'; ctx.fillRect(0, 0, 512, 256)
    // Chamfered ceramic panels, recessed fasteners and access markings.
    ctx.fillStyle = '#b1bbbe'
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(175, 0); ctx.lineTo(143, 26); ctx.lineTo(0, 26); ctx.fill()
    ctx.fillStyle = '#738189'; ctx.fillRect(0, 0, 512, 4); ctx.fillRect(0, 0, 4, 256)
    ctx.strokeStyle = '#8b989d'; ctx.lineWidth = 2
    ctx.beginPath(); ctx.moveTo(0, 55); ctx.lineTo(21, 34); ctx.lineTo(21, 3); ctx.stroke()
    ctx.fillStyle = '#e0e2db'
    for (const y of [6, 244]) ctx.fillRect(28, y, 463, 1.6)
    for (const x of [14, 498]) for (const y of [13, 241]) {
      ctx.fillStyle = '#73838b'; ctx.beginPath(); ctx.arc(x, y, 2.6, 0, 2 * Math.PI); ctx.fill()
      ctx.fillStyle = '#d9dcd5'; ctx.fillRect(x - 1.9, y + 1.1, 3.5, .7)
    }
    ctx.fillStyle = '#899297'
    for (let i = 0; i < 5; i++) ctx.fillRect(467 + i * 4, 213, i % 2 ? 2 : 1, 11)
    ctx.fillStyle = '#e0e2dc'; ctx.fillRect(464, 227, 25, 2)
  })
  map.wrapS = map.wrapT = THREE.RepeatWrapping
  return map
}

function auroraGlass() {
  const map = canvasTexture(432, 288, ctx => {
    const base = ctx.createLinearGradient(0, 0, 0, 288)
    base.addColorStop(0, '#32939c'); base.addColorStop(.34, '#58bdb6')
    base.addColorStop(.56, '#438aa0'); base.addColorStop(.82, '#3eaaa7'); base.addColorStop(1, '#32939c')
    ctx.fillStyle = base; ctx.fillRect(0, 0, 432, 288)
    // Continuous hexagonal ceramic mesh inside the receiver's translucent laminate.
    const r = 24
    ctx.strokeStyle = 'rgba(196,251,236,.46)'; ctx.lineWidth = 1.6
    const rise = 18
    for (let x = -1; x < 14; x++) for (let y = -1; y < 10; y++) {
      const cx = x * 36, cy = (y * 2 + (x & 1)) * rise
      ctx.beginPath(); ctx.moveTo(cx - r, cy); ctx.lineTo(cx - r / 2, cy - rise)
      ctx.lineTo(cx + r / 2, cy - rise); ctx.lineTo(cx + r, cy); ctx.stroke()
      ctx.fillStyle = 'rgba(199,255,245,.52)'; ctx.fillRect(cx + r - 1.1, cy - 1.1, 2.2, 2.2)
    }
  })
  map.wrapS = map.wrapT = THREE.RepeatWrapping
  map.repeat.set(.77, .62)
  const mat = material('#efffff', .22, .22)
  mat.map = mat.emissiveMap = map
  mat.emissive.set('#7bb5c1'); mat.emissiveIntensity = .33
  mat.transparent = true; mat.opacity = .86; mat.forceSinglePass = true
  return mat
}

function auroraShell(track: CourseTrack, start: number, glass: Material) {
  const bands = 48, rows = Math.ceil((track.length - start) / .31)
  const shape = new THREE.PlaneGeometry(1, 1, bands, rows)
  const positions = shape.getAttribute('position'), uv = shape.getAttribute('uv')
  const color = new Float32Array(positions.count * 4).fill(1)
  const step = 2 * track.halfWidth / bands
  for (let row = 0; row <= rows; row++) {
    const s = start + (track.length - start) * row / rows
    let previousHeight = 0, arc = 0
    for (let col = 0; col <= bands; col++) {
      const index = row * (bands + 1) + col
      const p = track.sample(s, track.halfWidth - col * step)
      positions.setXYZ(index, p.x, p.y, p.z)
      if (col) arc += Math.hypot(step, p.y - previousHeight)
      uv.setXY(index, s / 4, arc / 1.6)
      previousHeight = p.y
    }
    // The continuous pane is frosted under the marbles and clears as its sides
    // rise. Measuring across the glass keeps the honeycomb regular on the curve.
    for (let col = 0; col <= bands; col++) {
      const first = row * (bands + 1), a = Math.max(0, col - 1), b = Math.min(bands, col + 1)
      const deltaY = positions.getY(first + b) - positions.getY(first + a)
      const slope = Math.abs(deltaY) / ((b - a) * step)
      color[(first + col) * 4 + 3] = 1 - .78 * THREE.MathUtils.smoothstep(slope, .32, 1.65)
    }
  }
  shape.setAttribute('color', new THREE.BufferAttribute(color, 4))
  shape.computeVertexNormals()
  glass.vertexColors = true
  const mesh = new THREE.Mesh(shape, glass)
  mesh.receiveShadow = true
  return mesh
}

function illuminated(color: string) {
  const mat = material(color, .29, .13)
  mat.emissive.set(color); mat.emissiveIntensity = .57
  return mat
}

function missionSign(group: THREE.Group, batch: SceneryBatch, mount: Material,
  position: THREE.Vector3, width: number, direction: THREE.Vector3, finish: boolean) {
  const badge = canvasTexture(1024, 144, c => {
    c.fillStyle = '#142638'; c.fillRect(0, 0, 1024, 144)
    c.fillStyle = '#f2eede'; c.fillRect(8, 10, 1008, 2)
    c.fillStyle = finish ? '#83ece0' : '#fe9956'; c.fillRect(8, 132, 1008, 4)
    c.strokeStyle = '#f8f1df'; c.lineWidth = 3
    c.beginPath(); c.ellipse(76, 72, 48, 19, -.53, 0, Math.PI * 2); c.stroke()
    c.fillStyle = '#f6a265'; c.beginPath(); c.arc(76, 72, 20, 0, Math.PI * 2); c.fill()
    c.fillStyle = '#fcf0d9'; c.fillRect(118, 44, 6, 6)
    c.fillStyle = '#e8f0ee'; c.font = 'bold 54px Arial, sans-serif'
    c.fillText('KEPLER RELAY', 158, 89)
    c.fillStyle = finish ? '#93e8da' : '#fab67e'; c.fillRect(627, 27, 370, 90)
    c.fillStyle = '#132938'; c.textAlign = 'center'; c.font = 'bold 57px Arial, sans-serif'
    c.fillText(finish ? 'FINISH' : 'START', 812, 92)
  })
  const paint = material('#ffffff', .57)
  paint.map = paint.emissiveMap = badge; paint.emissive.set('#c3c8c9'); paint.emissiveIntensity = .27
  const yaw = Math.atan2(direction.x, direction.z)
  const h = width * 144 / 1024
  batch.box(mount, position, [width + .12, h + .11, .19], yaw)
  for (const side of [-1, 1]) {
    const face = new THREE.Mesh(new THREE.PlaneGeometry(width, h), paint)
    face.position.copy(position).addScaledVector(direction, side * .099)
    face.rotation.y = yaw + (side < 0 ? Math.PI : 0)
    group.add(face)
  }
}

function transferCurtains(group: THREE.Group, track: CourseTrack) {
  const map = canvasTexture(64, 64, ctx => {
    ctx.fillStyle = 'rgba(111,228,249,.015)'; ctx.fillRect(0, 0, 64, 64)
    ctx.fillStyle = 'rgba(150,251,247,.41)'; ctx.fillRect(31, 31, 2, 2)
    ctx.fillStyle = 'rgba(130,239,251,.28)'; ctx.fillRect(29, 31.5, 6, 1)
  })
  map.wrapS = map.wrapT = THREE.RepeatWrapping
  const field = new THREE.MeshBasicMaterial({ map, transparent: true, opacity: .55, depthWrite: false,
    side: THREE.DoubleSide, forceSinglePass: true })
  for (const side of [-1, 1]) {
    const [a, b, c, d] = keplerCurtain(track, side)
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute([a, b, c, d].flatMap(p => [p.x, p.y, p.z]), 3))
    const length = Math.hypot(c.x - a.x, c.z - a.z)
    geo.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 0, b.y - a.y, length, 0, length, d.y - c.y], 2))
    geo.setIndex([0, 1, 2, 1, 3, 2])
    group.add(new THREE.Mesh(geo, field))
  }
}

export function createKeplerScenery(track: CourseTrack, onReady?: () => void) {
  const group = new THREE.Group(), batch = new SceneryBatch()
  group.name = 'Kepler Relay'
  const hull = material('#e1e4de', .48, .22), frame = material('#34465a', .43, .43)
  const titanium = material('#96a6ae', .39, .46), gold = material('#bd8b56', .36, .49)
  const copper = material('#d57442', .44, .36)
  const ablator = material('#38485a', .58, .24), amber = illuminated('#ffc16e'), ice = illuminated('#a4f8ed')
  const tiles = material('#fffaed', .47, .20)
  tiles.map = hullPlates()
  const carbon = material('#374453', .62, .20)
  carbon.map = tiles.map
  const glass = auroraGlass()
  const well = material('#2d5973', .32, .40)
  const pane = material('#b5e9e7', .27, .09)
  pane.transparent = true; pane.opacity = .15; pane.depthWrite = false; pane.forceSinglePass = true
  const { diveStart, takeoff, landing } = layout.jump
  const w = track.halfWidth
  const at = (s: number, l: number, dy = 0) => lifted(track.sample(s, l), dy)
  const rim = (s: number, side: number, dist: number, dy: number) => {
    const p = track.sample(s, side * w)
    return v(p.x + side * dist * p.rx, p.y + dy, p.z + side * dist * p.rz)
  }
  const ribbon = (m: Material, a: number, b: number, l: number, r: number, y: number, bands = 1) =>
    batch.surface(m, a, b, (s, t) => at(s, l + t * (r - l), y), Math.abs(r - l), bands)
  const belowGlass = (s: number, lateral: number, depth: number) => {
    const p = track.sample(s, lateral), left = Math.max(-w, lateral - .035), right = Math.min(w, lateral + .035)
    const slope = (track.sample(s, right).y - track.sample(s, left).y) / (right - left)
    const down = depth / Math.hypot(1, slope)
    return v(p.x + p.rx * slope * down, p.y - down, p.z + p.rz * slope * down)
  }

  addKeplerSky(group, track.sample(takeoff), onReady)
  const scan = addKeplerStation(group, track, batch, hull, frame, gold, ice)

  // Ceramic hull and box-section beams finish at the transfer lip.
  const gate = track.sections[0]
  ribbon(tiles, 0, gate.end, -w, w, 0, 48)
  ribbon(tiles, gate.end, diveStart, -w, w, 0, 14)
  ribbon(carbon, diveStart, takeoff, -w, w, 0, 16)
  ribbon(frame, 0, takeoff, -w, w, -.44, 10)
  for (const side of [-1, 1]) {
    batch.strip(hull, 0, takeoff, (s, k) => rim(s, side, k ? .15 : 0, k ? -.38 : .025), .44)
    batch.strip(frame, 0, takeoff, (s, k) => rim(s, side, k ? .05 : .15, k ? -.80 : -.38), .42)
    batch.strip(copper, 0, takeoff, (s, k) => rim(s, side, .155, k ? -.39 : -.48), .10)
    batch.strip(pane, 0, takeoff, (s, k) => rim(s, side, .025, k ? track.wallHeight(s) : .11), .8)
    batch.strip(frame, 0, takeoff, (s, k) => rim(s, side, k ? .11 : -.039, track.wallHeight(s)), .15)
    batch.strip(hull, 0, takeoff, (s, k) => rim(s, side, .105, track.wallHeight(s) - (k ? .014 : .068)), .054)
    ribbon(frame, 0, takeoff, side * (w - .32), side * (w - .23), .012)
    for (let s = .12, i = 0; s < takeoff; s += 3, i++) {
      batch.rod(frame, rim(s, side, .03, -.11), rim(s, side, .03, track.wallHeight(s)), .052, 6)
      batch.strip(i % 3 ? hull : amber, s, Math.min(s + .88, takeoff), (d, k) => rim(d, side, .022, track.wallHeight(d) * .52 + k * .12), .12)
      if (s + .7 < takeoff) ribbon(copper, s + .12, s + .7, side * (w - .55), side * (w - .38), .015)
    }
  }
  for (let s = .2; s < takeoff - .12; s += 5.3) {
    const bottom = Math.min(...Array.from({ length: 17 }, (_, i) => track.sample(s, (i / 8 - 1) * w).y))
    const a = rim(s, -1, -.30, 0), b = rim(s, 1, -.30, 0)
    a.y = b.y = bottom - .95
    batch.rod(frame, a, b, .18)
    for (const side of [-1, 1]) {
      const shoulder = rim(s, side, -.30, -.36), foot = shoulder.clone()
      foot.y = bottom - .94
      batch.rod(titanium, shoulder, foot, .13, 6)
    }
    const p = track.sample(s)
    batch.box(ablator, v(p.x, bottom - .68, p.z), [.51, .42, 2 * w - .40], -Math.atan2(p.tz, p.tx))
  }

  // A slim clear lip caps each shoulder. Curved saddles carry the glass on
  // paired keels beneath the trough so the sides stay clear of heavy bracing.
  group.add(auroraShell(track, landing, glass))
  const keel = (s: number, side: number) => belowGlass(s, side * w * .29, .62)
  for (const side of [-1, 1]) {
    batch.strip(titanium, landing, track.length, (s, k) => rim(s, side, .025, k ? .008 : -.068), .076)
    batch.strip(pane, landing, track.length, (s, k) => rim(s, side, .025, k ? track.wallHeight(s) : .008), .42)
    batch.strip(ice, landing, track.length, (s, k) => rim(s, side, k ? .056 : .012, track.wallHeight(s)), .044)
  }
  for (let s = landing + .12, i = 0; s < track.length; s += 3, i++) {
    const next = Math.min(s + 3, track.length)
    batch.surface(titanium, s - .058, Math.min(s + .058, track.length), (d, t) =>
      belowGlass(d, (2 * t - 1) * w, .15), 2 * w, 40)
    for (const side of [-1, 1]) {
      batch.rod(well, keel(s, side), keel(next, side), .077)
      batch.rod(titanium, belowGlass(s, side * w * .29, .14), keel(s, side), .067, 6)
      if (i % 2 === 0) batch.rod(titanium, keel(s, side), keel(next, -side), .045)
      batch.rod(titanium, rim(s, side, .032, -.04), rim(s, side, .032, track.wallHeight(s)), .027, 6)
      if (s + .39 < track.length) ribbon(ice, s + .12, s + .39, side * (w - .25), side * (w - .20), .025)
    }
  }
  // The telemetry instrument is printed directly onto the bank: its two traces
  // chart the same left/right sequence of gravity wells that the pack encounters.
  const telemetry = track.sections[3]
  const signal = (s: number) => {
    const u = (s - telemetry.start) / (telemetry.end - telemetry.start)
    return -2.25 * Math.sin(u * 4 * Math.PI) * Math.sin(u * Math.PI) ** 2
  }
  batch.surface(frame, telemetry.start, telemetry.end, (s, t) => at(s, signal(s) + t * .065, .018), .065)
  for (let s = telemetry.start; s < telemetry.end - .9; s += 1.7) {
    batch.surface(copper, s, s + .85, (d, t) => at(d, signal(d) - .18 - t * .10, .02), .10)
    ribbon(titanium, s, s + .045, -w + .62, -w + 1.02, .016)
  }
  // A wide inner-edge sweep and its synchronized tally marks face the tracking dish.
  const magnet = track.sections[2]
  ribbon(copper, magnet.start, magnet.end, w - 1.12, w - .72, .017)
  for (let s = magnet.start + .45, i = 0; s < magnet.end; s += 1.50, i++) {
    ribbon(frame, s, s + .085, w - (i % 4 ? 1.34 : 1.70), w - 1.08, .021)
  }
  // The six pressure-molded grooves give way to a flush racing deck.
  for (let i = 1; i < track.laneCount; i++) for (const side of [-1, 1]) {
    const l = -w + i * track.laneWidth
    batch.strip(frame, 0, track.sections[0].end + 1, (s, k) =>
      at(s, l + side * (k ? 0 : .048) * track.divider(s), (k ? .205 * track.divider(s) : 0) + .009), .205)
  }
  // Canted induction vanes and amber chevrons guide the eye down the dive and up the kicker.
  for (let s = diveStart + .6; s < takeoff - .8; s += 3.6) for (const side of [-1, 1]) {
    const lo = rim(s, side, .26, -.59)
    const mid = rim(s + .33, side, .62, .37)
    const tip = rim(s + .66, side, .73, 1.65)
    batch.rod(frame, lo, mid, .155, 6); batch.rod(copper, mid, tip, .133, 6)
    batch.rod(amber, mid.clone().lerp(tip, .69), tip, .14, 6)
    batch.surface(amber, s, s + .88, (d, t) => {
      const u = (d - s) / .88
      return at(d, side * (w - .58 - 1.16 * u - t * .29), .025)
    }, .29)
  }
  // The glass end face is visible head-on from the launch. All beams stop at the lip.
  for (const [s, mat, depth] of [[takeoff, copper, .43], [landing, well, .19]] as const) {
    for (let j = 0; j < 18; j++) {
      const l = w * (j / 9 - 1), next = l + w / 9
      const a = at(s, l), b = at(s, next)
      const face = new THREE.PlaneGeometry(1, 1), vertices = face.getAttribute('position')
      for (const [i, p] of [a, b, a, b].entries()) vertices.setXYZ(i, p.x, p.y - (i < 2 ? 0 : depth), p.z)
      face.computeVertexNormals()
      batch.add(mat, face)
    }
  }
  transferCurtains(group, track)

  for (const [s, finish] of [[.22, false], [track.finishS, true]] as const) {
    const p = track.sample(s), dir = v(p.tx, 0, p.tz)
    const top = Math.max(at(s, -w).y, at(s, w).y, p.y) + (finish ? 3.05 : 2.02)
    const center = v(p.x, top, p.z)
    missionSign(group, batch, frame, center, 2 * w + .65, dir, finish)
    for (const side of [-1, 1]) {
      const socket = rim(s, side, .30, -.51), joint = socket.clone()
      joint.y = top + .48
      batch.rod(titanium, socket, joint, .125, 8)
      batch.rod(finish ? ice : amber, joint.clone().addScaledVector(axisY, -.25), joint, .15, 8)
    }
    if (finish) for (let i = 0; i < 18; i++) for (let j = 0; j < 2; j++) {
      ribbon((i + j) % 2 ? frame : hull, s + j * .25, s + (j + 1) * .25, w * (i / 9 - 1), w * ((i + 1) / 9 - 1), .02)
    }
  }
  const end = track.sample(track.length)
  batch.box(frame, lifted(end, .54), [.18, 1.13, 2 * w + .18], -Math.atan2(end.tz, end.tx))
  batch.finish(group)
  group.traverse(object => {
    if (object instanceof THREE.Mesh && (object.material === pane || object.material === glass)) object.castShadow = false
  })
  return Object.assign(group, { setRaceTime: scan })
}
