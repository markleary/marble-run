import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import type { PrismTrack, TrackSample } from './track'

const LANES = ['#e21e46', '#ff9400', '#00a58f', '#075dca']
type Material = THREE.MeshStandardMaterial
type Point = { x: number; y: number; z: number }
const axisY = new THREE.Vector3(0, 1, 0)
const lifted = (p: Point, lift: number) => new THREE.Vector3(p.x, p.y + lift, p.z)

function material(color: THREE.ColorRepresentation, roughness = 0.48, metalness = 0.06) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness, side: THREE.DoubleSide })
}

function canvasTexture(width: number, height: number, paint: (ctx: CanvasRenderingContext2D) => void) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')!
  paint(ctx)
  const map = new THREE.CanvasTexture(canvas)
  map.colorSpace = THREE.SRGBColorSpace
  map.anisotropy = 4
  return map
}

function woodTexture() {
  const map = canvasTexture(512, 256, ctx => {
    let seed = 721
    const noise = () => {
      seed = (Math.imul(1664525, seed) + 1013904223) >>> 0
      return seed / 0x100000000
    }
    ctx.fillStyle = '#dfae71'
    ctx.fillRect(0, 0, 512, 256)
    for (let i = 0; i < 1800; i++) {
      const y = noise() * 260 - 2
      const x = noise() * 512
      const len = 8 + noise() ** 2 * 210
      const wave = noise() * 3 - 1.5
      ctx.strokeStyle = noise() < 0.57 ? 'rgba(86,41,17,.095)' : 'rgba(255,242,193,.21)'
      ctx.lineWidth = 0.35 + noise() * 1.0
      for (const offset of [-512, 0]) {
        ctx.beginPath()
        ctx.moveTo(x + offset, y)
        ctx.bezierCurveTo(x + len * 0.3 + offset, y - wave, x + len * 0.72 + offset, y + wave, x + len + offset, y)
        ctx.stroke()
      }
    }
  })
  map.wrapS = map.wrapT = THREE.RepeatWrapping
  return map
}

function signTexture(label: string, mode: 'start' | 'finish' | 'course') {
  return canvasTexture(1024, 160, ctx => {
    ctx.fillStyle = mode === 'course' ? '#ecdfca' : '#242e30'
    ctx.fillRect(0, 0, 1024, 160)
    if (mode === 'course') {
      const colors = ['#f85060', '#ffb32c', '#20b5a5', '#367ee9']
      ctx.transform(1, 0, -0.28, 1, 0, 0)
      colors.forEach((c, i) => {
        ctx.fillStyle = c
        ctx.fillRect(37 + i * 26, 30, 22, 100)
      })
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.fillStyle = '#202a2c'
      ctx.font = '900 93px Arial, sans-serif'
      ctx.textAlign = 'left'
      ctx.fillText(label, 152, 112, 838)
    } else {
      ctx.fillStyle = '#fff6e7'
      ctx.font = '900 93px Arial, sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(label, 512, 115)
      if (mode === 'finish') {
        for (const startX of [32, 824]) {
          for (let row = 0; row < 3; row++) for (let col = 0; col < 5; col++) {
            if ((row + col) % 2 === 0) ctx.fillRect(startX + 32 * col, 32 + row * 32, 32, 32)
          }
        }
      } else {
        for (const [i, color] of LANES.entries()) {
          ctx.fillStyle = color
          ctx.fillRect(37 + i * 37, 59, 29, 39)
          ctx.fillRect(852 + i * 37, 59, 29, 39)
        }
      }
    }
  })
}

