import * as THREE from 'three'
import { SceneryBatch, canvasTexture, material, type Material } from './sceneryKit'

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)
const holdColors = ['#e45734', '#04a3a2', '#edc834', '#566dbb', '#e580a7']

function panelFinish(tint: string, grain: THREE.Texture) {
  const finish = material(tint, .88)
  finish.map = grain
  return finish
}

function wallGrain() {
  const map = canvasTexture(256, 256, ctx => {
    ctx.fillStyle = '#eee9df'
    ctx.fillRect(0, 0, 256, 256)
    let seed = 527
    const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 0x100000000)
    for (let i = 0; i < 3800; i++) {
      ctx.fillStyle = random() < .5 ? 'rgba(113,90,74,.16)' : 'rgba(255,255,252,.32)'
      ctx.fillRect(random() * 256, random() * 256, .6 + random() * 1.8, .7)
    }
    // Staggered T-nut grid in the plywood, with a tiny lit lower rim.
    for (let row = 0; row < 4; row++) for (let column = 0; column < 4; column++) {
      const x = 12 + 64 * column + 26 * (row % 2), y = 16 + 64 * row
      ctx.fillStyle = '#fff6e2'
      ctx.beginPath(); ctx.arc(x, y + 1.4, 2.6, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = '#756c64'
      ctx.beginPath(); ctx.arc(x, y, 2.1, 0, Math.PI * 2); ctx.fill()
    }
  })
  map.wrapS = map.wrapT = THREE.RepeatWrapping
  return map
}

