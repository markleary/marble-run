import * as THREE from 'three'
import type { CourseTrack } from './track'
import { checkpointRack, checkpointPocketRim } from './courses/checkpointRack'
import { SceneryBatch, lifted, type Material } from './sceneryKit'

/** The red switch belt turns into an open-sided cup on the same deck as the fork. */
export function createCheckpointRejectChute(track: CourseTrack, throat: number, machine: THREE.Group,
  finishes: { rubber: Material; stripe: Material; chrome: Material; label: Material }) {
  const { rubber, stripe, chrome, label } = finishes
  const fixed = new SceneryBatch(.12)
  const at = (ds: number, lateral: number, lift: number) => lifted(track.sample(throat + ds, lateral), lift)
  const end = checkpointRack.pocketOffset, pocket = -track.halfWidth + checkpointRack.pocketSideInset
  const lane = track.sample(throat), yaw = Math.atan2(lane.tx, lane.tz)
  // Set the belt flush with the brake rollers. Colored edges and transverse
  // treads make its direction legible while the sphere rolls across them.
  const turn = new THREE.CubicBezierCurve(
    new THREE.Vector2(.08, 0), new THREE.Vector2(end * .77, 0),
    new THREE.Vector2(end, pocket * .48), new THREE.Vector2(end, pocket),
  )
  const length = turn.getLength()
  const point = (distance: number, offset: number, lift: number) => {
    const t = distance / length, p = turn.getPointAt(t), tangent = turn.getTangentAt(t)
    return at(p.x - tangent.y * offset, p.y + tangent.x * offset, lift)
  }
  fixed.surface(rubber, 0, length, (d, t) => point(d, (t - .5) * 1.25, .047), 1.25, 2)
  for (const side of [-1, 1]) {
    fixed.surface(stripe, 0, length, (d, t) => point(d, side * (.50 + .10 * t), .056), .10)
  }
  for (let d = .20; d < length - .45; d += .30) {
    fixed.surface(chrome, d, d + .045, (s, t) => point(s, (t - .5) * .88, .057), .88)
  }
  const cup = at(end, pocket, .048)
  fixed.rod(rubber, cup.clone().add(new THREE.Vector3(0, -.019, 0)), cup, .53, 24)
  const rim = checkpointPocketRim(track, throat).map(p => lifted(p, .13))
  for (let i = 1; i < rim.length; i++) fixed.rod(stripe, rim[i - 1], rim[i], .065, 8)

  const sign = at(end, -track.halfWidth - .28, 1.05)
  const bracket = at(end, -track.halfWidth - .10, .30)
  fixed.rod(chrome, bracket, sign, .047, 6)
  fixed.box(rubber, sign, [1.03, .37, .13], yaw)
  const transform = new THREE.Matrix4().makeRotationY(yaw).setPosition(sign.clone().add(new THREE.Vector3(.074 * lane.tx, 0, .074 * lane.tz)))
  fixed.add(label, new THREE.PlaneGeometry(.94, .31), transform)
  fixed.finish(machine)
}
