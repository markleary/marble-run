import RAPIER from '@dimforge/rapier3d-compat';
import type { CourseTrack, CourseSurface } from './track';
import { spectralFields, spectralOffset, spectralPolarity } from './courses/spectral';
import { attachOrreryDrive } from './orreryDrive';
import { attachAfterglowDrive } from './afterglowDrive';
import { attachSpectralFan } from './spectralFanDrive';
import { spectralFan } from './courses/spectralFan';
import { attachCheckpointRacks } from './checkpointRackDrive';
import { checkpointStations } from './courses/checkpoints';
import { createCheckpointRace, type CheckpointFormat } from './checkpointRace';
import { crossingTime } from './raceTiming';

export const FIXED_DT = 1 / 60;
const GRAVITY = 5.4;
const STALL_SECONDS = 10;
const MAX_HEAT_SECONDS = 120;
const LONG_HEAT_SECONDS = 240;

let initialization: Promise<void> | undefined;
export function initPhysics(): Promise<void> {
  initialization ??= RAPIER.init();
  return initialization;
}

export interface Point { x: number; y: number; z: number }
export interface Orientation extends Point { w: number }

export interface MarbleState {
  readonly id: number;
  readonly slot: number;
  position: Point;
  previousPosition: Point;
  rotation: Orientation;
  previousRotation: Orientation;
  distance: number;
  previousDistance: number;
  progress: number;
  speed: number;
  finishTime: number | null;
  cutAt?: number;
  stagingAt?: number;
  rackSlot?: number;
}

export interface Impact {
  id: number;
  strength: number;
}

