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
let previewDirty = true;
let countdownRemaining = 0;
let accumulator = 0;
let lastHUD = -1;
let lastFinishCount = 0;
let lastTimestamp = 0;
let settling = 0;
let contextLost = false;
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
    previewDirty = true;
    broadcast?.entrants(ui.previewRacers());
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
    if (key !== previewKey) broadcast?.entrants(field);
    previewKey = key;
    previewDirty = true;
  }
});
sound.enable(ui.soundEnabled());

function ordered(): RaceRow[] {
  if (!heat) return [];
  return [...heat.marbles].sort(compareRacePosition)
    .map(m => ({ id: entrants[m.id].id, finishTime: m.finishTime, cutAt: m.cutAt }));
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
    countdownRemaining = 3; accumulator = 0; lastFinishCount = 0; lastHUD = -1;
    racingState = 'countdown';
    ui.showCountdown(3); broadcast!.grid();
    ui.updateRace(0, ordered(), heat.competition?.gates);
    lastTimestamp = 0;
  };
  ui.setReady(true);
  const resize = new ResizeObserver(() => {
    previewDirty = true;
    if (racingState === 'results') settling = 1.5;
  });
  resize.observe(canvas);

  function frame(now: number) {
    requestAnimationFrame(frame);
    if (document.hidden || contextLost) { lastTimestamp = 0; return; }
    const dt = lastTimestamp ? Math.min((now - lastTimestamp) / 1000, 0.4) : 0;
    lastTimestamp = now;
    if (racingState === 'setup') {
      if (previewDirty) { broadcast!.update([], 1, 1, 0); previewDirty = false; }
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
      broadcast!.update(heat.marbles, 1, dt, 0);
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
      if (finishedCount > lastFinishCount) {
        sound.play('bell', lastFinishCount ? 0.36 : 0.85);
        lastFinishCount = finishedCount;
      }
      if (heat.failure) {
        racingState = 'failure'; sound.stopRolling(); sound.stopMusic(); ui.showFailure(heat.failure); return;
      }
      if (heat.finished) {
        racingState = 'results'; settling = 2;
        ui.showResults(ordered(), heat.competition?.gates); sound.stopRolling(); sound.stopMusic(); broadcast!.podium();
      } else if (heat.elapsed - lastHUD >= 0.08) {
        lastHUD = heat.elapsed; ui.updateRace(heat.elapsed, ordered(), heat.competition?.gates);
        const active = heat.marbles.filter(m => m.finishTime === null && !m.cutAt);
        const surfaces = { lacquer: 0, wood: 0, ice: 0, wire: 0, glass: 0, alloy: 0 };
        let rolling = 0, speed = 0;
        for (const marble of active) {
          const surface = heat.rollingSurface(marble, track.id === 'kepler' ? 'support' : 'any');
          if (surface) { surfaces[surface]++; speed += marble.speed; rolling++; }
        }
        if (rolling) {
          const hiss = surfaces.ice + 0.3 * surfaces.glass;
          const rattle = surfaces.wire + 0.35 * surfaces.alloy;
          sound.rolling(speed / rolling, surfaces.wood / rolling, hiss / rolling, rattle / rolling);
        } else sound.stopRolling();
      }
      broadcast!.update(heat.marbles, Math.min(1, accumulator / FIXED_DT), dt, heat.elapsed);
    } else if (racingState === 'results' && settling > 0) {
      settling -= dt;
      accumulator += dt;
      while (accumulator >= FIXED_DT) { heat.coast(); accumulator -= FIXED_DT; }
      broadcast!.update(heat.marbles, accumulator / FIXED_DT, dt, heat.elapsed);
    }
  }
  requestAnimationFrame(frame);
}
document.addEventListener('visibilitychange', () => {
  lastTimestamp = 0;
  sound.setPaused(document.hidden || contextLost);
});
canvas.addEventListener('webglcontextlost', event => {
  event.preventDefault(); contextLost = true; sound.setPaused(true);
  announceProblem('Graphics paused. Restoring the track…');
});
canvas.addEventListener('webglcontextrestored', () => {
  contextLost = false; lastTimestamp = 0; previewDirty = true; settling = 2;
  sound.setPaused(document.hidden);
  document.querySelector('.runtime-notice')?.remove();
});
boot().catch(error => {
  console.error(error);
  announceProblem('The 3D track could not start. Enable WebGL in your browser and reload to try again.');
});
