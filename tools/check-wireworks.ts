import assert from 'node:assert/strict'
import RAPIER from '@dimforge/rapier3d-compat'
import type { CourseTrack } from '../src/courseGeometry'
import type { WireworksTrack } from '../src/courses/wireworks'
import { receivingDeck } from '../src/courses/wireworks'
import design from '../src/courses/wireworks-layout.json'

/** Probe actual contact geometry independently of the course sampler and race rankings. */
export function checkWireworksContacts(course: CourseTrack) {
  const track = course as WireworksTrack
  const world = new RAPIER.World({ x: 0, y: -5.4, z: 0 })
  try {
    for (const mesh of track.collisions) {
      world.createCollider(RAPIER.ColliderDesc.trimesh(mesh.vertices, mesh.indices, RAPIER.TriMeshFlags.FIX_INTERNAL_EDGES))
    }
    world.step()
    // There must be air between the wires and a distinct contact surface under
    // each contact patch, including the tightest part of the drop.
    for (const s of [track.startS, 18, receivingDeck - .6]) {
      for (let lane = 0; lane < track.laneCount; lane++) {
        const centerline = track.sample(s, (lane + .5) * track.laneWidth - track.halfWidth)
        assert.equal(world.castRay(new RAPIER.Ray({ ...centerline, y: centerline.y + .8 }, { x: 0, y: -1, z: 0 }), 2, true), null)
        const colliderHandles = new Set<number>()
        for (const side of [-1, 1] as const) {
          const cap = track.railPoint(s, lane, side, 0)
          const hit = world.castRay(new RAPIER.Ray({ ...cap, y: cap.y + .8 }, { x: 0, y: -1, z: 0 }), 2, true)
          assert.ok(hit && Math.abs(hit.timeOfImpact - .8) < .015, 'Each visible wire must support the marble.')
          colliderHandles.add(hit.collider.handle)
        }
        assert.equal(colliderHandles.size, 2, 'A channel needs two separate running wires.')
      }
    }
    for (const fraction of [.05, .25, .5, .75, .95]) {
      const s = design.forkStart + (design.forkEnd - design.forkStart) * fraction
      for (const lateral of [-track.halfWidth / 2, track.halfWidth / 2]) {
        const p = track.sample(s, lateral)
        const at = track.locate(p.x, p.z, s - .2, p.y + track.radius)
        assert.ok(Math.abs(at.s - s) < .01 && Math.abs(at.lateral - lateral) < .01, 'Branch checkpoints must map to common race progress.')
      }
    }
    // Release an isolated sphere into each branch from the catch deck. It must
    // pass the correct side of the tower and coast through the physical reunion.
    const mid = (design.forkStart + design.forkEnd) * .5, center = track.sample(mid)
    for (const side of [-1, 1]) {
      const p = track.sample(design.forkStart - 2, side * track.halfWidth * .55)
      const body = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(p.x, p.y + track.radius + .01, p.z).setCanSleep(false).setCcdEnabled(true))
      world.createCollider(RAPIER.ColliderDesc.ball(track.radius).setMass(1).setFriction(.45), body)
      let s = design.forkStart - 2, passedTower = false
      for (let tick = 0; tick < 3600 && s < design.forkEnd + 2; tick++) {
        world.step()
        const pos = body.translation()
        s = track.locate(pos.x, pos.z, s, pos.y).s
        if (!passedTower && s >= mid) {
          const lateral = (pos.x - center.x) * center.rx + (pos.z - center.z) * center.rz
          assert.ok(side * lateral > track.radius, 'Isolated racer must round its own side of the tower.')
          passedTower = true
        }
      }
      assert.ok(passedTower && s >= design.forkEnd + 2, 'Each tower branch must rejoin the main deck from rest.')
      world.removeRigidBody(body)
    }
  } finally {
    world.free()
  }
}
