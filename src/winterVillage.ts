import * as THREE from 'three'
import type { CourseTrack } from './track'
import { SceneryBatch, axisY, canvasTexture, material } from './sceneryKit'

type Ground = (x: number, z: number) => number
const v3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)
const up = (point: THREE.Vector3, y: number) => point.clone().addScaledVector(axisY, y)
function randomSequence(seed: number) {
  let state = seed
  return () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0
    return state / 0x100000000
  }
}

const brookX = (z: number) => 12.4 + 1.5 * Math.sin(z * .18 + .4) + 2.8 * Math.sin(z * .086)
const brookWidth = (z: number) => 1.7 + .38 * Math.sin(z * .31)
const waterLevel = (z: number) => -.60 - .007 * z

export function createSnowTerrain(track: CourseTrack, group: THREE.Group): Ground {
  const start = track.sample(0)
  const ground: Ground = (x, z) => {
    const hill = (start.y - 1.65) * Math.exp(-(((x - start.x) / 16) ** 2 + ((z - start.z) / 15) ** 2))
    const snow = -.06 + hill + .16 * Math.sin(x * .29 + z * .13) + .13 * Math.cos(z * .41 - x * .09)
    const bank = THREE.MathUtils.smoothstep(Math.abs(x - brookX(z)), brookWidth(z) * .66, brookWidth(z) + .72)
    const stream = (1 - bank) * THREE.MathUtils.smoothstep(z, -14, -7)
    return THREE.MathUtils.lerp(snow, waterLevel(z) - .35, stream)
  }
  const mesh = new THREE.PlaneGeometry(170, 166, 156, 152)
  mesh.rotateX(-Math.PI / 2)
  const coords = mesh.getAttribute('position')
  const colors: number[] = []
  const snowColor = new THREE.Color()
  const cool = new THREE.Color('#cedee7'), white = new THREE.Color('#f4f6f8')
  for (let i = 0; i < coords.count; i++) {
    const t = coords.getX(i) / 85, z = coords.getZ(i)
    // Concentrate vertices along the stream, so its curved banks stay smooth up close.
    const x = 12.4 + 85 * (.24 * t + .76 * t ** 3)
    coords.setXYZ(i, x, ground(x, z), z)
    const variation = .48 + .22 * Math.sin(x * .44 + z * .17) + .20 * Math.cos(x * .22 - z * .31)
    snowColor.copy(cool).lerp(white, variation)
    colors.push(snowColor.r, snowColor.g, snowColor.b)
  }
  mesh.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  mesh.computeVertexNormals()
  const surface = new THREE.Mesh(mesh, new THREE.MeshStandardMaterial({ roughness: .87, vertexColors: true }))
  surface.receiveShadow = true
  group.add(surface)

  const water = material('#64aab9', .23, .28)
  const bed = new THREE.PlaneGeometry(1, 1, 1, 150)
  const points = bed.getAttribute('position')
  for (let i = 0; i < points.count; i++) {
    const z = THREE.MathUtils.lerp(-13.5, 83, Math.floor(i / 2) / 150)
    const x = brookX(z) + (i % 2 ? 1 : -1) * (brookWidth(z) + .6)
    points.setXYZ(i, x, waterLevel(z), z)
  }
  bed.computeVertexNormals()
  const river = new THREE.Mesh(bed, water)
  river.receiveShadow = true
  group.add(river)
  addMountains(group, track.seed)
  return ground
}

