import * as THREE from 'three'
import giantMapUrl from './assets/kepler-giant.jpg'
import { canvasTexture } from './sceneryKit'

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)
const sun = v(-.86, .31, .41).normalize()

function rings() {
  // Each row of texels describes the optical depth of a different belt of ice.
  const bands = canvasTexture(1024, 1, ctx => {
    const data = ctx.createImageData(1024, 1)
    for (let i = 0; i < 1024; i++) {
      const r = i / 1023
      const fade = THREE.MathUtils.smoothstep(r, 0, .042) * (1 - THREE.MathUtils.smoothstep(r, .974, 1))
      const division = THREE.MathUtils.smoothstep(Math.abs(r - .694), .012, .023)
      const density = (.6 + .14 * Math.sin(r * 34) + .09 * Math.sin(r * 141 + 1)
        + .065 * Math.cos(r * 672) + .045 * Math.sin(r * 1055) + .022 * Math.cos(r * 3009))
      const value = Math.min(1, density + (r > .70 ? .03 : .11))
      data.data.set([248 * value, 208 * value, 172 * value, 255 * fade * division * Math.min(.94, density + .27)], i * 4)
    }
    ctx.putImageData(data, 0, 0)
  })
  // RingGeometry's standard UVs project a square. Here U travels radially through the ice.
  const geo = new THREE.RingGeometry(1.27, 2.18, 192, 36)
  geo.rotateX(-Math.PI / 2)
  const xyz = geo.getAttribute('position'), uv = geo.getAttribute('uv'), colors = []
  const ray = v(0, 0, 0)
  for (let i = 0; i < xyz.count; i++) {
    ray.fromBufferAttribute(xyz, i)
    uv.setXY(i, (ray.length() - 1.27) / .91, .5)
    const projection = -ray.dot(sun)
    const shadow = projection > 0 ? THREE.MathUtils.smoothstep(ray.addScaledVector(sun, projection).length(), .94, 1.07) : 1
    colors.push(.039 + .84 * shadow, .044 + .84 * shadow, .072 + .87 * shadow)
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  return new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
    map: bands, vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide,
    forceSinglePass: true, fog: false,
  }))
}

function craterMap() {
  return canvasTexture(512, 256, ctx => {
    ctx.fillStyle = '#9c9ca9'; ctx.fillRect(0, 0, 512, 256)
    let state = 8230
    const random = () => (state = (Math.imul(1664525, state) + 1013904223) >>> 0) / 4294967296
    for (let i = 0; i < 1800; i++) {
      const x = random() * 512, y = random() * 256
      const r = (i < 55 ? 9 + random() * 23 : .5 + random() ** 3 * 6)
      const cr = ctx.createRadialGradient(x, y, .1, x, y, r)
      cr.addColorStop(0, 'rgba(60,63,81,.26)')
      cr.addColorStop(.64, 'rgba(75,78,96,.29)')
      cr.addColorStop(.82, 'rgba(57,59,80,.43)')
      cr.addColorStop(.88, 'rgba(204,203,196,.73)')
      cr.addColorStop(1, 'rgba(176,176,171,0)')
      ctx.fillStyle = cr; ctx.fillRect(x - r, y - r, 2 * r, 2 * r)
    }
  })
}

function globe(map: THREE.Texture, ringShadow: boolean) {
  // Diffuse illumination is baked into the sphere vertices. The miniature station
  // can keep its studio reflections without washing out the planet's night side.
  const geo = new THREE.SphereGeometry(1, ringShadow ? 120 : 48, ringShadow ? 80 : 32)
  const normal = v(0, 0, 0), atRings = v(0, 0, 0), colors = []
  const positions = geo.getAttribute('position')
  for (let i = 0; i < positions.count; i++) {
    normal.fromBufferAttribute(positions, i)
    let light = Math.max(0, normal.dot(sun)) ** .65
    if (ringShadow && normal.y < 0) {
      atRings.copy(normal).addScaledVector(sun, -normal.y / sun.y)
      const r = atRings.length()
      const shade = THREE.MathUtils.smoothstep(r, 1.27, 1.36) * (1 - THREE.MathUtils.smoothstep(r, 2.08, 2.18))
      light *= 1 - .55 * shade
    }
    colors.push(.015 + light, .022 + light, .037 + light)
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  return new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map, vertexColors: true, fog: false }))
}

export function addKeplerSky(group: THREE.Group, lip: { x: number; y: number; z: number }, onReady?: () => void) {
  const giant = new THREE.Group()
  giant.position.set(lip.x + 39, lip.y - 46, lip.z - 133)
  giant.rotation.set(.22, .04, -.25)
  giant.scale.setScalar(19.5)
  const cloudMap = new THREE.TextureLoader().load(giantMapUrl, onReady)
  cloudMap.colorSpace = THREE.SRGBColorSpace
  giant.add(globe(cloudMap, true), rings())
  group.add(giant)

  const moon = globe(craterMap(), false)
  moon.position.set(-77, -20, 52)
  moon.rotation.set(-.18, 2.4, .37)
  moon.scale.setScalar(10.5)
  group.add(moon)

  const shepherd = globe(moon.material.map!, false)
  shepherd.position.copy(giant.position).add(v(-43, 12, 9))
  shepherd.scale.setScalar(2.1)
  group.add(shepherd)
}
