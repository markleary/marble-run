import RAPIER from '@dimforge/rapier3d-compat'
import type { CourseTrack } from './courseGeometry'
import { bobRadius, bobRestHeight, pendulums, pendulumAngle } from './courses/orrery'

const rotation = (angle: number) => ({ x: Math.sin(angle / 2), y: 0, z: 0, w: Math.cos(angle / 2) })

/** Advance the clock drive before each fixed physics step so contact has angular velocity. */
export function attachOrreryDrive(world: RAPIER.World, track: CourseTrack) {
  const axles = pendulums.map(pendulum => {
    const p = track.sample(pendulum.s, pendulum.lateral)
    const body = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased()
      .setTranslation(p.x, p.y + bobRestHeight + pendulum.length, p.z)
      .setRotation(rotation(pendulumAngle(pendulum, 0))))
    world.createCollider(RAPIER.ColliderDesc.ball(bobRadius).setTranslation(0, -pendulum.length, 0)
      .setFriction(.18).setRestitution(.18), body)
    world.createCollider(RAPIER.ColliderDesc.cylinder(pendulum.length / 2, .047)
      .setTranslation(0, -pendulum.length / 2, 0).setFriction(.18), body)
    return body
  })
  return (time: number) => {
    axles.forEach((body, i) => body.setNextKinematicRotation(rotation(pendulumAngle(pendulums[i], time))))
  }
}
