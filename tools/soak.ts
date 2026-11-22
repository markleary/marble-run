import assert from 'node:assert/strict';
import { buildPrismTrack } from '../src/track';
import { initPhysics, RaceSimulation } from '../src/simulation';

const repetitions = Number(process.argv[2] ?? 100);
const firstSeed = Number(process.argv[3] ?? 1);
assert.ok(Number.isSafeInteger(repetitions) && repetitions > 0, 'Pass a positive number of heats per field size.');
assert.ok(Number.isSafeInteger(firstSeed), 'Pass an integer starting seed.');
await initPhysics();
const track = buildPrismTrack();
let failureCount = 0;
let heatCount = 0;
let replayFinishTimes: (number | null)[] | undefined;
for (const count of [2, 3, 4]) {
  const wins = [0, 0, 0, 0];
  const starts = [0, 0, 0, 0];
  const durations: number[] = [];
  for (let i = 0; i < repetitions; i++) {
    const seed = firstSeed + i;
    const race = new RaceSimulation(track, count, seed);
    try {
      for (const marble of race.marbles) starts[marble.slot]++;
      assert.equal(new Set(race.marbles.map(m => m.slot)).size, count);
      race.step();
      assert.equal(race.elapsed, 0, 'staging must not advance the clock');
      race.release();
      while (!race.finished && !race.failure) race.step();
      if (race.failure) {
        failureCount++;
        console.error(JSON.stringify({
          count, seed, problem: race.failure, time: race.elapsed,
          marbles: race.marbles.map(m => ({ slot: m.slot, s: +m.distance.toFixed(2), speed: +m.speed.toFixed(2) })),
        }));
      } else {
        const finishers = [...race.marbles].sort((a, b) => a.finishTime! - b.finishTime!);
        for (const marble of finishers) {
          assert.ok(Number.isFinite(marble.finishTime) && marble.finishTime! > 0 && marble.finishTime! <= race.elapsed);
        }
        if (count === 4 && i === 0) {
          replayFinishTimes = race.marbles.map(m => m.finishTime);
          const finishClock = race.elapsed;
          for (let frame = 0; frame < 120; frame++) race.coast();
          assert.equal(race.elapsed, finishClock, 'coasting must preserve the race clock');
          assert.deepEqual(race.marbles.map(m => m.finishTime), replayFinishTimes);
        }
        wins[finishers[0].slot]++;
        durations.push(finishers[count - 1].finishTime!);
      }
      heatCount++;
    } finally {
      race.dispose();
    }
  }
  console.log(JSON.stringify({
    count, heats: repetitions, finishes: durations.length, startingSlots: starts, winningSlots: wins,
    seconds: durations.length ? [Math.min(...durations), Math.max(...durations)].map(s => +s.toFixed(2)) : [],
  }));
}
assert.equal(failureCount, 0, `${failureCount} of ${heatCount} heats failed`);

// A reported race seed must reproduce the exact finish times on the same runtime.
if (replayFinishTimes) {
  const replay = new RaceSimulation(track, 4, firstSeed);
  try {
    replay.release();
    while (!replay.finished && !replay.failure) replay.step();
    assert.deepEqual(replay.marbles.map(m => m.finishTime), replayFinishTimes);
  } finally {
    replay.dispose();
  }
}
