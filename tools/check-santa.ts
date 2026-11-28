import assert from 'node:assert/strict'
import RAPIER from '@dimforge/rapier3d-compat'
import type { CourseTrack } from '../src/courseGeometry'
import { parcel, parcelHeight, pinwheel, santaMachines } from '../src/courses/santaObstacles'
import { attachSantaDrive } from '../src/santaDrive'
import { FIXED_DT } from '../src/simulation'

export function checkSantaObstacles(track: CourseTrack) {
  const { wheels, boxes } = santaMachines(track)
  const world = new RAPIER.World({ x: 0, y: 0, z: 0 })
  world.timestep = FIXED_DT
  try {
    const advance = attachSantaDrive(world, track, 0)
    const probeAt = (x: number, y: number, z: number) => {
      const probe = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(x, y, z).setCanSleep(false))
      world.createCollider(RAPIER.ColliderDesc.ball(track.radius).setMass(1), probe)
      return probe
    }
    // Each probe starts in the free space between arms and is swept sideways.
    const wheelProbes = wheels.map(wheel => {
      const a = -wheel.phase - Math.sign(wheel.period) * Math.PI / pinwheel.arms
      const dx = Math.cos(a), dz = Math.sin(a), dist = pinwheel.reach * .90
      const x = wheel.at.x + dist * dx, z = wheel.at.z + dist * dz
      return { x, z, dx, dz, sign: Math.sign(wheel.period), body: probeAt(x, wheel.at.y + pinwheel.armY, z) }
    })
    for (let i = 1; i <= 120; i++) {
      advance(i * FIXED_DT)
      world.step()
    }
    for (const { body, x, z, dx, dz, sign } of wheelProbes) {
      const p = body.translation()
      const swept = sign * ((p.x - x) * dz - (p.z - z) * dx)
      assert.ok(swept > track.radius, 'A peppermint arm must sweep its probe in the direction of rotation.')
      world.removeRigidBody(body)
    }

    // Roll a marble down the center of each wheel well during the return stroke.
    advance(5)
    world.step()
    const passes = wheels.map(({ at }) => {
      const body = probeAt(at.x - 2.4 * at.tx, at.y + track.radius, at.z - 2.4 * at.tz)
      body.setLinvel({ x: 3 * at.tx, y: 0, z: 3 * at.tz }, true)
      return { at, body }
    })
    for (let i = 1; i <= 96; i++) {
      advance(5 + i * FIXED_DT)
      world.step()
    }
    for (const { at, body } of passes) {
      const p = body.translation()
      assert.ok((p.x - at.x) * at.tx + (p.z - at.z) * at.tz > 2.39, 'The retracted pinwheel must clear a full marble.')
      world.removeRigidBody(body)
    }

    for (const box of boxes) {
      const lowTime = box.period * (1 - box.phase / (2 * Math.PI))
      advance(lowTime)
      world.step()
      const { x, y, z } = box.at
      const probe = probeAt(x, y + track.radius, z)
      const tick = (time: number) => { advance(time); world.step() }
      tick(lowTime)
      assert.ok(Math.abs(probe.translation().y - (y + track.radius)) < .001, 'The retracted parcel must clear the lane.')
      // Start with the gift fully underground and advance the normal race drive through its rise.
      for (let i = 1; i <= Math.ceil(box.period / (2 * FIXED_DT)); i++) tick(lowTime + i * FIXED_DT)
      const lid = y + parcelHeight(box, lowTime + box.period / 2) + parcel.height / 2
      assert.ok(probe.translation().y >= lid + track.radius - .02, 'A rising parcel must lift its probe above the lid.')
      world.removeRigidBody(probe)
    }
  } finally {
    world.free()
  }
}
