import assert from 'node:assert/strict';
import { spectralFields, spectralLaunch } from '../src/courses/spectral';
import { FIXED_DT, RaceSimulation } from '../src/simulation';
import type { CourseTrack } from '../src/track';

export function checkSpectralMechanics(track: CourseTrack, seed: number) {
  const race = new RaceSimulation(track, track.laneCount, seed);
  try {
    const grid = race.marbles.map(marble => marble.position);
    race.release();
    // Before the scoop, all six marbles must fall straight down from their grid positions.
    while (race.elapsed < 2 && !race.failure) race.step();
    assert.equal(race.failure, null);
    for (const marble of race.marbles) {
      const start = grid[marble.id], p = marble.position;
      const fall = start.y - p.y;
      assert.ok(fall > 9 && Math.hypot(p.x - start.x, p.z - start.z) < track.radius / 4, 'Expected a straight vertical freefall.');
      assert.ok(Math.abs(marble.distance - track.startS - fall) < .05, 'Progress must follow altitude in the shaft.');
    }
    let fastTicks = 0, clampedTicks = 0;
    while (!race.failure && !race.finished && race.marbles.some(marble => marble.distance < spectralLaunch.end + 1)) {
      race.step();
      for (const m of race.marbles) {
        if (m.distance < spectralLaunch.drop || m.distance > spectralLaunch.end || m.speed < 8) continue;
        const p = m.position, previous = m.previousPosition;
        const travel = Math.hypot(p.x - previous.x, p.y - previous.y, p.z - previous.z);
        fastTicks++;
        if (travel < .5 * FIXED_DT * m.speed) clampedTicks++;
      }
    }
    assert.equal(race.failure, null, 'The scoop must catch the whole field.');
    assert.ok(fastTicks > 0 && clampedTicks < fastTicks * .05,
      `Marbles repeatedly lost high-speed travel on the scoop (${clampedTicks} of ${fastTicks} ticks).`);
    const exit = track.sample(spectralLaunch.end);
    for (const marble of race.marbles) {
      const beyondExit = (marble.position.x - exit.x) * exit.tx + (marble.position.z - exit.z) * exit.tz;
      assert.ok(marble.speed > 8 && beyondExit > .8,
        'The curved receiver must carry each marble out of the shaft at speed.');
    }
  } finally {
    race.dispose();
  }

  // Start at a wave crest on each straight with the opposite coil energized.
  // A resting marble in an interior lane should roll toward that coil.
  for (const [i, field] of spectralFields.entries()) {
    const side = i === 0 ? -1 : 1;
    const phase = side < 0 ? .5 : 0;
    const startS = field.start + field.pitch * (2 + phase - field.phase / (2 * Math.PI));
    const heat = new RaceSimulation({ ...track, startS }, track.laneCount, seed);
    try {
      const marble = heat.marbles.find(m => m.slot === 2)!;
      const start = marble.position, line = track.sample(startS);
      heat.release();
      for (let tick = 0; tick < 24; tick++) heat.step();
      assert.equal(heat.failure, null);
      const drift = (marble.position.x - start.x) * line.rx + (marble.position.z - start.z) * line.rz;
      assert.ok(side * drift > .12, 'A marble at rest must accelerate toward the active pole.');
    } finally {
      heat.dispose();
    }
  }
}
