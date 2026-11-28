import RAPIER from '@dimforge/rapier3d-compat'
import type { CourseTrack } from './courseGeometry'
import { parcel, parcelHeight, pinwheel, pinwheelAngle, pinwheelLift, santaCue, santaMachines } from './courses/santaObstacles'

const turn = (angle: number) => ({ x: 0, y: Math.sin(angle / 2), z: 0, w: Math.cos(angle / 2) })

export function attachSantaDrive(world: RAPIER.World, track: CourseTrack, seed: number) {
  const cue = santaCue(seed)
  const { wheels, boxes } = santaMachines(track)
  const rotors = wheels.map(wheel => {
    const { x, y, z } = wheel.at
    const body = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased()
      .setTranslation(x, y + pinwheelLift(wheel, cue), z).setRotation(turn(pinwheelAngle(wheel, cue))))
    const hub = RAPIER.ColliderDesc.cylinder(pinwheel.axleHeight / 2, pinwheel.axleRadius)
      .setTranslation(0, pinwheel.axleHeight / 2, 0).setFriction(.12).setRestitution(.18)
    world.createCollider(hub, body)
    for (let i = 0; i < pinwheel.arms; i++) {
      const a = 2 * Math.PI * i / pinwheel.arms
      const dx = Math.cos(a), dz = Math.sin(a), reach = pinwheel.reach
      const stick = RAPIER.ColliderDesc.capsule(reach / 2, pinwheel.stickRadius)
        .setTranslation(dx * reach / 2, pinwheel.armY, dz * reach / 2)
        .setRotation({ x: dz * Math.SQRT1_2, y: 0, z: -dx * Math.SQRT1_2, w: Math.SQRT1_2 })
        .setFriction(.14).setRestitution(.24)
      world.createCollider(stick, body)
      world.createCollider(RAPIER.ColliderDesc.ball(pinwheel.tipRadius)
        .setTranslation(dx * reach, pinwheel.armY, dz * reach).setFriction(.12).setRestitution(.24), body)
    }
    return body
  })
  const lifts = boxes.map(box => {
    const { x, y, z } = box.at
    const body = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased()
      .setTranslation(x, y + parcelHeight(box, cue), z).setRotation(turn(box.yaw)))
    const r = parcel.bevel
    world.createCollider(RAPIER.ColliderDesc.roundCuboid(parcel.width / 2 - r, parcel.height / 2 - r,
      parcel.depth / 2 - r, r).setFriction(.18).setRestitution(.12), body)
    // A rounded proxy across the two ribbon loops catches a marble riding on the lid.
    world.createCollider(RAPIER.ColliderDesc.capsule(parcel.bowSpan, parcel.bowRadius)
      .setRotation({ x: 0, y: 0, z: Math.SQRT1_2, w: Math.SQRT1_2 })
      .setTranslation(0, parcel.height / 2 + parcel.bowHeight, 0).setFriction(.18), body)
    return body
  })
  return (seconds: number) => {
    const time = seconds + cue
    rotors.forEach((body, i) => {
      const wheel = wheels[i], { x, y, z } = wheel.at
      body.setNextKinematicRotation(turn(pinwheelAngle(wheel, time)))
      body.setNextKinematicTranslation({ x, y: y + pinwheelLift(wheel, time), z })
    })
    lifts.forEach((body, i) => {
      const box = boxes[i], { x, y, z } = box.at
      body.setNextKinematicTranslation({ x, y: y + parcelHeight(box, time), z })
    })
  }
}
