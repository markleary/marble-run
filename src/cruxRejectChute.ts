import * as THREE from 'three'
import type { CourseTrack } from './track'
import { cruxRack } from './courses/cruxCheckpoints'
import type { MarbleState } from './simulation'
import { SceneryBatch, lifted, type Material } from './sceneryKit'

/** Once the timing beam has classified the last arrival, a short return chute
 * takes its marble to a pocket beside the starting rack. Both the visible
 * chute and the post-cut roll follow this curve. */
export function createCruxRejectChute(track: CourseTrack, throat: number, machine: THREE.Group,
  finishes: { rubber: Material; stripe: Material; chrome: Material; label: Material }) {
  const { rubber, stripe, chrome, label } = finishes
  const fixed = new SceneryBatch(), blade = new SceneryBatch()
  const at = (ds: number, l: number, dy: number) => lifted(track.sample(throat + ds, l), dy)
  const pocket = -(track.halfWidth - .60)
  const center = new THREE.CubicBezierCurve3(at(.85, -.95, .105), at(1.6, -1.86, .105),
    at(1.96, pocket, .10), at(4.33, pocket, .095))
  const sidePoint = (u: number, offset: number, y = 0) => {
    const p = center.getPoint(u), t = center.getTangent(u)
    const scale = offset / Math.hypot(t.x, t.z)
    p.x -= t.z * scale; p.z += t.x * scale; p.y += y
    return p
  }
  fixed.surface(rubber, 0, 6, (d, t) => sidePoint(d / 6, (t - .5) * .94), .94, 2)
  for (const side of [-1, 1]) {
    fixed.surface(stripe, 0, 6, (d, t) => sidePoint(d / 6, side * (.34 + t * .082), .009), .082)
    for (let i = 0; i < 10; i++) {
      // The inlet guides rise only after the last qualifier has passed them.
      const batch = i < 5 ? blade : fixed
      batch.rod(chrome, sidePoint(i / 10, side * .435, .08), sidePoint((i + 1) / 10, side * .435, .08), .044)
    }
  }
  const cup = center.getPoint(1)
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
  const switchBlade = new THREE.Group()
  fixed.finish(machine); blade.finish(switchBlade); machine.add(switchBlade)

  const join = center.getPoint(0), start = new THREE.Vector3(), axis = new THREE.Vector3()
  const rotation = new THREE.Quaternion(), upstream = new THREE.Vector3()
  function roll(mesh: THREE.Object3D, marble: MarbleState, seconds: number, divertedAt: number, pocketAt: number | null) {
    // Pull into the side guide immediately, leaving the throat clear if a qualifier
    // was passed inside the funnel. Wait here until the last qualifying pad fills.
    const guideTime = Math.min(seconds, pocketAt ?? seconds) - divertedAt
    const guide = .63 * (1 - (1 - THREE.MathUtils.clamp(guideTime / .38, 0, 1)) ** 1.45)
    const t = pocketAt === null ? 0 : THREE.MathUtils.clamp((seconds - pocketAt) / cruxRack.pocketTravelSeconds, 0, 1)
    const progress = guide + (1 - guide) * (1 - (1 - t) ** 1.45)
    start.copy(marble.position)
    // Start at the actual pose and heading where the marble stopped at the fork.
    upstream.subVectors(marble.position, marble.previousPosition).setY(0)
    if (upstream.lengthSq() === 0) upstream.set(lane.tx, 0, lane.tz)
    upstream.normalize().multiplyScalar(.72).add(start)
    if (progress < .26) {
      const u = progress / .26, b = 1 - u
      mesh.position.copy(start).multiplyScalar(b * b).addScaledVector(upstream, 2 * b * u).addScaledVector(join, u * u)
      mesh.position.y += u * u * track.radius
    } else {
      center.getPoint((progress - .26) / .74, mesh.position)
      mesh.position.y += track.radius
    }
    axis.subVectors(mesh.position, start)
    const travel = axis.length()
    axis.set(axis.z, 0, -axis.x).normalize()
    if (travel > .0001) rotation.setFromAxisAngle(axis, travel / track.radius)
    else rotation.identity()
    mesh.quaternion.copy(marble.rotation).premultiply(rotation)
  }
  return { switchBlade, roll }
}