function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = Math.imul(state ^ (state >>> 15), state | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function startingSlots(count: number, random: () => number): number[] {
  const slots = Array.from({ length: count }, (_, index) => index);
  for (let i = slots.length - 1; i > 0; i--) {
    const other = Math.floor(random() * (i + 1));
    [slots[i], slots[other]] = [slots[other], slots[i]];
  }
  return slots;
}

export class RaceSimulation {
  readonly marbles: MarbleState[];
  elapsed = 0;
  finished = false;
  failure: string | null = null;

  private readonly world: RAPIER.World;
  private readonly events: RAPIER.EventQueue;
  private readonly bodies: RAPIER.RigidBody[] = [];
  private readonly idByCollider = new Map<number, number>();
  private readonly surfaceByCollider = new Map<number, CourseSurface>();
  private readonly checkpoints: { distance: number; time: number }[] = [];
  private readonly lastImpact: number[] = [];
  private readonly finishLine: ReturnType<CourseTrack['sample']>;
  private readonly impacts: Impact[] = [];
  private readonly advanceDrive?: (seconds: number) => void;
  private readonly driveRacks?: ReturnType<typeof attachCheckpointRacks>;
  readonly competition?: ReturnType<typeof createCheckpointRace>;
  private tick = 0;
  private racing = false;
  private disposed = false;
  private fastOpening = false;

  constructor(private readonly track: CourseTrack, entrantCount: number, readonly seed: number, format: CheckpointFormat = 'endurance') {
    if (!Number.isInteger(entrantCount) || entrantCount < 2 || entrantCount > track.laneCount) {
      throw new RangeError('A race requires between 2 and ' + track.laneCount + ' marbles.');
    }
    this.world = new RAPIER.World({ x: 0, y: -GRAVITY, z: 0 });
    this.world.timestep = FIXED_DT;
    this.events = new RAPIER.EventQueue(true);
    const friction = { ice: 0.045, wood: 0.48, lacquer: 0.42, wire: 0.40, glass: 0.31, alloy: 0.38 };
    for (const mesh of track.collisions) {
      const collider = RAPIER.ColliderDesc.trimesh(
        mesh.vertices, mesh.indices, RAPIER.TriMeshFlags.FIX_INTERNAL_EDGES,
      ).setFriction(friction[mesh.surface]).setRestitution(0.08);
      if (mesh.surface === 'ice') collider.setFrictionCombineRule(RAPIER.CoefficientCombineRule.Min);
      this.surfaceByCollider.set(this.world.createCollider(collider).handle, mesh.surface);
    }
    for (const peg of track.deflectors) {
      const floor = track.sample(peg.s, peg.lateral);
      // Extend the peg below the banked floor. The rounded shape adds its bevel
      // to both the core radius and its half-height.
      const buried = peg.radius * 0.6;
      const halfHeight = (peg.height + buried) / 2;
      const bevel = Math.min(0.08, peg.radius / 3, halfHeight / 3);
      const collider = RAPIER.ColliderDesc.roundCylinder(halfHeight - bevel, peg.radius - bevel, bevel)
        .setTranslation(floor.x, floor.y + halfHeight - buried, floor.z)
        .setFriction(0.22).setRestitution(0.28);
      this.world.createCollider(collider);
    }
    if (track.id === 'orrery') this.advanceDrive = attachOrreryDrive(this.world, track);
    if (track.id === 'afterglow') this.advanceDrive = attachAfterglowDrive(this.world, track, seed);
    this.finishLine = track.sample(track.finishS);
    const stations = checkpointStations(track.id, track.sections);
    if (stations.length) this.competition = createCheckpointRace(track, entrantCount, stations, format);
    if (track.id === 'spectral') {
      this.advanceDrive = attachSpectralFan(this.world, track, collider => this.surfaceByCollider.set(collider.handle, 'alloy'));
      this.fastOpening = track.startS < track.sections[1].end;
      // Resume travel after an impact with the curved receiver within the same
      // fixed tick. A single CCD substep discards the remaining motion at contact.
      if (this.fastOpening) this.world.maxCcdSubsteps = 4;
    }
    const random = seededRandom(seed);
    const slots = startingSlots(track.laneCount, random);
    this.marbles = Array.from({ length: entrantCount }, (_, id) => {
      const slot = slots[id];
      const wiggleRoom = Math.max(0, track.laneWidth / 2 - track.radius - 0.06);
      const laneCenter = (slot + 0.5) * track.laneWidth - track.halfWidth;
      const lateral = laneCenter + (2 * random() - 1) * wiggleRoom;
      const floor = track.sample(track.startS, lateral);
      const normal = track.id === 'spectral' ? spectralOffset(track.startS) : { x: 0, y: 1 };
      const clearance = track.radius + .01;
      const position = { x: floor.x + normal.x * clearance, y: floor.y + normal.y * clearance, z: floor.z };
      const yaw = random() * Math.PI;
      const rotation = { x: 0, y: Math.sin(yaw), z: 0, w: Math.cos(yaw) };
      const body = this.world.createRigidBody(RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(position.x, position.y, position.z).setRotation(rotation)
        .setCanSleep(false).setCcdEnabled(true).setLinearDamping(0.025).setAngularDamping(0.015));
      const collider = this.world.createCollider(RAPIER.ColliderDesc.ball(track.radius)
        .setMass(1).setFriction(0.45).setRestitution(0.17)
        .setActiveEvents(RAPIER.ActiveEvents.CONTACT_FORCE_EVENTS)
        .setContactForceEventThreshold(16), body);
      this.bodies.push(body);
      this.checkpoints.push({ distance: track.startS, time: 0 });
      this.lastImpact.push(-1);
      this.idByCollider.set(collider.handle, id);
      return {
        id, slot, position, previousPosition: position, rotation, previousRotation: rotation,
        distance: track.startS, previousDistance: track.startS, progress: 0, speed: 0, finishTime: null,
      };
    });
    if (this.competition?.gates.some(gate => gate.cut)) {
      this.driveRacks = attachCheckpointRacks(this.world, track, this.competition.gates, this.bodies);
    }
  }

  release(): void {
    this.racing = true;
  }

  rollingSurface(marble: MarbleState, contact: 'any' | 'support' = 'any'): CourseSurface | undefined {
    const ball = this.bodies[marble.id].collider(0);
    const preferred = this.track.surfaceAt(marble.distance);
    let result: CourseSurface | undefined;
    this.world.contactPairsWith(ball, other => {
      const surface = this.surfaceByCollider.get(other.handle);
      if (!surface || result === preferred) return;
      this.world.contactPair(ball, other, (manifold, flipped) => {
        if (!manifold.numSolverContacts()) return;
        if (contact === 'support') {
          // Point the normal from the track toward the marble, whichever
          // collider Rapier placed first. A vertical guard supplies no lift.
          const up = manifold.normal().y * (flipped ? 1 : -1);
          if (up < 0.5) return;
        }
        result = surface;
      });
    });
    return result;
  }

  step(): readonly Impact[] {
    this.impacts.length = 0;
    if (!this.racing || this.disposed || this.finished || this.failure) return this.impacts;
    this.advanceDrive?.((this.tick + 1) * FIXED_DT);
    if (this.track.id === 'spectral') this.driveSpectralTrack();
    this.world.step(this.events);
    this.elapsed = ++this.tick * FIXED_DT;
    this.syncBodies();
    if (this.fastOpening && this.marbles.every(marble => marble.distance >= this.track.sections[1].end)) {
      this.fastOpening = false;
      this.world.maxCcdSubsteps = 1;
    }
    this.competition?.step(this.marbles, this.elapsed, FIXED_DT);
    this.driveRacks?.(this.marbles, this.elapsed, FIXED_DT);
    this.events.drainContactForceEvents(event => {
      const id = this.idByCollider.get(event.collider1()) ?? this.idByCollider.get(event.collider2());
      if (id === undefined || this.elapsed - this.lastImpact[id] < 0.12) return;
      const impulse = event.totalForceMagnitude() * FIXED_DT;
      if (impulse < 0.45) return;
      this.lastImpact[id] = this.elapsed;
      this.impacts.push({ id, strength: Math.min(1, impulse / 4) });
    });
    this.finished = this.marbles.every(marble => marble.finishTime !== null || marble.cutAt !== undefined);
    return this.impacts;
  }

  private driveSpectralTrack() {
    for (const marble of this.marbles) {
      if (marble.cutAt !== undefined) continue;
      const s = marble.distance;
      const intake = s >= spectralFan.startS - spectralFan.intakeLength && s < spectralFan.startS;
      const runout = s > spectralFan.endS && s <= spectralFan.endS + spectralFan.runoutLength;
      if ((intake || runout) && this.rollingSurface(marble, 'support')) {
        // The intake meters the pack into the open pocket. The discharge belt
        // gathers the sideways momentum after the vanes release the marble.
        const { tx, tz } = this.track.sample(s);
        const body = this.bodies[marble.id], v = body.linvel();
        const target = intake ? spectralFan.intakeSpeed : spectralFan.runoutSpeed;
        const dx = target * tx - v.x, dz = target * tz - v.z;
        const scale = Math.min(1, 6.8 * FIXED_DT / Math.max(.001, Math.hypot(dx, dz)));
        body.applyImpulse({ x: dx * scale, y: 0, z: dz * scale }, true);
      }
      const field = spectralFields.find(f => s >= f.start && s <= f.end);
      if (!field) continue;
      const impulse = 4.2 * spectralPolarity(field, marble.distance, this.elapsed, this.competition?.gates) * FIXED_DT;
      if (impulse === 0) continue;
      const { rx, rz } = this.track.sample(marble.distance);
      this.bodies[marble.id].applyImpulse({ x: rx * impulse, y: 0, z: rz * impulse }, true);
    }
  }

  /** Continue into the catch tray while the results camera settles. Timing is already locked. */
  coast(): void {
    if (!this.finished || this.disposed) return;
    this.world.step();
    this.syncBodies();
  }

  private syncBodies(): void {
    for (const marble of this.marbles) {
      const body = this.bodies[marble.id];
      marble.previousPosition = marble.position;
      marble.previousRotation = marble.rotation;
      marble.previousDistance = marble.distance;
      marble.position = body.translation();
      marble.rotation = body.rotation();
      const velocity = body.linvel();
      marble.speed = Math.hypot(velocity.x, velocity.y, velocity.z);
      if (marble.cutAt !== undefined) {
        marble.distance = this.track.locate(marble.position.x, marble.position.z, marble.distance, marble.position.y).s;
        continue;
      }
      if (!this.finished && marble.finishTime === null) this.updateProgress(marble);
      // The receiving bed damps both translation and roll after the entire
      // sphere has cleared the timing stripe. The result is already locked.
      if ((this.track.id === 'crux' || this.track.id === 'spectral') && marble.finishTime !== null && body.linearDamping() < 2.4) {
        const line = this.finishLine;
        const depth = (marble.position.x - line.x) * line.tx + (marble.position.z - line.z) * line.tz - 1.1;
        if (depth > 0) {
          const felt = 2.4 * Math.min(1, depth);
          body.setLinearDamping(Math.max(body.linearDamping(), felt));
          body.setAngularDamping(Math.max(body.angularDamping(), felt));
        }
      }
    }
  }

  private updateProgress(marble: MarbleState) {
    const { track, finishLine } = this;
    const p = marble.position;
    const nearest = track.locate(p.x, p.z, marble.distance, p.y);
    marble.distance = nearest.s;
    marble.progress = Math.max(0, Math.min(1, (nearest.s - track.startS) / (track.finishS - track.startS)));

    // Count the leading edge of the sphere at the finish, even when two racers cross in one tick.
    if (nearest.s >= track.finishS - track.radius * 2 && Math.abs(nearest.lateral) <= track.halfWidth) {
      const time = crossingTime(marble, finishLine, track.radius, this.elapsed, FIXED_DT);
      if (time !== null) {
        marble.finishTime = time;
        marble.progress = 1;
        return;
      }
    }

    const checkpoint = this.checkpoints[marble.id];
    // Waiting behind a closed start bar is intentional. Reset the progress
    // watchdog there so the fresh start has the same grace period as the grid.
    if (marble.stagingAt !== undefined
        && this.competition?.gates.find(gate => gate.number === marble.stagingAt)?.seated.includes(marble.id)) {
      checkpoint.time = this.elapsed;
    }
    if (nearest.s > checkpoint.distance + 0.2) {
      checkpoint.distance = nearest.s;
      checkpoint.time = this.elapsed;
    }
    if (Math.abs(nearest.lateral) > track.halfWidth + track.radius * 2
        || p.y < track.sample(nearest.s, nearest.lateral).y - 2 * track.radius) {
      this.failure = 'A marble left the course.';
    } else if (this.elapsed - checkpoint.time > STALL_SECONDS || this.elapsed > (this.competition ? LONG_HEAT_SECONDS : MAX_HEAT_SECONDS)) {
      this.failure = 'A marble stopped before the finish.';
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.events.free();
    this.world.free();
  }
}
