import * as THREE from 'three'
import type { CourseTrack } from './track'
import { checkpointRack } from './courses/checkpointRack'
import type { MarbleState } from './simulation'
import { SceneryBatch, lifted, type Material } from './sceneryKit'

/** Once the timing beam has classified the last arrival, a short return chute
 * takes its marble to a pocket beside the starting rack. Both the visible
 * chute and the post-cut roll follow this curve. */
export function createCheckpointRejectChute(track: CourseTrack, throat: number, machine: THREE.Group,
  finishes: { rubber: Material; stripe: Material; chrome: Material; label: Material }) {
  const { rubber, stripe, chrome, label } = finishes
  const fixed = new SceneryBatch(), ports = new SceneryBatch()
  const at = (ds: number, l: number, dy: number) => lifted(track.sample(throat + ds, l), dy)
  const pocket = -(track.halfWidth - .60)
  // An air jet pops the eliminated marble into an elevated side return before
  // it crosses the qualifying belt. The outside rail slopes down into the cup.
  const chute = new THREE.CatmullRomCurve3([
    at(-.35, -1.60, 1.54), at(-.32, -2.62, 1.52), at(.20, pocket, 1.40),
    at(1.35, pocket, 1.14), at(3.15, pocket, .39), at(4.33, pocket, .095),
  ])
  const sidePoint = (u: number, offset: number, y = 0) => {
    const p = chute.getPoint(u), t = chute.getTangent(u)
    const scale = offset / Math.hypot(t.x, t.z)
    p.x -= t.z * scale; p.z += t.x * scale; p.y += y
    return p
  }
  fixed.surface(rubber, 0, 8, (d, t) => sidePoint(d / 8, (t - .5) * .94), .94, 2)
  for (const side of [-1, 1]) {
    fixed.surface(stripe, 0, 8, (d, t) => sidePoint(d / 8, side * (.34 + t * .082), .009), .082)
    for (let i = 0; i < 24; i++) {
      fixed.rod(chrome, sidePoint(i / 24, side * .435, .08), sidePoint((i + 1) / 24, side * .435, .08), .044)
    }
  }
  for (const u of [.43, .70]) {
    const mount = sidePoint(u, .08, -.03)
    const floor = track.locate(mount.x, mount.z, throat)
    fixed.rod(chrome, lifted(track.sample(floor.s, floor.lateral), .03), mount, .057)
  }
  // Recessed jet ports span every possible crossing position at the fork.
  for (let i = -3; i <= 3; i++) {
    const nozzle = at(-track.radius, i * .27, .058)
    fixed.rod(chrome, nozzle, nozzle.clone().add(new THREE.Vector3(0, .035, 0)), .096, 12)
    ports.rod(stripe, nozzle.clone().add(new THREE.Vector3(0, .035, 0)),
      nozzle.clone().add(new THREE.Vector3(0, .04, 0)), .064, 12)
  }
  const cup = chute.getPoint(1)
  const rim = new THREE.LatheGeometry([
    new THREE.Vector2(.32, -.035), new THREE.Vector2(.47, -.022),
    new THREE.Vector2(.54, .045), new THREE.Vector2(.585, .21),
    new THREE.Vector2(.54, .25), new THREE.Vector2(.475, .12),
    new THREE.Vector2(.38, .012),
  ], 24, 0, Math.PI * 1.48)
  const lane = track.sample(throat)
  const yaw = Math.atan2(lane.tx, lane.tz)
  fixed.add(stripe, rim, new THREE.Matrix4().makeRotationY(yaw - Math.PI * .74).setPosition(cup))
  fixed.rod(rubber, cup.clone().add(new THREE.Vector3(0, -.026, 0)), cup, .47, 24)
  // Mount the identification tab outboard, clear of the support for the moving bar.
  const sign = at(3.65, -track.halfWidth - .28, 1.25)
  const bracket = at(3.65, -track.halfWidth - .10, .53)
  fixed.rod(chrome, bracket, sign, .047, 6)
  fixed.box(rubber, sign, [1.03, .37, .13], yaw)
  const transform = new THREE.Matrix4().makeRotationY(yaw).setPosition(sign.clone().add(new THREE.Vector3(.074 * lane.tx, 0, .074 * lane.tz)))
  fixed.add(label, new THREE.PlaneGeometry(.94, .31), transform)
  const jetLights = new THREE.Group()
  fixed.finish(machine); ports.finish(jetLights); machine.add(jetLights)

  const join = chute.getPoint(0), start = new THREE.Vector3(), axis = new THREE.Vector3()
  const rotation = new THREE.Quaternion(), velocity = new THREE.Vector3()
  const neighbor = new THREE.Vector3(), separation = new THREE.Vector3()
  function roll(mesh: THREE.Object3D, marble: MarbleState, seconds: number, divertedAt: number, pocketAt: number | null,
    field: readonly MarbleState[], alpha: number) {
    // Reconstruct the actual sub-tick crossing pose. It can be on either side
    // of the throat with a qualifying marble immediately alongside it.
    const depth = (p: typeof marble.position) => (p.x - lane.x) * lane.tx + (p.z - lane.z) * lane.tz + track.radius
    const before = depth(marble.previousPosition), after = depth(marble.position)
    const crossed = after > before ? THREE.MathUtils.clamp(-before / (after - before), 0, 1) : 1
    start.lerpVectors(marble.previousPosition, marble.position, crossed)
    velocity.subVectors(marble.position, marble.previousPosition).normalize().multiplyScalar(marble.speed)
    const age = seconds - divertedAt
    const rise = .135, handoff = .31, parked = .43
    if (age < rise) {
      // Match the incoming motion until the marble clears the field vertically.
      // The jet removes its forward momentum over the first part of the flight.
      const u = Math.max(0, age / rise)
      mesh.position.copy(start).addScaledVector(velocity, age < 0 ? age : rise * (u - .5 * u * u))
      if (age >= 0) mesh.position.y = start.y + (join.y + track.radius + .18 - start.y) * u * (2 - u)
      // The cut body has left Rapier. While lifting out of a nose-to-nose pack,
      // let only its displayed center yield to the live, interpolated spheres.
      for (let pass = 0; pass < 3; pass++) {
        let clear = true
        for (const other of field) {
          if (other.cutAt !== undefined) continue
          neighbor.lerpVectors(other.previousPosition, other.position, alpha)
          separation.subVectors(mesh.position, neighbor)
          const distance = separation.length()
          if (distance >= 2 * track.radius || distance < .00001) continue
          mesh.position.addScaledVector(separation, (2 * track.radius - distance) / distance)
          clear = false
        }
        if (clear) break
      }
    } else if (age < handoff) {
      const u = (age - rise) / (handoff - rise)
      mesh.position.copy(start).addScaledVector(velocity, rise / 2)
      mesh.position.y = join.y + track.radius + .18
      mesh.position.lerp(join, u * u * (3 - 2 * u))
      mesh.position.y += track.radius * u * u * (3 - 2 * u)
    } else {
      const intake = THREE.MathUtils.clamp((age - handoff) / (parked - handoff), 0, 1)
      let progress = .43 * intake * (2 - intake)
      if (pocketAt !== null) {
        const rollStart = Math.max(divertedAt + handoff, pocketAt)
        const startFraction = THREE.MathUtils.clamp((rollStart - divertedAt - handoff) / (parked - handoff), 0, 1)
        const from = .43 * startFraction * (2 - startFraction)
        const t = THREE.MathUtils.clamp((seconds - rollStart) / (pocketAt + checkpointRack.pocketTravelSeconds - rollStart), 0, 1)
        if (seconds >= rollStart) progress = from + (1 - from) * t * (2 - t)
      }
      chute.getPoint(progress, mesh.position)
      mesh.position.y += track.radius
    }
    axis.subVectors(mesh.position, start)
    const travel = axis.length()
    axis.set(axis.z, 0, -axis.x).normalize()
    if (travel > .0001) rotation.setFromAxisAngle(axis, travel / track.radius)
    else rotation.identity()
    mesh.quaternion.copy(marble.rotation).premultiply(rotation)
  }
  return { jetLights, roll }
}
