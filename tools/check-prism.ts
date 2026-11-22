import assert from 'node:assert/strict'
import { FIXED_DT, RaceSimulation } from '../src/simulation'
import type { CourseTrack } from '../src/track'

export function checkPrismBanks(track: CourseTrack) {
  // This two-racer grid starts in separated lanes. Both marbles approach the
  // opposing banks at race speed, with room to cross the lane dividers.
  const seed = 1
  const race = new RaceSimulation(track, 2, seed)
  const banks = ['Spectrum Hairpin', 'Timber Merge'].map(name => {
    const section = track.sections.find(section => section.name === name)!
    return { ...section, retention: 1, entrySpeeds: new Map<number, number>() }
  })
  const previous = race.marbles.map(() => 0)
  try {
    race.release()
    while (!race.finished && !race.failure && race.marbles.some(marble => marble.distance < banks[1].end)) {
      race.step()
      for (const marble of race.marbles) {
        const frame = track.sample(marble.distance)
        const dx = marble.position.x - marble.previousPosition.x
        const dz = marble.position.z - marble.previousPosition.z
        const forward = (dx * frame.tx + dz * frame.tz) / FIXED_DT
        const bank = banks.find(bank => marble.distance >= bank.start && marble.distance <= bank.end)
        if (bank) {
          if (!bank.entrySpeeds.has(marble.id)) bank.entrySpeeds.set(marble.id, forward)
          bank.retention = Math.min(bank.retention, forward / previous[marble.id])
          if (marble.distance < bank.start + 6) {
            assert.ok(forward >= .90 * bank.entrySpeeds.get(marble.id)!,
              `Marble in slot ${marble.slot + 1} lost over 10% of its approach speed entering ${bank.name}, seed ${seed}.`)
          }
        }
        previous[marble.id] = forward
      }
    }
    assert.ok(!race.failure, race.failure ?? undefined)
    for (const bank of banks) {
      assert.equal(bank.entrySpeeds.size, race.marbles.length, `Both marbles must reach ${bank.name}.`)
      assert.ok(bank.retention >= .94,
        `Seed ${seed} retained only ${(100 * bank.retention).toFixed(1)}% of forward speed in one tick on ${bank.name}.`)
    }
    console.log(JSON.stringify({ course: track.id, seed, bankMinTickSpeedRetention: Object.fromEntries(
      banks.map(bank => [bank.name, +bank.retention.toFixed(3)]),
    ) }))
  } finally {
    race.dispose()
  }
}
