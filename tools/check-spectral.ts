import assert from 'node:assert/strict';
import RAPIER from '@dimforge/rapier3d-compat';
import { Quaternion, Vector3 } from 'three';
import { spectralFields, spectralLaunch } from '../src/courses/spectral';
import { spectralFan, spectralFanAngle, spectralFanFrame } from '../src/courses/spectralFan';
import { attachSpectralFan } from '../src/spectralFanDrive';
import { FIXED_DT, RaceSimulation } from '../src/simulation';
import type { CourseTrack } from '../src/track';

/** Follow actual bodies across the rim and measure how far one blade pocket carries each racer. */
export function watchSpectralFan(track: CourseTrack, race: RaceSimulation) {
  const { center, tilt } = spectralFanFrame(track);
  const { radius, bladeRadius, bladeCount, angularSpeed, startS, endS } = spectralFan;
  const local = new Vector3(), untilt = new Quaternion().copy(tilt).invert();
  const spacing = 2 * Math.PI / bladeCount;
  const passes = race.marbles.map(() => ({
    entered: false, supported: false, exited: false, pocket: -1, angle: 0,
    sweep: 0, pickedUpAt: 0, carried: false,
  }));
  let crossed = 0;
  return {
    observe() {
      if (crossed === passes.length) return;
      for (const marble of race.marbles) {
        const pass = passes[marble.id];
        if (pass.exited || marble.distance < startS - 2 || marble.distance > endS + 2) continue;
        const dx = marble.position.x - center.x, dz = marble.position.z - center.z;
        const forward = dx * center.tx + dz * center.tz;
        const inside = dx * dx + dz * dz <= radius * radius;
        if (!pass.entered && inside && forward < 0) pass.entered = true;
        if (pass.entered && !inside && forward > 0) {
          pass.exited = true;
          crossed++;
        }

        local.copy(marble.position).sub(center).applyQuaternion(untilt);
        const r = Math.hypot(local.x, local.z);
        if (!pass.entered || !inside || r > bladeRadius || r < spectralFan.hubTopRadius) {
          pass.pocket = -1;
          continue;
        }
        if (!pass.supported) pass.supported = race.rollingSurface(marble, 'support') !== undefined;
        const angle = Math.atan2(local.z, local.x);
        // The line through each solid paddle sweeps backward toward its tip.
        // Crossing that line changes pockets even when a marble hops over a vane.
        const bladeAngle = .015 + .14 * Math.max(0, Math.min(1, (r / bladeRadius - .5) * 2));
        const sector = Math.floor((angle + spectralFanAngle(race.elapsed) - bladeAngle) / spacing);
        const pocket = ((sector % bladeCount) + bladeCount) % bladeCount;
        if (pocket !== pass.pocket) {
          pass.pocket = pocket;
          pass.sweep = 0;
          pass.pickedUpAt = race.elapsed;
        } else {
          const turn = Math.atan2(Math.sin(angle - pass.angle), Math.cos(angle - pass.angle));
          pass.sweep -= Math.sign(angularSpeed) * turn;
          const rotorSweep = Math.abs(angularSpeed) * (race.elapsed - pass.pickedUpAt);
          if (pass.sweep >= Math.PI / 2 && rotorSweep >= Math.PI / 3) pass.carried = true;
        }
        pass.angle = angle;
      }
    },
    verify() {
      for (const [id, pass] of passes.entries()) {
        const label = `Spectral fan, seed ${race.seed}, slot ${race.marbles[id].slot + 1}`;
        assert.ok(pass.entered, label + ' must enter the upstream rim.');
        assert.ok(pass.supported, label + ' must make supporting contact within the fan blade radius.');
        assert.ok(pass.carried, label + ' must travel at least a quarter-turn in one rotating pocket.');
        assert.ok(pass.exited, label + ' must leave through the downstream rim.');
      }
      return crossed;
    },
  };
}

function checkFanBladeContact(track: CourseTrack) {
  const { centerS, bladeRadius, bladeCount, angularSpeed } = spectralFan;
  const center = track.sample(centerS);
  const spacing = 2 * Math.PI / bladeCount;
  const uphill = Math.atan2(-center.tz, -center.tx);
  const gapAngle = spacing * (Math.floor(uphill / spacing) + .5);
  const x = center.x + bladeRadius * .65 * Math.cos(gapAngle);
  const z = center.z + bladeRadius * .65 * Math.sin(gapAngle);
  // Place the probe between two blades at the actual height of the uphill deck.
  // With gravity disabled, only a rotor correctly pitched to the deck can move it.
  const at = track.locate(x, z, centerS);
  const start = new Vector3(x, track.sample(at.s, at.lateral).y + track.radius, z);
  const world = new RAPIER.World({ x: 0, y: 0, z: 0 });
  try {
    world.timestep = FIXED_DT;
    const advance = attachSpectralFan(world, track);
    const body = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(start.x, start.y, start.z));
    const ball = world.createCollider(RAPIER.ColliderDesc.ball(track.radius).setMass(1), body);
    world.step();
    assert.ok(start.distanceTo(body.translation()) < .001, 'The probe must start clear of both blades.');
    const oneBladePass = spacing / Math.abs(angularSpeed);
    assert.ok(Number.isFinite(oneBladePass) && oneBladePass > 0, 'The turbine must have a finite blade pass time.');
    let contact = false;
    for (let tick = 1; tick <= Math.ceil(oneBladePass / FIXED_DT); tick++) {
      advance(tick * FIXED_DT);
      world.step();
      world.contactPairsWith(ball, blade => world.contactPair(ball, blade, manifold => {
        if (manifold.numSolverContacts()) contact = true;
      }));
    }
    const displacement = new Vector3().copy(body.translation()).sub(start);
    const alongSweep = Math.sign(angularSpeed) * (displacement.x * Math.sin(gapAngle) - displacement.z * Math.cos(gapAngle));
    assert.ok(contact && alongSweep > .10,
      `A moving blade must contact the marble and push it along its sweep (traveled ${alongSweep.toFixed(3)}).`);
  } finally {
    world.free();
  }
}

export function checkSpectralMechanics(track: CourseTrack, seed: number) {
  checkFanBladeContact(track);
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
