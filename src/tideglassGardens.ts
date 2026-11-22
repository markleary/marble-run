import * as THREE from 'three'
import { SceneryBatch, axisY, canvasTexture, material, type Material } from './sceneryKit'

const point = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)
const translation = (x: number, y: number, z: number) => new THREE.Matrix4().makeTranslation(x, y, z)

/** A ridged, arching blade. The same folded construction makes broad leaves, fern leaflets and lotus petals. */
function blade(batch: SceneryBatch, mat: Material, root: THREE.Vector3, angle: number,
  reach: number, rise: number, width: number, bend: number, rib?: Material) {
  const x = Math.cos(angle), z = Math.sin(angle)
  const vertices: number[] = [], uvs: number[] = [], indices: number[] = []
  const vein: number[] = [], veinUvs: number[] = [], veinIndices: number[] = []
  const segments = width < .27 ? 4 : 6
  for (let i = 0; i <= segments; i++) {
    const t = i / segments
    const swell = Math.sin(t * Math.PI) ** .74
    const r = reach * t, y = root.y + rise * t + bend * Math.sin(t * Math.PI)
    for (const side of [-1, 0, 1]) {
      const offset = width * swell * side
      vertices.push(root.x + x * r - z * offset, y + (1 - Math.abs(side)) * swell * width * .3, root.z + z * r + x * offset)
      uvs.push(t, .5 + side / 2)
    }
    if (i) for (let j = 0; j < 2; j++) {
      const a = (i - 1) * 3 + j
      indices.push(a, a + 1, a + 3, a + 1, a + 4, a + 3)
    }
    if (rib) {
      for (const side of [-1, 1]) {
        const offset = width * swell * side * .051
        vein.push(root.x + x * r - z * offset, y + swell * width * .3 + .004, root.z + z * r + x * offset)
        veinUvs.push(t, (side + 1) / 2)
      }
      const a = (i - 1) * 2
      if (i) veinIndices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
    }
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geometry.setIndex(indices)
  batch.add(mat, geometry)
  if (rib) {
    const midrib = new THREE.BufferGeometry()
    midrib.setAttribute('position', new THREE.Float32BufferAttribute(vein, 3))
    midrib.setAttribute('uv', new THREE.Float32BufferAttribute(veinUvs, 2))
    midrib.setIndex(veinIndices)
    batch.add(rib, midrib)
  }
}

function gardenWindow() {
  const texture = canvasTexture(1024, 256, ctx => {
    const sky = ctx.createLinearGradient(0, 0, 0, 256)
    sky.addColorStop(0, '#b1d4d9')
    sky.addColorStop(.58, '#e3ead7')
    sky.addColorStop(1, '#8fad9a')
    ctx.fillStyle = sky
    ctx.fillRect(0, 0, 1024, 256)
    for (let ridge = 0; ridge < 3; ridge++) {
      ctx.fillStyle = ['#b3c9b5', '#97b6a6', '#78a38f'][ridge]
      ctx.beginPath()
      ctx.moveTo(0, 258)
      for (let x = 0; x <= 1024; x += 4) {
        const a = 2 * Math.PI * x / 1024
        ctx.lineTo(x, 128 + 33 * ridge - 15 * Math.cos(a * 3 + ridge * 2) - 9 * Math.sin(a * 6) + 1.7 * Math.cos(a * 140))
      }
      ctx.lineTo(1024, 258)
      ctx.fill()
    }
    ctx.fillStyle = 'rgba(245,252,223,.14)'
    for (let x = -100; x < 1024; x += 123) {
      ctx.beginPath()
      ctx.moveTo(x, 0); ctx.lineTo(x + 15, 0); ctx.lineTo(x - 49, 256); ctx.lineTo(x - 64, 256)
      ctx.fill()
    }
  })
  texture.wrapS = THREE.RepeatWrapping
  texture.repeat.x = 1.6
  return texture
}

export function createTideglassGardens(batch: SceneryBatch, group: THREE.Group, copper: Material, iron: Material, porcelain: Material) {
  const rim = material('#3f766c', .38, .25), stone = material('#a7bdac', .78)
  const soil = material('#574a3c', .98), water = material('#459c9a', .13, .30)
  const reflection = material('#b0dfca', .29, .17), petal = material('#f49a9c', .49)
  const ivory = material('#ffe4ac', .64), pollen = material('#e7a53e', .53)
  const bark = material('#8f8461', .86), leafStem = material('#92b484', .68)
  const bract = material('#da7250', .51)
  const greens = ['#276958', '#41866a', '#69a56b', '#92b976'].map(c => material(c, .54))
  let state = 30345
  const random = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    return state / 0x100000000
  }
  const disc = (mat: Material, x: number, y: number, z: number, top: number, base: number, height: number, sides = 24) =>
    batch.add(mat, new THREE.CylinderGeometry(top, base, height, sides), translation(x, y, z))
  const ring = (mat: Material, x: number, y: number, z: number, radius: number, thickness: number) => {
    const matrix = new THREE.Matrix4().makeRotationX(Math.PI / 2).setPosition(x, y, z)
    batch.add(mat, new THREE.TorusGeometry(radius, thickness, 5, 36), matrix)
  }

  // Stone-tile galleries have an open southern elevation for the broadcast cameras.
  const pavers = canvasTexture(256, 256, ctx => {
    ctx.fillStyle = '#c1cec1'
    ctx.fillRect(0, 0, 256, 256)
    for (let r = 0; r < 4; r++) for (let c = -1; c < 3; c++) {
      const shade = Math.floor(random() * 14)
      ctx.fillStyle = 'rgb(' + (211 + shade) + ',' + (221 + shade) + ',' + (207 + shade) + ')'
      ctx.fillRect(c * 128 + (r % 2) * 64 + 1, r * 64 + 1, 126, 62)
    }
  })
  pavers.wrapS = pavers.wrapT = THREE.RepeatWrapping
  pavers.repeat.set(125, 125)
  const floorMat = material('#d0d8c6', .85)
  floorMat.map = pavers
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(800, 800), floorMat)
  floor.rotation.x = -Math.PI / 2
  floor.receiveShadow = true
  floor.position.y = -.1
  group.add(floor)

  // A band of tall windows, fanlights and a receding roof marks the north nave of the glasshouse.
  const north = -33
  const windowMat = material('#eaf3e4', .51, .06)
  windowMat.map = gardenWindow()
  const glazing = new THREE.Mesh(new THREE.PlaneGeometry(110, 19), windowMat)
  glazing.position.set(0, 10.7, north - .22)
  group.add(glazing)
  batch.box(stone, point(0, 1, north), [110, 2.1, .64])
  batch.box(rim, point(0, 23.02, north - 5), [110, .27, .32])
  const roof = new THREE.Mesh(new THREE.PlaneGeometry(110, Math.hypot(5, 3)), material('#afd1c2', .38, .15))
  roof.position.set(0, 21.45, north - 2.55)
  roof.rotation.x = -Math.atan2(5, 3)
  group.add(roof)
  for (const y of [2, 7.8, 14.1, 20]) {
    batch.box(y === 7.8 || y === 14.1 ? rim : iron, point(0, y, north), [110, .19, .35])
  }
  for (let i = 0; i < 12; i++) {
    const x = -53 + i * 9.3
    batch.box(iron, point(x, 10, north), [.25, 20, .4])
    batch.box(porcelain, point(x, 1.05, north + .1), [.76, 2.1, .78])
    batch.box(rim, point(x, 19.55, north), [.62, .6, .74])
    batch.rod(rim, point(x, 20, north), point(x, 23, north - 5), .13)
    if (i === 11) continue
    const mid = x + 4.65
    batch.box(rim, point(mid, 10.8, north), [.12, 17.8, .25])
    for (let j = 0; j < 8; j++) {
      const arch = (step: number) => point(mid + 4.65 * Math.cos(step * Math.PI / 8), 14.1 + 4.4 * Math.sin(step * Math.PI / 8), north + .18)
      batch.rod(iron, arch(j), arch(j + 1), .11)
      if (j % 2) batch.rod(rim, point(mid, 14.1, north + .13), arch(j), .078, 6)
    }
  }

  // A projecting gable and a radial rose window distinguish the principal exhibition hall.
  const bay = north + .9
  for (const side of [-1, 1]) {
    const x = side * 7.2
    batch.box(porcelain, point(x, 2.4, bay), [1.1, 4.8, 1.2])
    batch.rod(iron, point(x, 3, bay), point(x, 20, bay), .26, 10)
    batch.rod(iron, point(x * 1.12, 19.0, bay), point(0, 25.3, bay), .22, 8)
    batch.rod(copper, point(x * 1.12, 19.36, bay), point(0, 25.66, bay), .11)
    batch.rod(rim, point(x, 17.1, bay), point(x * .62, 19.5, bay), .14, 8)
  }
  batch.rod(iron, point(-7.2, 19.45, bay), point(7.2, 19.45, bay), .20)
  const eye = point(0, 20.72, bay)
  const rose = (radius: number, a: number) => point(radius * Math.cos(a), eye.y + radius * Math.sin(a), bay)
  for (let j = 0; j < 20; j++) {
    const angle = j * Math.PI / 10
    batch.rod(rim, rose(2.45, angle), rose(2.45, angle + Math.PI / 10), .12, 7)
    if (j % 2 === 0) batch.rod(rim, eye, rose(2.45, angle), .08, 6)
  }
  batch.rod(copper, point(0, 24.9, bay), point(0, 26.18, bay), .13)
  batch.add(copper, new THREE.SphereGeometry(.27, 12, 8), translation(0, 26.28, bay))

  function pot(x: number, z: number, radius: number, h: number) {
    disc(rim, x, h * .48, z, radius, radius * .75, h)
    ring(copper, x, h * .9, z, radius * .985, .055)
    disc(soil, x, h + .025, z, radius * .91, radius * .91, .06)
    return point(x, h + .06, z)
  }

  function palm(root: THREE.Vector3, scale: number, tall = false) {
    const stalk = scale * (tall ? 2.2 : .36)
    const crown = root.clone().add(point(scale * .22, stalk, scale * .12))
    const spine = crown.clone().sub(root)
    const transform = new THREE.Matrix4().compose(root.clone().lerp(crown, .5),
      new THREE.Quaternion().setFromUnitVectors(axisY, spine.clone().normalize()), point(1, 1, 1))
    batch.add(bark, new THREE.CylinderGeometry(.13 * scale, .19 * scale, spine.length(), 9), transform)
    if (tall) for (let j = 1; j < 7; j++) {
      const radius = (.202 - j * .008) * scale
      batch.rod(leafStem, root.clone().lerp(crown, j / 7), root.clone().lerp(crown, j / 7 + .025), radius, 9)
    }
    const phase = random() * 6
    for (let i = 0; i < 11; i++) {
      const size = (.75 + random() * .43) * scale
      const inner = i > 6
      const a = phase + i * 2.4
      const reach = size * (inner ? 1.02 : 1.42), rise = size * (inner ? 1.64 : .28)
      blade(batch, greens[(i + (inner ? 1 : 0)) % 4], crown, a, reach, rise, size * .38, size * .64, leafStem)
    }
  }

  function fern(root: THREE.Vector3, scale: number) {
    const phase = random() * 3
    for (let frond = 0; frond < 7; frond++) {
      const angle = phase + frond * Math.PI * 2 / 7
      const r = scale * (.86 + random() * .3)
      const along = (t: number) => root.clone().add(point(Math.cos(angle) * r * t, r * (.53 * t + .4 * Math.sin(t * Math.PI)), Math.sin(angle) * r * t))
      for (let i = 0; i < 5; i++) {
        const t = i / 5
        batch.rod(greens[2], along(t), along(t + .2), r * .018, 5)
        for (const side of [-1, 1]) {
          blade(batch, greens[(i + frond) % 3], along(t + .13), angle + side * .92,
            r * (.49 - .32 * t), r * .065, r * (.075 - .045 * t), r * .09)
        }
      }
    }
  }

  function lotus(origin: THREE.Vector3, size: number) {
    for (let i = 0; i < 15; i++) {
      const outer = i < 9
      blade(batch, outer ? petal : ivory, origin, i * Math.PI * 2 / (outer ? 9 : 6),
        size * (outer ? 1 : .55), size * (outer ? .28 : .54), size * .26, -size * .06)
    }
    disc(pollen, origin.x, origin.y + .25 * size, origin.z, .21 * size, .14 * size, .34 * size, 12)
  }

  function pond(x: number, z: number, radius: number, y: number) {
    disc(stone, x, y / 2, z, radius, radius, y, 40)
    disc(water, x, y + .025, z, radius - .14, radius - .14, .06, 40)
    ring(rim, x, y + .10, z, radius - .07, .115)
    for (let i = 0; i < 12; i++) {
      const angle = random() * Math.PI * 2, distance = radius * (.36 + .45 * random())
      const px = x + Math.cos(angle) * distance, pz = z + Math.sin(angle) * distance
      const pad = radius * (.062 + random() * .064)
      // A cutout wedge and raised petiole distinguish floating lily pads from stones.
      const matrix = new THREE.Matrix4().makeRotationY(angle).multiply(new THREE.Matrix4().makeRotationX(-Math.PI / 2)).setPosition(px, y + .075 + .004 * i, pz)
      batch.add(greens[i % 4], new THREE.CircleGeometry(pad, 16, .1, 5.84), matrix)
      if (i % 4 === 1) lotus(point(px + .18 * pad, y + .096, pz), pad * .8)
    }
    return y + .10
  }

  // A stepped lily fountain sits in the first hairpin; its spouts land inside the masonry pool.
  const fountainX = 10.9, fountainZ = -7.28
  const waterY = pond(fountainX, fountainZ, 5.9, 2.8)
  const column = point(fountainX, waterY, fountainZ)
  batch.rod(porcelain, column, column.clone().addScaledVector(axisY, 4.8), .48, 12)
  disc(rim, fountainX, waterY + 2.04, fountainZ, 2.24, .59, .80)
  ring(copper, fountainX, waterY + 2.48, fountainZ, 2.18, .075)
  disc(rim, fountainX, waterY + 4.53, fountainZ, 1.6, .44, .74)
  lotus(point(fountainX, waterY + 4.91, fountainZ), 1.58)
  for (let jet = 0; jet < 6; jet++) {
    const a = jet * Math.PI / 3
    const arc = (t: number) => point(fountainX + Math.cos(a) * (.48 + t * 2.59),
      waterY + 4.83 + .47 * t - 5.27 * t * t, fountainZ + Math.sin(a) * (.48 + t * 2.59))
    const points = Array.from({ length: 7 }, (_, i) => arc(i / 6))
    for (let i = 1; i < points.length; i++) batch.rod(reflection, points[i - 1], points[i], .046, 6)
    const end = points[6]
    ring(reflection, end.x, waterY -.035, end.z, .35, .023)
  }

  // A glazed octagonal Wardian case shelters ferns on the island inside the second turn.
  const cx = -26.1, cz = 11.45
  disc(stone, cx, .58, cz, 4.15, 4.37, 1.16, 8)
  const pane = material('#91c8b2', .26, .16)
  pane.transparent = true
  pane.opacity = .22
  pane.depthWrite = false
  const vertices: number[] = [], indices: number[] = []
  for (let i = 0; i < 8; i++) {
    const a = Math.PI / 4 * i
    const at = (r: number, y: number, angle = a) => point(cx + r * Math.cos(angle), y, cz + r * Math.sin(angle))
    const bottom = at(3.85, .98), shoulder = at(3.85, 3.9), crown = at(1.2, 5.75)
    const next = a + Math.PI / 4
    for (const [p, q] of [[bottom, shoulder], [shoulder, crown], [crown, at(0, 6.28)], [shoulder, at(3.85, 3.9, next)], [crown, at(1.2, 5.75, next)]]) batch.rod(iron, p, q, .074, 7)
    const points = [bottom, at(3.85, .98, next), shoulder, at(3.85, 3.9, next), crown, at(1.2, 5.75, next)]
    const first = vertices.length / 3
    for (const p of points) vertices.push(p.x, p.y, p.z)
    for (const j of [0, 2, 1, 1, 2, 3, 2, 4, 3, 3, 4, 5]) indices.push(first + j)
  }
  const shell = new THREE.BufferGeometry()
  shell.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
  shell.setIndex(indices)
  shell.computeVertexNormals()
  group.add(new THREE.Mesh(shell, pane))
  fern(point(cx, 1.12, cz), 2.95)
  palm(point(cx + 1.25, 1.15, cz - .98), 1.48)

  // Planted beds fill the spaces between sections of raceway, below the sightline.
  for (const [x, z, scale] of [[-31, -7, 2.4], [-21, -7.8, 2.7], [-12, -7.2, 2.4], [-3.2, -7.6, 2.2],
    [-14.7, 11.2, 1.8], [-5.3, 11.4, 1.6], [9.5, 8.8, 1.15], [21, 5.9, 1.6],
    [30, -13.6, 2.8], [-39.4, -19, 2.1], [38, 18.1, 2.2]]) {
    const base = pot(x, z, scale * .86, .67 + .16 * scale)
    palm(base, scale, true)
    fern(base.clone().add(point(scale, -.36, .17)), scale * .83)
    for (let stem = 0; stem < 2; stem++) {
      const bottom = base.clone().add(point((stem ? -.55 : .65) * scale, -.08, .48 * scale))
      const tip = bottom.clone().add(point(.28 * scale, (1.45 + .36 * stem) * scale, .18 * scale))
      batch.rod(greens[0], bottom, tip, .034 * scale, 6)
      for (let j = 0; j < 5; j++) {
        const bud = bottom.clone().lerp(tip, .48 + .11 * j)
        blade(batch, j === 4 ? pollen : bract, bud, (j % 2 === 0 ? .64 : 3.78) + stem,
          scale * (.32 - j * .032), scale * .22, scale * .078, -scale * .048)
      }
    }
  }
  pond(-5, -9.4, 2.45, .5)
  pond(.3, 11.9, 2.45, .46)
  for (let x = -48; x <= 44; x += 9.4) {
    const base = pot(x, -28.1, 1.8, .97)
    palm(base, 2.55 + random() * .48, true)
  }
}
