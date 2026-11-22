import { createUI } from './ui';
import type { Racer, RaceRow } from './ui';
import { RaceSound } from './sound';
import type { CourseId } from './courses/catalog';
import type { RaceBroadcast } from './broadcast';
import type { RaceSimulation } from './simulation';

const canvas = document.querySelector<HTMLCanvasElement>('#scene')!;
const sound = new RaceSound();
let heat: RaceSimulation | undefined;
let broadcast: RaceBroadcast | undefined;
let entrants: Racer[] = [];
let racingState: 'setup' | 'countdown' | 'race' | 'results' | 'failure' = 'setup';
let stageHeat: ((field: Racer[]) => void) | undefined;
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
  onStart(field) {
    sound.unlock();
    stageHeat?.(field);
  },
  onSetup() {
    racingState = 'setup';
    heat?.dispose(); heat = undefined;
    sound.stopRolling(); broadcast?.preview();
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
  return [...heat.marbles].sort((a, b) => {
    if (a.finishTime !== null || b.finishTime !== null) return (a.finishTime ?? Infinity) - (b.finishTime ?? Infinity);
    return b.distance - a.distance;
  }).map(m => ({ id: entrants[m.id].id, finishTime: m.finishTime }));
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
  stageHeat = (field) => {
    heat?.dispose(); sound.stopRolling();
    entrants = field;
    heat = new RaceSimulation(track, entrants.length, crypto.getRandomValues(new Uint32Array(1))[0]);
    broadcast!.entrants(entrants);
    countdownRemaining = 3; accumulator = 0; lastFinishCount = 0; lastHUD = -1;
    racingState = 'countdown';
    ui.showCountdown(3); broadcast!.grid();
    ui.updateRace(0, ordered());
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
        racingState = 'failure'; sound.stopRolling(); ui.showFailure(heat.failure); return;
      }
      if (heat.finished) {
        racingState = 'results'; settling = 2;
        ui.showResults(ordered()); sound.stopRolling(); broadcast!.podium();
      } else if (heat.elapsed - lastHUD >= 0.08) {
        lastHUD = heat.elapsed; ui.updateRace(heat.elapsed, ordered());
        const active = heat.marbles.filter(m => m.finishTime === null);
        const speed = active.reduce((sum, m) => sum + m.speed, 0) / active.length;
        const wood = active.filter(m => track.surfaceAt(m.distance) === 'wood').length / active.length;
        const ice = active.filter(m => track.surfaceAt(m.distance) === 'ice').length / active.length;
        sound.rolling(speed, wood, ice);
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
document.addEventListener('visibilitychange', () => { lastTimestamp = 0; if (document.hidden) sound.stopRolling(); });
canvas.addEventListener('webglcontextlost', event => {
  event.preventDefault(); contextLost = true; sound.stopRolling();
  announceProblem('Graphics paused. Restoring the track…');
});
canvas.addEventListener('webglcontextrestored', () => {
  contextLost = false; lastTimestamp = 0; previewDirty = true; settling = 2;
  document.querySelector('.runtime-notice')?.remove();
});
boot().catch(error => {
  console.error(error);
  announceProblem('The 3D track could not start. Enable WebGL in your browser and reload to try again.');
});
