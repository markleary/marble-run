import * as THREE from 'three'
import type { CourseTrack } from './track'
import { frondCrest, waveCenter } from './courses/tideglass'
import { SceneryBatch, axisY, canvasTexture, lifted, material, signBoard, woodTexture, type Material } from './sceneryKit'
import { createTideglassGardens } from './tideglassGardens'

const gateColors = ['#195c57', '#298c81', '#6ebd9d', '#ecebc5', '#c78964', '#943f3e']

function glassTexture() {
  const texture = canvasTexture(512, 256, ctx => {
    ctx.fillStyle = '#d0e8d9'
    ctx.fillRect(0, 0, 512, 256)
    // Long hairline ripples and wavering highlights inside the kiln glass tile.
    for (let j = 0; j < 30; j++) {
      const y = (j + .5) * 256 / 30
      for (const shift of [-256, 0, 256]) {
        ctx.beginPath()
        for (let x = 0; x <= 512; x += 4) {
          const a = x * Math.PI * 2 / 512
          const line = shift + y + 4 * Math.sin(2 * a + j * .41) + 2 * Math.sin(5 * a - j * .35)
          if (!x) ctx.moveTo(x, line)
          else ctx.lineTo(x, line)
        }
        ctx.strokeStyle = j % 3 === 0 ? 'rgba(255,255,229,.42)' : 'rgba(62,145,137,.22)'
        ctx.lineWidth = j % 3 === 0 ? 1.3 : .8
        ctx.stroke()
      }
    }
  })
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(.44, .46)
  return texture
}

function gaugeFace() {
  return canvasTexture(256, 256, ctx => {
    ctx.fillStyle = '#efe9d0'
    ctx.fillRect(0, 0, 256, 256)
    ctx.translate(128, 128)
    ctx.strokeStyle = '#356257'
    for (let j = 0; j <= 24; j++) {
      const a = .72 * Math.PI + j * 1.55 * Math.PI / 24
      const r = j % 3 ? 92 : 78
      ctx.lineWidth = j % 3 ? 2.5 : 4.5
      ctx.beginPath(); ctx.moveTo(r * Math.cos(a), r * Math.sin(a)); ctx.lineTo(106 * Math.cos(a), 106 * Math.sin(a)); ctx.stroke()
    }
    ctx.fillStyle = '#9b4f43'
    ctx.beginPath(); ctx.moveTo(-7, 5); ctx.lineTo(64, -62); ctx.lineTo(5, 6); ctx.fill()
    ctx.fillStyle = '#386559'
    ctx.beginPath(); ctx.arc(0, 0, 7, 0, Math.PI * 2); ctx.fill()
    ctx.font = 'bold 20px Georgia, serif'; ctx.textAlign = 'center'; ctx.fillText('TIDE', 0, 53)
  })
}

