import { bankAt, buildCourse, clamp, ease, launchTrim, type CourseTrack, type PathPiece, type Profile } from '../courseGeometry'
import layout from './kepler-layout.json'

const { sections, jump, halfWidth } = layout

function relayProfile(pieces: PathPiece[]): Profile {
  const telemetry = sections[3]
  return {
    divider: s => 1 - ease(5, sections[0].end, s),
    deflectors: [],
    spans: [
      { start: 0, end: jump.takeoff, surface: 'alloy' },
      { start: jump.landing, end: sections[9].end, surface: 'glass' },
    ],
    wallHeight: s => 1.12 + .78 * ease(jump.takeoff, jump.landing, s) * (1 - ease(jump.landing + 12, jump.landing + 22, s)),
    height(s, lateral) {
      const bank = bankAt(s, pieces[1], -.065) + bankAt(s, pieces[2], .065)
        + bankAt(s, pieces[4], -.14, 7) + bankAt(s, pieces[6], .14, 7)
        + bankAt(s, pieces[8], -.13, 6) + bankAt(s, pieces[9], .13, 6)
      const launch = launchTrim(lateral / halfWidth, layout.launchTrims) * (1 - ease(2, sections[0].end, s))
      // Two shallow gravity wells roll the pack across the telemetry antenna bed.
      const phase = clamp((s - telemetry.start) / (telemetry.end - telemetry.start), 0, 1)
      const crossfall = .068 * Math.sin(phase * 4 * Math.PI) * Math.sin(phase * Math.PI) ** 2
      const telemetryDrop = .037 * clamp(s - (telemetry.start - 8), 0, telemetry.end - telemetry.start + 16)
      const dive = 8.4 * ease(jump.diveStart, jump.rampStart, s)
      const ramp = clamp((s - jump.rampStart) / (jump.takeoff - jump.rampStart), 0, 1)
      // The sweep at the bottom is tangent to the dive. Beyond the lip, only
      // the coordinate used by progress and cameras spans the vacuum.
      const lip = 2.05 * ramp ** 2.2
      const transferDrop = 7.6 * ease(jump.takeoff, jump.landing, s)
      // The shoulders taper into a flat arresting tray at the end wall.
      const flume = .045 * lateral ** 2 * ease(jump.takeoff, jump.landing, s) * (1 - ease(sections[9].start, layout.finishS, s))
      return 38 - .055 * s - 1.55 * (1 - Math.exp(-s / 7)) + launch + lateral * (bank + crossfall)
        - telemetryDrop - dive + lip - transferDrop + flume
    },
  }
}

// Emitters on each side of the straight form vertical curtains. They can
// reflect a sideways launch but have no upward-facing contact surface.
export function keplerCurtain(track: CourseTrack, side: number) {
  const lip = track.sample(jump.takeoff, side * halfWidth)
  const receiver = track.sample(jump.landing + 16, side * halfWidth)
  const bottom = receiver.y - .2
  return [
    { x: lip.x, y: bottom, z: lip.z }, { x: lip.x, y: lip.y + 7, z: lip.z },
    { x: receiver.x, y: bottom, z: receiver.z }, { x: receiver.x, y: receiver.y + 5, z: receiver.z },
  ] as const
}

export function buildKeplerTrack() {
  const track = buildCourse('kepler', layout, relayProfile)
  const vertices = [-1, 1].flatMap(side => keplerCurtain(track, side).flatMap(p => [p.x, p.y, p.z]))
  track.collisions.push({
    surface: 'alloy', vertices: new Float32Array(vertices),
    indices: new Uint32Array([0, 2, 1, 1, 2, 3, 4, 5, 6, 5, 7, 6]),
  })
  return track
}
