import RAPIER from '@dimforge/rapier3d-compat'
import type { CourseTrack } from './courseGeometry'
import { afterglowCue, faders, faderPose } from './courses/afterglow'

/** The pucks ride on horizontal mixer slots. A side impact picks up the slider's velocity. */
export function attachAfterglowDrive(world: RAPIER.World, track: CourseTrack, seed: number) {
  const cue = afterglowCue(seed)
  const bodies = faders.map(fader => {
    const p = faderPose(track, fader, cue)
    const body = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(p.x, p.y, p.z))
    const buried = .24, bevel = .12
    const collider = RAPIER.ColliderDesc.roundCylinder((fader.height + buried) / 2 - bevel, fader.radius - bevel, bevel)
      .setTranslation(0, (fader.height - buried) / 2, 0).setFriction(.16).setRestitution(.32)
    world.createCollider(collider, body)
    return body
  })
  return (seconds: number) => bodies.forEach((body, i) => body.setNextKinematicTranslation(faderPose(track, faders[i], seconds + cue)))
}
