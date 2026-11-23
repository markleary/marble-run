import * as THREE from 'three'
import { spectralFields, spectralLaunch, spectralOffset, spectralPolarity } from './courses/spectral'
import { spectralCheckpoints, spectralGateColors } from './courses/spectralCheckpoints'
import type { RaceCheckpoint } from './checkpointRace'
import type { CourseTrack } from './track'
import { SceneryBatch, axisY, canvasTexture, material, type Material } from './sceneryKit'
import { addSpectralArena } from './spectralArena'

const spectrum = ['#ff4879', '#ff9c38', '#f5df4c', '#42eca1', '#36c6ff', '#ab6aff']
const glow = (color: string, strength = .85) => {
  const mat = material(color, .36, .24)
  mat.emissive.set(color)
  mat.emissiveIntensity = strength
  return mat
}

function timingDial(label: string, accent: string) {
  const map = canvasTexture(512, 512, c => {
    const circle = (r: number, from = 0, to = Math.PI * 2) => {
      c.beginPath(); c.arc(256, 256, r, from, to); c.stroke()
    }
    c.fillStyle = '#060c1c'
    c.fillRect(0, 0, 512, 512)
    c.lineWidth = 12
    c.lineCap = 'round'
    for (const [i, color] of spectrum.entries()) {
      c.strokeStyle = color
      circle(232, i * Math.PI / 3 + .035, (i + 1) * Math.PI / 3 - .035)
    }
    c.lineWidth = 2
    c.strokeStyle = '#88adc7'
    circle(212)
    for (let i = 0; i < 48; i++) {
      const angle = i * Math.PI / 24, r = i % 4 ? 195 : 188
      c.beginPath(); c.moveTo(256 + r * Math.sin(angle), 256 + r * Math.cos(angle))
      c.lineTo(256 + 200 * Math.sin(angle), 256 + 200 * Math.cos(angle)); c.stroke()
    }
    c.textAlign = 'center'
    c.fillStyle = accent
    c.font = '700 33px Barlow, Arial, sans-serif'
    c.fillText('CHECKPOINT', 256, 179)
    c.fillStyle = '#f2ffff'
    c.font = '800 171px "Barlow Condensed", Arial, sans-serif'
    c.fillText(label, 256, 325)
    c.fillStyle = accent
    for (let i = 0; i < 5; i++) {
      c.globalAlpha = i < Number(label) ? 1 : .22
      c.fillRect(184 + i * 30, 354, 21, 7)
    }
    c.globalAlpha = 1
  })
  return new THREE.MeshBasicMaterial({ map, toneMapped: false })
}

function prismGlass(width: number) {
  // Long faceted panes along the outside of the glass leave a dark center lane for the racers.
  const map = canvasTexture(768, 384, c => {
    c.fillStyle = '#152340'; c.fillRect(0, 0, 768, 384)
    const tints = ['#16537d', '#2847a1', '#633c95', '#98426e', '#986c3d', '#196e87']
    for (const edge of [-1, 1]) {
      c.save()
      if (edge > 0) { c.translate(768, 384); c.rotate(Math.PI) }
      for (let i = -1; i < 7; i++) {
        const x = i * 128, tip = 76 + (i % 2 ? 38 : 0)
        c.fillStyle = tints[(i + 6) % 6]
        c.beginPath(); c.moveTo(x, 0); c.lineTo(x + 189, 0)
        c.lineTo(x + 111, tip); c.lineTo(x + 45, tip - 19); c.closePath(); c.fill()
        c.strokeStyle = '#7abbae'; c.lineWidth = 1.5
        c.beginPath(); c.moveTo(x + 4, 0); c.lineTo(x + 47, tip - 25); c.lineTo(x + 110, tip - 7); c.stroke()
      }
      c.restore()
    }
  })
  map.wrapS = map.wrapT = THREE.RepeatWrapping
  map.repeat.set(.21, 1.6 / width)
  const finish = material('#b9cedf', .24, .46)
  finish.map = finish.emissiveMap = map
  finish.emissive.set('#d1e7ff'); finish.emissiveIntensity = .27
  return finish
}

