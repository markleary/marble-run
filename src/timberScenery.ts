import * as THREE from 'three'
import type { CourseTrack } from './track'
import { SceneryBatch, axisY, canvasTexture, lifted, material, signBoard, woodTexture, type Material } from './sceneryKit'
import layout from './courses/timber-layout.json'

const swatches = ['#183f38', '#2c6653', '#ad8041', '#ddb976', '#895539', '#5a392c']
const point = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)

function turnedEndgrain() {
  return canvasTexture(512, 512, ctx => {
    ctx.fillStyle = '#d6b085'
    ctx.fillRect(0, 0, 512, 512)
    for (let i = 0; i < 48; i++) {
      const r = 12 + i * 7.6
      ctx.strokeStyle = i % 4 ? '#b48d6459' : '#85533070'
      ctx.lineWidth = i % 4 ? 1.1 : 2.1
      ctx.beginPath()
      for (let j = 0; j <= 160; j++) {
        const a = 2 * Math.PI * j / 160
        const radial = r + 2.3 * Math.sin(3 * a + i / 8) + Math.sin(5 * a + i / 5)
        const x = 252 + Math.cos(a) * radial, y = 266 + Math.sin(a) * radial * .96
        if (j === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.closePath()
      ctx.stroke()
    }
  })
}

function addDrum(track: CourseTrack, batch: SceneryBatch, oak: Material, walnut: Material, brass: Material, enamel: Material) {
  const s0 = track.sections[0].end, s1 = track.sections[2].end
  const entry = track.sample(s0)
  const cx = entry.x + entry.rx * layout.drumRadius, cz = entry.z + entry.rz * layout.drumRadius
  const r = layout.drumRadius - track.halfWidth - .37
  const center = (y: number) => point(cx, y, cz)
  const top = track.sample(s0, track.halfWidth).y + .76
  const radiusPoint = (angle: number, radial: number, y: number) => point(cx + Math.cos(angle) * radial, y, cz + Math.sin(angle) * radial)
  const cylinder = (mat: Material, radius: number, y: number, thickness: number) =>
    batch.rod(mat, center(y), center(y + thickness), radius, 72)

  cylinder(walnut, r, .08, top - .08)
  // Individual coopered staves leave a narrow dark seam on the turned wooden drum.
  for (let i = 0; i < 36; i++) {
    const a = i * Math.PI / 18, da = Math.PI / 36 * .97
    const verts: number[] = []
    for (const [angle, y] of [[a - da, .25], [a + da, .25], [a - da, top - .18], [a + da, top - .18]]) {
      verts.push(...radiusPoint(angle, r + .011, y).toArray())
    }
    const face = new THREE.BufferGeometry()
    face.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3))
    face.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 0, .23, 2.6, 0, 2.6, .23], 2))
    face.setIndex([0, 2, 1, 2, 3, 1])
    batch.add(i % 5 === 1 ? walnut : oak, face)
  }
  for (const y of [.2, top * .36, top * .72, top - .35]) {
    cylinder(enamel, r + .065, y, .22)
    cylinder(brass, r + .075, y + .16, .045)
    for (let i = 0; i < 12; i++) {
      const a = i * Math.PI / 6
      batch.rod(brass, radiusPoint(a, r + .06, y + .095), radiusPoint(a, r + .11, y + .095), .047, 8)
    }
  }
  const end = material('#fff8e9', .60); end.map = turnedEndgrain()
  cylinder(end, r + .12, top, .16)
  cylinder(enamel, r * .46, top + .16, .045)
  cylinder(brass, r * .37, top + .20, .04)
  cylinder(walnut, r * .22, top + .237, .05)

  // Cantilevers attach each elevated turn to the drum, leaving the lower racing line open.
  for (let s = s0 + .7; s < s1; s += 3.8) {
    const outer = lifted(track.sample(s, -track.halfWidth + .23), -.45)
    const inner = lifted(track.sample(s, track.halfWidth - .30), -.45)
    const a = Math.atan2(inner.z - cz, inner.x - cx)
    const root = radiusPoint(a, r - .07, Math.min(outer.y, inner.y) - .21)
    const tip = outer.clone(); tip.y = root.y
    batch.rod(walnut, root, tip, .21, 8)
    batch.rod(enamel, root.clone().addScaledVector(axisY, -.93), tip.clone().lerp(root, .34), .10)
    batch.rod(brass, tip, outer, .085)
  }
}

