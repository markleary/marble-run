import { buildCourse, ease, launchTrim, type PathPiece, type Profile } from '../courseGeometry'
import layout from './timber-layout.json'

function corkscrewProfile(pieces: PathPiece[]): Profile {
  const helixStart = layout.sections[1].start
  const helixEnd = layout.sections[2].end
  const reeding = layout.sections[4]
  const helixGrade = layout.turnDrop / (2 * Math.PI * layout.drumRadius)
  const baseGrade = .082
  const divider = (s: number) => (1 - ease(4, helixStart, s))
    + .24 * ease(reeding.start, reeding.start + 2, s) * (1 - ease(reeding.end - 2, reeding.end, s))

  // Bend the bank about its high shoulder. This extra descent keeps a stopped
  // inside marble rolling forward as the curved deck unwinds into a straight.
  function bankHeight(s: number, lateral: number, start: number, end: number, slope: number, blend: number) {
    const entry = ease(start - blend, start + blend, s)
    const exit = ease(end - blend, end + blend, s)
    return slope * lateral * entry * (1 - exit) - Math.abs(slope) * layout.halfWidth * .66 * (entry + exit)
  }

  return {
    divider, layered: true, deflectors: [],
    wallHeight(s) {
      const switchback = ease(helixEnd - .5, helixEnd + 4, s) * (1 - ease(reeding.start - .5, reeding.start + 4, s))
      return .88 + .50 * switchback + .12 * ease(layout.finishS + .4, layout.sections[5].end, s)
    },
    spans: [{ start: 0, end: layout.sections[5].end, surface: 'wood' }],
    height(s, lateral) {
      const distanceOnDrum = Math.max(0, Math.min(s, helixEnd) - helixStart)
      const drop = baseGrade * s + (helixGrade - baseGrade) * distanceOnDrum + 2.3 * (1 - Math.exp(-s / 6))
      const bank = bankHeight(s, lateral, helixStart, helixEnd, -.36, 5.5)
        + bankHeight(s, lateral, pieces[7].start, pieces[7].end, .17, 4)
        + bankHeight(s, lateral, pieces[9].start, pieces[9].end, -.16, 4)
      const trim = launchTrim(lateral / layout.halfWidth, layout.launchTrims)
      return 20.6 - drop + bank + trim * (1 - ease(2, helixStart, s))
    },
  }
}

export function buildTimberTrack() {
  return buildCourse('timber', layout, corkscrewProfile)
}