/** Static geometry is merged by finish, so all support hardware shares a few draws. */
class SceneryBatch {
  private readonly buckets = new Map<Material, THREE.BufferGeometry[]>()
  add(mat: Material, geo: THREE.BufferGeometry, matrix?: THREE.Matrix4) {
    if (matrix) geo.applyMatrix4(matrix)
    if (!geo.getAttribute('normal')) geo.computeVertexNormals()
    const normalized = geo.index ? geo.toNonIndexed() : geo
    if (normalized !== geo) geo.dispose()
    let bucket = this.buckets.get(mat)
    if (!bucket) this.buckets.set(mat, bucket = [])
    bucket.push(normalized)
  }
  box(mat: Material, center: THREE.Vector3, size: [number, number, number], rotation = 0) {
    const transform = new THREE.Matrix4().makeRotationY(rotation).setPosition(center)
    this.add(mat, new THREE.BoxGeometry(...size), transform)
  }
  rod(mat: Material, a: THREE.Vector3, b: THREE.Vector3, radius: number, sides = 8) {
    const delta = new THREE.Vector3().subVectors(b, a)
    const geometry = new THREE.CylinderGeometry(radius, radius, delta.length(), sides)
    const midpoint = a.clone().lerp(b, 0.5)
    const rotation = new THREE.Quaternion().setFromUnitVectors(axisY, delta.normalize())
    this.add(mat, geometry, new THREE.Matrix4().compose(midpoint, rotation, new THREE.Vector3(1, 1, 1)))
  }
  surface(mat: Material, start: number, end: number, get: (s: number, t: number) => Point, width: number, bands = 1) {
    const vertices: number[] = [], uvs: number[] = [], indices: number[] = []
    const rows = Math.max(1, Math.ceil((end - start) / .32))
    const columns = bands + 1
    for (let i = 0; i <= rows; i++) {
      const s = start + (end - start) * i / rows
      for (let j = 0; j <= bands; j++) {
        const t = j / bands
        const p = get(s, t)
        vertices.push(p.x, p.y, p.z)
        uvs.push(s / 4, t * width / 1.6)
        if (i === 0 || j === 0) continue
        const a = (i - 1) * columns + j - 1
        indices.push(a, a + 1, a + columns, a + 1, a + columns + 1, a + columns)
      }
    }
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
    geometry.setIndex(indices)
    this.add(mat, geometry)
  }
  strip(mat: Material, start: number, end: number, get: (s: number, side: 0 | 1) => Point, width: number) {
    this.surface(mat, start, end, (s, t) => get(s, t === 0 ? 0 : 1), width)
  }
  finish(group: THREE.Group) {
    for (const [mat, parts] of this.buckets) {
      const merged = mergeGeometries(parts)
      for (const part of parts) part.dispose()
      const mesh = new THREE.Mesh(merged, mat)
      mesh.castShadow = true
      mesh.receiveShadow = true
      group.add(mesh)
    }
  }
}