function addMountains(group: THREE.Group, seed: number) {
  const random = randomSequence(seed ^ 0x6e48)
  const count = 104
  const rings: THREE.Vector3[][] = [[], [], [], []]
  const basis = Array.from({ length: count }, (_, i) => {
    const a = i * Math.PI * 2 / count
    return 5 + 13 * Math.abs(Math.sin(a * 3 + .9)) ** 2 + 12 * Math.abs(Math.sin(a * 8 + 1.4)) ** 6 + random() * 2.5
  })
  for (let i = 0; i < count; i++) {
    const a = i * Math.PI * 2 / count
    const summit = basis[i]
    for (const [j, radius] of [62, 77, 92, 105].entries()) {
      const angle = a + (j === 2 ? .018 : 0)
      const r = radius + (random() - .5) * 5
      const h = j === 0 ? -1.5 : j === 1 ? summit * (.23 + random() * .12) : j === 2 ? summit * (.58 + random() * .14) : summit
      rings[j].push(v3(Math.cos(angle) * r, h, Math.sin(angle) * r))
    }
  }
  const positions: number[] = [], colors: number[] = []
  const color = new THREE.Color()
  const vertex = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, shade: string) => {
    color.set(shade)
    for (const point of [a, b, c]) {
      positions.push(point.x, point.y, point.z)
      colors.push(color.r, color.g, color.b)
    }
  }
  for (let j = 0; j < 3; j++) for (let i = 0; i < count; i++) {
    const k = (i + 1) % count, a = rings[j][i], b = rings[j][k], c = rings[j + 1][i], d = rings[j + 1][k]
    const darker = j === 0 ? '#8ea9b6' : j === 1 ? '#adc3d1' : '#bdceda'
    const lighter = j === 0 ? '#b4c9d1' : j === 1 ? '#d3e0e7' : '#eff4f4'
    // Exposed rock reads as continuous ridges below the snowy upper slopes.
    const lee = rings[3][i].y > rings[3][k].y
    vertex(a, b, c, lee ? darker : lighter)
    vertex(b, d, c, lee ? darker : lighter)
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  geometry.computeVertexNormals()
  group.add(new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: .98 })))
}

