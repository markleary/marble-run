import assert from 'node:assert/strict'
import RAPIER from '@dimforge/rapier3d-compat'
import { attachAfterglowDrive } from '../src/afterglowDrive'
import { afterglowCue, faders, faderPose } from '../src/courses/afterglow'
import type { CourseTrack } from '../src/courseGeometry'
import { FIXED_DT } from '../src/simulation'

export function checkAfterglow(track: CourseTrack) {
  const bridge = track.sections.find(section => section.name === 'Mono Bridge')!
  const center = (bridge.start + bridge.end) / 2
  const left = track.sample(center, -track.halfWidth), right = track.sample(center, track.halfWidth)
  const width = Math.hypot(left.x - right.x, left.z - right.z)
  assert.ok(width < .4 * track.halfWidth * 2 && width > 6 * track.radius, 'The mono stretch should fit three marbles abreast.')

  // Trace both shoulders across the stacked bridges, including the narrow
  // one. Ranking must recover the correct deck even with no prior distance.
  for (let s = 1; s < track.finishS; s += .5) {
    for (const lateral of [-track.halfWidth, 0, track.halfWidth]) {
      const p = track.sample(s, lateral)
      const at = track.locate(p.x, p.z, undefined, p.y + track.radius)
      assert.ok(Math.abs(at.s - s) < .08 && Math.abs(at.lateral - lateral) < .08, 'Wrong deck or lane at ' + s)
    }
  }

  // Place a ball in each mixer's path and run the actual Rapier drive.
  // Each sphere starts clear of its puck and must be pushed by its travel.
  const world = new RAPIER.World({ x: 0, y: 0, z: 0 })
  try {
    world.timestep = FIXED_DT
    const seed = 12
    const advance = attachAfterglowDrive(world, track, seed)
    const probes = faders.map(fader => {
      const start = faderPose(track, fader, afterglowCue(seed))
      const middle = track.sample(fader.s, fader.center)
      const side = (start.x - middle.x) * middle.rx + (start.z - middle.z) * middle.rz >= 0 ? -1 : 1
      const p = track.sample(fader.s, fader.center + side * fader.travel)
      const body = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(p.x, p.y + track.radius, p.z))
      world.createCollider(RAPIER.ColliderDesc.ball(track.radius).setMass(1), body)
      return { body, p }
    })
    for (let tick = 1; tick <= 360; tick++) {
      advance(tick * FIXED_DT)
      world.step()
    }
    for (const { body, p } of probes) {
      const end = body.translation()
      assert.ok(Math.hypot(end.x - p.x, end.z - p.z) > track.radius, 'A crossfader failed to move its marble.')
    }
  } finally {
    world.free()
  }
}
