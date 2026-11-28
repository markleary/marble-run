import * as THREE from 'three'
import type { CourseTrack, TrackSample } from './track'
import { canvasTexture } from './sceneryKit'

const tau = 2 * Math.PI
// Placement of the level workshop pads and the buildings they support (x, z, width, depth, height, yaw).
export const workshopSites = [
  [-39.3, -17.0, 7.8, 5.7, 4.5, 1.85],
  [-19.6, -13.0, 5.2, 4.3, 3.1, 2.55],
  [-5.8, -12.0, 5.0, 4.6, 3.2, 3.3],
  [6.8, -13.0, 4.4, 3.9, 3.0, 2.9],
  [-49, 5.9, 5.7, 5.0, 3.7, 1.4],
  [-50, 24, 5.0, 4.4, 3.3, 1.0],
  [42, 8.5, 5.9, 4.7, 3.8, -0.75],
  [56, 11.7, 6.4, 4.6, 4.1, -0.85],
  [2.0, 13.8, 5.8, 4.6, 3.7, 0.25],
  [12.8, 12.2, 4.6, 4.1, 2.9, 0.47],
  [-44, -41, 5.6, 4.5, 3.6, 0.53],
  [-4, -48, 4.7, 4.1, 2.8, -0.12],
]

export function winterRandom(seed: number) {
  let state = seed
  return () => (state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 4294967296
}

function polarSky() {
  const map = canvasTexture(2048, 768, (c) => {
    const rng = winterRandom(1224)
    const sky = c.createLinearGradient(0, 0, 0, 768)
    sky.addColorStop(0, '#091729')
    sky.addColorStop(0.28, '#102841')
    sky.addColorStop(0.45, '#34596d')
    sky.addColorStop(0.55, '#cfadae')
    sky.addColorStop(0.64, '#a1a9c2')
    sky.addColorStop(1, '#69849b')
    c.fillStyle = sky
    c.fillRect(0, 0, 2048, 768)
    // Two overlapping ribbons catch the peaks of the aurora; the continuous periodic
    // curves meet at the panorama seam, including their narrow vertical rays.
    for (let k = 0; k < 2; k++) {
      for (let x = 0; x < 2048; x += 2) {
        const a = (tau * x) / 2048
        const wave = Math.sin(a * 3 + 0.83 * Math.sin(a * 4 + k) + 0.47 * k)
        const low = 348 + k * 5 - (26 - k * 6) * wave - 10 * Math.cos(a * 7 + 0.8 * k)
        const ray = 0.63 + 0.14 * Math.sin(a * 83 + 0.4 * Math.cos(a * 17)) + 0.15 * Math.cos(a * 9)
        const strength = (0.32 + 0.12 * wave) * ray
        const height = (56 + 17 * wave) * (1 - 0.32 * k)
        const curtain = c.createLinearGradient(0, low - height, 0, low)
        const tint = k ? '110,216,229' : '105,235,176'
        curtain.addColorStop(0, 'rgba(' + tint + ',0)')
        curtain.addColorStop(0.64, 'rgba(' + tint + ',' + strength * 0.46 + ')')
        curtain.addColorStop(0.88, 'rgba(' + tint + ',' + strength + ')')
        curtain.addColorStop(1, 'rgba(' + tint + ',0)')
        c.fillStyle = curtain
        c.fillRect(x, low - height, 2, height)
      }
    }
    for (let i = 0; i < 650; i++) {
      const x = rng() * 2048,
        y = 70 + rng() * 287,
        r = 0.28 + rng() ** 3 * 1.0
      c.fillStyle = 'rgba(255,244,221,' + (0.35 + 0.65 * rng()) + ')'
      c.beginPath()
      c.arc(x, y, r, 0, tau)
      c.fill()
      if (r > 1.18) {
        c.fillRect(x - 2.2, y - 0.34, 4.4, 0.68)
        c.fillRect(x - 0.34, y - 2.2, 0.68, 4.4)
      }
    }
    const moon = c.createRadialGradient(765, 279, 7, 765, 279, 31)
    moon.addColorStop(0, 'rgba(255,230,164,.56)')
    moon.addColorStop(1, 'rgba(255,230,164,0)')
    c.fillStyle = moon
    c.fillRect(730, 245, 70, 70)
    c.fillStyle = '#ffedc9'
    c.beginPath()
    c.arc(765, 279, 7.5, 0, tau)
    c.fill()
    for (let band = 0; band < 3; band++) {
      const y = (x: number) => {
        const a = (tau * x) / 2048
        return 391 + 11 * band - 15 * Math.cos(5 * a + 1.7 * band) - 6 * Math.cos(17 * a + band) - 3 * Math.cos(43 * a)
      }
      c.fillStyle = ['#778ba4', '#667e96', '#526d83'][band]
      c.beginPath()
      c.moveTo(0, 768)
      for (let x = 0; x <= 2048; x += 4) c.lineTo(x, y(x))
      c.lineTo(2048, 768)
      c.fill()
      if (band > 0)
        for (let x = -3; x < 2049; x += 2.6) {
          const h = 2.5 + rng() * 5 + 3 * band,
            base = y(x) + 0.8
          c.beginPath()
          c.moveTo(x - h * 0.24, base)
          c.lineTo(x, base - h)
          c.lineTo(x + h * 0.24, base)
          c.fill()
        }
    }
  })
  map.offset.y = 0.065
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(165, 60, 28),
    new THREE.MeshBasicMaterial({
      map,
      side: THREE.BackSide,
      depthTest: false,
      depthWrite: false,
      fog: false,
      toneMapped: false,
    }),
  )
  sky.rotation.z = 0.025
  sky.renderOrder = -100
  return sky
}

