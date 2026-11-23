import type { Section } from '../courseGeometry'

export const spectralGateColors = ['#58eafb', '#669aff', '#b18aff', '#ff70bc', '#ffc763'] as const

// Place the timing beam and its illuminated gate at the same point on each deck.
const gates = [
  ['Afterimage Straight', .60],
  ['Induction Gallery', .60],
  ['Chromatic Viaduct', .55],
  ['Polarity Inverter', .65],
  ['Terminal Sprint', .25],
] as const

export function spectralCheckpoints(sections: readonly Section[]) {
  return gates.map(([sectionName, fraction], index) => {
    const section = sections.find(section => section.name === sectionName)
    if (!section) throw new Error('Missing Spectral Relay checkpoint section: ' + sectionName)
    const s = section.start + fraction * (section.end - section.start)
    return { number: index + 1, name: 'CP ' + (index + 1), s, entryS: s }
  })
}
