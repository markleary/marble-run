import * as THREE from 'three'
import type { CourseTrack } from './track'
import { canvasTexture, material, SceneryBatch, type Material } from './sceneryKit'
import { workshopSites, winterRandom } from './santaWinter'

const tau = 2 * Math.PI
const pt = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)
const lift = (p: THREE.Vector3, h: number) => pt(p.x, p.y + h, p.z)
const glow = (paint: string, strength: number) => {
  const m = material(paint, 0.29, 0.15)
  m.emissive.set(paint)
  m.emissiveIntensity = strength
  return m
}

export function christmasPaint() {
  return {
    red: material('#b92137', 0.33, 0.21),
    berry: material('#781f34', 0.39, 0.18),
    pine: material('#0e5150', 0.52, 0.09),
    needles: material('#26745e', 0.67),
    spruce: material('#124f46', 0.68),
    dark: material('#24383c', 0.43, 0.25),
    timber: material('#87492d', 0.65),
    biscuit: material('#c08554', 0.59),
    snow: material('#dee9e9', 0.68),
    cream: material('#fff1ce', 0.39, 0.06),
    brass: material('#d9a54a', 0.31, 0.52),
    gold: glow('#ffd379', 0.55),
    lantern: glow('#ffcf79', 1.22),
    scarletLight: glow('#ff5347', 0.79),
    mintLight: glow('#5ee8bd', 0.73),
    pinkLight: glow('#ffa6a0', 0.68),
  }
}
export type ChristmasPaint = ReturnType<typeof christmasPaint>

function ellipsoid(batch: SceneryBatch, m: Material, at: THREE.Vector3, rx: number, ry = rx, rz = rx, segments = 12) {
  const g = new THREE.SphereGeometry(1, segments, Math.max(5, segments / 2))
  g.scale(rx, ry, rz)
  g.translate(at.x, at.y, at.z)
  batch.add(m, g)
}
function cone(batch: SceneryBatch, m: Material, at: THREE.Vector3, bot: number, top: number, h: number, sides = 10) {
  const g = new THREE.CylinderGeometry(top, bot, h, sides)
  g.translate(at.x, at.y + h / 2, at.z)
  batch.add(m, g)
}

export function christmasStar(batch: SceneryBatch, paint: ChristmasPaint, at: THREE.Vector3, radius: number, yaw: number) {
  const edge = Array.from({ length: 10 }, (_, i) => {
    const a = Math.PI / 2 + (i * Math.PI) / 5,
      r = radius * (i % 2 ? 0.43 : 1)
    return pt(r * Math.cos(a), r * Math.sin(a), 0)
  })
  const ridge = new THREE.Matrix4().makeRotationY(yaw).setPosition(at)
  for (const side of [-1, 1])
    for (let i = 0; i < edge.length; i++) {
      const positions = [pt(0, 0, side * radius * 0.25), edge[i], edge[(i + 1) % 10]].flatMap((p) => [p.x, p.y, p.z])
      const geo = new THREE.BufferGeometry()
      geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
      geo.setAttribute('uv', new THREE.Float32BufferAttribute([0.5, 0.5, 0, 0, 1, 0], 2))
      batch.add(i % 2 ? paint.brass : paint.gold, geo, ridge)
    }
}

function gift(
  batch: SceneryBatch,
  p: ChristmasPaint,
  at: THREE.Vector3,
  w: number,
  h: number,
  yaw: number,
  box: Material,
  ribbon: Material,
) {
  const dx = w,
    dz = w * 0.83
  batch.box(box, lift(at, h / 2), [dx, h, dz], yaw)
  batch.box(ribbon, lift(at, h / 2), [dx + 0.018, h + 0.018, dz * 0.18], yaw)
  batch.box(ribbon, lift(at, h / 2 + 0.012), [dx * 0.14, h + 0.027, dz + 0.018], yaw)
  for (const dir of [-1, 1]) {
    const bow = new THREE.TorusGeometry(w * 0.15, w * 0.034, 5, 12)
    bow.scale(1, 0.56, 1)
    bow.rotateZ(dir * 0.4)
    bow.translate(dir * w * 0.116, h + w * 0.112, 0)
    bow.rotateY(yaw)
    bow.translate(at.x, at.y, at.z)
    batch.add(ribbon, bow)
  }
  ellipsoid(batch, ribbon, lift(at, h + w * 0.08), w * 0.075)
}

