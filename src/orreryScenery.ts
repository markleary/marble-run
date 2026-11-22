import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import type { CourseTrack } from './courseGeometry'
import { bobRadius, bobRestHeight, pendulums, pendulumAngle } from './courses/orrery'
import { jumpShield, orreryDeckSpans, orreryJumps } from './courses/orreryJumps'
import layout from './courses/orrery-layout.json'
import { SceneryBatch, axisY, canvasTexture, lifted, material, signBoard, type Material } from './sceneryKit'

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)
const fullCircle = 2 * Math.PI
const swatches = ['#143858', '#216875', '#2d969d', '#eec979', '#cc8360', '#eba969']

// Each arched pane carries a different engraved sky chart behind the model.
function observatoryWindows(group: THREE.Group) {
  const map = canvasTexture(2048, 512, ctx => {
    let seed = 1209
    const random = () => (seed = Math.imul(1664525, seed) + 1013904223 >>> 0) / 0x100000000
    ctx.fillStyle = '#132335'
    ctx.fillRect(0, 0, 2048, 512)
    for (let pane = 0; pane < 8; pane++) {
      const x = pane * 256
      ctx.save()
      ctx.beginPath()
      ctx.moveTo(x + 13, 490)
      ctx.lineTo(x + 13, 208)
      ctx.bezierCurveTo(x + 13, 110, x + 100, 77, x + 128, 59)
      ctx.bezierCurveTo(x + 156, 77, x + 243, 110, x + 243, 208)
      ctx.lineTo(x + 243, 490)
      ctx.closePath()
      ctx.strokeStyle = '#4e585d'
      ctx.lineWidth = 9
      ctx.stroke()
      ctx.strokeStyle = '#927755'
      ctx.lineWidth = 2
      ctx.stroke()
      ctx.clip()
      const glass = ctx.createLinearGradient(0, 60, 0, 494)
      glass.addColorStop(0, '#172741')
      glass.addColorStop(.55, '#394c63')
      glass.addColorStop(1, '#789298')
      ctx.fillStyle = glass
      ctx.fillRect(x, 56, 256, 445)
      for (let star = 0; star < 110; star++) {
        ctx.fillStyle = star % 6 ? '#92aeb9' : '#e7d598'
        const r = .45 + random() ** 2 * 1.2
        ctx.beginPath()
        ctx.arc(x + random() * 256, 68 + random() * 418, r, 0, fullCircle)
        ctx.fill()
      }
      const stars = Array.from({ length: 7 }, (_, i) => [x + 23 + 34 * i, 175 + random() * 132])
      ctx.beginPath()
      stars.forEach(([sx, sy], i) => i ? ctx.lineTo(sx, sy) : ctx.moveTo(sx, sy))
      ctx.strokeStyle = '#8197a2'
      ctx.lineWidth = 1
      ctx.stroke()
      for (const [sx, sy] of stars) {
        ctx.beginPath()
        ctx.arc(sx, sy, 2.1, 0, fullCircle)
        ctx.fillStyle = '#f0d59c'
        ctx.fill()
      }
      ctx.restore()
    }
  })
  map.wrapS = THREE.RepeatWrapping
  map.repeat.x = 2
  const glass = new THREE.MeshBasicMaterial({ map, side: THREE.BackSide, fog: true })
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(120, 120, 61, 96, 1, true), glass)
  wall.position.y = 26
  group.add(wall)
}

