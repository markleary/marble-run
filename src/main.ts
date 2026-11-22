import { createUI } from './ui';
import type { Racer, RaceRow } from './ui';
import { RaceSound } from './sound';
import type { CourseId } from './courses/catalog';
import type { RaceBroadcast } from './broadcast';
import type { RaceSimulation } from './simulation';
import type { CruxFormat } from './courses/cruxCheckpoints';
import { compareRacePosition } from './raceTiming';

const canvas = document.querySelector<HTMLCanvasElement>('#scene')!;
const sound = new RaceSound();
let heat: RaceSimulation | undefined;
let broadcast: RaceBroadcast | undefined;
let entrants: Racer[] = [];
let racingState: 'setup' | 'countdown' | 'race' | 'results' | 'failure' = 'setup';
let stageHeat: ((field: Racer[], format: CruxFormat) => void) | undefined;
let requestFrame: (() => void) | undefined;
let countdownRemaining = 0;
let accumulator = 0;
let lastHUD = -1;
let lastFinishCount = 0;
let lastGateReleases = 0;
let lastTimestamp = 0;
let settling = 0;
let contextLost = false;
let pageHidden = false;
let screenLock: WakeLockSentinel | undefined;
let requestingScreenLock = false;
let previewKey = '';
let selectedCourse: CourseId = 'prism';
let changeCourse: ((id: CourseId) => void) | undefined;

const ui = createUI(document.querySelector('#ui')!, {
  onStart(field, format) {
    sound.unlock();
    stageHeat?.(field, format);
  },
  onSetup() {
    racingState = 'setup';
    heat?.dispose(); heat = undefined;
    sound.stopRolling(); sound.stopMusic(); broadcast?.preview();
    broadcast?.entrants(ui.previewRacers());
    requestFrame?.();
  },
  onSound(enabled) {
    sound.enable(enabled);
    if (enabled) sound.unlock();
  },
  onPreview(field, course) {
    if (selectedCourse !== course) {
      selectedCourse = course;
      changeCourse?.(course);
    }
    const key = [course, ...field.map(r => r.color)].join('/');
    if (key !== previewKey) {
      broadcast?.entrants(field);
      requestFrame?.();
    }
    previewKey = key;
  }
});
sound.enable(ui.soundEnabled());

function ordered(): RaceRow[] {
  if (!heat) return [];
  return [...heat.marbles].sort(compareRacePosition)
    .map(m => ({ id: entrants[m.id].id, finishTime: m.finishTime, cutAt: m.cutAt }));
}

function isSuspended() {
  return document.hidden || pageHidden || contextLost;
}

function watchingHeat() {
  return !isSuspended() && (racingState === 'countdown' || racingState === 'race');
}

// A spectator may watch a two-minute heat without touching the screen.
async function syncScreenLock() {
  if (!watchingHeat()) {
    const previous = screenLock;
    screenLock = undefined;
    await previous?.release().catch(() => {});
    return;
  }
  if (!navigator.wakeLock || requestingScreenLock || (screenLock && !screenLock.released)) return;
  requestingScreenLock = true;
  try {
    const lock = await navigator.wakeLock.request('screen');
    if (watchingHeat()) screenLock = lock;
    else await lock.release();
  } catch { /* The OS can decline the request in power-saving mode. */ }
  finally { requestingScreenLock = false; }
}

function announceProblem(message: string) {
  let notice = document.querySelector<HTMLElement>('.runtime-notice');
  if (!notice) {
    notice = document.createElement('div');
    notice.className = 'runtime-notice';
    notice.setAttribute('role', 'alert');
    document.body.append(notice);
  }
  notice.textContent = message;
}