// Each ring connects to the next one around the full circumference. A final
// single point closes a crown. The untextured faces share vertices around the seam.
function branchSurface(batch: SceneryBatch, mat: Material, rings: THREE.Vector3[][]) {
  const vertices = rings.flat()
  const indices: number[] = []
  let start = 0
  for (let row = 1; row < rings.length; row++) {
    const sides = rings[row - 1].length, next = start + sides
    for (let j = 0; j < sides; j++) {
      const k = (j + 1) % sides
      if (rings[row].length === 1) indices.push(start + j, next, start + k)
      else indices.push(start + j, next + j, start + k, start + k, next + j, next + k)
    }
    start = next
  }
  const geometry = new THREE.BufferGeometry().setFromPoints(vertices)
  geometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(vertices.length * 2), 2))
  geometry.setIndex(indices)
  batch.add(mat, geometry)
}

function spruce(batch: SceneryBatch, p: ChristmasPaint, at: THREE.Vector3, h: number, decorated: boolean, phase: number) {
  const tiers = decorated ? 6 : 4
  batch.rod(p.timber, lift(at, -0.48), lift(at, h * 0.73), h * 0.044, 8)
  // Folded branch tips give the tree a layered, scalloped skirt even in silhouette.
  for (let i = 0; i < tiers; i++) {
    const base = 0.15 + (0.72 * i) / (tiers - 1),
      radius = h * 0.29 * (1 - (i * 0.8) / (tiers - 1))
    const top = Math.min(1, base + (decorated ? 0.3 - (i * 0.14) / (tiers - 1) : 0.34 - 0.035 * i))
    const sides = decorated ? 32 : 16
    const tips: THREE.Vector3[] = [], snowline: THREE.Vector3[] = [], shoulder: THREE.Vector3[] = []
    const shoulderY = h * (top - 0.045) + (decorated ? 0 : 0.03)
    for (let j = 0; j < sides; j++) {
      const a = (tau * j) / sides + phase + i * 0.39
      const point = (r: number, y: number) => pt(at.x + Math.cos(a) * r, at.y + y, at.z + Math.sin(a) * r)
      const r = radius * (j % 2 ? 0.83 : 1)
      const y = h * (base + (j % 2 ? 0.029 : -0.008))
      tips.push(point(r, y))
      if (!decorated) {
        const rise = h * (0.057 + 0.013 * Math.sin(3 * a + i))
        snowline.push(point(r * 0.9, y + Math.min(rise, (shoulderY - y) * 0.85)))
      }
      shoulder.push(point(radius * 0.37 * (decorated ? 1 : 0.9), shoulderY))
    }
    const crown = [lift(at, h * top + (decorated ? 0 : 0.035))]
    const green = i % 2 ? p.needles : p.spruce
    if (decorated) branchSurface(batch, green, [tips, shoulder, crown])
    else {
      // The snow and needles meet on one scalloped edge, even on the tallest trees.
      branchSurface(batch, green, [tips, snowline])
      branchSurface(batch, p.snow, [snowline, shoulder, crown])
    }
    if (decorated && i < tiers - 1) {
      const n = 15 - i * 2
      const bulbs = [p.red, p.gold, p.mintLight, p.pinkLight]
      const onRing = (t: number) => {
        const a = t * tau + i * 0.54,
          r = radius * (0.935 + 0.017 * Math.cos(t * tau * 6))
        return pt(at.x + r * Math.cos(a), at.y + h * (base + 0.022 + 0.022 * Math.cos(t * tau * 5)), at.z + r * Math.sin(a))
      }
      for (let k = 0; k < n * 2; k++) batch.rod(p.brass, onRing(k / (n * 2)), onRing((k + 1) / (n * 2)), h * 0.005, 5)
      for (let k = 0; k < n; k++) {
        const ball = onRing((k + 0.32) / n)
        const r = h * (0.018 + 0.006 * (k % 2))
        batch.rod(p.gold, lift(ball, -0.01), lift(ball, -r * 0.8), h * 0.0035, 5)
        ellipsoid(batch, bulbs[(k + i) % bulbs.length], lift(ball, -r * 1.6), r, r * 1.07, r, 10)
        ellipsoid(batch, p.lantern, onRing((k + 0.76) / n), h * 0.009, h * 0.012, h * 0.009, 8)
      }
    }
  }
  if (decorated) christmasStar(batch, p, lift(at, h * 1.025), h * 0.101, -0.35)
}