function chartTable(group: THREE.Group, brass: Material, midnight: Material) {
  const atlas = canvasTexture(1536, 1024, ctx => {
    ctx.fillStyle = '#244754'
    ctx.fillRect(0, 0, 1536, 1024)
    // Hand-ruled circular coordinate grids over a fine linen ground.
    for (let y = 0; y < 1024; y += 4) {
      ctx.fillStyle = y % 8 ? '#254956' : '#244653'
      ctx.fillRect(0, y, 1536, 1)
    }
    const circle = (x: number, y: number, r: number) => {
      ctx.beginPath(); ctx.arc(x, y, r, 0, fullCircle); ctx.stroke()
    }
    for (const [x, y, r] of [[680, 500, 420], [1085, 380, 235], [330, 690, 185]]) {
      ctx.strokeStyle = '#43616a'
      ctx.lineWidth = 2
      for (const scale of [.26, .51, .76, .94, 1]) circle(x, y, r * scale)
      for (let n = 0; n < 96; n++) {
        const a = fullCircle * n / 96
        const inner = n % 8 === 0 ? r * .23 : r * (n % 4 ? .975 : .94)
        ctx.beginPath()
        ctx.moveTo(x + Math.cos(a) * inner, y + Math.sin(a) * inner)
        ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r)
        ctx.stroke()
      }
    }
    ctx.strokeStyle = '#b49966'
    ctx.lineWidth = 3
    ctx.strokeRect(22, 22, 1492, 980)
    ctx.lineWidth = 1
    ctx.strokeRect(31, 31, 1474, 962)
    for (let i = 0; i < 112; i++) {
      const x = 55 + ((503 * i) % 1424), y = 55 + ((131 * i + i * i * 17) % 904)
      const r = i % 7 ? 1.6 : 3.1
      ctx.fillStyle = i % 3 ? '#6a8790' : '#baac80'
      ctx.beginPath(); ctx.arc(x, y, r, 0, fullCircle); ctx.fill()
    }
  })
  const tableTop = material('#ffffff', .75)
  tableTop.map = atlas
  const center = v(10.8, -.48, -2.5)
  const table = new THREE.Mesh(new RoundedBoxGeometry(91, .95, 46.5, 2, .27), midnight)
  table.position.copy(center)
  table.receiveShadow = true
  group.add(table)
  const rim = new THREE.Mesh(new RoundedBoxGeometry(91.04, .11, 46.54, 2, .05), brass)
  rim.position.copy(center).y -= .09
  group.add(rim)
  const top = new THREE.Mesh(new THREE.PlaneGeometry(90.55, 46.05), tableTop)
  top.position.copy(center).y = .011
  top.rotation.x = -Math.PI / 2
  top.receiveShadow = true
  group.add(top)
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(1800, 1800), material('#263847', .91))
  floor.position.y = -1.04
  floor.rotation.x = -Math.PI / 2
  floor.receiveShadow = true
  group.add(floor)
}

// Inlaid instrument faces are printed straight onto the banked deck. Subdividing
// the decal in track space keeps its outer ring flush even around the hairpins.
function addDialInlays(group: THREE.Group, track: CourseTrack) {
  const face = canvasTexture(384, 384, ctx => {
    const c = 192
    ctx.translate(c, c)
    ctx.fillStyle = '#254a60'
    ctx.beginPath(); ctx.arc(0, 0, 184, 0, fullCircle); ctx.fill()
    ctx.strokeStyle = '#d2b57a'
    for (const [r, weight] of [[182, 2], [176, 1], [151, 1.5], [51, 1.4], [26, 1]]) {
      ctx.lineWidth = weight
      ctx.beginPath(); ctx.arc(0, 0, r, 0, fullCircle); ctx.stroke()
    }
    for (let n = 0; n < 72; n++) {
      const angle = fullCircle * n / 72
      const length = n % 6 ? n % 3 ? 6 : 11 : 20
      ctx.lineWidth = n % 6 ? 1.5 : 2.6
      ctx.beginPath(); ctx.moveTo(174 * Math.sin(angle), 174 * Math.cos(angle))
      ctx.lineTo((174 - length) * Math.sin(angle), (174 - length) * Math.cos(angle)); ctx.stroke()
    }
    for (let n = 0; n < 8; n++) {
      ctx.save()
      ctx.rotate(fullCircle * n / 8)
      const tip = n % 2 ? 84 : 123
      for (const sign of [-1, 1]) {
        ctx.beginPath()
        ctx.moveTo(0, -tip); ctx.lineTo(sign * 13, -16); ctx.lineTo(0, -3); ctx.closePath()
        ctx.fillStyle = sign < 0 ? '#92bdba' : '#ccac70'; ctx.fill()
      }
      ctx.restore()
    }
    ctx.fillStyle = '#dfc890'
    ctx.beginPath(); ctx.arc(0, 0, 9, 0, fullCircle); ctx.fill()
  })
  const ink = material('#ffffff', .51, .18)
  ink.map = face
  ink.alphaTest = .5
  for (const [s, radius] of [[32.4, 1.65], [55.6, 2.1], [87.1, 1.63], [118.4, 2.05], [151.2, 1.62]]) {
    const patch = new THREE.PlaneGeometry(2, 2, 14, 14)
    const coordinates = patch.getAttribute('position')
    for (let i = 0; i < coordinates.count; i++) {
      const p = track.sample(s + radius * coordinates.getY(i), radius * coordinates.getX(i))
      coordinates.setXYZ(i, p.x, p.y + .021, p.z)
    }
    patch.computeVertexNormals()
    const dial = new THREE.Mesh(patch, ink)
    dial.receiveShadow = true
    group.add(dial)
  }
}