function addBench(batch: SceneryBatch, oak: Material, walnut: Material, brass: Material, green: Material) {
  const bench = material('#9ba18b', .88)
  const apron = material('#886347', .78)
  const iron = material('#494d46', .60, .24)
  const floor = material('#c3b6a1', .91)
  batch.box(floor, point(0, -5.1, 0), [520, .2, 520])
  batch.box(apron, point(7, -.85, 4.3), [75.1, 1.55, 56.6])
  // A sage linoleum worktop, wooden face vise and two rows of bench dogs.
  for (let i = 0; i < 13; i++) {
    batch.box(bench, point(7, -.13, -23.84 + (i + .5) * 4.33), [75, .24, 4.315])
  }
  for (const x of [-28, 42]) for (const z of [-21, 30]) batch.box(apron, point(x, -3.2, z), [2.9, 4.2, 2.9])
  for (let x = -26; x <= 41; x += 3.35) {
    for (const z of [-21.4, 29.75]) {
      batch.rod(walnut, point(x, .001, z), point(x, .012, z), .145, 12)
    }
  }
  batch.box(green, point(7, -.72, 32.9), [7.2, 1.45, 1.2])
  for (const x of [4.3, 9.7]) batch.rod(iron, point(x, -.79, 32.5), point(x, -.79, 34.1), .23)
  batch.rod(brass, point(7, -.79, 32.5), point(7, -.79, 34.6), .32, 14)
  batch.rod(walnut, point(6.52, -1.94, 34.57), point(7.54, .5, 34.57), .13, 12)

  // A brass-and-rosewood try square and low metal block plane sit beside the raceway.
  batch.box(walnut, point(15, .21, -12), [1.05, .40, 5.0], -.15)
  batch.box(brass, point(18.35, .18, -13.46), [7.35, .16, .91], -.15)
  for (let i = 0; i < 26; i++) {
    const x = i * .26
    batch.box(iron, point(15.2 + x, .274, -14.2 + x * .151), [.025, .016, i % 4 ? .19 : .34], -.15)
  }
  batch.box(iron, point(-21, .24, 18), [6.5, .43, 2.3], -.17)
  batch.box(green, point(-21, .63, 18), [5.7, .43, 1.97], -.17)
  batch.box(brass, point(-20.2, .96, 18.14), [1.7, .14, 1.51], -.17)
  batch.rod(oak, point(-23.1, .84, 17.66), point(-23.1, 1.6, 17.66), .46, 16)
  batch.rod(walnut, point(-19.43, .89, 18.25), point(-19.04, 2.05, 18.35), .27, 12)

  // Rolled plane shavings are tapered ribbons with a readable curl in profile.
  for (let i = 0; i < 5; i++) {
    const radius = .3 + i % 3 * .12, z = 14.7 + i % 2 * .85, x = -21 + i * .95
    batch.surface(oak, 0, 14, (distance, t) => {
      const s = distance / 4
      const a = s * (2.8 + i % 2 * .25)
      return point(x + s * .46 + Math.cos(a) * radius, radius + .035 + Math.sin(a) * radius, z + t * .43 + s * .17)
    }, .43)
  }
  // Open shop, soft north windows and framing beyond the edge of the worktop.
  const wall = material('#a19d85', .93)
  const frame = material('#626556', .8)
  const glass = material('#f2f3de', .72)
  const treeline = canvasTexture(1024, 256, ctx => {
    const gradient = ctx.createLinearGradient(0, 0, 0, 256)
    gradient.addColorStop(0, '#91b3bc')
    gradient.addColorStop(.78, '#d7dfd0')
    gradient.addColorStop(1, '#c6cdad')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, 1024, 256)
    for (let band = 0; band < 2; band++) {
      ctx.beginPath()
      ctx.moveTo(0, 256)
      for (let x = 0; x <= 1024; x += 4) {
        const angle = x * Math.PI * 2 / 1024
        const y = 161 + band * 30 - 11 * Math.cos(angle + band) - 8 * Math.cos(5 * angle + band) - 3 * Math.sin(31 * angle)
        ctx.lineTo(x, y)
      }
      ctx.lineTo(1024, 256)
      ctx.closePath()
      ctx.fillStyle = band ? '#869d86' : '#a3b6a0'
      ctx.fill()
    }
  })
  glass.map = glass.emissiveMap = treeline
  glass.emissive.set('#e9ecd8')
  glass.emissiveIntensity = .16
  batch.box(wall, point(4, 26, -47.5), [280, 64, .6])
  for (let i = 0; i < 9; i++) {
    const x = -57 + i * 14
    batch.box(frame, point(x, 9, -47.0), [12, 12, .28])
    const pane = new THREE.PlaneGeometry(11.54, 11.48)
    const uv = pane.getAttribute('uv')
    for (let v = 0; v < uv.count; v++) uv.setX(v, (i % 4 + uv.getX(v)) / 4)
    batch.add(glass, pane, new THREE.Matrix4().makeTranslation(x, 9, -46.75))
    batch.box(frame, point(x, 9, -46.66), [.15, 11.59, .2])
    batch.box(frame, point(x, 8, -46.66), [11.62, .15, .2])
  }
}