function cottage(
  batch: SceneryBatch,
  p: ChristmasPaint,
  at: THREE.Vector3,
  w: number,
  d: number,
  h: number,
  yaw: number,
  facade: Material,
  ground: (x: number, z: number) => number,
) {
  const local = (x: number, y: number, z: number) =>
    pt(at.x + x * Math.cos(yaw) + z * Math.sin(yaw), at.y + y, at.z - x * Math.sin(yaw) + z * Math.cos(yaw))
  const box = (m: Material, x: number, y: number, z: number, size: [number, number, number]) =>
    batch.box(m, local(x, y, z), size, yaw)
  let lowest = at.y
  for (const side of [-1, 1])
    for (const edge of [-0.5, 0, 0.5]) {
      for (const point of [local((side * w) / 2, 0, edge * d), local(edge * w, 0, (side * d) / 2)]) {
        lowest = Math.min(lowest, ground(point.x, point.z))
      }
    }
  const foundationDepth = at.y - lowest + 0.55
  box(p.dark, 0, -0.5 * foundationDepth, 0, [w + 0.14, foundationDepth + 0.16, d + 0.14])
  box(facade, 0, h / 2, 0, [w, h, d])
  const peak = w * 0.45,
    eave = w * 0.55,
    slope = Math.atan2(peak, w / 2)
  const gable = new THREE.Shape()
  gable.moveTo(-w / 2, 0)
  gable.lineTo(w / 2, 0)
  gable.lineTo(0, peak)
  gable.closePath()
  const triangle = new THREE.ExtrudeGeometry(gable, { depth: d, bevelEnabled: false })
  batch.add(facade, triangle, new THREE.Matrix4().makeRotationY(yaw).setPosition(local(0, h, -d / 2)))
  for (const side of [-1, 1]) {
    const roof = (m: Material, dy: number, thick: number) => {
      const g = new THREE.BoxGeometry(eave / Math.cos(slope) + 0.05, thick, d + 0.67)
      g.rotateZ(-side * slope)
      g.rotateY(yaw)
      const pos = local((side * eave) / 2, h + peak - (eave * Math.tan(slope)) / 2 + dy, 0)
      g.translate(pos.x, pos.y, pos.z)
      batch.add(m, g)
    }
    roof(p.berry, 0, 0.24)
    // Snow gathers on the ridge, leaving a band of red roof tiles and icicles above the eaves.
    const snow = new THREE.PlaneGeometry(1, 1, 2, 20)
    const snowPos = snow.getAttribute('position')
    for (let j = 0; j <= 20; j++) {
      const z = (j / 20 - 0.5) * (d + 0.74)
      const reach = eave * (0.78 + 0.09 * Math.sin(z * 2.2 + w) + 0.036 * Math.cos(z * 3.6))
      for (let k = 0; k < 3; k++) {
        const x = k === 0 ? 0 : reach
        const y = h + peak - x * Math.tan(slope) + (k < 2 ? 0.255 : 0.11)
        const point = local(side * x, y, z)
        snowPos.setXYZ(j * 3 + k, point.x, point.y, point.z)
      }
    }
    snow.computeVertexNormals()
    batch.add(p.snow, snow)
    for (const end of [-1, 1]) {
      const z = end * (d / 2 + 0.35)
      for (let n = 0; n <= 5; n++) {
        const x = (side * eave * n) / 5
        ellipsoid(
          batch,
          n % 3 ? p.lantern : p.scarletLight,
          local(x, h + peak - Math.tan(slope) * Math.abs(x) - 0.12, z),
          0.078,
          0.099,
          0.078,
          8,
        )
      }
    }
    box(p.cream, side * (w / 2 - 0.06), h / 2, d / 2 + 0.035, [0.14, h, 0.11])
    box(p.berry, side * (w / 2 + 0.035), h * 0.55, 0, [0.12, h * 0.54, d * 0.69])
    box(p.lantern, side * (w / 2 + 0.11), h * 0.55, 0, [0.06, h * 0.42, d * 0.62])
    for (let n = -1; n <= 1; n++) box(p.dark, side * (w / 2 + 0.152), h * 0.55, n * d * 0.18, [0.05, h * 0.44, 0.08])
  }
  box(p.biscuit, w * 0.28, h + peak * 0.95, -d * 0.23, [0.57, 1.5, 0.72])
  box(p.snow, w * 0.28, h + peak * 0.95 + 0.74, -d * 0.23, [0.72, 0.17, 0.88])
  for (const side of [-1, 1]) {
    const x = side * w * 0.305,
      z = d / 2
    box(p.dark, x, h * 0.54, z + 0.07, [w * 0.24, h * 0.49, 0.14])
    box(p.lantern, x, h * 0.54, z + 0.15, [w * 0.195, h * 0.39, 0.06])
    box(p.cream, x, h * 0.54, z + 0.2, [0.072, h * 0.4, 0.06])
    box(p.cream, x, h * 0.54, z + 0.2, [w * 0.2, 0.07, 0.06])
    box(p.snow, x, h * 0.3, z + 0.2, [w * 0.27, 0.15, 0.3])
  }
  box(p.cream, 0, h * 0.39, d / 2 + 0.039, [w * 0.21, h * 0.81, 0.105])
  box(p.pine, 0, h * 0.37, d / 2 + 0.11, [w * 0.165, h * 0.75, 0.07])
  const wreath = new THREE.TorusGeometry(w * 0.077, w * 0.025, 6, 12)
  wreath.rotateY(yaw)
  batch.add(p.needles, wreath, new THREE.Matrix4().makeTranslation(...local(0, h * 0.53, d / 2 + 0.17).toArray()))
  box(p.red, 0, h * 0.49, d / 2 + 0.19, [w * 0.076, 0.13, 0.07])
  ellipsoid(batch, p.gold, local(0, h + peak * 0.38, d / 2 + 0.12), w * 0.09, w * 0.09, w * 0.045)
  // Snowy lane cameras can see either gable. Give the rear a timber frame and an illuminated loft.
  for (const end of [-1, 1]) {
    const z = end * (d / 2 + 0.1)
    box(p.biscuit, 0, h, z, [w, 0.14, 0.13])
    batch.rod(p.biscuit, local(-w * 0.46, h + 0.14, z), local(0, h + peak * 0.83, z), 0.062, 5)
    batch.rod(p.biscuit, local(w * 0.46, h + 0.14, z), local(0, h + peak * 0.83, z), 0.062, 5)
  }
  const back = -d / 2
  for (const x of [-0.26, 0.26]) {
    box(p.dark, w * x, h * 0.55, back - 0.03, [w * 0.26, h * 0.5, 0.13])
    box(p.lantern, w * x, h * 0.55, back - 0.11, [w * 0.21, h * 0.41, 0.08])
    box(p.cream, w * x, h * 0.55, back - 0.17, [0.065, h * 0.41, 0.04])
    box(p.cream, w * x, h * 0.55, back - 0.17, [w * 0.21, 0.07, 0.04])
  }
  box(p.brass, 0, h + peak * 0.37, back - 0.07, [w * 0.19, peak * 0.37, 0.1])
  box(p.lantern, 0, h + peak * 0.37, back - 0.14, [w * 0.14, peak * 0.28, 0.06])
}