export function createOrreryScenery(track: CourseTrack) {
  const group = new THREE.Group()
  group.name = 'Midnight Orrery'
  const batch = new SceneryBatch()
  const brass = material('#d3a25d', .32, .61)
  const paleGold = material('#f4d494', .32, .48)
  const bronze = material('#9a6249', .38, .44)
  const midnight = material('#152f45', .44, .29)
  const enamel = material('#23515d', .32, .32)
  const cream = material('#f4e6c4', .43, .17)
  const turquoise = material('#50b7b2', .31, .27)
  const rose = material('#c77d68', .37, .28)
  const glass = material('#92b9be', .29, .10)
  glass.transparent = true
  glass.opacity = .19
  glass.depthWrite = false
  const w = track.halfWidth
  const at = (s: number, l: number, dy = 0) => lifted(track.sample(s, l), dy)
  const ribbon = (mat: Material, a: number, b: number, left: number, right: number, lift = .012) =>
    batch.strip(mat, a, b, (s, side) => at(s, side ? right : left, lift), Math.abs(right - left))
  const cylinder = (mat: Material, at: THREE.Vector3, bottom: number, top: number, h: number, sides = 28) => {
    batch.add(mat, new THREE.CylinderGeometry(top, bottom, h, sides), new THREE.Matrix4().makeTranslation(at.x, at.y, at.z))
  }
  const globe = (mat: Material, center: THREE.Vector3, radius: number) =>
    batch.add(mat, new THREE.SphereGeometry(radius, 28, 16), new THREE.Matrix4().makeTranslation(center.x, center.y, center.z))
  const ring = (mat: Material, center: THREE.Vector3, r: number, gauge: number, rx = 0, ry = 0, rz = 0) => {
    const matrix = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx, ry, rz)).setPosition(center)
    batch.add(mat, new THREE.TorusGeometry(r, gauge, 8, 64), matrix)
  }

  chartTable(group, brass, midnight)
  observatoryWindows(group)
  addDialInlays(group, track)

  const bed = ['#427982', '#347583', '#385b83', '#315a68', '#465c85', '#357c80', '#517c87', '#487078']
    .map(color => material(color, .42, .21))
  for (const [index, section] of track.sections.entries()) {
    const launch = index === 0
    for (const span of orreryDeckSpans) {
      const start = Math.max(section.start, span.start), end = Math.min(section.end, span.end)
      if (end <= start) continue
      batch.surface(bed[index], start, end, (s, t) => at(s, -w + 2 * w * t), 2 * w, launch ? 60 : 16)
      // Surveyors' double hairlines and compass graduations run along each edge.
      for (const side of [-1, 1]) {
        ribbon(paleGold, start, end, side * (w - .23), side * (w - .19))
        ribbon(midnight, start, end, side * (w - .31), side * (w - .28))
        for (let s = start + .62, n = 0; s + .07 < end; s += .88, n++) {
          ribbon(n % 5 ? cream : paleGold, s, s + (n % 5 ? .038 : .065), side * (w - .24), side * (w - (n % 5 ? .42 : .69)), .016)
        }
      }
    }
  }
  const launch = track.sections[0]
  const laneColors = [turquoise, paleGold, rose, cream, turquoise, paleGold]
  for (let index = 1; index < track.laneCount; index++) {
    const l = -w + index * track.laneWidth
    for (const sign of [-1, 1]) batch.strip(brass, 0, launch.end + 1, (s, side) => {
      const d = track.divider(s)
      return at(s, l + sign * d * (side ? .018 : .045), .004 + (side ? .205 * d : 0))
    }, .21)
  }
  for (let index = 0; index < track.laneCount; index++) {
    const l = (index + .5) * track.laneWidth - w
    ribbon(laneColors[index], 0, launch.end - 1, l - .045, l + .045, .008)
  }

  for (const { start, end } of orreryDeckSpans) {
    for (const side of [-1, 1]) {
      const outside = side * w
      batch.strip(midnight, start, end, (s, t) => at(s, outside, t ? .12 : -.41), .53)
      batch.strip(brass, start, end, (s, t) => at(s, side * (w + .014), t ? -.29 : -.35), .06)
      batch.strip(glass, start, end, (s, t) => at(s, outside, t ? track.wallHeight(s) : .12), .85)
      batch.strip(brass, start, end, (s, t) => at(s, side * (w + (t ? .055 : -.035)), track.wallHeight(s)), .09)
      for (let s = start + .45; s < end; s += 2.95) {
        batch.rod(enamel, at(s, side * (w + .045), -.08), at(s, side * (w + .045), track.wallHeight(s)), .042, 6)
        batch.rod(brass, at(s, side * (w + .045), -.12), at(s, side * (w + .045), .15), .070, 8)
      }
    }
    batch.surface(midnight, start, end, (s, t) => at(s, -w + t * 2 * w, -.39), 2 * w, 8)
  }
  for (const jump of orreryJumps) {
    for (const side of [-1, 1]) {
      const [lowA, highA, lowB, highB] = jumpShield(track, jump, side).map(p => lifted(p, 0))
      batch.strip(glass, 0, 1, (u, top) => top ? highA.clone().lerp(highB, u) : lowA.clone().lerp(lowB, u), 1)
      batch.rod(brass, highA, highB, .039)
    }
    for (const [s, mat] of [[jump.takeoff, paleGold], [jump.landing, turquoise]] as const) {
      // Exposed copper edges, pale launch lips and turquoise landing plates.
      for (let i = 0; i < 16; i++) {
        batch.rod(bronze, at(s, -w + 2 * w * i / 16, -.20), at(s, -w + 2 * w * (i + 1) / 16, -.20), .19, 8)
      }
      const offset = s === jump.takeoff ? -.16 : .16
      ribbon(mat, Math.min(s, s + offset), Math.max(s, s + offset), -w, w, .025)
      for (const side of [-1, 1]) {
        batch.rod(brass, at(s, side * (w + .035), -.29), at(s, side * (w + .035), track.wallHeight(s)), .071)
      }
    }
    for (const side of [-1, 1]) for (let i = 0; i < 3; i++) {
      const s = jump.takeoff - jump.runUp + .55 + i * .70
      ribbon(paleGold, s, s + .12, side * (w - .38), side * (w - .98 - .24 * i), .027)
    }
  }

  const lowerDeck = track.sections[5]
  // Leave a clear diagonal opening under the clock bridge. Store both corner
  // feet against the lower alignment, not only the center of each trestle.
  for (let s = 1.35, n = 0; s < track.length; s += 5.1, n++) {
    if (orreryJumps.some(jump => s > jump.takeoff - 1 && s < jump.landing + 1)) continue
    const ends = [-1, 1].map(side => at(s, side * (w - .28), -.42))
    const beamY = Math.min(...ends.map(p => p.y)) - .14
    const clear = ends.every(p => {
      if (s > lowerDeck.start) return true
      const lower = track.locate(p.x, p.z, (lowerDeck.start + lowerDeck.end) / 2, track.sample(lowerDeck.start).y)
      return Math.abs(lower.lateral) > w + 1.4 || Math.abs(lower.s - s) < 12 ||
        Math.hypot(track.sample(lower.s).x - p.x, track.sample(lower.s).z - p.z) > w + 1.4
    })
    if (!clear) continue
    batch.rod(enamel, v(ends[0].x, beamY, ends[0].z), v(ends[1].x, beamY, ends[1].z), .17)
    for (const p of ends) {
      cylinder(midnight, v(p.x, .2, p.z), .51, .37, .36, 10)
      cylinder(brass, v(p.x, .44, p.z), .33, .29, .16, 12)
      cylinder(enamel, v(p.x, (beamY + .48) / 2, p.z), .19, .14, beamY - .48, 12)
      cylinder(brass, v(p.x, beamY - .19, p.z), .19, .32, .38, 12)
    }
    if (beamY > 2.5) {
      const foot = ends[n % 2], crown = ends[1 - n % 2]
      batch.rod(enamel, v(foot.x, .62, foot.z), v(crown.x, beamY - .55, crown.z), .069)
      batch.rod(brass, v(ends[0].x, beamY * .30, ends[0].z), v(ends[1].x, beamY * .30, ends[1].z), .049)
    }
  }

  // A brass armillary stands within the first 180-degree turn. Its ecliptic,
  // equator and meridian rings surround a chased sun and two painted planets.
  const orbit = track.sections[2]
  const a = track.sample(orbit.start), r = layout.orbitRadius
  const solar = v(a.x + r * a.rx, track.sample((orbit.start + orbit.end) / 2).y + .45, a.z + r * a.rz)
  cylinder(midnight, v(solar.x, .40, solar.z), 2.86, 2.58, .80)
  cylinder(brass, v(solar.x, .95, solar.z), 2.5, 2.21, .32)
  cylinder(enamel, v(solar.x, (1.12 + solar.y - 4.0) / 2, solar.z), 1.32, .92, solar.y - 5.12)
  cylinder(brass, solar.clone().addScaledVector(axisY, -4.02), 1.4, 1.7, .30)
  for (let i = 0; i < 8; i++) {
    const angle = i * fullCircle / 8
    const x = Math.cos(angle), z = Math.sin(angle)
    batch.rod(brass, v(solar.x + x * 1.27, 1.18, solar.z + z * 1.27), v(solar.x + x * .91, solar.y - 4.2, solar.z + z * .91), .065)
  }
  ring(brass, solar, 3.76, .12, .19, .32)
  ring(paleGold, solar, 3.42, .075, Math.PI / 2, .2, -.3)
  ring(rose, solar, 3.36, .100, .85, -.65, .53)
  ring(brass, solar, 3.18, .065, -.23, 1.20, .16)
  const sun = material('#edab54', .33, .42)
  sun.emissive.set('#e69a39')
  sun.emissiveIntensity = .26
  batch.rod(brass, solar.clone().add(v(0, -3.89, 0)), solar.clone().add(v(0, 3.71, 0)), .075)
  globe(sun, solar, 1.13)
  for (const angle of [.2, .8, 1.4, 2.0]) ring(paleGold, solar, 1.14, .025, .1, angle)
  const planets = new THREE.Group()
  const orbiting = new SceneryBatch()
  const planet = v(2.16, .72, -.66)
  orbiting.rod(brass, v(0, 0, 0), planet, .052)
  orbiting.add(turquoise, new THREE.SphereGeometry(.43, 20, 14), new THREE.Matrix4().makeTranslation(planet.x, planet.y, planet.z))
  orbiting.add(brass, new THREE.TorusGeometry(.71, .047, 7, 40),
    new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(1.15, 0, .13)).setPosition(planet))
  const redPlanet = v(-1.56, -.63, 1.53)
  orbiting.rod(brass, v(0, 0, 0), redPlanet, .043)
  orbiting.add(rose, new THREE.SphereGeometry(.31, 18, 12), new THREE.Matrix4().makeTranslation(redPlanet.x, redPlanet.y, redPlanet.z))
  orbiting.finish(planets)
  planets.position.copy(solar)
  group.add(planets)

  const orbit2 = track.sections[4], m = track.sample(orbit2.start)
  const moon = v(m.x + m.rx * layout.returnRadius, track.sample((orbit2.start + orbit2.end) / 2).y + .23, m.z + m.rz * layout.returnRadius)
  cylinder(midnight, v(moon.x, .28, moon.z), 2.18, 2.01, .56)
  cylinder(brass, v(moon.x, .69, moon.z), 1.86, 1.62, .24)
  cylinder(enamel, v(moon.x, (moon.y - 2.5 + .81) / 2, moon.z), 1.05, .71, moon.y - 3.31)
  cylinder(brass, moon.clone().addScaledVector(axisY, -2.48), 1.29, 1.44, .26)
  ring(brass, moon, 2.43, .14, .10, -.12, .11)
  ring(turquoise, moon, 2.16, .073, 1.28, 0, -.15)
  globe(cream, moon, 1.17)
  // A patinated bronze hemisphere turns the ivory globe into a lunar phase dial.
  const darkHalf = new THREE.SphereGeometry(1.18, 30, 18, -.75, Math.PI)
  batch.add(midnight, darkHalf, new THREE.Matrix4().makeTranslation(moon.x, moon.y, moon.z))
  for (let i = 0; i < 24; i++) {
    const angle = fullCircle * i / 24
    const outer = v(Math.sin(angle), Math.cos(angle), 0)
    batch.rod(paleGold, moon.clone().addScaledVector(outer, 2.40), moon.clone().addScaledVector(outer, i % 3 ? 2.52 : 2.70), .037)
  }

  // Open portal frames hold the clock movements. Narrow shafts leave the field
  // visible through the gateway as the weighted bobs cross the racing line.
  const moving = pendulums.map((spec, index) => {
    const floor = track.sample(spec.s, spec.lateral)
    const y = floor.y + bobRestHeight + spec.length
    const movement = new THREE.Group()
    movement.position.set(floor.x, y, floor.z)
    movement.rotation.x = pendulumAngle(spec, 0)
    const parts = new SceneryBatch()
    parts.rod(brass, v(0, 0, 0), v(0, -spec.length, 0), .047, 12)
    parts.rod(paleGold, v(0, -.36 * spec.length, 0), v(0, -.70 * spec.length, 0), .071, 10)
    parts.add(index % 2 ? rose : paleGold, new THREE.SphereGeometry(bobRadius, 24, 16),
      new THREE.Matrix4().makeTranslation(0, -spec.length, 0))
    parts.add(turquoise, new THREE.TorusGeometry(bobRadius * .97, .031, 6, 32),
      new THREE.Matrix4().makeRotationX(Math.PI / 2).setPosition(0, -spec.length, 0))
    parts.finish(movement)
    group.add(movement)
    const ends = [-1, 1].map(sign => at(spec.s, sign * (w + .24), -.25))
    const tops = ends.map(p => v(p.x, y + .14, p.z))
    for (const [i, p] of ends.entries()) {
      batch.rod(enamel, p, tops[i], .13, 10)
      batch.rod(brass, tops[i].clone().addScaledVector(axisY, -.56), tops[i], .17, 12)
      const crown = tops[i].clone().addScaledVector(axisY, .13)
      globe(paleGold, crown, .17)
    }
    batch.rod(brass, tops[0], tops[1], .105)
    const pivot = v(floor.x, y, floor.z)
    batch.rod(midnight, pivot.clone().add(v(-.19, 0, 0)), pivot.clone().add(v(.19, 0, 0)), .24, 18)
    for (const sign of [-1, 1]) {
      // Clockmaker's beat scale on the deck is aligned with the pendulum's arc.
      for (let mark = 0; mark < 9; mark++) {
        const lateral = spec.lateral + (mark - 4) * .40
        ribbon(mark % 2 ? paleGold : cream, spec.s + .52 * sign - .028, spec.s + .52 * sign + .028,
          lateral - .02, lateral + (mark % 2 ? .13 : .25))
      }
    }
    return movement
  })

  for (const [s, finish] of [[.25, false], [track.finishS, true]] as const) {
    const p = track.sample(s)
    const y = Math.max(at(s, -w).y, at(s, w).y) + 2.1
    for (const sign of [-1, 1]) {
      const base = at(s, sign * (w + .16), -.18)
      const end = v(base.x, y, base.z)
      batch.rod(enamel, base, end, .12, 10)
      globe(paleGold, end.clone().addScaledVector(axisY, .42), .19)
    }
    signBoard(group, batch, brass, swatches, finish ? 'FINISH' : 'START', finish ? 'finish' : 'start',
      v(p.x, y, p.z), 2 * w + .43, .66, v(p.tx, 0, p.tz))
  }
  for (let row = 0; row < 2; row++) for (let col = 0; col < 16; col++) {
    const s = track.finishS + row * .24
    ribbon((row + col) % 2 ? midnight : cream, s, s + .24, -w + 2 * w * col / 16, -w + 2 * w * (col + 1) / 16, .025)
  }
  const end = track.sample(track.length)
  batch.box(midnight, lifted(end, .50), [.19, 1.05, 2 * w + .13], -Math.atan2(end.tz, end.tx))
  batch.finish(group)
  return Object.assign(group, { setRaceTime(time: number) {
    planets.rotation.y = time * .29
    moving.forEach((movement, i) => { movement.rotation.x = pendulumAngle(pendulums[i], time) })
  } })
}
