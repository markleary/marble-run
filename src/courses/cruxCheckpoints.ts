import type { Section } from '../courseGeometry'

export type CruxFormat = 'knockout' | 'endurance'

/** The gantries and the simulation measure the same four lines across the deck. */
export function cruxCheckpoints(sections: readonly Section[]) {
  return [3, 5, 7, 9].map((index, i) => {
    const { start, end } = sections[index]
    return { number: i + 1, name: 'CP ' + (i + 1), s: start + .6 * (end - start) }
  })
}
