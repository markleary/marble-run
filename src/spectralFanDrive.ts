import RAPIER from '@dimforge/rapier3d-compat'
import type { CourseTrack } from './courseGeometry'
import { spectralFan, spectralFanAngle, spectralFanBlade, spectralFanFrame, spectralFanHubBaseY } from './courses/spectralFan'

export function attachSpectralFan(world: RAPIER.World, track: CourseTrack,
  registerSurface?: (collider: RAPIER.Collider) => void) {
  const { center, tilt } = spectralFanFrame(track)
  const rotor = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased()
    .setTranslation(center.x, center.y, center.z).setRotation(tilt))
  // The hub closes the inner end of each pocket. The moving vanes and the
  // stationary rim hold the marbles until the downstream opening.
  const capPoints: number[] = []
  for (let i = 0; i < 32; i++) {
    const angle = 2 * Math.PI * i / 32, x = Math.cos(angle), z = Math.sin(angle)
    capPoints.push(x * spectralFan.hubRadius, spectralFanHubBaseY, z * spectralFan.hubRadius,
      x * spectralFan.hubTopRadius, spectralFan.hubHeight, z * spectralFan.hubTopRadius)
  }
  const hub = world.createCollider(RAPIER.ColliderDesc.convexHull(new Float32Array(capPoints))!
    .setFriction(.26).setRestitution(.08), rotor)
  registerSurface?.(hub)
  for (let i = 0; i < spectralFan.bladeCount; i++) {
    const halfAngle = i * Math.PI / spectralFan.bladeCount
    const blade = RAPIER.ColliderDesc.convexHull(spectralFanBlade.vertices)!
      .setRotation({ x: 0, y: Math.sin(halfAngle), z: 0, w: Math.cos(halfAngle) })
      .setFriction(.31).setRestitution(.09)
    const collider = world.createCollider(blade, rotor)
    registerSurface?.(collider)
  }
  return (seconds: number) => {
    const halfAngle = spectralFanAngle(seconds) / 2, cos = Math.cos(halfAngle), sin = Math.sin(halfAngle)
    // tilt * spin: rotate about the normal of the pitched table.
    rotor.setNextKinematicRotation({ x: tilt.x * cos - tilt.z * sin, y: tilt.w * sin,
      z: tilt.z * cos + tilt.x * sin, w: tilt.w * cos })
  }
}