export function santaWinter(group: THREE.Group, track: CourseTrack) {
  const sky = polarSky()
  group.add(sky)
  // Sample the course slopes so bridges, houses and trees share one continuous snowy hillside.
  const road: TrackSample[] = []
  for (let s = 0; s < track.length + 3; s += 3) road.push(track.sample(s))
  const ground = (x: number, z: number) => {
    let sum = 0,
      influence = 0,
      ceiling = Infinity
    for (const p of road) {
      const d2 = (x - p.x) ** 2 + (z - p.z) ** 2
      const weight = 1 / (22 + d2) ** 2
      sum += p.y * weight
      influence += weight
      if (d2 < 48) ceiling = Math.min(ceiling, p.y - 1.6)
    }
    const drift = 0.34 * Math.sin(x * 0.28 + z * 0.23) + 0.41 * Math.cos(z * 0.29 - x * 0.08)
    const y = Math.min(ceiling, sum / influence - 3.3 + drift)
    const rim = Math.max(Math.abs(x) - 62, Math.abs(z) - 47)
    return THREE.MathUtils.lerp(y, -3 + drift * 1.5, THREE.MathUtils.smoothstep(rim, 0, 44))
  }
  const width = 258,
    depth = 224,
    columns = 116,
    rows = 102
  const snow = new THREE.PlaneGeometry(width, depth, columns, rows)
  snow.rotateX(-Math.PI / 2)
  const pos = snow.getAttribute('position'),
    colors = [],
    color = new THREE.Color()
  const shaded = new THREE.Color('#7991ad'),
    bright = new THREE.Color('#b3c3cd')
  const pads = workshopSites.map(([x, z, w, d, , yaw]) => ({
    x,
    z,
    w,
    d,
    cos: Math.cos(yaw),
    sin: Math.sin(yaw),
    y: ground(x, z),
  }))
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i),
      z = pos.getZ(i)
    let elevation = ground(x, z)
    for (const pad of pads) {
      const dx = x - pad.x,
        dz = z - pad.z
      const out = Math.max(Math.abs(dx * pad.cos - dz * pad.sin) - pad.w / 2, Math.abs(dx * pad.sin + dz * pad.cos) - pad.d / 2)
      if (out < 4) elevation = THREE.MathUtils.lerp(pad.y, elevation, THREE.MathUtils.smoothstep(out, 1.5, 4))
    }
    pos.setY(i, elevation)
    color.copy(shaded).lerp(bright, 0.51 + 0.22 * Math.sin(z * 0.36 + x * 0.22) + 0.2 * Math.cos(z * 0.13 - x * 0.31))
    colors.push(color.r, color.g, color.b)
  }
  // The sampled snowfield is piecewise planar. Ground all props on those actual rendered
  // triangles, particularly where the steep hillside turns beneath a trestle or foundation.
  const groundMesh = (x: number, z: number) => {
    const u = THREE.MathUtils.clamp((x / width + 0.5) * columns, 0, columns)
    const v = THREE.MathUtils.clamp((z / depth + 0.5) * rows, 0, rows)
    const ix = Math.min(columns - 1, Math.floor(u)),
      iz = Math.min(rows - 1, Math.floor(v))
    const j = iz * (columns + 1) + ix,
      fx = u - ix,
      fz = v - iz
    const a = pos.getY(j),
      b = pos.getY(j + columns + 1),
      c = pos.getY(j + columns + 2),
      d = pos.getY(j + 1)
    return fx + fz <= 1 ? a + (d - a) * fx + (b - a) * fz : c + (b - c) * (1 - fx) + (d - c) * (1 - fz)
  }
  snow.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  snow.computeVertexNormals()
  // Sled ruts and boot prints connect the workshops to the post and the tree plaza.
  const paths = canvasTexture(1536, 1536, (c) => {
    c.fillStyle = '#ffffff'
    c.fillRect(0, 0, 1536, 1536)
    c.scale(1536 / 258, 1536 / 224)
    c.translate(129, 112)
    const rng = winterRandom(5517)
    for (const route of [
      [
        [-58, -10],
        [-43, -16],
        [-31, -16],
        [-17, -17],
        [-4, -17],
        [12, -17],
        [20, -15],
      ],
      [
        [-48, 33],
        [-47, 20],
        [-51, 10],
        [-45, -2],
        [-43, -16],
      ],
      [
        [-36, 17],
        [-24, 17],
        [-8, 14],
        [1, 17],
        [14, 16],
        [28, 12],
        [42, 13],
        [56, 14],
        [64, 20],
      ],
    ]) {
      const points = route.map(([x, z]) => new THREE.Vector3(x, 0, z))
      const trail = new THREE.CatmullRomCurve3(points)
      const steps = Math.round(trail.getLength() * 2)
      for (let i = 0; i <= steps; i++) {
        const point = trail.getPointAt(i / steps),
          dir = trail.getTangentAt(i / steps)
        c.save()
        c.translate(point.x, point.z)
        c.rotate(Math.atan2(dir.z, dir.x))
        c.fillStyle = 'rgba(145,167,193,.13)'
        c.beginPath()
        c.ellipse(0, 0, 0.83, 1.55, 0.04, 0, Math.PI * 2)
        c.fill()
        c.fillStyle = 'rgba(106,135,162,.32)'
        for (const side of [-1, 1]) c.fillRect(-0.29, side * 0.65, 0.62, 0.064)
        c.fillStyle = 'rgba(88,117,146,.5)'
        c.beginPath()
        c.ellipse(0, 0.14 * (i % 2 ? 1 : -1) + rng() * 0.13, 0.18, 0.09, 0.13, 0, Math.PI * 2)
        c.fill()
        c.restore()
      }
    }
  })
  const terrain = new THREE.Mesh(
    snow,
    new THREE.MeshStandardMaterial({ map: paths, vertexColors: true, roughness: 0.97, metalness: 0 }),
  )
  terrain.receiveShadow = true
  group.add(terrain)
  const rng = winterRandom(221224)
  const flakes = new Float32Array(460 * 3)
  for (let i = 0; i < flakes.length; i += 3) {
    flakes[i] = rng() * 132 - 66
    flakes[i + 1] = rng() * 36
    flakes[i + 2] = rng() * 108 - 54
  }
  const snowGeo = new THREE.BufferGeometry()
  snowGeo.setAttribute('position', new THREE.BufferAttribute(flakes, 3))
  const snowfall = new THREE.Points(
    snowGeo,
    new THREE.ShaderMaterial({
      uniforms: { time: { value: 0 } },
      vertexShader: `
      uniform float time;
      void main() {
        vec3 p = position;
        p.y = mod(position.y - time * .72, 36.0);
        p.x += .34 * sin(p.y * .45 + position.z);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = clamp(18.0 / max(1.,-mv.z), 1.0, 2.9);
      }`,
      fragmentShader: `void main() {
      float d = length(gl_PointCoord - vec2(.5));
      gl_FragColor = vec4(.94,.96,1.,.65 * (1. - smoothstep(.2,.5,d)));
      #include <colorspace_fragment>
    }`,
      transparent: true,
      depthWrite: false,
    }),
  )
  group.add(snowfall)
  return {
    ground: groundMesh,
    frameCamera(camera: THREE.Camera) {
      sky.position.copy(camera.position)
    },
    setRaceTime(seconds: number) {
      snowfall.material.uniforms.time.value = seconds
    },
  }
}
