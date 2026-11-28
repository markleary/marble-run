import { bankAt, buildCourse, clamp, ease, launchTrim, type PathPiece, type Profile } from '../courseGeometry'
import layout from './santa-layout.json'

const [shed, mint, , parcels, curl, bells, esses, post] = layout.sections

function santaProfile(pieces: PathPiece[]): Profile {
  const [treeTurn, ribbonTurn, firstEsse, secondEsse] = pieces.filter(piece => piece.curvature !== 0)
  return {
    divider: s => 1 - ease(5, shed.end - 2, s),
    roundedLaneDepth: .13,
    collisionResolution: { rowSpacing: .48, bandsPerLane: 6 },
    deflectors: [],
    // Catch marbles lifted off a turning sweet or emerging present, including its runout.
    wallHeight: s => 1.12 + .52 * (bankAt(s, treeTurn, 1, 6) + bankAt(s, ribbonTurn, 1, 6))
      + 1.38 * ease(mint.start - 1, mint.start + 4, s) * (1 - ease(mint.end + 1, mint.end + 6, s))
      + 1.38 * ease(parcels.start, parcels.start + 5, s) * (1 - ease(parcels.end + 1, parcels.end + 6, s)),
    spans: [
      { start: 0, end: shed.end, surface: 'wood' },
      { start: mint.start, end: curl.end, surface: 'lacquer' },
      { start: bells.start, end: esses.end, surface: 'ice' },
      { start: post.start, end: post.end, surface: 'wood' },
    ],
    height(s, lateral) {
      const across = lateral / layout.halfWidth
      const tree = bankAt(s, treeTurn, 1, 6), ribbon = bankAt(s, ribbonTurn, 1, 6)
      const bank = -.13 * tree + .16 * ribbon
        + bankAt(s, firstEsse, .09, 4.6) + bankAt(s, secondEsse, -.09, 4.6)
      const shoulder = (.24 * across ** 2 + .4 * across ** 6) * (tree + ribbon)
      const launch = launchTrim(across, layout.launchTrims) * (1 - ease(2, shed.end, s))
      const trapDrop = .13 * clamp(s - mint.start, 0, mint.end - mint.start)
        + .096 * clamp(s - parcels.start, 0, parcels.end - parcels.start)
      // Drop the bed as the banks wind out, including underneath a stalled inside marble.
      const unwind = .58 * (ease(treeTurn.end - 6, treeTurn.end + 6, s)
        + ease(ribbonTurn.end - 6, ribbonTurn.end + 6, s))
      // As the ice banks change sides, lower the center by each edge's rise.
      const iceDrop = .38 * (ease(firstEsse.start - 4.6, firstEsse.start + 4.6, s)
        + 2 * ease(firstEsse.end - 4.6, firstEsse.end + 4.6, s)
        + ease(secondEsse.end - 4.6, secondEsse.end + 4.6, s))
      // Four shallow scallops in the sleigh runners vary the grade without an uphill lip.
      const beat = clamp((s - bells.start) / layout.bellPitch, 0, 4) * 2 * Math.PI
      const bellDrop = .032 * (beat - Math.sin(beat))
      // Raise the gate end of the shed and ease its steeper pitch into the pinwheel approach.
      return 21.99 + 1.45 * Math.exp(-s / 6.5) - .029 * s - trapDrop - unwind - bellDrop - iceDrop
        + launch + lateral * bank + shoulder
    },
  }
}

export const buildSantaTrack = () => buildCourse('santa', layout, santaProfile)