function bannerMap() {
  return canvasTexture(1024, 512, ctx => {
    ctx.fillStyle = '#102e37'
    ctx.fillRect(0, 0, 1024, 512)
    for (let ring = 0; ring < 25; ring++) {
      ctx.beginPath()
      for (let step = 0; step <= 120; step++) {
        const angle = step / 120 * Math.PI * 2
        const radius = (24 + ring * 15) * (1 + .13 * Math.sin(3 * angle + .8) + .06 * Math.cos(5 * angle))
        const x = 970 + 1.28 * radius * Math.cos(angle), y = 420 + radius * Math.sin(angle)
        if (step === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.strokeStyle = ring % 4 ? '#25454a' : '#375656'; ctx.lineWidth = 2; ctx.stroke()
    }
    ctx.fillStyle = '#ffc442'
    ctx.beginPath()
    for (const [x, y] of [[62, 260], [164, 92], [198, 144], [179, 173], [164, 151], [95, 260]]) ctx.lineTo(x, y)
    ctx.fill()
    ctx.fillStyle = '#f6eee0'
    ctx.beginPath()
    for (const [x, y] of [[117, 260], [219, 105], [324, 260], [277, 260], [218, 174], [162, 260]]) ctx.lineTo(x, y)
    ctx.fill()
    ctx.fillStyle = '#f6eee0'
    ctx.font = '900 164px Barlow Condensed, Arial Narrow, sans-serif'
    ctx.fillText('CRUX', 351, 258, 570)
    ctx.font = '700 64px Barlow Condensed, Arial Narrow, sans-serif'
    ctx.fillText('MOUNTAIN MASTERS', 70, 368, 859)
    ctx.fillStyle = '#ffc442'; ctx.fillRect(72, 410, 159, 9)
    ctx.fillStyle = '#36b1ae'; ctx.fillRect(240, 410, 52, 9)
  })
}

/** A cutaway sports hall. Each perimeter has its own batch so a camera outside
 * the miniature can look through the near wall, while race cameras see the interior. */
export function createCruxHall(group: THREE.Group, bounds: THREE.Box3, floorY: number) {
  const ground = new SceneryBatch()
  const grain = wallGrain()
  const panels = ['#cfa481', '#e4dfce', '#98b1ac', '#516f7a', '#ddd2bb'].map(tint => panelFinish(tint, grain))
  const charcoal = material('#22333a', .76), seam = material('#76817c', .75)
  const aluminum = material('#b7c4bc', .45, .45), pads = material('#496a76', .88)
  const holds = holdColors.map(color => material(color, .72))
  const gripShape = new THREE.IcosahedronGeometry(1, 0)
  const glass = material('#d7e7e8', .35, .15)
  glass.emissive.set('#b7d6dd'); glass.emissiveIntensity = .32
  const banner = material('#ffffff', .8)
  banner.map = bannerMap()

  const center = bounds.getCenter(new THREE.Vector3())
  const size = bounds.getSize(new THREE.Vector3())
  const spanX = size.x + 23, spanZ = size.z + 23
  const hallHeight = Math.max(28, bounds.max.y - floorY + 5)
  ground.box(material('#abb4ad', .97), v(center.x, floorY - .46, center.z), [spanX + 4, .72, spanZ + 4])
  // The climbing gym's slab sits on a beveled ply plinth.
  ground.box(material('#c3a279', .74), v(center.x, floorY - 1.12, center.z), [spanX + 4.4, .62, spanZ + 4.4])
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(1800, 1800), material('#b6c2bc', .96))
  floor.rotation.x = -Math.PI / 2; floor.position.y = floorY - 1.47; floor.receiveShadow = true
  group.add(floor)
  for (let dx = -spanX / 2 + 8; dx < spanX / 2; dx += 8)
    ground.box(seam, v(center.x + dx, floorY - .091, center.z), [.039, .02, spanZ + 1])
  for (let dz = -spanZ / 2 + 8; dz < spanZ / 2; dz += 8)
    ground.box(seam, v(center.x, floorY - .09, center.z + dz), [spanX + 1, .02, .039])

  const perimeters: { mesh: THREE.Group; mid: THREE.Vector3; inward: THREE.Vector3 }[] = []
  function wall(mid: THREE.Vector3, yaw: number, width: number, wallIndex: number) {
    const mesh = new THREE.Group(), batch = new SceneryBatch()
    const grips: { transform: THREE.Matrix4; color: THREE.Color }[] = []
    const inward = v(Math.sin(yaw), 0, Math.cos(yaw)), along = v(Math.cos(yaw), 0, -Math.sin(yaw))
    const at = (x: number, y: number, depth: number) =>
      mid.clone().addScaledVector(along, x).addScaledVector(inward, depth).addScaledVector(THREE.Object3D.DEFAULT_UP, y)
    const bayCount = Math.ceil(width / 10), bay = width / bayCount
    function face(mat: Material, corners: THREE.Vector3[], uv: number[], indices: number[]) {
      const geom = new THREE.BufferGeometry()
      geom.setAttribute('position', new THREE.Float32BufferAttribute(corners.flatMap(p => [p.x, p.y, p.z]), 3))
      geom.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
      geom.setIndex(indices); batch.add(mat, geom)
    }
    // Climbing panels share edges even where a bay leans dramatically into the hall.
    const rows = Math.max(3, Math.round(hallHeight / 14))
    const stepHeight = hallHeight / rows
    const ledge = (i: number, row: number) => {
      if (row === 0) return 0
      return 2.6 + 1.23 * Math.sin(i * 1.23 + wallIndex + row * .77)
        + .82 * Math.cos(row * 2.74 + i * .48)
    }
    for (let i = 0; i < bayCount; i++) {
      const left = -width / 2 + bay * i
      const surface = (u: number, y: number) => {
        const row = Math.min(rows - 1, Math.floor(y / stepHeight))
        const t = y / stepHeight - row
        const near = THREE.MathUtils.lerp(ledge(i, row), ledge(i + 1, row), u)
        const high = THREE.MathUtils.lerp(ledge(i, row + 1), ledge(i + 1, row + 1), u)
        return THREE.MathUtils.lerp(near, high, t)
      }
      const onWall = (u: number, y: number, depth = 0) => at(left + bay * u, y, surface(u, y) + depth)
      for (let row = 0; row < rows; row++) {
        const y0 = row * stepHeight, y1 = (row + 1) * stepHeight
        const corners = [onWall(0, y0), onWall(1, y0), onWall(1, y1), onWall(0, y1)]
        const color = panels[(Math.floor((i + wallIndex + row) / 2) + Math.floor(row / 2)) % panels.length]
        face(color, corners, [0, 0, bay / 3, 0, bay / 3, (y1 - y0) / 3, 0, (y1 - y0) / 3], [0, 1, 2, 0, 2, 3])
        batch.rod(seam, corners[0], corners[3], .037, 4)
        batch.rod(seam, corners[2], corners[3], .046, 4)
      }
      // Distinct color routes wind through real protruding slopers, jugs and pyramidal volumes.
      for (let route = 0; route < 2; route++) {
        const paint = holds[(i + wallIndex + route * 2) % holds.length]
        const count = Math.ceil(hallHeight / (route ? 3.4 : 2.7))
        for (let k = 0; k < count; k++) {
          const y = (1.8 + (k + route * .39) / count * (hallHeight - 3.4))
          const u = .27 + .43 * route + .12 * Math.sin(i * 3 + k * 1.58 + route * .6)
          const a = onWall(u, y, .04)
          if (k % 5 === (i + route) % 5) {
            const radius = .7 + .48 * Math.sin(k + i) ** 2
            const corners = [onWall(u - radius / bay, y - .55), onWall(u + radius / bay, y - .43),
              onWall(u + .034, y + radius), a.clone().addScaledVector(inward, .42 + radius * .46)]
            face(paint, corners, [0, 0, 1, 0, .4, 1, .5, .4], [0, 1, 3, 1, 2, 3, 2, 0, 3])
          } else {
            const quat = new THREE.Quaternion().setFromEuler(new THREE.Euler(.2, yaw, .7 * Math.sin(k * 2.13), 'YXZ'))
            const scale = v(.44 + .24 * Math.cos(k) ** 2, .23 + .18 * Math.sin(i + k) ** 2, .26)
            grips.push({ transform: new THREE.Matrix4().compose(a, quat, scale), color: paint.color })
          }
        }
      }
      const padAt = at(left + bay / 2, .17, 2.1)
      batch.box(pads, padAt, [bay - .09, .51, 4.1], yaw)
      batch.box(charcoal, at(left + bay / 2, .46, 3.93), [bay - .21, .03, .12], yaw)
      // The tall sash windows and exterior lattice along the roofline establish an indoor arena.
      batch.box(glass, at(left + bay / 2, hallHeight + 2.45, -.25), [bay, 5.1, .16], yaw)
      batch.box(aluminum, at(left + bay / 2, hallHeight + 2.45, -.09), [.085, 5.1, .14], yaw)
      batch.box(charcoal, at(left, hallHeight + 2.4, 0), [.24, 5.3, .22], yaw)
      batch.box(aluminum, at(left + bay / 2, hallHeight + 2.45, 0), [bay, .12, .15], yaw)
      for (const y of [hallHeight, hallHeight + 5]) batch.box(charcoal, at(left + bay / 2, y, .02), [bay, .23, .3], yaw)
      if (i % 4 === 1) {
        const start = onWall(.11, hallHeight - .38)
        const belay = onWall(.13, 1.3, .2)
        const midLine = start.clone().lerp(belay, .53).addScaledVector(inward, 1.2)
        batch.rod(charcoal, start, midLine, .05, 5)
        batch.rod(charcoal, midLine, belay, .05, 5)
        batch.rod(aluminum, start.clone().addScaledVector(along, -.25), start.clone().addScaledVector(along, .25), .22, 8)
      }
    }
    if (wallIndex % 2 === 0) {
      const width = Math.min(bay * 2.45, 25), height = width / 2
      const y = hallHeight * .56
      const p = at(-bay * .52, y, 5.45)
      batch.box(charcoal, p, [width + .22, height + .22, .23], yaw)
      const transform = new THREE.Matrix4().makeRotationY(yaw).setPosition(p.clone().addScaledVector(inward, .13))
      batch.add(banner, new THREE.PlaneGeometry(width, height), transform)
    }
    // One shared shape and one draw per wall carry thousands of small climbing holds.
    const routes = new THREE.InstancedMesh(gripShape, material('#ffffff', .72), grips.length)
    grips.forEach(({ transform, color }, index) => {
      routes.setMatrixAt(index, transform); routes.setColorAt(index, color)
    })
    mesh.add(routes)
    batch.finish(mesh)
    for (const child of mesh.children) child.castShadow = false
    group.add(mesh); perimeters.push({ mesh, mid, inward })
  }
  wall(v(center.x, floorY, center.z - spanZ / 2), 0, spanX, 0)
  wall(v(center.x - spanX / 2, floorY, center.z), Math.PI / 2, spanZ, 1)
  wall(v(center.x, floorY, center.z + spanZ / 2), Math.PI, spanX, 2)
  wall(v(center.x + spanX / 2, floorY, center.z), -Math.PI / 2, spanZ, 3)
  ground.finish(group)
  const relative = new THREE.Vector3()
  return (camera: THREE.Camera) => {
    for (const { mesh, mid, inward } of perimeters)
      mesh.visible = relative.subVectors(camera.position, mid).dot(inward) > 5.7
  }
}
