import prism from './courses/prism-layout.json'
import frostline from './courses/frostline-layout.json'
import { buildTimberTrack } from './courses/timber'
import { buildWireworksTrack } from './courses/wireworks'
import { buildOrreryTrack } from './courses/orrery'
import { buildKeplerTrack } from './courses/kepler'
import { buildTideglassTrack } from './courses/tideglass'
import { buildSpectralTrack } from './courses/spectral'
import { buildCruxTrack } from './courses/crux'
import type { CourseId } from './courses/catalog'

import { bankAt, buildCourse, clamp, ease, launchTrim } from './courseGeometry'
import type { PathPiece, Profile } from './courseGeometry'
export type { CourseTrack, CourseSurface, TrackSample } from './courseGeometry'
export type { CourseId } from './courses/catalog'

function prismProfile(pieces: PathPiece[]): Profile {
  const { banks, sections } = prism
  const divider = (s: number) => 1 - ease(pieces[3].end - 7, pieces[3].end + 4, s)
  const timber = sections[4].start + 1.8
  return {
    divider, roundedLaneDepth: prism.roundedLaneDepth, deflectors: [],
    spans: [{ start: 0, end: timber, surface: 'lacquer' }, { start: timber, end: sections[5].end, surface: 'wood' }],
    height(s, lateral) {
      const drop = 0.041 * s + 1.45 * (1 - Math.exp(-s / 8.5))
      const rollers = 0.115 * Math.sin((s - 4.5) * 2 * Math.PI / prism.rollerPitch) * ease(3, 8, s) * (1 - ease(19, 22, s))
      const bank = bankAt(s, pieces[1], banks.first) + bankAt(s, pieces[3], banks.second)
      const across = lateral / prism.halfWidth
      const launchGroove = banks.launchGrooveDepth * Math.exp(-(((across - 0.25) / banks.launchGrooveWidth) ** 2))
      const launchProfile = launchTrim(across, prism.launchTrims) + banks.launchTilt * across + banks.launchFlare * across ** 2 - launchGroove
        + banks.launchShoulder * (1 - ease(-0.49, 0.49, across))
      return 7.6 - drop + rollers + lateral * bank + (1 - ease(2, 20, s)) * launchProfile
    },
  }
}

function frostProfile(pieces: PathPiece[]): Profile {
  const sections = frostline.sections
  const timber = sections[2]
  const field = sections[3]
  const divider = (s: number) => 1 - ease(5, sections[0].end, s)
  return {
    divider, deflectors: frostline.deflectors,
    spans: [
      { start: 0, end: sections[0].end, surface: 'wood' },
      { start: sections[1].start, end: timber.start, surface: 'ice' },
      { start: timber.start, end: field.start, surface: 'wood' },
      { start: field.start, end: sections[5].start, surface: 'ice' },
      { start: sections[5].start, end: sections[5].end, surface: 'wood' },
    ],
    height(s, lateral) {
      const fieldDrop = 0.115 * clamp(s - (field.start - 2), 0, field.end - field.start + 2)
      const drop = 0.043 * s + 1.08 * (1 - Math.exp(-s / 6.5)) + fieldDrop
      // Integrate a varying downhill grade: each crest can release a ball from rest.
      const phase = clamp((s - timber.start) / frostline.rollerPitch, 0, 3) * 2 * Math.PI
      const rollerDrop = 0.059 * (phase - Math.sin(phase))
      const bank = bankAt(s, pieces[1], -0.044, 5.4) + bankAt(s, pieces[2], 0.049, 5.4)
        + bankAt(s, pieces[4], -0.066, 5.6) + bankAt(s, pieces[6], -0.07, 5.6)
      // A small crossfall and the downhill pitch shed slow marbles around the round deflectors.
      const crossfall = 0.018 * Math.sin((s - field.start) * 0.22) * ease(field.start - 2, field.start + 2, s)
        * (1 - ease(field.end - 2, field.end + 2, s))
      const gate = (1 - ease(1.8, 17, s)) * launchTrim(lateral / frostline.halfWidth, frostline.launchTrims)
      return 10.8 - drop - rollerDrop + lateral * (bank + crossfall) + gate
    },
  }
}

export const buildPrismTrack = () => buildCourse('prism', prism, prismProfile)
export const buildFrostlineTrack = () => buildCourse('frostline', frostline, frostProfile)
const builders = {
  prism: buildPrismTrack, frostline: buildFrostlineTrack, timber: buildTimberTrack,
  wireworks: buildWireworksTrack, orrery: buildOrreryTrack, tideglass: buildTideglassTrack,
  kepler: buildKeplerTrack, crux: buildCruxTrack, spectral: buildSpectralTrack,
}
export const buildTrack = (id: CourseId) => builders[id]()