function deckFinish() {
  const map = canvasTexture(256, 128, c => {
    c.fillStyle = '#62768f'
    c.fillRect(0, 0, 256, 128)
    c.fillStyle = '#54677e'
    c.beginPath(); c.moveTo(0, 0); c.lineTo(180, 0); c.lineTo(165, 15); c.lineTo(0, 15); c.fill()
    c.strokeStyle = '#8296a9'; c.lineWidth = 1
    c.beginPath(); c.moveTo(225, 0); c.lineTo(214, 11); c.lineTo(151, 11); c.stroke()
    c.fillStyle = '#384656'; c.fillRect(0, 0, 1, 128)
    c.fillStyle = '#425366'; c.fillRect(0, 0, 256, 1)
    c.fillStyle = '#9caab8'
    for (const x of [5, 250]) for (const y of [5, 122]) c.fillRect(x, y, 2, 2)
  })
  map.wrapS = map.wrapT = THREE.RepeatWrapping
  const finish = material('#566781', .39, .53)
  finish.map = map
  return finish
}

export function createSpectralScenery(track: CourseTrack) {
  const group = new THREE.Group()
  group.name = 'Spectral Relay'
  const hull = material('#141f35', .48, .64), nickel = material('#72849c', .32, .65)
  const deck = deckFinish(), rail = glow('#2465e8', .81), white = glow('#dffaff', 1.35)
  const black = material('#0d1428', .34, .36)
  const shield = material('#8bc4ef', .30)
  shield.map = canvasTexture(96, 96, c => {
    c.fillStyle = 'rgba(113,173,208,.075)'; c.fillRect(0, 0, 96, 96)
    c.fillStyle = 'rgba(161,224,255,.59)'
    for (let row = 0; row < 4; row++) for (let col = 0; col < 4; col++) {
      c.fillRect(col * 24 + (row % 2) * 12, row * 24, 1.6, 1.6)
    }
  })
  shield.map.wrapS = shield.map.wrapT = THREE.RepeatWrapping
  shield.transparent = true; shield.opacity = .65; shield.depthWrite = false; shield.forceSinglePass = true
  const inks = spectrum.map(color => glow(color, .5))
  const w = track.halfWidth, lane = track.laneWidth, glass = prismGlass(track.halfWidth * 2)
  const at = (s: number, lateral: number, height = 0) => {
    const p = track.sample(s, lateral), n = spectralOffset(s)
    return new THREE.Vector3(p.x + height * n.x, p.y + height * n.y, p.z)
  }
  let batch: SceneryBatch
  const ribbon = (mat: Material, start: number, end: number, left: number, right: number, h = 0, bands = 1) =>
    batch.surface(mat, start, end, (s, t) => at(s, left + (right - left) * t, h), Math.abs(right - left), bands)
  const turnRotor = addSpectralArena(group, track, hull, rail, white)

  for (const [index, section] of track.sections.entries()) {
    const { start, end } = section
    const shaft = index === 0
    batch = new SceneryBatch(shaft ? .30 : .72, { indexed: true, straightUntil: shaft ? spectralLaunch.drop : undefined })
    ribbon(shaft ? black : track.surfaceAt((start + end) / 2) === 'glass' ? glass : deck, start, end, -w, w, 0, shaft ? 36 : 16)
    for (const side of [-1, 1]) {
      const edge = side * w
      // The optical sill and its slim guard follow the surface normal even as the shaft goes vertical.
      batch.strip(hull, start, end, (s, k) => at(s, edge, k ? .11 : -.57), .68)
      batch.strip(nickel, start, end, (s, k) => at(s, side * (w + .018), k ? -.13 : -.19), .06)
      batch.strip(rail, start, end, (s, k) => at(s, side * (w + .025), k ? -.31 : -.44), .13)
      if ([2, 4, 6, 8].includes(index)) {
        batch.strip(shield, start, end, (s, k) => at(s, edge, k ? track.wallHeight(s) - .1 : .08), 4.8)
      }
      batch.strip(hull, start, end, (s, k) => at(s, edge, track.wallHeight(s) - (k ? .14 : .014)), .13)
      batch.strip(shaft ? white : rail, start, end, (s, k) =>
        at(s, side * (w + (k ? .045 : -.052)), track.wallHeight(s)), .10)
      for (let s = start + .4; s < end; s += shaft ? 3.8 : 4.7) {
        batch.rod(nickel, at(s, edge, -.22), at(s, edge, track.wallHeight(s) - .06), .042, 6)
      }
    }
    if (shaft) {
      for (let i = 0; i <= track.laneCount; i++) {
        const l = -w + i * lane
        ribbon(rail, start, end, l - .104, l + .104, .028)
        ribbon(white, start, end, l - .064, l + .064, .038)
      }
      // Independent colored light pipes run down the back of the drop tower.
      for (let i = 0; i < track.laneCount; i++) {
        const l = -w + (i + .5) * lane
        ribbon(inks[i], start, end, l - .15, l + .15, -.59)
      }
      for (let s = .6; s < spectralLaunch.drop; s += 4) {
        batch.rod(hull, at(s, -w - .27, -.61), at(s, w + .27, -.61), .16, 6)
      }
    } else if (index === 5 || index === 8) {
      // The viaduct braids six fine optical filaments beneath the running surface.
      // Through the esses the traces fan outward and converge at each change of direction.
      for (let i = 0; i < 6; i++) {
        const l = -w + (i + .5) * lane
        batch.surface(inks[i], start, end, (s, t) => {
          const phase = 2 * Math.PI * (s - start) / (index === 5 ? 46 : 33)
          const offset = index === 5 ? l * Math.cos(phase) : l * (.74 + .24 * Math.sin(phase))
          return at(s, offset + (t - .5) * (index === 5 ? .12 : .23), .023 + i * .001)
        }, .23)
      }
    } else {
      for (let s = start + 2, stripe = 0; s < end - 2; s += 6.4, stripe++) {
        for (const side of [-1, 1]) {
          const accent = inks[(index + Math.floor(stripe / 4)) % inks.length]
          const l = side * (w - .40)
          batch.surface(accent, s, s + 1.7, (d, t) =>
            at(d, l - side * (.25 * (d - s) / 1.7 + .105 * t), .022), .105)
        }
      }
    }
    batch.finish(group)
  }

  batch = new SceneryBatch(.32, { indexed: true })
  // A spectrum marquee and six feed pipes crown the launch shaft.
  const lip = track.sample(0)
  const header = canvasTexture(768, 128, c => {
    c.fillStyle = '#131b30'; c.fillRect(0, 0, 768, 128)
    for (const [i, color] of spectrum.entries()) {
      c.fillStyle = color; c.fillRect(16 + 123 * i, 119, 119, 5)
      c.beginPath(); c.moveTo(18 + i * 13, 88); c.lineTo(40 + i * 13, 35)
      c.lineTo(47 + i * 13, 35); c.lineTo(25 + i * 13, 88); c.fill()
    }
    c.fillStyle = '#e0f9ff'; c.font = 'italic 800 76px "Barlow Condensed", Arial, sans-serif'
    c.fillText('SPECTRAL RELAY', 139, 91, 605)
  })
  const headerMat = new THREE.MeshBasicMaterial({ map: header })
  const crown = new THREE.Vector3(lip.x - .38, lip.y + .90, lip.z)
  batch.box(hull, crown, [.68, 1.72, 2 * w + .45])
  const print = new THREE.Mesh(new THREE.PlaneGeometry(2 * w + .22, 1.5), headerMat)
  print.position.copy(crown); print.position.x += .35; print.rotation.y = Math.PI / 2
  group.add(print)
  for (const side of [-1, 1]) {
    const shoulder = at(.2, side * (w + .2), -.22), crown = shoulder.clone().addScaledVector(axisY, 2.57)
    const socket = crown.clone().addScaledVector(axisY, -.62)
    batch.rod(hull, shoulder, socket, .22)
    batch.rod(white, socket, crown, .14)
  }
  const gates = spectralCheckpoints(track.sections)
  const lamps: Material[] = []
  for (const [i, gate] of gates.entries()) {
    const p = track.sample(gate.s), accent = spectralGateColors[i]
    const lamp = glow(accent, .65)
    lamps.push(lamp)
    ribbon(lamp, gate.s - .032, gate.s + .032, -w, w, .031, 16)
    for (const side of [-1, 1]) {
      const foot = at(gate.s, side * (w + .19), -.33), cap = foot.clone().addScaledVector(axisY, 2.7)
      const socket = cap.clone().addScaledVector(axisY, -.99)
      batch.rod(hull, foot, socket, .19, 8)
      batch.rod(lamp, socket, cap, .145, 8)
      for (let bar = 0; bar < 4; bar++) {
        const distance = gate.s - 2.7 + .53 * bar
        ribbon(lamp, distance, distance + .16, side * (w - .26), side * (w - .53 - bar * .18), .027)
      }
    }
    // The timing display stands on the far shoulder of the approaching camera.
    const hub = at(gate.s, -w - .64, 3.4), foot = at(gate.s, -w - .64, -.46)
    batch.rod(nickel, foot, hub.clone().addScaledVector(axisY, -1.39), .16, 8)
    const normal = new THREE.Vector3(-.73 * p.tx + .68 * p.rx, 0, -.73 * p.tz + .68 * p.rz).normalize()
    const face = new THREE.Mesh(new THREE.CircleGeometry(1.42, 64), timingDial(String(i + 1).padStart(2, '0'), accent))
    face.position.copy(hub).addScaledVector(normal, .13)
    face.rotation.y = Math.atan2(normal.x, normal.z)
    group.add(face)
    const rear = face.clone()
    rear.rotation.y += Math.PI
    rear.position.copy(hub).addScaledVector(normal, -.13)
    group.add(rear)
    batch.rod(hull, hub.clone().addScaledVector(normal, -.12), hub.clone().addScaledVector(normal, .12), 1.47, 56)
  }

  const finish = track.finishS
  for (let col = 0; col < 18; col++) for (let row = 0; row < 2; row++) {
    ribbon((row + col) % 2 ? white : black, finish + row * .25, finish + (row + 1) * .25,
      -w + 2 * w * col / 18, -w + 2 * w * (col + 1) / 18, .025)
  }
  for (let i = 0; i < 6; i++) for (const side of [-1, 1]) {
    const p = at(finish + (i - 2.5) * .54, side * (w + .38), -.34)
    const tip = p.clone().addScaledVector(axisY, 2.2 + Math.sin((i + .5) * Math.PI / 6) * 1.5)
    const socket = p.clone().lerp(tip, .48)
    batch.rod(hull, p, socket, .15, 8)
    batch.rod(inks[i], socket, tip, .159, 8)
  }
  const end = track.sample(track.length)
  batch.box(black, at(track.length, 0, .54), [.27, 1.15, 2 * w + .13], -Math.atan2(end.tz, end.tx))

  // The paired induction coils illuminate the side exerting the stronger pull.
  const coils: { s: number; side: number; field: typeof spectralFields[number]; matrix: THREE.Matrix4 }[] = []
  for (const field of spectralFields) {
    for (let s = field.start + .8; s < field.end - .5; s += 3.9) {
      const p = track.sample(s), yaw = -Math.atan2(p.tz, p.tx)
      for (const side of [-1, 1]) {
        const l = side * (w + .31)
        batch.box(hull, at(s, l, .21), [1.15, 1.08, .53], yaw)
        for (const dx of [-.38, .38]) {
          batch.box(nickel, at(s + dx, l, .53), [.13, .82, .58], yaw)
        }
        const matrix = new THREE.Matrix4().makeRotationY(yaw).setPosition(at(s, l, .81))
        coils.push({ s, side, field, matrix })
      }
    }
  }
  const coilLight = new THREE.MeshBasicMaterial({ toneMapped: false })
  const fieldLights = new THREE.InstancedMesh(new THREE.BoxGeometry(.69, .20, .60), coilLight, coils.length)
  coils.forEach((coil, index) => fieldLights.setMatrixAt(index, coil.matrix))
  group.add(fieldLights)
  batch.finish(group)

  for (const object of group.children) {
    if (object instanceof THREE.Mesh && object.material === shield) object.castShadow = false
  }
  const warm = new THREE.Color('#ff5790'), cool = new THREE.Color('#41d9ff'), current = new THREE.Color()
  const setRaceTime = (seconds: number) => {
    turnRotor(seconds)
    for (const [i, { s, side, field }] of coils.entries()) {
      const strength = .10 + .90 * Math.max(0, spectralPolarity(field, s, seconds) * side)
      fieldLights.setColorAt(i, current.copy(side > 0 ? warm : cool).multiplyScalar(strength))
    }
    if (fieldLights.instanceColor) fieldLights.instanceColor.needsUpdate = true
  }
  setRaceTime(0)
  return Object.assign(group, {
    setRaceTime,
    updateStations(states: readonly RaceCheckpoint[] | undefined, seconds: number) {
      for (const [i, lamp] of lamps.entries()) {
        const time = states?.[i]?.arrivals.at(-1)?.time
        lamp.emissiveIntensity = time == null ? .65 : .85 + 2.4 * Math.exp(-4 * Math.max(0, seconds - time))
      }
    },
  })
}
