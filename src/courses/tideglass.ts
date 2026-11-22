import { bankAt, buildCourse, ease, launchTrim, type PathPiece, type Profile } from '../courseGeometry'
import layout from './tideglass-layout.json'

const [gate, , , wave, , sluice, , landing] = layout.sections
const w = layout.halfWidth

/** The low line of the molded half-pipe moves from shoulder to shoulder. */
export function waveCenter(s: number) {
  const u = Math.min(1, Math.max(0, (s - wave.start) / (wave.end - wave.start)))
  return layout.waveTravel * Math.sin(u * Math.PI * 2 * layout.waveCycles)
}

/** The nose enters the line coming off the outside of Fernbank Turn, then straightens. */
export function frondCrest(s: number) {
  return 2.9 * (1 - ease(sluice.start - .4, sluice.start + 9.4, s))
}

function envelope(s: number, start: number, end: number, blend: number) {
  return ease(start - blend, start + blend, s) * (1 - ease(end - blend, end + blend, s))
}

function flumeProfile(pieces: PathPiece[]): Profile {
  return {
    divider: s => 1 - ease(4, gate.end - 1, s),
    wallHeight: s => 1.04 + .18 * envelope(s, wave.start - 2, wave.end + 2, 4),
    deflectors: [],
    spans: [
      { start: 0, end: gate.end, surface: 'wood' },
      { start: gate.end, end: landing.start, surface: 'glass' },
      { start: landing.start, end: landing.end, surface: 'wood' },
    ],
    height(s, lateral) {
      const bank = bankAt(s, pieces[1], -.045) + bankAt(s, pieces[2], .045)
        + bankAt(s, pieces[4], -.16, 5) + bankAt(s, pieces[6], .16, 5)
        + bankAt(s, pieces[8], .08) + bankAt(s, pieces[9], -.08)
      const trough = .073 * (lateral - waveCenter(s)) ** 2 * envelope(s, wave.start, wave.end, 4)
      // The downstream leaf-shaped ridge creates two minima. A marble can cross
      // the crest or run either trough, then rejoin as the ridge sinks away.
      const twin = (.044 * lateral ** 2 + .89 * Math.exp(-(((lateral - frondCrest(s)) / 1.12) ** 2)))
        * envelope(s, sluice.start, sluice.end, 4.8)
      const launch = launchTrim(lateral / w, layout.launchTrims) * (1 - ease(2, gate.end + 1, s))
      // Sink the bed as each molding opens. Even the shoulder on the inside
      // of the preceding bank then feeds downhill into the new contour.
      const bedDrop = 1.9 * ease(wave.start - 5, wave.start + 5, s)
        + 1.28 * ease(sluice.start - 5, sluice.start + 5, s)
      return 17.3 - .06 * s - 1.62 * (1 - Math.exp(-s / 7)) - bedDrop + lateral * bank + launch + trough + twin
    },
  }
}

export const buildTideglassTrack = () => buildCourse('tideglass', layout, flumeProfile)