export function createPrismScenery(track: PrismTrack): THREE.Group {
  const group = new THREE.Group()
  group.name = 'Prism Speedway'
  const batch = new SceneryBatch()
  const gunmetal = material('#333b3c', 0.35, 0.54)
  const rubber = material('#292e2d', 0.66, 0.13)
  const enamel = material('#f0eadd', 0.37, 0.19)
  const steel = material('#9aa5a0', 0.30, 0.67)
  const matteSteel = material('#76817f', 0.48, 0.37)
  const caution = material('#f7ae32', 0.46)
  const bracing = material('#636965', 0.46, 0.42)
  const woodMap = woodTexture()
  const wood = ['#f9e3bd', '#fff0d3', '#f1d1a5', '#ffecd1'].map(tint => {
    const woodMat = material(tint, 0.48)
    woodMat.map = woodMap
    return woodMat
  })
  const ply = material('#e2b989', 0.55)
  const darkPly = material('#9a7352', 0.52)
  const colorLanes = LANES.map(color => material(color, 0.27, 0.12))
  const edgeColors = ['#b93249', '#ca7d16', '#129187', '#2560af'].map(c => material(c))
  const w = track.halfWidth
  const bottom = -0.34
  const sample = (s: number, l: number, dy: number) => lifted(track.sample(s, l), dy)
  const ribbon = (mat: Material, s0: number, s1: number, left: number, right: number, height = 0) =>
    batch.strip(mat, s0, s1, (s, k) => sample(s, k ? right : left, height), right - left)
  const deckEdge = (mat: Material, lateral: number, y0: number, y1: number) =>
    batch.strip(mat, 0, track.length, (s, k) => sample(s, lateral, k ? y1 : y0), Math.abs(y1 - y0))
  const outside = (p: TrackSample, dist: number, up = 0) => new THREE.Vector3(p.x + p.rx * dist, p.y + up, p.z + p.rz * dist)

  // The base of the miniature is rounded ash plywood with a warm factory-bench top.
  const base = new THREE.Mesh(new RoundedBoxGeometry(50.5, 0.86, 35.5, 2, 0.28), ply)
  base.position.set(0.3, bottom - 0.51, 0)
  base.receiveShadow = base.castShadow = true
  group.add(base)
  const tabletop = new THREE.Mesh(new RoundedBoxGeometry(50.42, 0.26, 35.42, 2, 0.11), material('#bdbaae', 0.86))
  tabletop.position.set(0.3, bottom - 0.1, 0)
  tabletop.receiveShadow = true
  group.add(tabletop)
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(2000, 2000), material('#e0dbd2', 0.96))
  floor.rotation.x = -Math.PI / 2
  floor.position.y = bottom - 0.95
  floor.receiveShadow = true
  group.add(floor)

  // The rainbow finishes at the second bank, exposing the shared maple racing deck.
  const timber = track.sections[4].start + 1.8
  for (let lane = 0; lane < 4; lane++) {
    const left = -w + lane * track.laneWidth
    batch.surface(colorLanes[lane], 0, timber, (s, t) =>
      track.sample(s, left + t * track.laneWidth), track.laneWidth, 10)
  }
  for (let plank = 0; plank < 12; plank++) {
    const left = -w + 2 * w * plank / 12
    const right = -w + 2 * w * (plank + 1) / 12
    ribbon(wood[plank % wood.length], timber, track.length, left, right)
    if (plank > 0) ribbon(darkPly, timber, track.length, left - .004, left + .004, .014)
    // Staggered plank ends give the open deck a visible scale at speed.
    for (let s = timber + 2 + (plank % 3) * 2.1; s < track.length - .3; s += 7.8) {
      ribbon(darkPly, s, s + .014, left, right, .016)
    }
  }

  // Three dividing fins taper into the timber during the merge.
  for (let lane = 1; lane <= 3; lane++) {
    const lateral = -w + lane * track.laneWidth
    const until = track.sections[4].end
    for (const dir of [-1, 1]) {
      batch.strip(enamel, 0, until, (s, k) => {
        const factor = track.divider(s)
        return k ? sample(s, lateral + dir * .024 * factor, .205 * factor + .006)
          : sample(s, lateral + dir * .047 * factor, .005)
      }, .2)
    }
    batch.strip(enamel, 0, until, (s, k) => {
      const d = track.divider(s)
      return sample(s, lateral + (k ? .025 : -.025) * d, d * .205 + .007)
    }, .05)
  }
  // Steel sill, layered plywood fascia, low side guard and its dark rolled rim.
  for (const sign of [-1, 1]) {
    const lateral = sign * w
    deckEdge(wood[1], lateral, -.36, .01)
    deckEdge(darkPly, sign * (w + .011), -.315, -.29)
    deckEdge(ply, sign * (w + .014), -.27, -.225)
    deckEdge(gunmetal, sign * (w + .02), -.405, -.34)
    batch.strip(matteSteel, 0, track.length, (s, k) =>
      sample(s, lateral, k ? track.wallHeight(s) - .05 : 0), .7)
    // Slim walls stay light on the inside; hardware adds contrast on the exterior.
    batch.strip(enamel, 0, track.length, (s, k) =>
      sample(s, sign * (w + .045), k ? track.wallHeight(s) - .06 : -.025), .7)
    batch.strip(gunmetal, 0, track.length, (s, k) =>
      sample(s, sign * (w + (k ? .074 : -.034)), track.wallHeight(s) - .047), .11)
    batch.strip(rubber, 0, track.length, (s, k) =>
      sample(s, sign * (w + .072), track.wallHeight(s) - (k ? .045 : .105)), .06)
    for (let s = 0.22; s < track.length; s += 2.8) {
      const p = track.sample(s, lateral)
      const shift = sign * .087
      batch.rod(gunmetal, outside(p, shift, -.23), outside(p, shift, track.wallHeight(s) + .015), .039, 6)
      const hub = outside(p, shift, .21)
      batch.rod(steel, hub, outside(p, shift + sign * .059, .21), .058, 6)
    }
  }
  // Follow the cupped launch across its width, including on the underside.
  for (let lane = 0; lane < 8; lane++) {
    ribbon(wood[1], 0, track.length, -w + lane * w / 4, -w + (lane + 1) * w / 4, -.39)
  }

  // Four lacquered swatches inset into the wood mark the material transition.
  for (let lane = 0; lane < 4; lane++) {
    const center = (lane - 1.5) * track.laneWidth
    ribbon(edgeColors[lane], timber + .035, timber + .20, center - .53, center + .53, .018)
  }

  // Trestles use pairs of steel uprights with footplates, shoulder beams and diagonal stays.
  let stand = 0
  for (let s = 0.58; s < track.length; s += 4.15, stand++) {
    const p = track.sample(s)
    const yaw = -Math.atan2(p.tz, p.tx)
    const foots: THREE.Vector3[] = []
    const tops: THREE.Vector3[] = []
    for (const sign of [-1, 1]) {
      const atTop = track.sample(s, sign * (w - .29))
      const top = lifted(atTop, -.38)
      const foot = outside(atTop, sign * .13)
      foot.y = bottom + .06
      foots.push(foot)
      tops.push(top)
      batch.rod(matteSteel, foot, top, .091, 8)
      batch.rod(gunmetal, top.clone().addScaledVector(axisY, -.36), top.clone().addScaledVector(axisY, .045), .112)
      batch.box(gunmetal, foot, [.65, .105, .57], yaw)
      for (const dx of [-.20, .20]) {
        const bolt = foot.clone().add(new THREE.Vector3(dx * p.tx, .05, dx * p.tz))
        batch.rod(steel, bolt, bolt.clone().addScaledVector(axisY, .04), .05, 6)
      }
    }
    // Across the launch, the outer posts terminate above the center of the cup.
    // Hang the transverse beam below the entire racing deck, then connect its
    // ends to the posts. A single span between the post tops pierced the chute.
    let beamY = Infinity
    for (let j = 0; j <= 16; j++) {
      beamY = Math.min(beamY, track.sample(s, -w + 2 * w * j / 16).y - .60)
    }
    const beamEnds = tops.map(top => new THREE.Vector3(top.x, beamY, top.z))
    batch.rod(gunmetal, beamEnds[0], beamEnds[1], .14)
    batch.rod(steel, foots[0].clone().lerp(tops[0], .21), foots[1].clone().lerp(tops[1], .21), .048)
    if (tops[0].y - bottom > 1.2) {
      const a = stand % 2 ? 1 : 0, b = 1 - a
      batch.rod(bracing, foots[a].clone().lerp(tops[a], .2), tops[b].clone().addScaledVector(axisY, -.22), .048)
    }
  }

  // Red-and-ivory curbs mark outside apexes. Individual painted slats follow the banking.
  for (const [start, end, out] of [
    [track.sections[2].start + 3, track.sections[2].end - 3, -1],
    [track.sections[4].start + 3, track.sections[4].end - 8, 1],
  ]) {
    let count = 0
    for (let s = start; s < end; s += .54, count++) {
      ribbon(count % 2 ? enamel : colorLanes[0], s, Math.min(end, s + .54),
        out * (w - .29), out * (w - .07), .035)
    }
  }

  function signBoard(text: string, type: 'start' | 'finish' | 'course', at: THREE.Vector3, width: number, height: number, normal: THREE.Vector3) {
    const map = signTexture(text, type)
    const signMat = material('#ffffff', .54)
    signMat.map = map
    const yaw = Math.atan2(normal.x, normal.z)
    batch.box(type === 'course' ? darkPly : gunmetal, at, [width + .12, height + .12, .09], yaw)
    // Separate faces keep the lettering legible from both sides of the gantry.
    for (const face of [-1, 1]) {
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(width, height), signMat)
      sign.rotation.y = yaw + (face < 0 ? Math.PI : 0)
      sign.position.copy(at).addScaledVector(normal, .052 * face)
      sign.receiveShadow = true
      group.add(sign)
    }
  }

  for (const [s, isFinish] of [[track.startS + 1.08, false], [track.finishS, true]] as const) {
    const p = track.sample(s)
    const top = p.y + 2.33
    for (const side of [-1, 1]) {
      const base = sample(s, side * (w + .17), -.25)
      const end = base.clone()
      end.y = top + .32
      batch.rod(gunmetal, base, end, .081)
      batch.rod(caution, base.clone().lerp(end, .5), base.clone().lerp(end, .56), .084)
    }
    signBoard(isFinish ? 'FINISH' : 'START', isFinish ? 'finish' : 'start',
      new THREE.Vector3(p.x, top, p.z), 2 * w + .47, .78, new THREE.Vector3(p.tx, 0, p.tz))
    if (isFinish) {
      for (let col = 0; col < 16; col++) for (let row = 0; row < 2; row++) {
        ribbon((col + row) % 2 ? enamel : gunmetal, s + row * .26, s + (row + 1) * .26,
          -w + 2 * w * col / 16, -w + 2 * w * (col + 1) / 16, .017)
      }
    }
  }

  const finishEnd = track.sample(track.length)
  batch.box(rubber, lifted(finishEnd, .56), [.22, 1.18, 2 * w + .2], -Math.atan2(finishEnd.tz, finishEnd.tx))
  // A physical maker's plate sits alongside the final chute.
  const plateS = track.finishS - 9
  const nearPlate = track.sample(plateS, w)
  const plateAt = outside(nearPlate, .14, -.06)
  signBoard('PRISM SPEEDWAY', 'course', plateAt, 4.85, .71, new THREE.Vector3(nearPlate.rx, 0, nearPlate.rz))

  // A bright workshop sits beyond the table. Its tall windows provide scale and a
  // horizon for the tracking cameras while keeping the racing surface uncluttered.
  const plaster = material('#b9b5a8', .96)
  const sill = material('#a9a79c', .80)
  const frame = material('#939b95', .59, .18)
  const landscape = canvasTexture(1536, 384, ctx => {
    const sky = ctx.createLinearGradient(0, 0, 0, 384)
    sky.addColorStop(0, '#84adbf')
    sky.addColorStop(.65, '#d5e1d3')
    sky.addColorStop(1, '#a1b4a0')
    ctx.fillStyle = sky
    ctx.fillRect(0, 0, 1536, 384)
    let state = 98
    const random = () => {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0
      return state / 0x100000000
    }
    ctx.filter = 'blur(4px)'
    for (let layer = 0; layer < 2; layer++) {
      const h = 219 + layer * 76
      ctx.fillStyle = layer ? '#8fa89a' : '#b8c9ba'
      ctx.beginPath()
      ctx.moveTo(-20, 404)
      ctx.lineTo(-20, h)
      for (let x = -20; x < 1600; x += 20) {
        const height = h - 16 * Math.sin(x * .006 + layer) - 8 * Math.sin(x * .019) - random() * 9
        ctx.lineTo(x, height)
      }
      ctx.lineTo(1600, 404)
      ctx.fill()
    }
    // Muted overlapping crowns and branches read as foliage through frosted glass.
    for (let i = 0; i < 84; i++) {
      const x = random() * 1536
      const y = 253 + 52 * Math.sin(x * .009) + random() * 65
      const radius = 5 + random() * 18
      ctx.fillStyle = i % 3 === 0 ? '#8fa391' : '#a2b5a1'
      ctx.beginPath(); ctx.ellipse(x, y, radius, radius * .82, 0, 0, Math.PI * 2); ctx.fill()
      ctx.fillRect(x - 1.2, y + radius / 2, 2.4, 384 - y)
    }
    ctx.filter = 'none'
    ctx.fillStyle = 'rgba(232,235,213,.15)'
    ctx.fillRect(0, 0, 1536, 384)
  })
  const window = material('#d1ded9', .78)
  window.map = window.emissiveMap = landscape
  window.emissive.set('#ffffff')
  window.emissiveIntensity = .19
  const mullion = material('#c5c7b9', .68)
  function workshopWall(x: number, z: number, yaw: number, bays: number) {
    const along = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw))
    const normal = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw))
    const place = (side: number, y: number, depth: number) =>
      new THREE.Vector3(x, y, z).addScaledVector(along, side).addScaledVector(normal, depth)
    const bay = 13.8
    const width = bay * bays
    batch.box(plaster, place(0, 13, -.33), [width, 32, .65], yaw)
    for (let i = 0; i < bays; i++) {
      const at = (i - (bays - 1) / 2) * bay
      const windowWidth = bay - 1.9
      batch.box(sill, place(at, 8.28, .03), [windowWidth + .53, 11.2, .23], yaw)
      const pane = new THREE.PlaneGeometry(windowWidth, 10.76)
      const uv = pane.getAttribute('uv')
      for (let v = 0; v < uv.count; v++) uv.setX(v, ((i % 5) + uv.getX(v)) / 5)
      const planeTransform = new THREE.Matrix4().makeRotationY(yaw).setPosition(place(at, 8.35, .25))
      batch.add(window, pane, planeTransform)
      for (const fraction of [-.5, -.1667, .1667, .5]) {
        batch.box(frame, place(at + fraction * windowWidth, 8.35, .32), [.14, 10.9, .14], yaw)
      }
      for (const y of [2.97, 6.4, 10.3, 13.73]) {
        batch.box(mullion, place(at, y, .34), [windowWidth + .15, .16, .16], yaw)
      }
      batch.box(sill, place(at, 2.72, .39), [windowWidth + .65, .28, .83], yaw)
      batch.box(plaster, place(at - bay * .5, 10, .21), [.52, 23, .72], yaw)
    }
  }
  workshopWall(-1.2, 43, Math.PI, 12)
  workshopWall(-55, -4, Math.PI / 2, 7)

  // A maple shop rule and a hexagonal drafting pencil give the tabletop scale.
  const ruleCenter = new THREE.Vector3(-1.5, bottom + .089, 6.2)
  const ruleYaw = -.14
  const onRule = (x: number, y: number, z: number) =>
    new THREE.Vector3(x * Math.cos(ruleYaw) + z * Math.sin(ruleYaw), y, -x * Math.sin(ruleYaw) + z * Math.cos(ruleYaw)).add(ruleCenter)
  batch.box(wood[2], ruleCenter, [10.35, .105, .88], ruleYaw)
  for (let i = 0; i <= 100; i++) {
    const length = i % 10 === 0 ? .36 : i % 5 === 0 ? .25 : .135
    batch.box(rubber, onRule(-5 + i / 10, .058, .40 - length / 2), [.016, .009, length], ruleYaw)
  }
  const pencilStart = new THREE.Vector3(1.2, bottom + .16, 7.03)
  const pencilEnd = new THREE.Vector3(6.8, bottom + .16, 7.62)
  batch.rod(colorLanes[0], pencilStart, pencilEnd, .125, 6)
  const pencilAxis = pencilEnd.clone().sub(pencilStart).normalize()
  const cone = new THREE.ConeGeometry(.125, .52, 6)
  const coneRotation = new THREE.Quaternion().setFromUnitVectors(axisY, pencilAxis)
  batch.add(ply, cone, new THREE.Matrix4().compose(pencilEnd.clone().addScaledVector(pencilAxis, .26), coneRotation, new THREE.Vector3(1, 1, 1)))
  batch.add(rubber, new THREE.ConeGeometry(.046, .16, 6),
    new THREE.Matrix4().compose(pencilEnd.clone().addScaledVector(pencilAxis, .47), coneRotation, new THREE.Vector3(1, 1, 1)))
  batch.rod(steel, pencilStart, pencilStart.clone().addScaledVector(pencilAxis, .25), .129, 8)

  // Corner screws inset into the baseboard help read the course as a miniature.
  for (const x of [-24, 24.6]) for (const z of [-16.8, 16.8]) {
    const screw = new THREE.Vector3(x, bottom + .035, z)
    batch.rod(matteSteel, screw, screw.clone().addScaledVector(axisY, .029), .135, 12)
    batch.box(gunmetal, screw.clone().addScaledVector(axisY, .032), [.16, .008, .021], .32)
  }

  batch.finish(group)
  return group
}
