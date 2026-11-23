import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'

export type Material = THREE.MeshStandardMaterial
type Point = { x: number; y: number; z: number }
export const axisY = new THREE.Vector3(0, 1, 0)
export const lifted = (p: Point, lift: number) => new THREE.Vector3(p.x, p.y + lift, p.z)

export function material(color: THREE.ColorRepresentation, roughness = 0.48, metalness = 0.06) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness, side: THREE.DoubleSide })
}

export function canvasTexture(width: number, height: number, paint: (ctx: CanvasRenderingContext2D) => void) {
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

export function woodTexture() {
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

function signTexture(label: string, mode: 'start' | 'finish' | 'course', colors: readonly string[]) {
  return canvasTexture(1024, 160, ctx => {
    ctx.fillStyle = mode === 'course' ? '#ecdfca' : '#242e30'
    ctx.fillRect(0, 0, 1024, 160)
    if (mode === 'course') {
      ctx.transform(1, 0, -0.28, 1, 0, 0)
      colors.forEach((c, i) => {
        ctx.fillStyle = c
        ctx.fillRect(37 + i * 18, 30, 15, 100)
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
        for (const [i, color] of colors.entries()) {
          ctx.fillStyle = color
          ctx.fillRect(35 + i * 25, 59, 19, 39)
          ctx.fillRect(847 + i * 25, 59, 19, 39)
        }
      }
    }
  })
}

/** Static geometry is merged by finish, so all support hardware shares a few draws. */
export class SceneryBatch {
  private readonly buckets = new Map<Material, THREE.BufferGeometry[]>()
  constructor(private readonly rowSpacing = .32, private readonly options: {
    indexed?: boolean
    /** End of an exact straight extrusion with a constant cross-section. */
    straightUntil?: number
  } = {}) {}
  add(mat: Material, geo: THREE.BufferGeometry, matrix?: THREE.Matrix4) {
    if (matrix) geo.applyMatrix4(matrix)
    if (!geo.getAttribute('normal')) geo.computeVertexNormals()
    const normalized = geo.index && !this.options.indexed ? geo.toNonIndexed() : geo
    if (normalized !== geo) geo.dispose()
    if (this.options.indexed && !normalized.index) {
      normalized.setIndex(Array.from({ length: normalized.getAttribute('position').count }, (_, i) => i))
    }
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
    const rows = Math.max(1, Math.ceil((end - start) / this.rowSpacing))
    const columns = bands + 1
    // Keep two regular intervals at each end of the straight. All intermediate
    // cross-sections have identical profiles and linearly mapped texture coordinates.
    const straightEnd = Math.min(this.options.straightUntil ?? start, end)
    const skippedRows = straightEnd > start ? Math.max(0, Math.floor(rows * (straightEnd - start) / (end - start)) - 5) : 0
    for (let i = 0; i <= rows - skippedRows; i++) {
      const sourceRow = i > 2 ? i + skippedRows : i
      const s = start + (end - start) * sourceRow / rows
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
    if (skippedRows) {
      // Three averages normals by triangle area. Keep the two ends of the long
      // quad shaded like the adjacent regular row of this same extrusion.
      geometry.computeVertexNormals()
      const normals = geometry.getAttribute('normal') as THREE.BufferAttribute
      for (let j = 0; j < columns; j++) {
        normals.copyAt(2 * columns + j, normals, columns + j)
        normals.copyAt(3 * columns + j, normals, columns + j)
      }
    }
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

export function signBoard(group: THREE.Group, batch: SceneryBatch, frame: Material,
  colors: readonly string[], text: string, type: 'start' | 'finish' | 'course',
  at: THREE.Vector3, width: number, height: number, normal: THREE.Vector3) {
  const map = signTexture(text, type, colors)
  const signMat = material('#ffffff', .54)
  signMat.map = map
  const yaw = Math.atan2(normal.x, normal.z)
  batch.box(frame, at, [width + .12, height + .12, .09], yaw)
  // Separate faces keep the lettering legible from both sides of the gantry.
  for (const face of [-1, 1]) {
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(width, height), signMat)
    sign.rotation.y = yaw + (face < 0 ? Math.PI : 0)
    sign.position.copy(at).addScaledVector(normal, .052 * face)
    sign.receiveShadow = true
    group.add(sign)
  }
}
