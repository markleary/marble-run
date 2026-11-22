import { buildCourse, clamp, ease, launchTrim, type PathPiece, type Profile, type Section } from '../courseGeometry'
import layout from './crux-layout.json'

const [gate, speedWall, , alley, arete, , , slabs, , , hook, runout] = layout.sections
export const cruxVolumes = layout.volumes
type Volume = typeof cruxVolumes[number]

/** Four triangular planes meet at the apex. The skew shears the footprint along the racing line. */
export function cruxVolumeLift(volume: Volume, s: number, lateral: number) {
  const along = s - volume.s
  const across = lateral - volume.lateral - along * volume.skew
  return volume.height * Math.max(0, 1 - Math.abs(2 * along / volume.length) - Math.abs(2 * across / volume.width))
}

/** Each slab hands the field to a panel with the opposite crossfall. */
function slabProfile(s: number, lateral: number) {
  if (s <= slabs.start) return 0
  const length = (slabs.end - slabs.start) / layout.slabCants.length
  let height = 0
  for (const [index, gradient] of layout.slabCants.entries()) {
    const start = slabs.start + length * index, end = start + length
    // Rock the deck about its low rim on each hand-off. Each edge stays
    // downhill even when a slow racer arrives on the previous low side.
    const rollIn = ease(start, start + 4.5, s)
    const rollOut = ease(end - 4.5, end, s)
    height += lateral * gradient * (rollIn - rollOut)
      - layout.halfWidth * Math.abs(gradient) * (rollIn + rollOut)
  }
  return height
}

// Start each steeper pitch just before the feature and carry it two units past the exit.
function sectionDrop(s: number, section: Section, grade: number) {
  return grade * clamp(s - section.start + 2, 0, section.end - section.start + 4)
}

function cruxProfile(pieces: PathPiece[]): Profile {
  const curves = pieces.filter(piece => piece.curvature !== 0)
    .map(({ start, end, curvature }) => ({ start, end, cant: -.82 * curvature }))
  return {
    roundedLaneDepth: .16,
    divider: s => 1 - ease(speedWall.end - 14, speedWall.end - 2, s),
    wallHeight: () => 1.03,
    spans: [
      { start: 0, end: gate.end, surface: 'wood' },
      { start: gate.end, end: runout.start, surface: 'lacquer' },
      { start: runout.start, end: runout.end, surface: 'wood' },
    ],
    deflectors: [],
    height(s, lateral) {
      let banking = 0
      for (const { start, end, cant } of curves) {
        if (s < start - 5) break
        const enter = ease(start - 5, start + 5, s), leave = ease(end - 5, end + 5, s)
        // Lower the center of the channel as the outer shoulder banks up and
        // again as the inner shoulder flattens, keeping both lines downhill.
        banking += lateral * cant * (enter - leave) - 2.75 * Math.abs(cant) * (enter + leave)
      }
      let volumeLift = 0
      if (s >= alley.start && s <= alley.end) {
        for (const volume of cruxVolumes) volumeLift += cruxVolumeLift(volume, s, lateral)
      }
      // The shallow asymmetric start pockets offer different lines down the
      // same block as each marble settles into its launch groove.
      let launch = 0
      if (s < gate.end) {
        const lane = (1 + lateral / layout.halfWidth) * layout.laneCount / 2
        const pocket = layout.startingCamber * Math.sin(2 * Math.PI * lane)
        launch = (launchTrim(lateral / layout.halfWidth, layout.launchTrims) + pocket) * (1 - ease(2, gate.end, s))
      }
      // A steeper pitch through the boulders carries marbles over a
      // volume or down either flank if they arrive at its toe from rest.
      const drop = .028 * s + sectionDrop(s, alley, .115) + 1.14 * (1 - Math.exp(-s / 6))
      const hairpinDrop = sectionDrop(s, arete, .084)
      const hookDrop = sectionDrop(s, hook, .06)
      return 36 - drop - hairpinDrop - hookDrop + banking + slabProfile(s, lateral) + volumeLift + launch
    },
  }
}

export const buildCruxTrack = () => buildCourse('crux', layout, cruxProfile)
