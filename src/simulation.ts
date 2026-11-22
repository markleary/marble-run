import RAPIER from '@dimforge/rapier3d-compat';
import type { PrismTrack } from './track';

export const FIXED_DT = 1 / 60;
const GRAVITY = 5.4;
const STALL_SECONDS = 10;
const MAX_HEAT_SECONDS = 120;

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
  progress: number;
  speed: number;
  finishTime: number | null;
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

function startingSlots(random: () => number): number[] {
  const slots = [0, 1, 2, 3];
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
  private readonly checkpoints: { distance: number; time: number }[] = [];
  private readonly lastImpact: number[] = [];
  private readonly finishLine: ReturnType<PrismTrack['sample']>;
  private readonly impacts: Impact[] = [];
  private tick = 0;
  private racing = false;
  private disposed = false;

  constructor(private readonly track: PrismTrack, entrantCount: number, readonly seed: number) {
    if (!Number.isInteger(entrantCount) || entrantCount < 2 || entrantCount > 4) {
      throw new RangeError('A race requires two to four marbles.');
    }
    this.world = new RAPIER.World({ x: 0, y: -GRAVITY, z: 0 });
    this.world.timestep = FIXED_DT;
    this.events = new RAPIER.EventQueue(true);
    const course = RAPIER.ColliderDesc.trimesh(
      track.collision.vertices, track.collision.indices, RAPIER.TriMeshFlags.FIX_INTERNAL_EDGES,
    ).setFriction(0.42).setRestitution(0.08);
    this.world.createCollider(course);
    this.finishLine = track.sample(track.finishS);
    const random = seededRandom(seed);
    const slots = startingSlots(random);
    this.marbles = Array.from({ length: entrantCount }, (_, id) => {
      const slot = slots[id];
      const wiggleRoom = Math.max(0, track.laneWidth / 2 - track.radius - 0.06);
      const lateral = (slot - 1.5) * track.laneWidth + (2 * random() - 1) * wiggleRoom;
      const floor = track.sample(track.startS, lateral);
      const position = { x: floor.x, y: floor.y + track.radius + 0.01, z: floor.z };
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
        distance: track.startS, progress: 0, speed: 0, finishTime: null,
      };
    });
  }

  release(): void {
    this.racing = true;
  }

  step(): readonly Impact[] {
    this.impacts.length = 0;
    if (!this.racing || this.disposed || this.finished || this.failure) return this.impacts;
    this.world.step(this.events);
    this.elapsed = ++this.tick * FIXED_DT;
    this.syncBodies();
    this.events.drainContactForceEvents(event => {
      const id = this.idByCollider.get(event.collider1()) ?? this.idByCollider.get(event.collider2());
      if (id === undefined || this.elapsed - this.lastImpact[id] < 0.12) return;
      const impulse = event.totalForceMagnitude() * FIXED_DT;
      if (impulse < 0.45) return;
      this.lastImpact[id] = this.elapsed;
      this.impacts.push({ id, strength: Math.min(1, impulse / 4) });
    });
    this.finished = this.marbles.every(marble => marble.finishTime !== null);
    return this.impacts;
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
      marble.position = body.translation();
      marble.rotation = body.rotation();
      const velocity = body.linvel();
      marble.speed = Math.hypot(velocity.x, velocity.y, velocity.z);
      if (!this.finished && marble.finishTime === null) this.updateProgress(marble);
    }
  }

  private updateProgress(marble: MarbleState) {
    const { track, finishLine } = this;
    const p = marble.position;
    const previous = marble.previousPosition;
    const nearest = track.locate(p.x, p.z, marble.distance);
    marble.distance = nearest.s;
    marble.progress = Math.max(0, Math.min(1, (nearest.s - track.startS) / (track.finishS - track.startS)));

    // Count the leading edge of the sphere at the finish, even when two racers cross in one tick.
    if (nearest.s >= track.finishS - track.radius * 2 && Math.abs(nearest.lateral) <= track.halfWidth) {
      const from = (previous.x - finishLine.x) * finishLine.tx
        + (previous.z - finishLine.z) * finishLine.tz + track.radius;
      const to = (p.x - finishLine.x) * finishLine.tx + (p.z - finishLine.z) * finishLine.tz + track.radius;
      if (from <= 0 && to >= 0 && to > from) {
        marble.finishTime = this.elapsed - FIXED_DT + FIXED_DT * (-from / (to - from));
        marble.progress = 1;
        return;
      }
    }

    const checkpoint = this.checkpoints[marble.id];
    if (nearest.s > checkpoint.distance + 0.2) {
      checkpoint.distance = nearest.s;
      checkpoint.time = this.elapsed;
    }
    if (Math.abs(nearest.lateral) > track.halfWidth + track.radius * 2
        || p.y < track.sample(nearest.s, nearest.lateral).y - 2 * track.radius) {
      this.failure = 'A marble left the course.';
    } else if (this.elapsed - checkpoint.time > STALL_SECONDS || this.elapsed > MAX_HEAT_SECONDS) {
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
