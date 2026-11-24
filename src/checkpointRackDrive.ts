import RAPIER from '@dimforge/rapier3d-compat'
import type { CourseTrack } from './courseGeometry'
import { checkpointFunnelTubes, checkpointRack, checkpointRackSlot } from './courses/checkpointRack'
import type { RaceCheckpoint } from './checkpointRace'
import type { MarbleState } from './simulation'

/** The funnel remains static. Its downstream belt steers dynamic marbles against
 * the release bar. The brakes engage only after a ball physically reaches its pad. */
export function attachCheckpointRacks(world: RAPIER.World, track: CourseTrack, gates: RaceCheckpoint[], bodies: RAPIER.RigidBody[]) {
  const racks = gates.filter(gate => gate.cut).map(gate => {
    for (const { start: a, end: b, radius } of checkpointFunnelTubes(track, gate.s, gate.number)) {
      const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z
      const length = Math.hypot(dx, dy, dz), norm = Math.sqrt(2 * length * (length + dy))
      world.createCollider(RAPIER.ColliderDesc.capsule(length / 2, radius)
        .setTranslation((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2)
        .setRotation({ x: dz / norm, y: 0, z: -dx / norm, w: (length + dy) / norm })
        .setFriction(.02).setRestitution(.03))
    }
    const p = track.sample(gate.s + checkpointRack.barOffset)
    const halfYaw = -.5 * Math.atan2(p.tz, p.tx)
    const halfBar = checkpointRackSlot(gate.field - 1, gate.field - 2) + .66
    const bar = world.createCollider(RAPIER.ColliderDesc.cuboid(.06, .35, halfBar)
      .setTranslation(p.x, p.y + .35, p.z).setRotation({ x: 0, y: Math.sin(halfYaw), z: 0, w: Math.cos(halfYaw) })
      .setFriction(.05).setRestitution(0))
    const apron = track.sample(gate.s + checkpointRack.launchEnd)
    const launchGrade = (apron.y - p.y) / (checkpointRack.launchEnd - checkpointRack.barOffset)
    return { gate, bar, launchGrade, inlet: [] as number[] }
  })

  return (marbles: MarbleState[], elapsed: number, dt: number) => {
    for (const rack of racks) {
      const { gate, bar } = rack
      const { tx, tz, rx, rz } = gate.line
      // Padded inlet rollers progressively scrub excess speed over the taper.
      // Places have already been awarded at the entrance to these rollers.
      if (gate.releasedAt === null) {
        for (const marble of marbles) {
          const remaining = gate.s - marble.distance
          if (marble.cutAt || remaining <= track.radius || remaining > checkpointRack.funnelLength) continue
          const body = bodies[marble.id], velocity = body.linvel()
          const forward = velocity.x * tx + velocity.z * tz
          const limit = Math.sqrt(4.2 ** 2 + 4 * remaining)
          const brake = Math.min(5.5 * dt, Math.max(0, forward - limit))
          if (brake > 0) {
            body.applyImpulse({ x: -brake * tx, y: 0, z: -brake * tz }, true)
            const torque = .4 * track.radius * brake
            body.applyTorqueImpulse({ x: -torque * tz, y: 0, z: torque * tx }, true)
          }
        }
      }
      // The exit rollers spin up as one bank. Push each freely colliding ball
      // along the inclined launch apron and stop driving at the end of the belt.
      if (gate.releasedAt !== null && elapsed - gate.releasedAt < 2) {
        for (const id of gate.seated) {
          if (marbles[id].distance >= gate.s + checkpointRack.launchEnd) continue
          const body = bodies[id], velocity = body.linvel()
          const push = Math.min(10 * dt, Math.max(0, checkpointRack.launchSpeed - velocity.x * tx - velocity.z * tz))
          body.applyImpulse({ x: tx * push, y: rack.launchGrade * push, z: tz * push }, true)
        }
      }
      if (gate.phase !== 'loading') continue
      const capacity = gate.field - 1
      let previousAlong = Infinity
      for (let slot = 0; slot < Math.min(gate.arrivals.length, capacity); slot++) {
        const { id } = gate.arrivals[slot], marble = marbles[id], body = bodies[id]
        const dx = marble.position.x - gate.line.x, dz = marble.position.z - gate.line.z
        const along = dx * tx + dz * tz, lateral = dx * rx + dz * rz
        const earlier = previousAlong
        previousAlong = along
        if (along < -track.radius || gate.seated.includes(id)) continue
        rack.inlet[slot] ??= lateral
        const seat = checkpointRackSlot(capacity, slot)
        if (Math.abs(checkpointRack.seatOffset - along) < .10 && Math.abs(seat - lateral) < .10 && marble.speed < .38) {
          body.setLinvel({ x: 0, y: 0, z: 0 }, true)
          body.setAngvel({ x: 0, y: 0, z: 0 }, true)
          body.setBodyType(RAPIER.RigidBodyType.Fixed, true)
          marble.speed = 0
          gate.seated.push(id)
          continue
        }
        // Fan out after clearing the funnel nose. Space successive transfers
        // along the feed belt until the preceding racer enters its numbered pad.
        const fan = Math.min(1, Math.max(0, (along - .1) / 3.2))
        const guide = rack.inlet[slot] + (seat - rack.inlet[slot]) * fan * fan * (3 - 2 * fan)
        // An overtake in the funnel may already have put this qualifier ahead.
        // Let it clear the throat instead of blocking the earlier entrant behind it.
        const destination = earlier > along && earlier < 3.8 ? Math.max(.15, earlier - .94) : checkpointRack.seatOffset
        const forward = Math.min(3.9, Math.max(-1.1, (destination - along) * 3))
        const side = Math.min(2.9, Math.max(-2.9, (guide - lateral) * 4.4))
        const velocity = body.linvel()
        const grip = 1 - Math.exp(-10 * dt)
        body.applyImpulse({
          x: grip * (forward * tx + side * rx - velocity.x),
          y: 0,
          z: grip * (forward * tz + side * rz - velocity.z),
        }, true)
        // The belt also slows the rolling surface. A sphere brought to rest
        // translationally with its old spin would skid forward into the gate.
        const spin = body.angvel(), radius = track.radius, inertia = .4 * radius * radius
        body.applyTorqueImpulse({
          x: grip * inertia * ((forward * tz + side * rz) / radius - spin.x),
          y: 0,
          z: grip * inertia * (-(forward * tx + side * rx) / radius - spin.z),
        }, true)
      }
      const last = gate.arrivals[capacity]
      if (last && marbles[last.id].cutAt === gate.number && gate.seated.length === capacity) {
        gate.pocketAt ??= elapsed
      }
      if (gate.pocketAt !== null && elapsed >= gate.pocketAt + checkpointRack.pocketTravelSeconds + .15) {
        world.removeCollider(bar, true)
        for (const id of gate.seated) {
          bodies[id].setBodyType(RAPIER.RigidBodyType.Dynamic, true)
          marbles[id].stagingAt = undefined
          marbles[id].rackSlot = undefined
        }
        gate.releasedAt = elapsed
        gate.phase = 'released'
      }
    }
  }
}
