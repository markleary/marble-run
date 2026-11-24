import { bankAt, buildCourse, clamp, ease, launchTrim, type CourseTrack, type PathPiece, type Profile } from '../courseGeometry'
import layout from './afterglow-layout.json'

const [grid, alley, , bridge] = layout.sections
export const faders = layout.faders

/** The same heat seed cues the mixers at the same point in their repeating travel. */
export const afterglowCue = (seed: number) => ((Math.imul(seed, 2654435761) >>> 0) / 0x100000000) * 16.8

export function faderPose(track: CourseTrack, fader: typeof faders[number], seconds: number) {
  const lateral = fader.center + fader.travel * Math.sin(fader.phase + seconds * 2 * Math.PI / fader.period)
  return track.sample(fader.s, lateral)
}

function afterglowProfile(pieces: PathPiece[]): Profile {
  const [carrier, sideband, stereo] = pieces.filter(piece => piece.curvature !== 0)
  return {
    layered: true,
    widthScale: s => 1 - (1 - layout.bridgeScale) * ease(bridge.start, bridge.start + 12, s)
      * (1 - ease(bridge.end - 16, bridge.end - 3, s)),
    divider: s => 1 - ease(6, grid.end, s),
    roundedLaneDepth: .14,
    collisionResolution: { rowSpacing: .42, bandsPerLane: 6 },
    deflectors: [],
    spans: [{ start: 0, end: layout.sections.at(-1)!.end, surface: 'lacquer' }],
    wallHeight: s => 1.12 + 1.25 * (bankAt(s, carrier, 1, 8) + bankAt(s, sideband, 1, 8) + bankAt(s, stereo, 1, 10)),
    height(s, lateral) {
      const across = lateral / layout.halfWidth
      const spiral = bankAt(s, carrier, 1, 7), sidebank = bankAt(s, sideband, 1, 7)
      const returnBend = bankAt(s, stereo, 1, 10)
      const bank = -.34 * spiral + .38 * sidebank + .42 * returnBend
      const shoulder = (.46 * across ** 2 + .57 * across ** 6) * (spiral + sidebank + returnBend)
      const launch = launchTrim(across, layout.launchTrims) * (1 - ease(2, grid.end, s))
      const alleyDrop = .12 * clamp(s - alley.start, 0, alley.end - alley.start)
      const alleyShoulder = .30 * across ** 2 * ease(alley.start - 4, alley.start + 3, s) * (1 - ease(alley.end - 5, alley.end, s))
      // Lower each bank as it unwinds. The former inside line must keep
      // descending even if a sideways impact leaves a marble at rest.
      const unwind = 1.18 * (ease(carrier.end - 7, carrier.end + 7, s) + ease(sideband.end - 7, sideband.end + 7, s))
      const returnDrop = 1.15 * ease(stereo.end - 10, stereo.end + 10, s)
      return 38 - .064 * s - 1.6 * (1 - Math.exp(-s / 6.5)) - alleyDrop - unwind - returnDrop + launch + lateral * bank + shoulder + alleyShoulder
    },
  }
}

export const buildAfterglowTrack = () => buildCourse('afterglow', layout, afterglowProfile)