export function createTideglassScenery(track: CourseTrack) {
  const group = new THREE.Group()
  group.name = 'Tideglass Conservatory'
  const batch = new SceneryBatch()
  const glazing = new SceneryBatch()
  const iron = material('#2c5554', .53, .33), copper = material('#bd8059', .34, .53)
  const brass = material('#d8ae72', .35, .44), porcelain = material('#f3e6cd', .44, .10)
  const gasket = material('#2e514d', .78), edge = material('#347d76', .29, .19)
  const greenGlass = material('#61baa0', .24, .12), paleGlass = material('#7bcfc9', .23, .14)
  greenGlass.map = paleGlass.map = glassTexture()
  const guardPane = material('#b0edda', .24, .11)
  guardPane.transparent = true
  guardPane.opacity = .26
  guardPane.depthWrite = false
  guardPane.forceSinglePass = true
  const veins = material('#c5e8cd', .32, .15)
  const timber = material('#e0c599', .57)
  timber.map = woodTexture()
  const seam = material('#9e8772', .65)
  const gauge = material('#fff7de', .42)
  gauge.map = gaugeFace()
  const w = track.halfWidth
  const [gate, , , wave, , sluice, , landing] = track.sections
  const at = (s: number, l: number, up = 0) => lifted(track.sample(s, l), up)
  const outside = (s: number, side: number, distance: number, up: number) => {
    const p = track.sample(s, side * w)
    return new THREE.Vector3(p.x + side * p.rx * distance, p.y + up, p.z + side * p.rz * distance)
  }
  const ribbon = (m: Material, a: number, b: number, left: number, right: number, y: number, n = 1) =>
    batch.surface(m, a, b, (s, t) => at(s, left + (right - left) * t, y), Math.abs(right - left), n)

  createTideglassGardens(batch, group, copper, iron, porcelain)

  for (const [index, section] of track.sections.entries()) {
    const { start, end } = section
    const wood = index === 0 || section === landing
    const molded = section === wave || section === sluice
    const floorBands = section === gate ? 42 : molded ? 28 : 12
    ribbon(wood ? timber : (molded ? paleGlass : greenGlass), start, end, -w, w, 0, floorBands)
    // Return the molded sheet under the channel. The cast sill follows its curvature.
    ribbon(iron, start, end, -w, w, -.29, molded || section === gate ? 14 : 6)
    if (wood) {
      for (let s = start + .8; s < end - .05; s += .9) ribbon(seam, s, s + .023, -w, w, .009, 36)
    } else {
      // Frosted joints divide the panels. Narrow longitudinal fillets connect each stretch of glass.
      for (let s = start + 4.1; s < end - .09; s += 4.3) {
        ribbon(edge, s, s + .039, -w, w, .013, 30)
        ribbon(veins, s + .045, s + .077, -w, w, .014, 30)
      }
    }
    for (const side of [-1, 1]) {
      ribbon(porcelain, start, end, side * (w - .20), side * (w - .095), .012)
      batch.strip(edge, start, end, (s, k) => outside(s, side, 0, k ? .13 : -.28), .41)
      batch.strip(edge, start, end, (s, k) => outside(s, side, .135, k ? .13 : -.29), .42)
      glazing.strip(guardPane, start, end, (s, k) => outside(s, side, .026, k ? track.wallHeight(s) - .025 : .13), .9)
      for (let s = start + .15; s < end; s += 2.85) {
        batch.rod(edge, outside(s, side, .03, .08), outside(s, side, .03, track.wallHeight(s)), .039, 6)
      }
      batch.strip(iron, start, end, (s, k) => outside(s, side, k ? .081 : -.008, track.wallHeight(s) + .006), .089)
      batch.strip(copper, start, end, (s, k) => outside(s, side, .081, k ? track.wallHeight(s) : track.wallHeight(s) - .048), .048)
      batch.strip(brass, start, end, (s, k) => outside(s, side, .138, k ? -.17 : -.22), .05)
    }
  }

  // Fine white and viridian inlays show the actual wandering low line, including its depth.
  for (const [offset, width, finish] of [[-.26, .036, edge], [-.16, .052, veins], [.16, .052, veins], [.26, .036, edge]] as const) {
    batch.surface(finish, wave.start, wave.end, (s, t) => at(s, waveCenter(s) + offset + (t - .5) * width, .018), width)
  }
  // An enamel fern grows along the ridge separating the two final sluices.
  batch.surface(veins, sluice.start - 2, sluice.end + 2, (s, t) => at(s, frondCrest(s) + (t - .5) * .118, .019), .12)
  for (let s = sluice.start + .7; s < sluice.end - 1; s += 2.3) for (const side of [-1, 1]) {
    batch.surface(veins, s, s + 1.95, (d, t) => {
      const u = (d - s) / 1.95
      const stem = frondCrest(d), leaf = (1 - u) * .98
      return at(d, stem + side * (leaf + t * .20 * Math.sin(u * Math.PI)), .018)
    }, .16)
  }

  const gateTrim = [edge, veins, porcelain, copper, brass]
  for (let lane = 1; lane < track.laneCount; lane++) {
    const center = -w + track.laneWidth * lane
    for (const side of [-1, 1]) {
      batch.strip(gateTrim[lane - 1], 0, gate.end, (s, k) => {
        const height = track.divider(s)
        return at(s, center + side * (k ? 0 : .048) * height, k ? .206 * height + .006 : .003)
      }, .21)
    }
  }

  // Copper feed pipes, sleeves and enameled brackets follow both rims of the flume.
  for (const side of [-1, 1]) {
    for (let s = .06, i = 0; s < track.length - .12; s += 1.5, i++) {
      const end = Math.min(s + 1.5, track.length - .07)
      const a = outside(s, side, .30, .06), b = outside(end, side, .30, .06)
      batch.rod(copper, a, b, .109, 8)
      if (i % 2 === 0) {
        batch.rod(brass, a, a.clone().lerp(b, .13), .147, 8)
        batch.rod(iron, outside(s, side, .17, -.20), a, .065, 8)
      }
    }
  }

  // Arched cast-iron trestles and glazed footstones are visible from underneath the wave.
  for (let s = 1.2; s < track.length; s += 5.5) {
    const p = track.sample(s)
    const lowest = Math.min(...Array.from({ length: 21 }, (_, i) => track.sample(s, (i / 10 - 1) * w).y))
    const beamY = lowest - .47
    const top = (l: number, y: number) => new THREE.Vector3(p.x + l * p.rx, y, p.z + l * p.rz)
    batch.rod(iron, top(-w + .25, beamY), top(w - .25, beamY), .14, 8)
    for (const side of [-1, 1]) {
      const l = side * (w - .33)
      const foot = top(l, .03), shoulder = top(l, track.sample(s, l).y - .21)
      batch.rod(iron, foot, shoulder, .135, 8)
      batch.box(porcelain, top(l, .16), [.66, .34, .66])
      batch.box(edge, top(l, .35), [.49, .085, .49])
      batch.rod(copper, top(l, beamY - .26), top(l, beamY + .06), .174, 8)
      if (beamY > 1.85) {
        const arch = (t: number) => top(l * (1 - t * .87), beamY - 1.35 * (1 - t) ** 2)
        for (let j = 0; j < 4; j++) batch.rod(iron, arch(j / 4), arch((j + 1) / 4), .093, 7)
      }
    }
  }

  // Porcelain tide gauges stand just outside the north rim, facing the camera across the gallery.
  for (const [s, side] of [[gate.end + 6, 1], [wave.start + 5, 1], [wave.start + 25, 1], [sluice.start + 8, -1]]) {
    const p = track.sample(s, side * w)
    const faceNormal = new THREE.Vector3(-side * p.rx, 0, -side * p.rz)
    const center = outside(s, side, .69, track.wallHeight(s) + .59)
    const post = outside(s, side, .69, -.17)
    batch.rod(iron, post, center, .098)
    batch.rod(brass, center.clone().addScaledVector(faceNormal, -.17), center, .55, 24)
    const matrix = new THREE.Matrix4().makeRotationY(Math.atan2(faceNormal.x, faceNormal.z)).setPosition(center.clone().addScaledVector(faceNormal, .014))
    batch.add(gauge, new THREE.CircleGeometry(.48, 28), matrix)
    const hub = outside(s - .62, side, .41, .13)
    const normal = faceNormal.clone().negate()
    const wheel = hub.clone().addScaledVector(normal, .23)
    batch.rod(brass, hub, wheel, .085)
    const rotation = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal)
    batch.add(copper, new THREE.TorusGeometry(.28, .052, 6, 16), new THREE.Matrix4().compose(wheel, rotation, new THREE.Vector3(1, 1, 1)))
    for (let i = 0; i < 3; i++) {
      const a = i * Math.PI * 2 / 3
      batch.rod(copper, wheel, wheel.clone().add(new THREE.Vector3(.27 * p.tx * Math.cos(a), .27 * Math.sin(a), .27 * p.tz * Math.cos(a))), .025, 5)
    }
  }

  for (const [s, finish] of [[.15, false], [track.finishS, true]] as const) {
    const p = track.sample(s)
    const crown = Math.max(at(s, -w).y, p.y, at(s, w).y) + (finish ? 3.5 : 2.12)
    const normal = new THREE.Vector3(p.tx, 0, p.tz)
    for (const side of [-1, 1]) {
      const post = outside(s, side, .22, -.28)
      const tip = post.clone(); tip.y = crown + .48
      batch.rod(iron, post, tip, .115, 10)
      batch.rod(brass, tip.clone().addScaledVector(axisY, -.18), tip, .19, 10)
      // Curled spandrels brace the gantry above the racing surface.
      const arc = (t: number) => new THREE.Vector3(tip.x - side * p.rx * 1.1 * t, crown - .46 - .72 * (1 - t) ** 2, tip.z - side * p.rz * 1.1 * t)
      for (let j = 0; j < 4; j++) batch.rod(copper, arc(j / 4), arc((j + 1) / 4), .063)
    }
    signBoard(group, batch, iron, gateColors, finish ? 'FINISH' : 'START', finish ? 'finish' : 'start',
      new THREE.Vector3(p.x, crown, p.z), 2 * w + .59, .77, normal)
    if (finish) for (let col = 0; col < 20; col++) for (let row = 0; row < 2; row++) {
      ribbon((row + col) % 2 ? porcelain : iron, s + row * .23, s + (row + 1) * .23,
        -w + 2 * w * col / 20, -w + 2 * w * (col + 1) / 20, .02)
    }
  }
  // Felt-lined catch tray, bounded by the end stop used by the collision mesh.
  ribbon(gasket, track.finishS + .61, track.length, -w, w, .014, 20)
  for (let i = 1; i < 5; i++) {
    const s = track.finishS + .62 + i * .68
    ribbon(edge, s, s + .042, -w, w, .019, 20)
  }
  const end = track.sample(track.length)
  batch.box(gasket, lifted(end, .56), [.17, 1.13, 2 * w + .2], -Math.atan2(end.tz, end.tx))
  const guards = new THREE.Group()
  glazing.finish(guards)
  for (const guard of guards.children) { guard.castShadow = false; guard.receiveShadow = false }
  group.add(guards)
  batch.finish(group)
  return group
}
