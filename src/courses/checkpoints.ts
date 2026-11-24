import type { Section } from '../courseGeometry'
import type { CourseId } from './catalog'
import { checkpointRack } from './checkpointRack'

/** The entry stripe is placed at a fraction of a named section, plus an optional offset.
 * The straight deck must accommodate the entire funnel, qualifying rack and launch belt. */
type Entry = readonly [section: string, fraction: number, offset?: number]
const entries: Partial<Record<CourseId, readonly Entry[]>> = {
  crux: [
    ['Dyno Straight', .82, -checkpointRack.funnelLength],
    ['Blade Slalom', .75, -checkpointRack.funnelLength],
    ['Slab Flight', .82, -checkpointRack.funnelLength],
    ['Volume Traverse', .75, -checkpointRack.funnelLength],
  ],
  spectral: [
    ['Afterimage Straight', .60],
    ['Induction Gallery', .60],
    ['Chromatic Viaduct', .55],
    ['Polarity Inverter', .65],
    ['Terminal Sprint', .25],
  ],
  afterglow: [
    ['Crossfader Alley', 1, -29],
    ['Sideband Turn', 0, 1],
    ['Stereo Return', 0, 9],
    ['Sign-Off Sprint', 0, 5],
  ],
}

export function checkpointCount(id: CourseId) {
  return entries[id]?.length ?? 0
}

export function hasCheckpoints(id: CourseId) {
  return checkpointCount(id) > 0
}

export function checkpointStations(id: CourseId, sections: readonly Section[]) {
  return (entries[id] ?? []).map(([sectionName, fraction, offset = 0], index) => {
    const section = sections.find(section => section.name === sectionName)
    if (!section) throw new Error('Missing ' + id + ' checkpoint section: ' + sectionName)
    const entryS = section.start + fraction * (section.end - section.start) + offset
    return { number: index + 1, name: 'CP ' + (index + 1), entryS, s: entryS + checkpointRack.funnelLength }
  })
}