export function buildWinterVillage(track: CourseTrack, ground: Ground, batch: SceneryBatch) {
  const random = randomSequence(track.seed)
  const snow = material('#e7eff4', .88)
  const roofSnow = material('#c2d4e0', .85)
  const pine = material('#214c48', .86)
  const needles = material('#35605a', .83)
  const bark = material('#735746', .86)
  const stone = material('#8e9ca3', .86)
  const eaves = material('#354551', .71)
  const wallFinishes = ['#a44c42', '#64919a', '#d8b587', '#c2c3a9', '#8a6c68'].map(c => material(c, .76))
  const trim = material('#ede2c7', .76)
  const shutters = material('#3e5c5e', .75)
  const brass = material('#a98856', .45, .47)
  const glazing = material('#e99d54', .42, .09)
  glazing.emissive.set('#ff9d47')
  glazing.emissiveIntensity = .48

  // Each whorl has drooping branch tips. Wind leaves some tips more exposed than others.
  function spruce(x: number, z: number, h: number) {
    const y = ground(x, z) - .16
    const yaw = random() * Math.PI * 2
    batch.rod(bark, v3(x, y, z), v3(x, y + h * .77, z), h * .045, 7)
    for (let i = 0; i < 4; i++) {
      const scale = 1 - i * .19, baseY = y + h * (.17 + .175 * i)
      const radius = h * .29 * scale, height = h * (.41 - .043 * i)
      const ring: THREE.Vector3[] = [], snowline: THREE.Vector3[] = []
      const tip = v3(x + radius * .06, baseY + height, z - radius * .05)
      for (let n = 0; n < 16; n++) {
        const angle = yaw + i * .5 + n * Math.PI / 8
        const branch = n % 2 === 0
        const reach = radius * (branch ? .92 + random() * .15 : .59 + random() * .10)
        const point = v3(x + reach * Math.cos(angle), baseY + height * (branch ? -.08 * random() : .18), z + reach * Math.sin(angle))
        ring.push(point)
        const cover = .72 + .16 * Math.cos(angle + .7) + random() * .1
        snowline.push(tip.clone().lerp(point, cover).addScaledVector(axisY, height * .045))
      }
      function crown(mat: THREE.MeshStandardMaterial, top: THREE.Vector3, edge: THREE.Vector3[]) {
        const vertices: number[] = []
        for (let n = 0; n < edge.length; n++) {
          for (const p of [top, edge[(n + 1) % edge.length], edge[n]]) vertices.push(p.x, p.y, p.z)
        }
        const geo = new THREE.BufferGeometry()
        geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
        geo.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(vertices.length * 2 / 3), 2))
        batch.add(mat, geo)
      }
      crown(i % 2 ? pine : needles, tip, ring)
      crown(snow, up(tip, height * .05), snowline)
    }
  }

  function house(x: number, z: number, width: number, depth: number, height: number, yaw: number, color: number) {
    const y = ground(x, z) - .12, cos = Math.cos(yaw), sin = Math.sin(yaw)
    const point = (a: number, lift: number, b: number) => v3(x + a * cos + b * sin, y + lift, z - a * sin + b * cos)
    function box(mat: THREE.MeshStandardMaterial, a: number, lift: number, b: number, dims: [number, number, number]) {
      batch.box(mat, point(a, lift, b), dims, yaw)
    }
    const facade = wallFinishes[color % wallFinishes.length]
    box(stone, 0, .12, 0, [width + .14, .60, depth + .14])
    box(facade, 0, height / 2 + .22, 0, [width, height, depth])
    const ridge = width * .48
    const gable = new THREE.Shape()
    gable.moveTo(-width / 2, 0); gable.lineTo(width / 2, 0); gable.lineTo(0, ridge); gable.closePath()
    batch.add(facade, new THREE.ExtrudeGeometry(gable, { depth, bevelEnabled: false }),
      new THREE.Matrix4().makeRotationY(yaw).setPosition(point(0, height + .22, -depth / 2)))
    const slope = Math.atan2(ridge, width / 2), reach = width / 2 + .36
    for (const side of [-1, 1]) {
      const turn = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw, -side * slope, 'YXZ'))
      const roof = (lift: number) => new THREE.Matrix4().compose(
        point(side * reach / 2, height + .22 + ridge - reach * .5 * Math.tan(slope) + lift, 0), turn, v3(1, 1, 1))
      batch.add(eaves, new THREE.BoxGeometry(reach / Math.cos(slope) + .12, .20, depth + .72), roof(0))
      batch.add(roofSnow, new THREE.BoxGeometry(reach / Math.cos(slope) + .16, .14, depth + .78), roof(.15))
    }
    const front = depth * .5 + .025
    function window(a: number, lift: number, rx: number, ry: number) {
      box(shutters, a, lift, front, [rx + .28, ry + .13, .13])
      box(glazing, a, lift, front + .078, [rx, ry, .042])
      box(trim, a, lift, front + .105, [.045, ry + .06, .04])
      box(trim, a, lift, front + .105, [rx + .06, .045, .04])
      box(snow, a, lift - ry * .5 - .055, front + .10, [rx + .29, .095, .25])
    }
    for (const side of [-1, 1]) {
      window(side * width * .30, height * .57, width * .17, height * .33)
      box(trim, side * (width * .5 - .085), height * .5 + .22, front, [.13, height, .095])
      // Windows on the flank give angled street views a lit interior as well.
      box(eaves, side * (width * .5 + .025), height * .57, 0, [.08, height * .33 + .12, depth * .43])
      box(glazing, side * (width * .5 + .079), height * .57, 0, [.04, height * .33, depth * .38])
      box(trim, side * (width * .5 + .10), height * .57, 0, [.04, height * .33, .055])
    }
    box(eaves, 0, height * .3, front + .04, [width * .19, height * .60, .11])
    box(glazing, 0, height * .44, front + .11, [width * .095, height * .17, .035])
    window(0, height + ridge * .37, width * .14, ridge * .31)
    const chimneyX = width * .28, chimneyY = height + ridge * .75 + .38
    box(stone, chimneyX, chimneyY, -depth * .24, [.42, 1.34, .48])
    box(eaves, chimneyX, chimneyY + .64, -depth * .24, [.53, .12, .58])
    box(snow, chimneyX, chimneyY + .73, -depth * .24, [.55, .09, .60])
  }

  const squareX = -1.5, squareZ = 3.8, squareFloor = ground(squareX, squareZ) + .20
  batch.box(stone, v3(squareX, squareFloor, squareZ), [18, .32, 8.1])
  for (const [x, z, width, depth, height, yaw, tint] of [
    [-9, -.2, 3.55, 3.55, 2.3, .12, 0], [-4.2, -.65, 4.4, 3.8, 3.35, .03, 1],
    [1.65, -.85, 4.3, 3.5, 2.65, -.09, 2], [-11.7, 5.05, 3.3, 3.65, 2.4, Math.PI * .46, 4],
    [-29.3, -7.2, 4.4, 3.8, 3.25, .7, 2], [-23.8, -4.3, 3.7, 3.35, 2.6, .9, 1],
    [-35.3, -13, 4.2, 3.85, 2.6, .72, 0], [-23, 10.4, 4.6, 4.0, 2.7, -1.1, 3],
    [8.8, -30, 4.4, 3.5, 2.7, .20, 0], [15.6, -30.2, 4.2, 4.0, 3.0, -.15, 2],
    [23.7, -32.0, 5.0, 4.0, 3.5, -.45, 1],
  ]) house(x, z, width, depth, height, yaw, tint)

  // Clock tower at the head of the square, visible from the ice and the bridge.
  const tower = v3(7.4, ground(7.4, .30), .30)
  const towerBox = (mat: THREE.MeshStandardMaterial, y: number, dims: [number, number, number]) => batch.box(mat, up(tower, y), dims)
  towerBox(stone, .32, [2.9, .8, 2.9])
  towerBox(wallFinishes[3], 2.5, [2.4, 4.7, 2.4])
  towerBox(eaves, 4.8, [2.72, .26, 2.72])
  towerBox(wallFinishes[3], 5.42, [2.34, 1.25, 2.34])
  const dial = material('#fff7dc', .45)
  dial.map = canvasTexture(128, 128, ctx => {
    ctx.fillStyle = '#283f49'; ctx.fillRect(0, 0, 128, 128)
    ctx.fillStyle = '#f1e3ba'; ctx.beginPath(); ctx.arc(64, 64, 57, 0, Math.PI * 2); ctx.fill()
    ctx.translate(64, 64); ctx.strokeStyle = '#32434a'; ctx.lineCap = 'round'
    for (let i = 0; i < 12; i++) {
      ctx.rotate(Math.PI / 6); ctx.lineWidth = i % 3 ? 2.5 : 5
      ctx.beginPath(); ctx.moveTo(0, -46); ctx.lineTo(0, -39); ctx.stroke()
    }
    ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(-18, -15); ctx.lineTo(0, 0); ctx.lineTo(25, -20); ctx.stroke()
  })
  for (const angle of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
    const at = v3(tower.x + 1.177 * Math.sin(angle), tower.y + 5.44, tower.z + 1.177 * Math.cos(angle))
    batch.add(dial, new THREE.PlaneGeometry(1.05, 1.05), new THREE.Matrix4().makeRotationY(angle).setPosition(at))
  }
  towerBox(eaves, 6.07, [2.67, .19, 2.67])
  const spireRoof = (mat: THREE.MeshStandardMaterial, base: number, h: number, radius: number) =>
    batch.add(mat, new THREE.ConeGeometry(radius, h, 4), new THREE.Matrix4().makeRotationY(Math.PI / 4).setPosition(up(tower, base + h / 2)))
  spireRoof(eaves, 6.13, 2.7, 2.07); spireRoof(snow, 6.32, 2.55, 1.99)
  batch.rod(brass, up(tower, 8.68), up(tower, 9.12), .06)
  batch.add(brass, new THREE.SphereGeometry(.14, 9, 6), new THREE.Matrix4().makeTranslation(tower.x, tower.y + 9.14, tower.z))

  // A few benches, brass lanterns and a village spruce complete the market square.
  for (const x of [-7.5, -.5]) {
    const y = squareFloor + .18, z = squareZ + 2.42
    batch.box(bark, v3(x, y + .63, z), [2.0, .17, .48])
    batch.box(bark, v3(x, y + .93, z + .22), [2.0, .43, .13])
    for (const dx of [-.70, .70]) batch.box(eaves, v3(x + dx, y + .31, z), [.13, .65, .34])
  }
  for (const [x, z] of [[-9.4, 2.6], [5.6, 5.8], [-4.8, 7.2], [-27, -6]]) {
    const p = v3(x, Math.max(ground(x, z), (x > -12 && x < 7) ? squareFloor : -.5), z)
    batch.rod(eaves, p, up(p, 2.15), .067)
    batch.box(brass, up(p, 2.16), [.37, .10, .37])
    batch.box(glazing, up(p, 2.41), [.28, .45, .28])
    batch.add(eaves, new THREE.ConeGeometry(.35, .27, 4), new THREE.Matrix4().makeRotationY(Math.PI / 4).setPosition(up(p, 2.75)))
  }
  spruce(3.9, 5.2, 4.2)
  const line = Array.from({ length: Math.ceil(track.length / 1.25) + 1 }, (_, i) => track.sample(i * 1.25))
  for (let i = 0; i < 193; i++) {
    const x = -51 + random() * 103, z = -41 + random() * 82
    const h = 2.4 + random() ** 1.5 * 4.5
    // Leave the village square, village rows, brook and spectator sightlines open.
    if (x > -35 && x < 11 && z > -17 && z < 13) continue
    if (x > 4 && x < 28 && z > -34 && z < -26) continue
    if (Math.abs(x - brookX(z)) < 3.3 && z > -9) continue
    if (line.some(p => Math.hypot(p.x - x, p.z - z) < track.halfWidth + 4.8 + h * .24)) continue
    spruce(x, z, h)
  }
}
