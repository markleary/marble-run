import type { Section } from '../courseGeometry'

export type CruxFormat = 'knockout' | 'endurance'

export const cruxRack = {
  funnelLength: 16,
  throatHalfWidth: 1.12,
  seatOffset: 4.8,
  barOffset: 5.38,
  launchEnd: 10,
  launchSpeed: 7.8,
  slotSpacing: 1.4,
  railHeight: .55,
}

export function cruxRackSlot(capacity: number, arrivalIndex: number) {
  return (arrivalIndex - (capacity - 1) / 2) * cruxRack.slotSpacing
}

/** Rail centerlines in track coordinates relative to the beam at the throat. */
export function cruxFunnelRails(halfWidth: number) {
  return [-1, 1].map(side => ({
    start: { s: -cruxRack.funnelLength, lateral: side * (halfWidth + cruxRack.railHeight / 2) },
    end: { s: 0, lateral: side * cruxRack.throatHalfWidth },
  }))
}

/** The gantries and the simulation measure the same four lines across the deck. */
export function cruxCheckpoints(sections: readonly Section[]) {
  return [3, 5, 7, 9].map((index, i) => {
    const { start, end } = sections[index]
    // Dyno Straight and Slab Flight need a full receiving deck before their funnels.
    const fraction = index === 3 || index === 7 ? .82 : .75
    return { number: i + 1, name: 'CP ' + (i + 1), s: start + fraction * (end - start) }
  })
}
