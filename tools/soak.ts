import assert from 'node:assert/strict';
import { buildTrack } from '../src/track';
import type { CourseTrack } from '../src/track';
import { courseIds } from '../src/courses/catalog';
import { initPhysics, RaceSimulation } from '../src/simulation';

const repetitions = Number(process.argv[2] ?? 100);
const firstSeed = Number(process.argv[3] ?? 1);
const courseFilter = process.argv[4];
assert.ok(Number.isSafeInteger(repetitions) && repetitions > 0, 'Pass a positive number of heats per field size.');
assert.ok(Number.isSafeInteger(firstSeed), 'Pass an integer starting seed.');
assert.ok(!courseFilter || courseIds.some(id => id === courseFilter), 'Specify prism or frostline.');

function exerciseField(track: CourseTrack, count: number) {
  const wins = Array<number>(track.laneCount).fill(0);
  const starts = Array<number>(track.laneCount).fill(0);
  const durations: number[] = [];
  let replayFinishTimes: (number | null)[] | undefined;

  for (let i = 0; i < repetitions; i++) {
    const seed = firstSeed + i;
    const race = new RaceSimulation(track, count, seed);
    try {
      for (const marble of race.marbles) {
        assert.ok(marble.slot >= 0 && marble.slot < track.laneCount);
        starts[marble.slot]++;
      }
      assert.equal(new Set(race.marbles.map(m => m.slot)).size, count);
      race.step();
      assert.equal(race.elapsed, 0, 'staging must not advance the clock');
      race.release();
      while (!race.finished && !race.failure) race.step();
      if (race.failure) {
        console.error(JSON.stringify({
          course: track.id, count, seed, problem: race.failure, time: race.elapsed,
          marbles: race.marbles.map(m => ({ slot: m.slot, s: +m.distance.toFixed(2), speed: +m.speed.toFixed(2) })),
        }));
      } else {
        const finishers = [...race.marbles].sort((a, b) => a.finishTime! - b.finishTime!);
        for (const marble of finishers) {
          assert.ok(Number.isFinite(marble.finishTime) && marble.finishTime! > 0 && marble.finishTime! <= race.elapsed);
        }
        if (count === track.laneCount && i === 0) {
          replayFinishTimes = race.marbles.map(m => m.finishTime);
          const finishClock = race.elapsed;
          for (let frame = 0; frame < 120; frame++) race.coast();
          assert.equal(race.elapsed, finishClock, 'coasting must preserve the race clock');
          assert.deepEqual(race.marbles.map(m => m.finishTime), replayFinishTimes);
        }
        wins[finishers[0].slot]++;
        durations.push(finishers[count - 1].finishTime!);
      }
    } finally {
      race.dispose();
    }
  }
  console.log(JSON.stringify({
    course: track.id, count, heats: repetitions, finishes: durations.length, startingSlots: starts, winningSlots: wins,
    seconds: durations.length ? [Math.min(...durations), Math.max(...durations)].map(s => +s.toFixed(2)) : [],
  }));
  if (replayFinishTimes) {
    const replay = new RaceSimulation(track, count, firstSeed);
    try {
      replay.release();
      while (!replay.finished && !replay.failure) replay.step();
      assert.deepEqual(replay.marbles.map(m => m.finishTime), replayFinishTimes);
    } finally {
      replay.dispose();
    }
  }
  return repetitions - durations.length;
}

function checkFrostlineTransitions(track: CourseTrack) {
  // A pack slowed by a deflector or a material seam should still roll downhill.
  for (const section of track.sections.slice(1)) {
    const race = new RaceSimulation({ ...track, startS: section.start }, track.laneCount, firstSeed);
    try {
      race.release();
      while (!race.finished && !race.failure) race.step();
      assert.ok(race.finished, section.name + ' from rest, seed ' + firstSeed + ': ' + race.failure);
    } finally {
      race.dispose();
    }
  }
}

await initPhysics();
let failures = 0;
for (const id of courseIds) {
  if (courseFilter && id !== courseFilter) continue;
  const track = buildTrack(id);
  for (let count = 2; count <= track.laneCount; count++) failures += exerciseField(track, count);
  if (id === 'frostline') checkFrostlineTransitions(track);
}
assert.equal(failures, 0, failures + ' heats failed; see the courses and seeds above.');
