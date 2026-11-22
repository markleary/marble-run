import * as THREE from 'three'
import type { CourseTrack } from './courseGeometry'
import type { WireworksTrack } from './courses/wireworks'
import { receivingDeck } from './courses/wireworks'
import design from './courses/wireworks-layout.json'
import { axisY, lifted, material, SceneryBatch, signBoard, woodTexture } from './sceneryKit'

const paint = ['#f25e37', '#f4aa3c', '#276d77', '#468c8c', '#406583', '#b55742']
const sides = [-1, 1] as const

export function createWireworksScenery(course: CourseTrack) {
  const track = course as WireworksTrack
  const group = new THREE.Group()
  const batch = new SceneryBatch()
  const zinc = material('#b5c7c7', .23, .84)
  const blued = material('#263d45', .45, .52)
  const frame = material('#37575b', .54, .44)
  const red = material('#c3462e', .52, .36)
  const gold = material('#d99a37', .44, .42)
  const light = material('#ede5ce', .70, .11)
  const rubber = material('#293333', .78)
  const aqua = material('#559c99', .43, .25)
  const slate = material('#668097', .46, .22)
  const sidewall = material('#557477', .51, .48)
  const oak = material('#f4d7aa', .69)
  oak.map = woodTexture()
  const iron = material('#3b4342', .75, .32)
  const foundation = material('#73827c', .79)
  const apron = material('#9ea7a0', .82)
  const grid = material('#86958d', .82)
  const w = track.halfWidth
  const bed = -.94
  const at = (s: number, l = 0, lift = 0) => lifted(track.sample(s, l), lift)
  const deck = (s: number, col: number, lift = 0) => lifted(track.deckPoint(s, col), lift)
  const rail = (s: number, lane: number, side: -1 | 1, angle: number) => lifted(track.railPoint(s, lane, side, angle), 0)

  // Twelve separate cylindrical running wires. Nothing fills the air underneath
  // a marble between the two contact points.
  for (let lane = 0; lane < track.laneCount; lane++) for (const side of sides) {
    batch.surface(zinc, 0, design.railEnd, (s, t) => rail(s, lane, side, 2 * Math.PI * t), .56, 12)
  }
  // The gallery purlins curl up from below the outer wires. Their colored
  // saddles and brass collars are deliberately below the sphere contact line.
  for (let s = .35, rib = 0; s < receivingDeck; s += 2.35, rib++) {
    const left = at(s, -w, -.31), right = at(s, w, -.31)
    const center = left.clone().lerp(right, .5)
    center.y -= .9
    for (const side of sides) {
      const rim = side < 0 ? left : right
      const elbow = center.clone().lerp(rim, .65)
      const shelf = rim.clone().addScaledVector(axisY, -.48)
      batch.rod(rib % 3 ? frame : red, rim, shelf, .118)
      batch.rod(rib % 3 ? frame : red, shelf, elbow, .118)
      batch.rod(rib % 3 ? frame : red, elbow, center, .118)
    }
    for (let lane = 0; lane < track.laneCount; lane++) {
      const a = rail(s, lane, -1, Math.PI), b = rail(s, lane, 1, Math.PI)
      const mid = a.clone().lerp(b, .5).addScaledVector(axisY, -.19)
      batch.rod(gold, a, mid, .065)
      batch.rod(gold, mid, b, .065)
      const support = mid.clone()
      support.y = center.y + Math.abs((lane - 2.5) / 3) * .42
      batch.rod(frame, mid, support, .065)
    }
  }
  for (const side of sides) {
    for (const level of [-.54, -.87]) {
      batch.surface(frame, 0, receivingDeck, (s, t) => {
        const p = track.sample(s, side * (w - .28))
        const lateral = Math.sin(t * Math.PI * 2) * .085
        return { x: p.x + p.rx * lateral, y: p.y + level + .085 * Math.cos(t * Math.PI * 2), z: p.z + p.rz * lateral }
      }, .5, 8)
    }
  }

  // Each racing deck shares the exact collision cross-sections. Striped
  // outside lips make the two lines easy to identify from the tower camera.
  const { forkStart, forkEnd } = design
  for (const [start, end, finish] of [[receivingDeck, forkStart, oak], [forkStart, forkEnd, aqua], [forkEnd, track.length, aqua]] as const) {
    for (let col = 0; col < 28; col++) {
      const isWall = col === 0 || col === 27
      const mat = isWall ? sidewall : start === forkStart && col >= 11 && col < 17 ? gold
        : start === forkStart && col < 11 ? slate : finish
      batch.strip(mat, start, end, (s, side) => deck(s, col + side), isWall ? .9 : .45)
    }
    for (const side of sides) {
      const col = side < 0 ? 0 : 28
      const skin = (s: number, depth: number, offset = 0) => {
        const p = track.deckPoint(s, col)
        return new THREE.Vector3(p.x + side * offset * p.rx, p.y + depth, p.z + side * offset * p.rz)
      }
      batch.strip(blued, start, end, (s, t) => skin(s, t ? .025 : -.09, t ? .01 : .14), .17)
      batch.strip(frame, start, end, (s, t) => skin(s, t ? -.09 : -1.17, .14), 1.08)
      batch.strip(gold, start, end, (s, t) => skin(s, -.17 - .08 * t, .145), .08)
      batch.strip(blued, start, end, (s, t) => skin(s, -1.17, t ? .14 : -.07), .21)
    }
  }
  for (let s = receivingDeck + .75; s < forkStart; s += .87) {
    batch.strip(iron, s, s + .018, (d, t) => at(d, t ? w - .025 : -w + .025, .009), 2 * w)
  }

  // Painted steel columns and cross-braces support the elevated wire drop and the split.
  for (let s = .5, n = 0; s < track.length; s += 5.1, n++) {
    // Follow both deck undersides at the same physical station. A straight
    // beam between the outer posts would cut through the bank's low inner lip.
    const lift = s < receivingDeck ? -1.04 : -.35
    const beam = s > forkStart && s < forkEnd
      ? [2, 11, 17, 26].map(column => deck(s, column, lift))
      : [at(s, -w + .27, lift), at(s, w - .27, lift)]
    for (let i = 1; i < beam.length; i++) batch.rod(frame, beam[i - 1], beam[i], .145)
    for (const [top, next] of [[beam[0], beam[1]], [beam.at(-1)!, beam.at(-2)!]]) {
      const foot = top.clone(); foot.y = bed
      const boltPlate = foot.clone().addScaledVector(axisY, .07)
      batch.box(blued, boltPlate, [.77, .14, .77])
      batch.rod(n % 3 ? frame : red, boltPlate, top, .14, 8)
      for (const delta of [-.235, .235]) {
        const bolt = boltPlate.clone().add(new THREE.Vector3(delta, .12, delta))
        batch.rod(zinc, bolt, bolt.clone().addScaledVector(axisY, .045), .07, 6)
      }
      if (top.y - bed > 1.5) {
        batch.rod(frame, top.clone().addScaledVector(axisY, -1.3), top.clone().lerp(next, .23), .09)
      }
    }
  }

  // A riveted lifting tower on the central island marks the decision point.
  const towerS = (forkStart + forkEnd) * .5
  const crown = deck(towerS, 14)
  const mastBase = crown.clone().addScaledVector(axisY, .09)
  batch.box(blued, mastBase, [1.95, .20, 2.56])
  const corners = [[-.68, -.91], [.68, -.91], [.68, .91], [-.68, .91]]
  for (let i = 0; i < 4; i++) {
    const [x, z] = corners[i], [nx, nz] = corners[(i + 1) % 4]
    const foot = mastBase.clone().add(new THREE.Vector3(x, .09, z))
    const top = mastBase.clone().add(new THREE.Vector3(x * .76, 2.65, z * .76))
    const nextTop = mastBase.clone().add(new THREE.Vector3(nx * .76, 2.65, nz * .76))
    batch.rod(red, foot, top, .097)
    batch.rod(blued, foot, nextTop, .057)
    batch.rod(red, top, nextTop, .095)
  }
  const spindle = mastBase.clone().addScaledVector(axisY, 2.70)
  // Two cable sheaves share a brass axle. The course can be seen through their spokes.
  for (const offset of [-.47, .47]) {
    const hub = spindle.clone().add(new THREE.Vector3(offset, .20, 0))
    const wheel = new THREE.TorusGeometry(.75, .079, 7, 28)
    batch.add(gold, wheel, new THREE.Matrix4().makeRotationY(Math.PI / 2).setPosition(hub))
    for (let n = 0; n < 6; n++) {
      const spoke = n * Math.PI / 3
      batch.rod(frame, hub, hub.clone().add(new THREE.Vector3(0, Math.cos(spoke) * .74, Math.sin(spoke) * .74)), .054)
    }
  }
  batch.rod(zinc, spindle.clone().add(new THREE.Vector3(-.7, .20, 0)), spindle.clone().add(new THREE.Vector3(.7, .20, 0)), .14)

  for (const [s, label] of [[0, 'START'], [track.finishS, 'FINISH']] as const) {
    const p = track.sample(s)
    const height = Math.max(...sides.map(side => at(s, side * w).y)) + 2.30
    const center = new THREE.Vector3(p.x, height, p.z)
    if (label === 'START') center.addScaledVector(new THREE.Vector3(p.tx, 0, p.tz), -.58)
    for (const side of sides) {
      const top = center.clone().add(new THREE.Vector3(p.rx, 0, p.rz).multiplyScalar(side * (w + .19)))
      const foot = top.clone(); foot.y = at(s, side * w).y - .30
      batch.rod(red, foot, top, .105)
      batch.rod(light, top.clone().addScaledVector(axisY, -.33), top.clone().addScaledVector(axisY, -.23), .112)
    }
    signBoard(group, batch, blued, paint, label, label === 'START' ? 'start' : 'finish', center, 2 * w + .34, .56, new THREE.Vector3(p.tx, 0, p.tz))
  }
  for (let i = 0; i < 16; i++) for (let row = 0; row < 2; row++) {
    const l = -w + (i + .5) * w / 8
    const s = track.finishS + (row - .5) * .21
    batch.strip((row + i) % 2 ? blued : light, s - .105, s + .105, (d, t) => at(d, l + (t - .5) * w / 8, .010), .5)
  }
  for (const side of sides) {
    const s = track.length
    const p = at(s, side * w, .48)
    batch.rod(red, p.clone().addScaledVector(axisY, -.42), p.clone().addScaledVector(axisY, .53), .10)
  }
  const tray = track.sample(track.length)
  batch.box(rubber, at(track.length, 0, .48), [.20, 1.05, w * 2], -Math.atan2(tray.tz, tray.tx))

  // Heavy exhibition plinth, sheet-metal seams and an industrial window wall.
  batch.box(foundation, new THREE.Vector3(-11, bed - .40, 4), [66, .78, 76])
  batch.box(apron, new THREE.Vector3(-11, bed - .035, 4), [65.7, .08, 75.7])
  for (let x = -41; x < 21; x += 5) batch.box(grid, new THREE.Vector3(x, bed + .009, 4), [.016, .008, 75.7])
  for (let z = -32; z < 42; z += 5) batch.box(grid, new THREE.Vector3(-11, bed + .011, z), [65.7, .008, .016])
  batch.box(iron, new THREE.Vector3(0, bed - .93, 0), [260, .20, 220])
  const window = material('#a8c5c5', .52, .12), enamel = material('#85928a', .75, .25)
  batch.box(enamel, new THREE.Vector3(3, 8, -47), [140, 22, .62])
  for (let x = -56; x < 61; x += 10) {
    batch.box(frame, new THREE.Vector3(x, 8, -46.57), [8.8, 7.0, .27])
    batch.box(window, new THREE.Vector3(x, 8, -46.39), [8.5, 6.7, .13])
    for (let i = -1; i <= 1; i++) batch.box(frame, new THREE.Vector3(x + i * 2.15, 8, -46.30), [.11, 6.8, .12])
    batch.box(frame, new THREE.Vector3(x, 8, -46.29), [8.57, .13, .12])
    batch.box(frame, new THREE.Vector3(x - 4.65, 8, -46.32), [.30, 20, .36])
  }

  // The return wall keeps the bench inside the same high-bay workshop in the
  // elevated establishing shot and in the side view looking across the wires.
  const wallX = -54
  batch.box(enamel, new THREE.Vector3(wallX, 8, 3), [.65, 22, 101])
  batch.box(frame, new THREE.Vector3(wallX + .37, .30, 3), [.16, 4.4, 101])
  batch.box(frame, new THREE.Vector3(3, .30, -46.61), [140, 4.4, .16])
  for (let z = -43; z < 50; z += 11) {
    batch.box(frame, new THREE.Vector3(wallX + .4, 8, z), [.30, 20, .35])
    batch.box(frame, new THREE.Vector3(wallX + .40, 10.0, z + 5.5), [.18, 5.0, 9.6])
    batch.box(window, new THREE.Vector3(wallX + .55, 10.0, z + 5.5), [.14, 4.75, 9.35])
    for (const offset of [-2.35, 0, 2.35]) {
      batch.box(frame, new THREE.Vector3(wallX + .65, 10.0, z + 5.5 + offset), [.10, 4.8, .12])
    }
    batch.box(frame, new THREE.Vector3(wallX + .65, 10, z + 5.5), [.10, .12, 9.35])
    batch.box(blued, new THREE.Vector3(wallX + .62, 4.8, z + 5.5), [.23, 1.5, 3.2])
    for (let row = 0; row < 5; row++) {
      batch.box(sidewall, new THREE.Vector3(wallX + .79, 4.30 + row * .23, z + 5.5), [.15, .12, 2.95])
    }
  }
  for (const [height, radius, color] of [[14.0, .13, gold], [14.65, .20, sidewall]] as const) {
    const elbow = new THREE.Vector3(wallX + .96, height, -46.0)
    batch.rod(color, elbow, new THREE.Vector3(66, height, -46.0), radius)
    batch.rod(color, elbow, new THREE.Vector3(wallX + .96, height, 52), radius)
    for (let z = -42; z < 50; z += 8) {
      batch.box(blued, new THREE.Vector3(wallX + .97, height, z), [radius * 2.5, radius * 2.5, .10])
    }
  }

  // Cable bobbins on the shop floor echo the sheaves in the racing exhibit.
  for (const [x, z, scale] of [[-22, -11, 1.0], [-25.2, -10.3, .74], [14, 8, .9], [-23, 2, .84]]) {
    const spool = new THREE.Vector3(x, bed + .14, z)
    const h = 1.55 * scale
    batch.rod(gold, spool, spool.clone().addScaledVector(axisY, .13), 1.46 * scale, 28)
    batch.rod(iron, spool, spool.clone().addScaledVector(axisY, h), 1.13 * scale, 28)
    for (let y = .25; y < h - .05; y += .17) batch.rod(zinc, spool.clone().addScaledVector(axisY, y), spool.clone().addScaledVector(axisY, y + .085), 1.14 * scale, 28)
    batch.rod(gold, spool.clone().addScaledVector(axisY, h), spool.clone().addScaledVector(axisY, h + .13), 1.46 * scale, 28)
    batch.rod(blued, spool.clone().addScaledVector(axisY, h + .13), spool.clone().addScaledVector(axisY, h + .22), .29 * scale, 12)
  }
  batch.finish(group)
  return group
}