function clockTower(batch: SceneryBatch, p: ChristmasPaint, at: THREE.Vector3) {
  const face = canvasTexture(256, 256, (c) => {
    c.fillStyle = '#173634'
    c.fillRect(0, 0, 256, 256)
    c.translate(128, 128)
    for (const [r, width, color] of [
      [112, 7, '#e9bd70'],
      [97, 2, '#d78f4a'],
      [66, 2, '#5e7662'],
    ] as const) {
      c.beginPath()
      c.arc(0, 0, r, 0, tau)
      c.lineWidth = width
      c.strokeStyle = color
      c.stroke()
    }
    c.fillStyle = '#ffe6ab'
    c.textAlign = 'center'
    c.textBaseline = 'middle'
    c.font = 'bold 23px Georgia,serif'
    for (let i = 1; i <= 12; i++) {
      const a = (tau * i) / 12
      c.fillText(
        ['XII', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'][i % 12],
        81 * Math.sin(a),
        -81 * Math.cos(a),
      )
    }
    c.strokeStyle = '#fff1c6'
    c.lineWidth = 6
    c.lineCap = 'round'
    c.beginPath()
    c.moveTo(-27, -53)
    c.lineTo(0, 0)
    c.lineTo(-15, -79)
    c.stroke()
    c.beginPath()
    c.arc(0, 0, 7, 0, tau)
    c.fill()
  })
  const dial = material('#fff7dd', 0.46)
  dial.map = dial.emissiveMap = face
  dial.emissive.set('#ffffff')
  dial.emissiveIntensity = 0.27
  batch.box(p.berry, lift(at, 0.65), [4.25, 1.5, 4.25])
  batch.box(p.pine, lift(at, 4.05), [3.5, 6.6, 3.5])
  for (const y of [1, 5.75, 8.42]) batch.box(p.brass, lift(at, y), [4.1, 0.27, 4.1])
  for (const x of [-1.63, 1.63])
    for (const z of [-1.63, 1.63]) {
      const foot = pt(at.x + x, at.y + 1.2, at.z + z)
      batch.rod(p.brass, foot, lift(foot, 4.6), 0.1, 8)
    }
  batch.box(p.berry, lift(at, 7.06), [3.9, 2.7, 3.9])
  for (let j = 0; j < 4; j++) {
    const a = (j * Math.PI) / 2,
      normal = pt(Math.sin(a), 0, Math.cos(a))
    const strip = (along: number, y: number, depth: number) =>
      lift(at, y)
        .addScaledVector(normal, depth)
        .add(pt(along * Math.cos(a), 0, -along * Math.sin(a)))
    batch.box(p.brass, strip(0, 3.5, 1.79), [2.62, 3.74, 0.11], a)
    batch.box(p.berry, strip(0, 3.5, 1.86), [2.43, 3.55, 0.09], a)
    batch.box(p.pine, strip(0, 3.5, 1.92), [1.97, 3.14, 0.07], a)
    christmasStar(batch, p, strip(0, 3.52, 2), 0.75, a)
    for (const side of [-1, 1]) {
      batch.rod(p.brass, strip(0, 2, 1.99), strip(side * 0.73, 3.52, 1.99), 0.046, 6)
      batch.rod(p.brass, strip(0, 5, 1.99), strip(side * 0.73, 3.52, 1.99), 0.046, 6)
    }
  }
  for (let j = 0; j < 4; j++) {
    const a = (j * Math.PI) / 2,
      normal = pt(Math.sin(a), 0, Math.cos(a))
    const center = lift(at, 7.08).addScaledVector(normal, 1.98)
    const plane = new THREE.PlaneGeometry(2.4, 2.4)
    plane.rotateY(a)
    plane.translate(center.x, center.y, center.z)
    batch.add(dial, plane)
  }
  cone(batch, p.pine, lift(at, 8.55), 3.02, 0.74, 2.8, 4)
  cone(batch, p.snow, lift(at, 8.87), 2.85, 0.66, 2.6, 4)
  cone(batch, p.brass, lift(at, 11.45), 0.28, 0.09, 1.5, 10)
  christmasStar(batch, p, lift(at, 12.98), 0.76, 0.1)
}

function sleigh(batch: SceneryBatch, p: ChristmasPaint, at: THREE.Vector3) {
  const local = (x: number, y: number, z: number) => pt(at.x + x, at.y + y, at.z + z)
  // The curved back and rolled prow are cut from the same two red lacquered cheeks.
  const sides = new THREE.Shape()
  sides.moveTo(-2.4, 2.5)
  sides.bezierCurveTo(-2.9, 3.6, -2.0, 3.7, -1.6, 2.6)
  sides.bezierCurveTo(-0.9, 1.55, 0.9, 1.25, 1.7, 2.3)
  sides.bezierCurveTo(2.75, 3.5, 3.4, 2.5, 2.43, 1.99)
  sides.bezierCurveTo(2.6, 0.8, 1.68, 0.66, 0.7, 0.65)
  sides.lineTo(-1.72, 0.65)
  sides.closePath()
  for (const side of [-1, 1]) {
    const z = side * 1.08
    const g = new THREE.ExtrudeGeometry(sides, {
      depth: 0.13,
      bevelEnabled: true,
      bevelThickness: 0.04,
      bevelSize: 0.05,
      bevelSegments: 1,
      curveSegments: 8,
    })
    batch.add(p.red, g, new THREE.Matrix4().makeTranslation(at.x, at.y, at.z + z))
    const rim = sides.getPoints(8)
    for (let j = 1; j < rim.length; j++)
      batch.rod(p.brass, local(rim[j - 1].x, rim[j - 1].y, z + 0.07), local(rim[j].x, rim[j].y, z + 0.07), 0.076, 6)
    const runner = new THREE.CatmullRomCurve3([
      local(-2.7, 0.27, z),
      local(-1.8, 0.15, z),
      local(1.0, 0.15, z),
      local(2.7, 0.37, z),
      local(3.0, 1.07, z),
      local(2.72, 1.13, z),
    ])
    batch.add(p.brass, new THREE.TubeGeometry(runner, 18, 0.098, 7, false))
    for (const x of [-1.46, 1.32]) batch.rod(p.brass, local(x, 0.19, z), local(x + 0.28, 0.9, z), 0.089, 8)
  }
  batch.box(p.berry, local(0, 0.89, 0), [4.22, 0.56, 2.13])
  ellipsoid(batch, p.needles, local(-1.75, 2.12, 0), 1.02, 1.09, 0.94)
  ellipsoid(batch, p.red, local(-0.16, 2.03, 0), 0.89, 1.09, 0.81)
  ellipsoid(batch, p.cream, local(-0.12, 2.79, 0), 0.66, 0.72, 0.61)
  ellipsoid(batch, p.biscuit, local(0.04, 3.1, 0), 0.61, 0.56, 0.59)
  ellipsoid(batch, p.cream, local(0.43, 2.84, 0), 0.52, 0.58, 0.51)
  ellipsoid(batch, p.biscuit, local(0.6, 3.12, 0), 0.22, 0.19, 0.21)
  cone(batch, p.cream, local(-0.02, 3.41, 0), 0.66, 0.66, 0.19, 16)
  cone(batch, p.red, local(-0.02, 3.6, 0), 0.64, 0.08, 0.79, 16)
  ellipsoid(batch, p.snow, local(-0.02, 4.4, 0), 0.17)
  for (const side of [-1, 1]) {
    ellipsoid(batch, p.dark, local(0.52, 3.22, side * 0.31), 0.066, 0.073, 0.058)
    batch.rod(p.red, local(0.16, 2.36, side * 0.54), local(0.76, 2.26, side * 0.85), 0.24, 10)
    ellipsoid(batch, p.pine, local(0.83, 2.28, side * 0.87), 0.24)
  }
  const deer = (x: number, z: number) => {
    const a = (dx: number, h: number, dz: number) => local(x + dx, h, z + dz)
    ellipsoid(batch, p.biscuit, a(0, 1.48, 0), 0.86, 0.47, 0.33)
    batch.rod(p.biscuit, a(0.45, 1.48, 0), a(0.81, 2.26, 0), 0.23, 10)
    ellipsoid(batch, p.biscuit, a(0.89, 2.28, 0), 0.4, 0.28, 0.23)
    ellipsoid(batch, p.scarletLight, a(1.24, 2.23, 0), 0.13)
    for (const side of [-1, 1]) {
      for (const hip of [-0.46, 0.44]) {
        batch.rod(p.timber, a(hip, 1.41, side * 0.21), a(hip + 0.12, 0.79, side * 0.25), 0.1, 7)
        batch.rod(p.timber, a(hip + 0.12, 0.79, side * 0.25), a(hip + 0.03, 0.24, side * 0.25), 0.076, 7)
      }
      const base = a(0.72, 2.49, side * 0.14),
        tip = a(0.35, 3.14, side * 0.48)
      batch.rod(p.timber, base, tip, 0.062, 7)
      batch.rod(p.timber, base.clone().lerp(tip, 0.47), a(0.91, 2.99, side * 0.36), 0.049, 6)
      batch.rod(p.timber, tip, a(0.51, 3.36, side * 0.55), 0.045, 6)
      ellipsoid(batch, p.dark, a(1, 2.36, side * 0.204), 0.052)
    }
    const reins = new THREE.CatmullRomCurve3([local(0.81, 2.26, z * 0.5), local(3.03, 1.64, z * 0.62), a(0.63, 1.99, 0)])
    batch.add(p.brass, new THREE.TubeGeometry(reins, 10, 0.035, 5, false))
  }
  deer(5.36, -0.87)
  deer(5.8, 0.94)
}

function toyRailway(batch: SceneryBatch, p: ChristmasPaint, at: THREE.Vector3, group: THREE.Group) {
  const base = lift(at, 0.14),
    r = 7.28
  for (const offset of [-0.27, 0.27]) {
    const rail = new THREE.TorusGeometry(r + offset, 0.041, 5, 96)
    rail.rotateX(Math.PI / 2)
    rail.translate(base.x, base.y, base.z)
    batch.add(p.brass, rail)
  }
  const local = (a: number, h: number) => pt(base.x + r * Math.cos(a), base.y + h, base.z + r * Math.sin(a))
  for (let j = 0; j < 62; j++) {
    const a = (tau * j) / 62
    batch.box(p.timber, local(a, -0.045), [0.83, 0.09, 0.15], -a)
  }
  // Keep the engine and wagons in one rotating assembly. The ties and rails belong to the terrain.
  const cars = new SceneryBatch(0.4, { indexed: true })
  const train = new THREE.Group()
  train.name = 'Christmas tree railway'
  train.position.copy(base)
  group.add(train)
  for (let i = 0; i < 4; i++) {
    const a = -0.59 - i * 0.307,
      yaw = -a + Math.PI / 2
    const point = (along: number, h: number, side = 0) =>
      local(a, h)
        .sub(base)
        .add(pt(-along * Math.sin(a) + side * Math.cos(a), 0, along * Math.cos(a) + side * Math.sin(a)))
    cars.box(p.berry, point(0, 0.34), [1.98, 0.2, 0.83], yaw)
    for (const x of [-0.61, 0.61])
      for (const side of [-1, 1]) {
        const hub = point(x, 0.22, side * 0.32)
        cars.rod(p.brass, hub, point(x, 0.22, side * 0.43), 0.19, 10)
      }
    if (i === 0) {
      cars.rod(p.pine, point(-0.38, 0.66), point(0.9, 0.66), 0.34, 12)
      cars.box(p.red, point(-0.61, 0.83), [0.57, 0.81, 0.76], yaw)
      cars.box(p.dark, point(-0.61, 1.26), [0.77, 0.13, 0.96], yaw)
      cone(cars, p.brass, point(0.57, 0.88), 0.1, 0.17, 0.33, 10)
      ellipsoid(cars, p.lantern, point(0.95, 0.72), 0.12)
    } else {
      for (const side of [-0.45, 0.45])
        gift(cars, p, point(side, 0.45), 0.65, 0.54 + 0.14 * Math.sin(i + side), yaw, i % 2 ? p.pine : p.red, p.brass)
    }
  }
  cars.finish(train)
  return train
}

function postBox(batch: SceneryBatch, p: ChristmasPaint, at: THREE.Vector3, yaw: number) {
  const local = (x: number, y: number, z: number) =>
    pt(at.x + x * Math.cos(yaw) + z * Math.sin(yaw), at.y + y, at.z - x * Math.sin(yaw) + z * Math.cos(yaw))
  batch.box(p.pine, local(0, 0.52, 0), [0.55, 1.7, 0.6], yaw)
  batch.box(p.red, local(0, 1.74, 0), [1.7, 1.03, 2.1], yaw)
  const cap = new THREE.CylinderGeometry(0.85, 0.85, 2.1, 20, 1, false, 0, Math.PI)
  cap.rotateZ(Math.PI / 2)
  cap.rotateY(Math.PI / 2)
  cap.rotateY(yaw)
  batch.add(p.red, cap, new THREE.Matrix4().makeTranslation(...local(0, 2.24, 0).toArray()))
  batch.box(p.brass, local(0, 2.07, 1.08), [1.32, 0.16, 0.07], yaw)
  batch.box(p.dark, local(0, 2.09, 1.124), [0.99, 0.07, 0.03], yaw)
  batch.box(p.cream, local(0, 1.69, 1.085), [0.73, 0.41, 0.035], yaw)
  for (const side of [-1, 1]) batch.rod(p.brass, local(side * 0.36, 1.89, 1.12), local(0, 1.65, 1.12), 0.023, 5)
  batch.rod(p.brass, local(0.9, 1.76, 0), local(0.9, 3.12, 0), 0.048, 8)
  batch.box(p.red, local(0.9, 2.98, 0.23), [0.1, 0.33, 0.52], yaw)
}

export function decorateSantaVillage(
  track: CourseTrack,
  batch: SceneryBatch,
  p: ChristmasPaint,
  ground: (x: number, z: number) => number,
  group: THREE.Group,
) {
  const rng = winterRandom(track.seed)
  const place = (x: number, z: number, h = 0) => pt(x, ground(x, z) + h, z)
  const treeBase = place(24, -13)
  cone(batch, p.berry, lift(treeBase, -1.55), 8.2, 8.2, 1.75, 60)
  cone(batch, p.brass, lift(treeBase, 0.16), 8.24, 8.24, 0.09, 60)
  cone(batch, p.snow, lift(treeBase, 0.24), 8.24, 8.13, 0.11, 60)
  spruce(batch, p, lift(treeBase, 0.35), 16.7, true, 0.43)
  const train = toyRailway(batch, p, lift(treeBase, 0.36), group)
  for (let j = 0; j < 12; j++) {
    const a = (j * tau) / 12,
      r = 4.18 + rng() * 1.15
    const foot = pt(treeBase.x + r * Math.cos(a), treeBase.y + 0.35, treeBase.z + r * Math.sin(a))
    const w = 0.92 + rng() * 0.73
    gift(batch, p, foot, w, 0.77 + rng() * 0.76, rng() * tau, [p.pine, p.red, p.cream][j % 3], j % 3 ? p.brass : p.red)
  }
  const towerBase = place(-26, 15)
  clockTower(batch, p, towerBase)
  for (let j = 0; j < 5; j++) {
    const a = (j * tau) / 5
    gift(
      batch,
      p,
      place(-26 + 3.4 * Math.cos(a), 15 + 3.4 * Math.sin(a)),
      1.22 + 0.5 * rng(),
      1.12,
      a,
      p.red,
      j % 2 ? p.brass : p.cream,
    )
  }
  // The starting village sits upstream so the countdown looks back at the open sleigh shed.
  const santa = place(-34.8, -22.3, 0.1)
  cone(batch, p.snow, lift(santa, -0.53), 4.25, 3.98, 0.57, 32)
  sleigh(batch, p, santa)
  for (let j = 0; j < 5; j++)
    gift(
      batch,
      p,
      place(-35 + j * 0.89, -24.4 + 0.3 * Math.sin(j)),
      0.86 + 0.16 * j,
      0.67 + 0.21 * (j % 3),
      j * 0.52,
      j % 2 ? p.red : p.pine,
      j % 2 ? p.cream : p.brass,
    )
  for (const [i, house] of workshopSites.entries()) {
    const [x, z, w, d, h, yaw] = house
    cottage(batch, p, place(x, z), w, d, h, yaw, [p.red, p.biscuit, p.pine, p.berry][i % 4], ground)
  }
  const last = track.sample(track.finishS)
  const mailAt = place(last.x + last.rx * 7.8, last.z + last.rz * 7.8)
  postBox(batch, p, mailAt, Math.atan2(-last.rx, -last.rz))
  const centerline = []
  for (let s = 0; s < track.length + 1; s += 2) centerline.push(track.sample(s))
  const planted: THREE.Vector3[] = []
  const groves = new Map<number, SceneryBatch>()
  for (let i = 0; i < 340; i++) {
    const x = rng() * 154 - 77,
      z = rng() * 112 - 56
    const h = 3.0 + rng() ** 1.35 * 6.0
    if (centerline.some((c) => Math.hypot(x - c.x, z - c.z) < (h > 6 ? 20 : 14))) continue
    if (Math.hypot(x - 24, z + 13) < 12 || Math.hypot(x + 26, z - 15) < 7 || Math.hypot(x + 33, z + 22) < 10) continue
    if (workshopSites.some(([cx, cz, w]) => Math.hypot(x - cx, z - cz) < w * 0.73 + h * 0.22)) continue
    if (planted.some((c) => Math.hypot(x - c.x, z - c.z) < h * 0.36 + 1.45)) continue
    const foot = place(x, z)
    planted.push(foot)
    // Partition forest meshes so every broadcast shot can cull the groves behind the camera.
    const cell = Math.floor((x + 78) / 39) + 4 * Math.floor((z + 56) / 38)
    let grove = groves.get(cell)
    if (!grove) {
      grove = new SceneryBatch(0.4, { indexed: true })
      groves.set(cell, grove)
    }
    spruce(grove, p, foot, h, false, rng() * tau)
  }
  for (const grove of groves.values()) grove.finish(group)
  return train
}
