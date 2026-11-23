import * as THREE from 'three'
import { canvasTexture } from './sceneryKit'
import type { CourseTrack } from './track'
import type { MarbleState } from './simulation'
import type { Racer } from './ui'

export function spectralPaint(racer: Racer) {
  return canvasTexture(512, 256, c => {
    c.fillStyle = racer.color
    c.fillRect(0, 0, 512, 256)
    // Broad cells survive minification as the camera pulls away from the pack.
    c.strokeStyle = 'rgba(255,255,255,.41)'
    c.lineWidth = 1.8
    const r = 512 / 24
    for (let x = -1; x < 18; x++) for (let y = -1; y < 9; y++) {
      const cx = x * r * 1.5, cy = (2 * y + (x & 1)) * 18
      c.beginPath(); c.moveTo(cx - r, cy); c.lineTo(cx - r / 2, cy - 18)
      c.lineTo(cx + r / 2, cy - 18); c.lineTo(cx + r, cy); c.stroke()
    }
    for (const x of [100, 356]) {
      c.fillStyle = '#10152c'; c.beginPath(); c.arc(x, 128, 32, 0, Math.PI * 2); c.fill()
      c.strokeStyle = '#def5ff'; c.lineWidth = 3; c.stroke()
      c.fillStyle = '#f5fcff'; c.font = 'bold 43px Arial'; c.textAlign = 'center'; c.textBaseline = 'middle'
      c.fillText(String(racer.symbol + 1), x, 129)
    }
  })
}

export function spectralReflections(group: THREE.Group, track: CourseTrack) {
  const map = canvasTexture(64, 64, c => {
    const glow = c.createRadialGradient(32, 32, 0, 32, 32, 32)
    glow.addColorStop(0, 'rgba(255,255,255,.94)')
    glow.addColorStop(.32, 'rgba(255,255,255,.53)')
    glow.addColorStop(.7, 'rgba(255,255,255,.13)')
    glow.addColorStop(1, 'rgba(255,255,255,0)')
    c.fillStyle = glow
    c.fillRect(0, 0, 64, 64)
  })
  const shape = new THREE.PlaneGeometry(2.15, 2.15)
  const pools = Array.from({ length: track.laneCount }, () => {
    const m = new THREE.Mesh(shape, new THREE.MeshBasicMaterial({
      map, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, toneMapped: false,
    }))
    m.visible = false
    group.add(m)
    return m
  })
  const across = new THREE.Vector3(), tangent = new THREE.Vector3(), z = new THREE.Vector3(0, 0, 1)
  return {
    entrants(racers: Racer[]) {
      pools.forEach((pool, i) => {
        pool.visible = false
        if (racers[i]) pool.material.color.set(racers[i].color)
      })
    },
    update(marbles: MarbleState[], meshes: readonly THREE.Mesh[], displayDistances: readonly number[]) {
      for (const m of marbles) {
        const pool = pools[m.id], position = meshes[m.id].position
        const s = Math.max(track.startS, displayDistances[m.id]), line = track.sample(s)
        const lateral = (position.x - line.x) * line.rx + (position.z - line.z) * line.rz
        const floor = track.sample(s, lateral), side = track.sample(s, lateral + .04)
        const near = track.sample(s - .08, lateral), far = track.sample(s + .08, lateral)
        across.set(side.x - floor.x, side.y - floor.y, side.z - floor.z)
        tangent.set(far.x - near.x, far.y - near.y, far.z - near.z)
        const normal = across.cross(tangent).normalize()
        pool.position.set(floor.x, floor.y, floor.z).addScaledVector(normal, .035)
        pool.quaternion.setFromUnitVectors(z, normal)
        pool.visible = pool.position.distanceToSquared(position) < 1.15
      }
    },
  }
}
