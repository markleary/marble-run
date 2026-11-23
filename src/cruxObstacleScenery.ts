import * as THREE from 'three'
import type { CourseTrack } from './track'
import { cruxObstacleMesh, cruxObstacles } from './courses/cruxObstacles'
import { SceneryBatch, axisY, canvasTexture, lifted, material } from './sceneryKit'

/** Ivory laminated board and charcoal grip tape use the same scale as the
 * physical lanes. Grain runs down the board and wraps cleanly at each seam. */
function boardTexture(plywood: boolean) {
  const map = canvasTexture(512, 256, ctx => {
    let state = 137
    const random = () => ((state = (Math.imul(1664525, state) + 1013904223) >>> 0) / 0x100000000)
    ctx.fillStyle = plywood ? '#eae4cf' : '#464846'
    ctx.fillRect(0, 0, 512, 256)
    if (plywood) {
      for (let i = 0; i < 1200; i++) {
        const x = random() * 512, y = random() * 256
        const length = 9 + random() ** 2 * 160, bend = random() * 3 - 1.5
        ctx.strokeStyle = random() < .65 ? 'rgba(138,120,87,.14)' : 'rgba(255,255,241,.35)'
        ctx.lineWidth = random() + .45
        for (const wrap of [-512, 0]) {
          ctx.beginPath(); ctx.moveTo(x + wrap, y)
          ctx.bezierCurveTo(x + wrap + length / 3, y + bend, x + wrap + length / 2, y - bend, x + wrap + length, y)
          ctx.stroke()
        }
      }
    }
    for (let i = 0; i < (plywood ? 7500 : 26000); i++) {
      const light = random() < .56
      ctx.fillStyle = plywood
        ? light ? 'rgba(255,255,243,.19)' : 'rgba(118,106,86,.10)'
        : light ? 'rgba(215,217,204,.38)' : 'rgba(5,8,9,.44)'
      const size = .4 + random() * 1.5
      ctx.fillRect(random() * 512, random() * 256, size, .7 * size)
    }
  })
  map.wrapS = map.wrapT = THREE.RepeatWrapping
  return map
}

export function cruxBoardFinishes() {
  const ivory = material('#f5f1df', .82), grit = material('#696d6e', .95)
  ivory.map = boardTexture(true)
  grit.map = boardTexture(false)
  return { ivory, grit }
}

export function createCruxObstacleScenery(track: CourseTrack, group: THREE.Group) {
  const paint = new Map<string, THREE.MeshStandardMaterial>()
  const resin = canvasTexture(128, 128, ctx => {
    const pixels = ctx.createImageData(128, 128)
    let state = 23
    for (let i = 0; i < pixels.data.length; i += 4) {
      state = (Math.imul(1664525, state) + 1013904223) >>> 0
      const grain = 232 + (state >>> 28)
      pixels.data[i] = pixels.data[i + 1] = pixels.data[i + 2] = grain
      pixels.data[i + 3] = 255
    }
    ctx.putImageData(pixels, 0, 0)
  })
  resin.wrapS = resin.wrapT = THREE.RepeatWrapping
  const socket = material('#252e31', .60, .30), steel = material('#bdc5bd', .29, .60)
  const batch = new SceneryBatch()
  for (const obstacle of cruxObstacles) {
    const mesh = cruxObstacleMesh(track, obstacle)
    const indexed = new THREE.BufferGeometry()
    indexed.setAttribute('position', new THREE.BufferAttribute(mesh.vertices, 3))
    indexed.setIndex(new THREE.BufferAttribute(mesh.indices, 1))
    if (obstacle.kind === 'bumper') indexed.computeVertexNormals()
    const geometry = indexed.toNonIndexed()
    indexed.dispose()
    if (!geometry.hasAttribute('normal')) geometry.computeVertexNormals()
    const dome = obstacle.kind === 'bumper'
    const key = dome ? 'brass dome' : obstacle.color
    let finish = paint.get(key)
    if (!finish) {
      finish = dome ? material('#c4a451', .41, .48) : material(obstacle.color, .66)
      finish.vertexColors = true; finish.map = resin
      paint.set(key, finish)
    }
    // The cast urethane holds have a darker base and differently grained
    // faces. They keep their relief under the hall's broad, soft ceiling light.
    const surface = track.sample(obstacle.s), normals = geometry.getAttribute('normal')
    const positions = geometry.getAttribute('position'), uv = new Float32Array(normals.count * 2)
    const shades = new Float32Array(normals.count * 3)
    for (let i = 0; i < normals.count; i++) {
      const x = normals.getX(i), y = normals.getY(i), z = normals.getZ(i)
      const across = x * surface.rx + z * surface.rz
      const along = x * surface.tx + z * surface.tz
      const value = THREE.MathUtils.clamp(.54 + .30 * y + .64 * across - .20 * along, .27, 1.06)
      shades.fill(value, i * 3, i * 3 + 3)
      // The oblique projection carries the fine grain onto the bevels too.
      uv[i * 2] = positions.getX(i) + .37 * positions.getY(i)
      uv[i * 2 + 1] = positions.getZ(i) - .63 * positions.getY(i)
    }
    geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
    geometry.setAttribute('color', new THREE.BufferAttribute(shades, 3))
    batch.add(finish, geometry)

    // Seat the washer flush against its actual facet, including the bank on the
    // folded return. The dark six-sided recess stays legible in the race closeup.
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3()
    const hit = new THREE.Vector3(), face = new THREE.Vector3()
    const ray = new THREE.Ray(new THREE.Vector3(), new THREE.Vector3(0, -1, 0))
    for (const bolt of obstacle.bolts) {
      const p = lifted(track.sample(bolt.s, bolt.lateral), bolt.lift)
      ray.origin.copy(p).y += 2
      const normal = axisY.clone()
      let closest = Infinity, topY = p.y
      for (let i = 0; i < mesh.indices.length; i += 3) {
        a.fromArray(mesh.vertices, 3 * mesh.indices[i])
        b.fromArray(mesh.vertices, 3 * mesh.indices[i + 1])
        c.fromArray(mesh.vertices, 3 * mesh.indices[i + 2])
        if (!ray.intersectTriangle(a, b, c, false, hit)) continue
        const delta = Math.abs(hit.y - p.y)
        if (delta >= closest) continue
        THREE.Triangle.getNormal(a, b, c, face)
        if (Math.abs(face.y) < .1) continue
        normal.copy(face).multiplyScalar(face.y < 0 ? -1 : 1)
        closest = delta; topY = hit.y
      }
      p.y = topY
      const at = (lift: number) => p.clone().addScaledVector(normal, lift)
      const r = obstacle.kind === 'stud' ? .145 : .115
      batch.rod(socket, at(-.008), at(.017), r * 1.16, 16)
      batch.rod(steel, at(.014), at(.033), r, 16)
      batch.rod(socket, at(.029), at(.035), r * .43, 6)
    }
  }
  batch.finish(group)
}