export function createTimberScenery(track: CourseTrack): THREE.Group {
  const group = new THREE.Group()
  group.name = 'Timber Corkscrew'
  const batch = new SceneryBatch()
  const grain = woodTexture()
  const timber = (color: string) => { const m = material(color, .48); m.map = grain; return m }
  const maple = [timber('#ffe3af'), timber('#f5cf9e'), timber('#ffe8bb'), timber('#e7c291')]
  const walnut = timber('#aa7855')
  const veneer = material('#edc887', .62)
  const edging = material('#654a36', .67)
  const green = material('#1e463e', .48, .15)
  const brass = material('#c4914c', .37, .54)
  const ivory = material('#f6e4c2', .65)
  const felt = material('#24483b', .97)
  const glazing = material('#b9d7cc', .25, .03)
  glazing.transparent = true
  glazing.opacity = .14
  glazing.depthWrite = false
  glazing.forceSinglePass = true
  const w = track.halfWidth, len = track.length
  const at = (s: number, l: number, h: number) => lifted(track.sample(s, l), h)
  const strip = (mat: Material, s0: number, s1: number, a: number, b: number, h: number) =>
    batch.strip(mat, s0, s1, (s, k) => at(s, k ? b : a, h), Math.abs(b - a))

  addBench(batch, maple[1], walnut, brass, green)
  addDrum(track, batch, maple[0], walnut, brass, green)
  // Glued tapered laminations follow the drum tangents; every plank is a sampled racing surface.
  for (let i = 0; i < 12; i++) {
    const a = -w + 2 * w * i / 12, b = -w + 2 * w * (i + 1) / 12
    batch.surface(maple[i % 4], 0, len, (s, t) => track.sample(s, a + t * (b - a)), b - a, 5)
    if (i) strip(edging, 0, track.finishS, a - .007, a + .007, .012)
    for (let s = 3.2 + (i % 3) * 1.65; s < track.finishS; s += 7.8) strip(edging, s, s + .016, a, b, .014)
    strip(walnut, 0, len, a, b, -.38)
  }
  // The dividers also rise gently across the reeded exit and fade before the timing stripe.
  for (let lane = 1; lane < track.laneCount; lane++) {
    const l = -w + lane * track.laneWidth
    for (const section of [track.sections[0], track.sections[4]]) {
      for (const side of [-1, 1]) batch.strip(veneer, section.start, section.end, (s, k) => {
        const d = track.divider(s)
        return at(s, l + side * (k ? .013 : .045) * d, k ? .205 * d + .002 : .002)
      }, .21)
    }
  }
  for (const side of [-1, 1]) {
    const l = side * w
    // The continuous clear guard spans a bent plywood toe board and brass stanchions.
    // Even a racer pressed against the outside of the helix remains visible through it.
    batch.strip(walnut, 0, len, (s, k) => at(s, l, k ? .12 : -.39), .51)
    for (const h of [-.29, -.18, .018]) {
      batch.strip(veneer, 0, len, (s, k) => at(s, side * (w + .014), h + (k ? .038 : 0)), .038)
    }
    batch.strip(glazing, 0, len, (s, k) => at(s, l, k ? track.wallHeight(s) - .035 : .12), 1)
    batch.strip(green, 0, len, (s, k) => at(s, side * (w + .022), track.wallHeight(s) - (k ? 0 : .048)), .048)
    batch.strip(green, 0, len, (s, k) => at(s, side * (w + (k ? .045 : -.024)), track.wallHeight(s) + .004), .069)
    for (let s = .4; s < len; s += 2.5) {
      const base = at(s, side * (w + .035), -.03)
      const cap = at(s, side * (w + .035), track.wallHeight(s) + .025)
      batch.rod(brass, base, cap, .044, 8)
      batch.rod(green, base, base.clone().addScaledVector(axisY, .19), .074)
    }
  }
  // Cross members under the approach, switchbacks and runout. The helix has its own brackets.
  for (let s = .85; s < len; s += 4.65) {
    if (s > 4 && s < track.sections[2].end + 6.5) continue
    const p = track.sample(s), yaw = -Math.atan2(p.tz, p.tx)
    const a = at(s, -w + .32, -.39), b = at(s, w - .32, -.39), y = Math.min(a.y, b.y) - .15
    const beamA = a.clone(); beamA.y = y
    const beamB = b.clone(); beamB.y = y
    batch.rod(walnut, beamA, beamB, .21, 8)
    for (const end of [a, b]) {
      const foot = end.clone(); foot.y = .04
      batch.box(green, foot, [.75, .12, .69], yaw)
      batch.rod(maple[1], foot, end, .19, 8)
    }
    const foot = beamA.clone(); foot.y = .35 * y
    batch.rod(walnut, foot, beamB, .095)
  }

  strip(felt, track.finishS + .52, len, -w, w, .024)
  for (let row = 0; row < 2; row++) for (let j = 0; j < 18; j++) {
    strip((j + row) % 2 ? green : ivory, track.finishS + row * .25, track.finishS + (row + 1) * .25,
      -w + 2 * w * j / 18, -w + 2 * w * (j + 1) / 18, .027)
  }
  for (const [s, finish] of [[.2, false], [track.finishS, true]] as const) {
    const p = track.sample(s), y = Math.max(at(s, -w, 0).y, at(s, w, 0).y) + 2.12
    for (const side of [-1, 1]) {
      const base = at(s, side * (w + .22), -.20)
      const top = base.clone(); top.y = y
      batch.rod(walnut, base, top, .105)
      batch.rod(brass, top.clone().addScaledVector(axisY, -.32), top, .115)
    }
    signBoard(group, batch, green, swatches, finish ? 'FINISH' : 'START', finish ? 'finish' : 'start', point(p.x, y, p.z), 2 * w + .5, .6, point(p.tx, 0, p.tz))
  }
  const end = track.sample(len)
  batch.box(felt, lifted(end, .53), [.22, 1.04, 2 * w + .15], -Math.atan2(end.tz, end.tx))
  batch.finish(group)
  return group
}
