import assert from 'node:assert/strict';
import { buildTrack } from '../src/track';
import type { CourseTrack, TrackSample } from '../src/track';
import { courseIds } from '../src/courses/catalog';
import timberLayout from '../src/courses/timber-layout.json';
import wireworksLayout from '../src/courses/wireworks-layout.json';
import { checkWireworksContacts } from './check-wireworks';
import { checkPrismBanks } from './check-prism';
import { checkOrreryCrossing, checkOrreryJumps } from './check-orrery';
import { initPhysics, RaceSimulation } from '../src/simulation';
import type { MarbleState } from '../src/simulation';

const repetitions = Number(process.argv[2] ?? 100);
const firstSeed = Number(process.argv[3] ?? 1);
const courseFilter = process.argv[4];
assert.ok(Number.isSafeInteger(repetitions) && repetitions > 0, 'Pass a positive number of heats per field size.');
assert.ok(Number.isSafeInteger(firstSeed), 'Pass an integer starting seed.');
assert.ok(!courseFilter || courseIds.some(id => id === courseFilter), 'Specify one of ' + courseIds.join(', ') + '.');

function firstBranchAcrossExit(exit: TrackSample, marbles: MarbleState[], branches: Map<number, number>) {
  let firstFraction = Infinity;
  let leader: number | undefined;
  for (const marble of marbles) {
    const branch = branches.get(marble.id);
    if (branch === undefined) continue;
    const from = (marble.previousPosition.x - exit.x) * exit.tx + (marble.previousPosition.z - exit.z) * exit.tz;
    const to = (marble.position.x - exit.x) * exit.tx + (marble.position.z - exit.z) * exit.tz;
    if (from > 0 || to < 0 || to <= from) continue;
    // Compare marble centers at the physical merge when multiple racers cross in one tick.
    const fraction = -from / (to - from);
    if (fraction < firstFraction) {
      firstFraction = fraction;
      leader = branch;
    }
  }
  return leader;
}

function exerciseField(track: CourseTrack, count: number) {
  const wins = Array<number>(track.laneCount).fill(0);
  const starts = Array<number>(track.laneCount).fill(0);
  const durations: number[] = [];
  const sluice = track.sections.find(section => section.name === 'Twin Frond Sluice');
  const branchMidpoint = track.id === 'wireworks' ? (wireworksLayout.forkStart + wireworksLayout.forkEnd) / 2
    : sluice ? (sluice.start + sluice.end) / 2 : undefined;
  const branchCenter = branchMidpoint === undefined ? undefined : track.sample(branchMidpoint);
  const branchStarts = [0, 0], branchWins = [0, 0];
  const forkExit = track.id === 'wireworks' ? track.sample(wireworksLayout.forkEnd) : undefined;
  const mixed = { branches: ['slateLower', 'aquaUpper'], heats: 0, mergeLeads: [0, 0], wins: [0, 0] };
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
      const branches = new Map<number, number>();
      let mergeLeader: number | undefined;
      while (!race.finished && !race.failure) {
        race.step();
        if (branchCenter && branchMidpoint !== undefined && branches.size < count) {
          for (const marble of race.marbles) {
            if (marble.distance < branchMidpoint || branches.has(marble.id)) continue;
            const { x, z } = marble.position;
            const lateral = (x - branchCenter.x) * branchCenter.rx + (z - branchCenter.z) * branchCenter.rz;
            const branch = lateral < 0 ? 0 : 1;
            branches.set(marble.id, branch);
            branchStarts[branch]++;
          }
        }
        if (forkExit && mergeLeader === undefined) {
          mergeLeader = firstBranchAcrossExit(forkExit, race.marbles, branches);
        }
      }
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
        if (branchCenter) {
          assert.equal(branches.size, count);
          const winnerBranch = branches.get(finishers[0].id)!;
          branchWins[winnerBranch]++;
          if (forkExit) {
            assert.ok(mergeLeader !== undefined, 'A Wireworks finisher must first cross the fork exit.');
            if (new Set(branches.values()).size === 2) {
              mixed.heats++;
              mixed.mergeLeads[mergeLeader]++;
              mixed.wins[winnerBranch]++;
            }
          }
        }
        durations.push(finishers[count - 1].finishTime!);
      }
    } finally {
      race.dispose();
    }
  }
  console.log(JSON.stringify({
    course: track.id, count, heats: repetitions, finishes: durations.length, startingSlots: starts, winningSlots: wins,
    seconds: durations.length ? [Math.min(...durations), Math.max(...durations)].map(s => +s.toFixed(2)) : [],
    ...(branchCenter && { branchStarts, branchWins }),
    ...(forkExit && { mixedBranchHeats: mixed }),
  }));
  if (forkExit && count === track.laneCount && repetitions >= 100) {
    assert.ok(mixed.heats >= .80 * repetitions, 'Both Wireworks branches must be used in at least 80% of full-field heats.');
    for (const [branch, name] of mixed.branches.entries()) {
      assert.ok(mixed.mergeLeads[branch] >= .30 * mixed.heats, name + ' must lead at least 30% of contested merges.');
      assert.ok(mixed.wins[branch] >= .30 * mixed.heats, name + ' must win at least 30% of contested heats.');
    }
  }
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

function checkSectionStarts(track: CourseTrack) {
  // Every downstream section must let a pack accelerate again from rest.
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

function checkTimberLevels(track: CourseTrack) {
  const upper = track.sections[1].start + timberLayout.drumRadius * Math.PI / 4;
  const lower = upper + 2 * Math.PI * timberLayout.drumRadius;
  for (const lateral of [-2, 0, 2]) {
    const top = track.sample(upper, lateral), bottom = track.sample(lower, lateral);
    assert.ok(Math.hypot(top.x - bottom.x, top.z - bottom.z) < 0.001 && top.y - bottom.y > 2 * track.radius);
    for (const [s, p] of [[upper, top], [lower, bottom]] as const) {
      for (const hint of [undefined, s - .2]) {
        const at = track.locate(p.x, p.z, hint, p.y + track.radius);
        assert.ok(Math.abs(at.s - s) < .01, 'Helix progress must pick the correct deck.');
      }
    }
  }
}

await initPhysics();
let failures = 0;
for (const id of courseIds) {
  if (courseFilter && id !== courseFilter) continue;
  const track = buildTrack(id);
  for (let count = 2; count <= track.laneCount; count++) failures += exerciseField(track, count);
  if (id === 'prism') checkPrismBanks(track);
  if (id === 'frostline' || id === 'timber' || id === 'orrery' || id === 'tideglass') checkSectionStarts(track);
  if (id === 'timber') checkTimberLevels(track);
  if (id === 'wireworks') checkWireworksContacts(track);
  if (id === 'orrery') {
    checkOrreryCrossing(track);
    checkOrreryJumps(track, firstSeed);
  }
}
assert.equal(failures, 0, failures + ' heats failed; see the courses and seeds above.');