async function boot() {
  const [{ buildTrack }, { RaceBroadcast }, { RaceSimulation, initPhysics, FIXED_DT }] = await Promise.all([
    import('./track'), import('./broadcast'), import('./simulation')
  ]);
  let track = buildTrack(selectedCourse);
  broadcast = new RaceBroadcast(canvas, track);
  changeCourse = id => {
    track = buildTrack(id);
    broadcast!.setCourse(track);
  };
  broadcast.entrants(ui.previewRacers());
  broadcast.update([], 1, 1, 0);
  await initPhysics();
  stageHeat = (field, format) => {
    heat?.dispose(); sound.stopRolling();
    entrants = field;
    heat = new RaceSimulation(track, entrants.length, crypto.getRandomValues(new Uint32Array(1))[0], format);
    sound.startMusic(track.id);
    broadcast!.entrants(entrants);
    countdownRemaining = 3; accumulator = 0; lastFinishCount = 0; lastGateReleases = 0; lastHUD = -1;
    racingState = 'countdown';
    void syncScreenLock();
    ui.showCountdown(3); broadcast!.grid();
    ui.updateRace(0, ordered(), heat.competition?.gates);
    lastTimestamp = 0;
    requestFrame?.();
  };
  ui.setReady(true);
  const resize = new ResizeObserver(() => {
    broadcast!.resize();
    if (racingState === 'results') settling = 1.5;
    requestFrame?.();
  });
  resize.observe(canvas);

  function frame(now: number) {
    const dt = lastTimestamp ? Math.min((now - lastTimestamp) / 1000, 0.4) : 0;
    lastTimestamp = now;
    if (racingState === 'setup') {
      broadcast!.update([], 1, 1, 0);
      return;
    }
    if (!heat) return;
    if (racingState === 'countdown') {
      const before = Math.ceil(countdownRemaining);
      countdownRemaining -= dt;
      const after = Math.ceil(countdownRemaining);
      if (countdownRemaining <= 0) {
        racingState = 'race'; heat.release(); ui.showRace(); broadcast!.race();
        sound.play('gate');
      } else if (before !== after) ui.showCountdown(after);
      broadcast!.update(heat.marbles, 1, dt, 0, heat.competition?.gates);
      return;
    }
    if (racingState === 'race') {
      accumulator += dt;
      while (accumulator >= FIXED_DT && !heat.finished && !heat.failure) {
        const impacts = heat.step();
        for (const impact of impacts) sound.play('contact', Math.max(0.14, impact.strength * 0.7));
        accumulator -= FIXED_DT;
      }
      const finishedCount = heat.marbles.filter(marble => marble.finishTime !== null).length;
      if (heat.competition) {
        const releases = heat.competition.gates.filter(gate => gate.releasedAt !== null).length;
        if (releases > lastGateReleases) sound.play('gate', 0.7);
        lastGateReleases = releases;
      }
      if (finishedCount > lastFinishCount) {
        sound.play('bell', lastFinishCount ? 0.36 : 0.85);
        lastFinishCount = finishedCount;
      }
      if (heat.failure) {
        racingState = 'failure'; sound.stopRolling(); sound.stopMusic(); ui.showFailure(heat.failure);
        void syncScreenLock();
        return;
      }
      if (heat.finished) {
        racingState = 'results'; settling = 2;
        void syncScreenLock();
        ui.showResults(ordered(), heat.competition?.gates); sound.stopRolling(); sound.stopMusic(); broadcast!.podium();
      } else if (heat.elapsed - lastHUD >= 0.08) {
        lastHUD = heat.elapsed; ui.updateRace(heat.elapsed, ordered(), heat.competition?.gates);
        const active = heat.marbles.filter(m => m.finishTime === null && !m.cutAt);
        const surfaces = { lacquer: 0, wood: 0, ice: 0, wire: 0, glass: 0, alloy: 0 };
        let rolling = 0, speed = 0;
        for (const marble of active) {
          const surface = heat.rollingSurface(marble, track.id === 'kepler' || track.id === 'crux' ? 'support' : 'any');
          if (surface) { surfaces[surface]++; speed += marble.speed; rolling++; }
        }
        if (rolling) {
          const hiss = surfaces.ice + 0.3 * surfaces.glass;
          const rattle = surfaces.wire + 0.35 * surfaces.alloy;
          sound.rolling(speed / rolling, surfaces.wood / rolling, hiss / rolling, rattle / rolling);
        } else sound.stopRolling();
      }
      broadcast!.update(heat.marbles, Math.min(1, accumulator / FIXED_DT), dt, heat.elapsed, heat.competition?.gates);
    } else if (racingState === 'results' && settling > 0) {
      settling -= dt;
      accumulator += dt;
      while (accumulator >= FIXED_DT) { heat.coast(); accumulator -= FIXED_DT; }
      broadcast!.update(heat.marbles, accumulator / FIXED_DT, dt, heat.elapsed, heat.competition?.gates);
    }
  }
  // Static menus and finished podiums need another frame only after an interaction or resize.
  let framePending = false;
  const schedule = () => {
    if (framePending || isSuspended()) return;
    framePending = true;
    requestAnimationFrame(now => {
      framePending = false;
      if (isSuspended()) return;
      frame(now);
      if (racingState === 'countdown' || racingState === 'race' || (racingState === 'results' && settling > 0)) schedule();
    });
  };
  requestFrame = schedule;
  schedule();
}
function syncActivity() {
  lastTimestamp = 0;
  const paused = isSuspended();
  sound.setPaused(paused);
  void syncScreenLock();
  if (!paused) requestFrame?.();
}
document.addEventListener('visibilitychange', syncActivity);
window.addEventListener('pagehide', () => {
  pageHidden = true;
  syncActivity();
});
window.addEventListener('pageshow', () => {
  pageHidden = false;
  syncActivity();
});
canvas.addEventListener('webglcontextlost', event => {
  event.preventDefault(); contextLost = true; syncActivity();
  announceProblem('Graphics paused. Restoring the track…');
});
canvas.addEventListener('webglcontextrestored', () => {
  contextLost = false; settling = 2;
  syncActivity();
  document.querySelector('.runtime-notice')?.remove();
});
boot().catch(error => {
  console.error(error);
  announceProblem('The 3D track could not start. Enable WebGL in your browser and reload to try again.');
});
