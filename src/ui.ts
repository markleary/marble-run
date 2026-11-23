import '@fontsource/barlow/latin-500.css';
import '@fontsource/barlow/latin-600.css';
import '@fontsource/barlow/latin-700.css';
import '@fontsource/barlow-condensed/latin-600.css';
import '@fontsource/barlow-condensed/latin-700.css';
import '@fontsource/barlow-condensed/latin-800-italic.css';
import '@fontsource/ibm-plex-mono/latin-500.css';
import './style.css';
import { setupInstall } from './install';
import { courseIds, courses, fieldSizes } from './courses/catalog';
import type { CourseId } from './courses/catalog';
import type { CruxFormat } from './courses/cruxCheckpoints';
import type { RaceCheckpoint } from './cruxCompetition';
import { Standings, finishPoints, normalizedName } from './standings';

export interface Racer {
  id: string;
  name: string;
  color: string;
  symbol: number;
  marked: boolean;
}

export interface RaceRow {
  id: string;
  finishTime?: number | null;
  cutAt?: number;
}

export interface UIActions {
  onStart: (racers: Racer[], format: CruxFormat) => void;
  onSetup: () => void;
  onSound: (enabled: boolean) => void;
  onPreview: (racers: Racer[], course: CourseId) => void;
}

const liveries = [
  { color: '#ef442a', label: 'Vermilion', name: 'Comet' },
  { color: '#edae17', label: 'Golden yellow', name: 'Sunbeam' },
  { color: '#179a74', label: 'Emerald', name: 'Clover' },
  { color: '#168bd2', label: 'Azure', name: 'Riptide' },
  { color: '#995bd8', label: 'Violet', name: 'Orbit' },
  { color: '#e95d97', label: 'Rose', name: 'Rosie' },
];

const icons = {
  sound: '<path d="M11.5 4.5 6.7 8.4H3v7.2h3.7l4.8 3.9z"/><path d="M15 8a5.6 5.6 0 0 1 0 8m3-11a9.5 9.5 0 0 1 0 14"/>',
  mute: '<path d="M11.5 4.5 6.7 8.4H3v7.2h3.7l4.8 3.9z"/><path d="m16 9 6 6m0-6-6 6"/>',
  expand: '<path d="M9 4H4v5m11-5h5v5M4 15v5h5m6 0h5v-5"/>',
  collapse: '<path d="M4 9h5V4m6 0v5h5M4 15h5v5m6 0v-5h5"/>',
  trophy: '<path d="M7 3h10v6a5 5 0 0 1-10 0V3Zm5 12v5m-4 1h8M7 6H3v2c0 2.4 1.8 4 4.6 4m9.4-6h4v2c0 2.4-1.8 4-4.6 4"/>',
  arrow: '<path d="M3 12h17m-6-6 6 6-6 6"/>',
  replay: '<path d="M3.5 10a8.5 8.5 0 1 1 .4 5M3.5 4v6h6"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  check: '<path d="m5 12 4 4 10-10"/>',
  flag: '<path d="M5 21V4c4-3 7 3 14 0v10c-7 3-10-3-14 0"/>',
  download: '<path d="M12 3v11m-4-4 4 4 4-4M5 16v4h14v-4"/>',
  chevron: '<path d="m6 9 6 6 6-6"/>',
} as const;

function icon(key: keyof typeof icons) {
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + icons[key] + '</svg>';
}

function bindFullscreen(button: HTMLButtonElement, status: HTMLElement) {
  const doc = document as Document & {
    webkitFullscreenEnabled?: boolean;
    webkitFullscreenElement?: Element;
    webkitExitFullscreen?: () => void | Promise<void>;
  };
  const root = doc.documentElement as HTMLElement & { webkitRequestFullscreen?: () => void | Promise<void> };
  const standard = doc.fullscreenEnabled && typeof root.requestFullscreen === 'function' && typeof doc.exitFullscreen === 'function';
  const webkit = doc.webkitFullscreenEnabled && typeof root.webkitRequestFullscreen === 'function' && typeof doc.webkitExitFullscreen === 'function';
  if (!standard && !webkit) return;

  const enter = standard ? root.requestFullscreen.bind(root) : root.webkitRequestFullscreen!.bind(root);
  const exit = standard ? doc.exitFullscreen.bind(doc) : doc.webkitExitFullscreen!.bind(doc);
  const active = () => Boolean(doc.fullscreenElement || doc.webkitFullscreenElement);
  function sync() {
    const full = active();
    button.innerHTML = icon(full ? 'collapse' : 'expand');
    button.title = full ? 'Exit full screen' : 'Enter full screen';
    button.setAttribute('aria-label', button.title);
  }
  doc.addEventListener(standard ? 'fullscreenchange' : 'webkitfullscreenchange', sync);
  button.addEventListener('click', async () => {
    try {
      if (active()) await exit();
      else await enter();
    } catch {
      status.textContent = 'The browser could not change full screen mode.';
    }
  });
  sync();
  button.hidden = false;
}

function escapeText(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);
}

function readSetting(key: string) {
  try { return localStorage.getItem(key); } catch { return null; }
}

function writeSetting(key: string, value: string) {
  try { localStorage.setItem(key, value); } catch { /* A private session can still race. */ }
}

const setupKey = 'marble-run:setup:v2';
const soundKey = 'marble-run:sound:v1';
interface Entry { name: string; livery: number }
interface Setup { course: CourseId; format: CruxFormat; count: number; entries: Entry[]; marker: number | null }

function readSetup(): Setup {
  function read(key: string) {
    try { return JSON.parse(readSetting(key) ?? 'null'); } catch { return null; }
  }
  const current = read(setupKey);
  const hasRoster = Array.isArray(current?.entries);
  const saved = hasRoster ? current : read('marble-run:setup:v1');
  // The first release stored one favorite and filled the other slots in this order.
  const favorite: number = !hasRoster && Number.isInteger(saved?.livery) && liveries[saved.livery] ? saved.livery : 0;
  const available = [favorite, ...[3, 2, 1, 4, 5, 0].filter(color => color !== favorite)];
  const entries = Array.from({ length: liveries.length }, (_, slot) => {
    const entry = hasRoster ? saved.entries[slot] : slot === 0 ? saved : null;
    const preferred = available.indexOf(entry?.livery);
    const [livery] = available.splice(preferred >= 0 ? preferred : 0, 1);
    return { livery, name: typeof entry?.name === 'string' ? normalizedName(entry.name) : liveries[livery].name };
  });
  return {
    course: courseIds.includes(saved?.course) ? saved.course : 'prism',
    format: saved?.format === 'endurance' ? 'endurance' : 'knockout',
    count: fieldSizes.includes(saved?.count) ? saved.count : 4,
    entries,
    marker: hasRoster && saved.marker === null ? null : Number.isInteger(saved?.marker) && entries[saved.marker] ? saved.marker : 0,
  };
}

function clock(seconds: number) {
  const value = Math.max(0, Math.floor(seconds * 100));
  const minutes = Math.floor(value / 6000);
  return minutes + ':' + String(Math.floor(value / 100) % 60).padStart(2, '0') + '.' + String(value % 100).padStart(2, '0');
}

function colorDot(color: string) {
  return '<span class="identity-dot" aria-hidden="true" style="--livery:' + color + '"></span>';
}

export function createUI(container: HTMLElement, actions: UIActions) {
  const config = readSetup();
  let sound = readSetting(soundKey) !== 'off';
  let ready = false;
  let racers: Racer[] = [];
  let raceId = '';
  let lastOrder = '';
  let lastClock = '';
  let view: 'setup' | 'countdown' | 'race' | 'results' | 'failure' = 'setup';
  const standings = new Standings(liveries.map(livery => livery.color));

  container.innerHTML = `
    <header class="masthead">
      <div class="brand" aria-label="Marble Run"><span class="brand-mark" aria-hidden="true"><i></i></span><span>Marble<span class="brand-run">Run</span></span></div>
      <div class="top-actions">
        <button type="button" class="top-button restart-button" aria-label="Restart race" hidden>${icon('replay')}<span>Restart</span></button>
        <button type="button" class="top-button standings-button" aria-label="Standings">${icon('trophy')}<span>Standings</span></button>
        <button type="button" class="top-button fullscreen-button" hidden></button>
        <button type="button" class="top-button sound-button"></button>
      </div>
    </header>
    <div class="preview-caption">
      <span class="preview-label"><i aria-hidden="true"></i> Track preview</span>
      <div class="course-title"></div>
      <div class="course-features"></div>
    </div>
    <main class="side-panel"></main>
    <section class="race-hud" aria-label="Live standings" hidden>
      <div class="hud-title"><span class="on-air"><i></i> Racing</span><time class="race-clock">0:00.00</time>
        <button class="order-toggle" type="button" aria-label="Full running order" aria-controls="running-order" aria-expanded="false">${icon('chevron')}</button>
      </div>
      <ol class="running-order" id="running-order"></ol>
      <div class="checkpoint-status" role="status" hidden></div>
    </section>
    <div class="countdown-overlay" role="status" aria-live="assertive" hidden><span class="countdown-value"></span></div>
    <div class="sr-only status-announcement" role="status"></div>
    <dialog class="standings-dialog" aria-labelledby="standings-title">
      <div class="dialog-heading"><h2 id="standings-title">Standings</h2><button class="icon-button close-dialog" aria-label="Close standings">${icon('close')}</button></div>
      <p class="scoring-rule">Points across all tracks. First earns 3, second earns 2, and third earns 1.</p>
      <div class="standings-content"></div>
    </dialog>
    <dialog class="install-dialog" id="install-help" aria-labelledby="install-title">
      <h2 id="install-title">Install Marble Run</h2><p></p>
      <form method="dialog"><button type="submit" class="secondary-button">Done</button></form>
    </dialog>`;

  function element<T extends Element>(selector: string): T { return container.querySelector<T>(selector)!; }
  const panel = element<HTMLElement>('.side-panel');
  const hud = element<HTMLElement>('.race-hud');
  const runningOrder = element<HTMLOListElement>('.running-order');
  const time = element<HTMLElement>('.race-clock');
  const checkpointStatus = element<HTMLElement>('.checkpoint-status');
  const countdown = element<HTMLElement>('.countdown-overlay');
  const countdownValue = element<HTMLElement>('.countdown-value');
  const soundButton = element<HTMLButtonElement>('.sound-button');
  const standingsButton = element<HTMLButtonElement>('.standings-button');
  const restartButton = element<HTMLButtonElement>('.restart-button');
  const orderToggle = element<HTMLButtonElement>('.order-toggle');
  const dialog = element<HTMLDialogElement>('.standings-dialog');
  const status = element<HTMLElement>('.status-announcement');
  const installButton = document.createElement('button');
  installButton.id = 'install-app';
  installButton.type = 'button';
  installButton.hidden = true;
  installButton.innerHTML = icon('download') + 'Install game';
  bindFullscreen(element<HTMLButtonElement>('.fullscreen-button'), status);

  function previewRacers() {
    return config.entries.slice(0, config.count).map((entry, slot) => {
      const livery = liveries[entry.livery];
      return { id: 'marble-' + slot, name: normalizedName(entry.name) || livery.name, color: livery.color, symbol: entry.livery, marked: slot === config.marker };
    });
  }

  function setView(next: typeof view) {
    view = next;
    document.body.dataset.view = next;
    const live = next === 'race' || next === 'countdown';
    panel.hidden = live;
    element<HTMLElement>('.preview-caption').hidden = next !== 'setup';
    standingsButton.hidden = live;
    restartButton.hidden = !live;
    hud.hidden = !live;
    countdown.hidden = next !== 'countdown';
    if (!live) panel.scrollTop = 0;
    window.scrollTo(0, 0);
  }

  function updateSound() {
    soundButton.innerHTML = icon(sound ? 'sound' : 'mute');
    soundButton.setAttribute('aria-label', sound ? 'Mute sound' : 'Enable sound');
    soundButton.title = sound ? 'Mute sound' : 'Enable sound';
  }

  function showStandings() {
    const scores = standings.totals();
    element<HTMLElement>('.standings-content').innerHTML = scores.length
      ? '<table class="scores"><thead><tr><th>Marble</th><th>Wins</th><th>Points</th></tr></thead><tbody>' +
        scores.map(m => '<tr><th scope="row">' + colorDot(m.color) + escapeText(m.name) + '</th><td>' + m.wins + '</td><td><strong>' + m.points + '</strong></td></tr>').join('') +
        '</tbody></table>'
      : '<div class="standings-empty">' + icon('trophy') + '<strong>No races yet</strong><p>Finish a race to start the standings.</p></div>';
    dialog.showModal();
  }

  function selectCourse(course: CourseId) {
    config.course = course;
    const selected = courses[course];
    document.title = selected.title + ' · Marble Run';
    document.querySelector('#scene')?.setAttribute('aria-label', 'Three-dimensional view of ' + selected.title);
    element<HTMLElement>('.course-title').textContent = selected.title;
    element<HTMLElement>('.course-features').innerHTML = selected.features.join(' <b>·</b> ');
    panel.querySelectorAll<HTMLButtonElement>('[data-course]').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.course === course));
    });
    syncSetup();
  }

  function syncSetup() {
    writeSetting(setupKey, JSON.stringify(config));
    const field = previewRacers();
    const format = element<HTMLFieldSetElement>('.crux-format');
    format.hidden = config.course !== 'crux';
    if (!format.hidden) {
      format.querySelectorAll<HTMLButtonElement>('[data-format]').forEach(button => {
        button.setAttribute('aria-pressed', String(button.dataset.format === config.format));
      });
      const cutCount = config.count - 2;
      const rule = config.format === 'endurance' ? 'Gates stay open. All marbles race to the finish.'
        : cutCount === 0 ? 'Two finalists race straight to the finish.'
        : (cutCount === 1 ? 'One cut at CP 4.' : 'Cuts at CP ' + (5 - cutCount) + '–4.') + ' Last across the ENTRY stripe is out. Qualifiers restart together.';
      format.querySelector('p')!.textContent = rule;
    }
    panel.querySelectorAll<HTMLButtonElement>('[data-count]').forEach((button) => button.setAttribute('aria-pressed', String(Number(button.dataset.count) === config.count)));
    panel.querySelectorAll<HTMLLIElement>('.entrant-row').forEach((row, slot) => {
      row.hidden = slot >= config.count;
      const entry = config.entries[slot];
      const livery = liveries[entry.livery];
      row.style.setProperty('--livery', livery.color);
      row.querySelector('select')!.value = String(entry.livery);
      row.querySelector('input')!.placeholder = livery.name;
    });
    const marker = element<HTMLSelectElement>('.marker-setting select');
    marker.replaceChildren(new Option('None', 'none'), ...field.map((racer, slot) => new Option('Player ' + (slot + 1) + ' · ' + racer.name, String(slot))));
    marker.value = config.marker !== null && config.marker < config.count ? String(config.marker) : 'none';
    actions.onPreview(field, config.course);
  }

  function start() {
    if (!ready) return;
    racers = previewRacers();
    raceId = globalThis.crypto?.randomUUID?.() ?? Date.now().toString(36) + Math.random().toString(36).slice(2);
    lastOrder = '';
    lastClock = '';
    status.textContent = '';
    if (dialog.open) dialog.close();
    actions.onStart(racers.map((racer) => ({ ...racer })), config.format);
  }

  function showSetup() {
    setView('setup');
    panel.innerHTML = `
      <form class="setup-form">
        <div class="panel-title"><h1>Race setup</h1><span class="checker" aria-hidden="true"></span></div>
        <fieldset class="track-picker"><legend>Track</legend><div class="track-options">
          ${courseIds.map(id => `<button type="button" data-course="${id}"${id === 'crux' ? ' aria-description="Race time over two minutes"' : ''}><span aria-hidden="true" class="track-stripes"></span>${courses[id].title}</button>`).join('')}
        </div></fieldset>
        <fieldset class="field-size"><legend>Marbles</legend><div class="count-choices" aria-label="Number of marbles">
          ${fieldSizes.map((n) => '<button type="button" data-count="' + n + '" aria-label="' + n + ' marbles"><b>' + n + '</b></button>').join('')}
        </div></fieldset>
        <fieldset class="crux-format" hidden><legend>Race format</legend><div class="format-choices">
          <button type="button" data-format="knockout">Knockout</button>
          <button type="button" data-format="endurance">Endurance</button>
        </div><p class="swap-hint"></p></fieldset>
        <fieldset class="roster-editor"><legend>Starting field</legend>
          <ol class="entrant-list">${config.entries.map((entry, slot) => `
            <li class="entrant-row">
              <label class="entrant-name"><span>Player ${slot + 1}</span>
                <input type="text" aria-label="Player ${slot + 1} name" value="${escapeText(entry.name)}" maxlength="18" autocomplete="off" spellcheck="false" enterkeyhint="done">
              </label>
              <label class="entrant-color"><span>Color</span><span class="color-select"><i aria-hidden="true"></i>
                <select aria-label="Player ${slot + 1} color">${liveries.map((livery, i) => '<option value="' + i + '">' + livery.label + '</option>').join('')}</select>
              </span></label>
            </li>`).join('')}</ol>
          <p class="swap-hint">Picking a color another player has swaps your colors.</p>
        </fieldset>
        <label class="marker-setting"><span>Race marker</span><select aria-label="Race marker"></select></label>
        <div class="panel-bottom"><button type="submit" class="primary-button start-button">${icon('flag')}<span>Start race</span>${icon('arrow')}</button></div>
      </form>`;
    element('.panel-title').append(installButton);
    element<HTMLButtonElement>('.start-button').disabled = !ready;
    panel.querySelectorAll<HTMLButtonElement>('[data-course]').forEach(button => {
      button.addEventListener('click', () => selectCourse(button.dataset.course as CourseId));
    });
    panel.querySelectorAll<HTMLButtonElement>('[data-count]').forEach((button) => button.addEventListener('click', () => { config.count = Number(button.dataset.count); syncSetup(); }));
    panel.querySelectorAll<HTMLButtonElement>('[data-format]').forEach(button => button.addEventListener('click', () => {
      config.format = button.dataset.format as CruxFormat;
      syncSetup();
    }));
    panel.querySelectorAll<HTMLLIElement>('.entrant-row').forEach((row, slot) => {
      const input = row.querySelector('input')!;
      const select = row.querySelector('select')!;
      const entry = config.entries[slot];
      input.addEventListener('input', () => { entry.name = input.value; syncSetup(); });
      input.addEventListener('keydown', event => {
        if (event.key !== 'Enter' || event.isComposing || !matchMedia('(pointer: coarse)').matches) return;
        event.preventDefault();
        input.blur();
      });
      select.addEventListener('change', () => {
        const next = Number(select.value);
        const other = config.entries.find(candidate => candidate.livery === next);
        if (other) other.livery = entry.livery;
        entry.livery = next;
        syncSetup();
      });
    });
    const marker = element<HTMLSelectElement>('.marker-setting select');
    marker.addEventListener('change', () => {
      config.marker = marker.value === 'none' ? null : Number(marker.value);
      syncSetup();
    });
    element<HTMLFormElement>('.setup-form').addEventListener('submit', (event) => { event.preventDefault(); start(); });
    selectCourse(config.course);
  }

  function updateCheckpoint(seconds: number, gates?: readonly RaceCheckpoint[]) {
    checkpointStatus.hidden = !gates;
    if (!gates) return;
    const next = gates.find(gate => gate.arrivals.length < gate.field);
    const loading = gates.find(gate => gate.phase === 'loading');
    const released = gates.find(gate => gate.releasedAt !== null && seconds - gate.releasedAt < 3);
    const split = gates.find(gate => !gate.cut && gate.arrivals[0] && seconds - gate.arrivals[0].time < 3);
    let message = 'Final stretch';
    if (loading) {
      const last = loading.arrivals[loading.field - 1];
      message = loading.name + ' · ' + (last ? racers[last.id].name + ' out'
        : loading.arrivals.length + '/' + (loading.field - 1) + ' qualified');
    } else if (released) {
      message = released.name + ' · ' + (released.field - 1) + ' released · ' + racers[released.arrivals[released.field - 1].id].name + ' out';
    } else if (split) {
      message = split.name + ' · ' + racers[split.arrivals[0].id].name + ' leads';
    } else if (next) {
      message = next.name + ' · ' + (next.cut ? (next.field - 1) + ' places' : 'Open gate');
    }
    if (checkpointStatus.textContent !== message) checkpointStatus.textContent = message;
  }

  function updateRace(seconds: number, ordered: RaceRow[], gates?: readonly RaceCheckpoint[]) {
    updateCheckpoint(seconds, gates);
    const formatted = clock(seconds);
    if (lastClock !== formatted) { time.textContent = formatted; lastClock = formatted; }
    const order = ordered.map((entry) => entry.id + '/' + (entry.finishTime ?? '') + '/' + (entry.cutAt ?? '')).join('|');
    if (order === lastOrder) return;
    lastOrder = order;
    runningOrder.innerHTML = ordered.map((entry, index) => {
      const racer = racers.find((r) => r.id === entry.id);
      if (!racer) return '';
      const badge = entry.cutAt ? '<small class="cut-badge">Out</small>' : entry.finishTime != null ? icon('flag') : '';
      return '<li' + (entry.cutAt ? ' class="cut-row"' : '') + (racer.marked ? ' data-marked' : '') + '><b>' + (index + 1) + '</b>' + colorDot(racer.color) + '<span>' + escapeText(racer.name) + '</span><span class="order-badges">' + (racer.marked ? '<small>Marked</small>' : '') + badge + '</span></li>';
    }).join('');
  }

  function showCountdown(n: number) {
    if (view !== 'countdown') {
      setView('countdown');
      element<HTMLElement>('.on-air').innerHTML = '<i></i> On grid';
      updateRace(0, racers);
    }
    const value = n > 0 ? String(n) : 'Go!';
    if (countdownValue.textContent !== value) countdownValue.textContent = value;
  }

  function showRace() {
    setView('race');
    element<HTMLElement>('.on-air').innerHTML = '<i></i> Racing';
    status.textContent = 'Race started.';
  }

  function bindResultsActions() {
    element<HTMLButtonElement>('.rematch-button').addEventListener('click', start);
    element<HTMLButtonElement>('.setup-button').addEventListener('click', () => { showSetup(); actions.onSetup(); });
  }

  function resultActions() {
    return '<div class="panel-bottom"><button class="primary-button rematch-button">' + icon('replay') + '<span>Race again</span>' + icon('arrow') + '</button><button class="secondary-button setup-button">Change setup</button></div>';
  }

  function showResults(ordered: RaceRow[], gates?: readonly RaceCheckpoint[]) {
    const result = ordered.flatMap((row) => {
      const racer = racers.find((item) => item.id === row.id);
      return racer && (row.finishTime != null || row.cutAt) ? [{ ...racer, time: row.finishTime, cutAt: row.cutAt }] : [];
    });
    if (!raceId || result.length !== racers.length || !result.length) return;
    const winner = result[0];
    if (winner.time == null) return;
    const winTime = winner.time;
    standings.record(raceId, result);
    setView('results');
    panel.innerHTML = `
      <div class="results-content"><div class="panel-title"><div><div class="result-course">${courses[config.course].title}</div><h1>Race results</h1></div><span class="checker" aria-hidden="true"></span></div>
      <div class="winner-card" style="--livery:${winner.color}"><div class="winner-marble" aria-hidden="true"><i></i></div><div><span class="small-label">Winner</span><h2>${escapeText(winner.name)}</h2><p>${clock(winner.time)}</p></div></div>
      <div class="table-key"><span>${gates ? 'Race order' : 'Finish order'}</span><span>${gates?.some(gate => gate.cut) ? 'Finish / cut' : 'Time / gap'}</span><span>Points</span></div>
      <ol class="finish-order">${result.map((racer, index) => {
        const timing = racer.cutAt ? 'Out at CP ' + racer.cutAt : clock(racer.time!) + (index ? '<small>+' + (racer.time! - winTime).toFixed(2) + 's</small>' : '');
        return '<li><b>' + (index + 1) + '</b><div class="finish-name">' + colorDot(racer.color) + '<span>' + escapeText(racer.name) + (racer.marked ? '<small>Marked</small>' : '') + '</span></div><div class="finish-time">' + timing + '</div><strong>' + finishPoints(index) + '</strong></li>';
      }).join('')}</ol>${gates ? checkpointResults(gates) : ''}${resultActions()}</div>`;
    status.textContent = winner.name + ' wins in ' + clock(winner.time);
    bindResultsActions();
  }

  function checkpointResults(gates: readonly RaceCheckpoint[]) {
    return '<details class="checkpoint-results"><summary>Checkpoint leaders</summary><ol>' + gates.map(gate => {
      const first = gate.arrivals[0];
      return '<li><b>' + gate.name + '</b><span>' + escapeText(racers[first.id].name) + '</span><time>' + clock(first.time) + '</time></li>';
    }).join('') + '</ol></details>';
  }

  function showFailure(message: string) {
    setView('failure');
    panel.innerHTML = '<div class="results-content"><div class="panel-title"><h1>Race stopped</h1></div><p class="failure-message">' + escapeText(message) + '</p>' + resultActions() + '</div>';
    bindResultsActions();
    status.textContent = message;
  }

  function setReady(value: boolean) {
    ready = value;
    const button = panel.querySelector<HTMLButtonElement>('.start-button');
    if (button) button.disabled = !ready;
  }

  soundButton.addEventListener('click', () => { sound = !sound; writeSetting(soundKey, sound ? 'on' : 'off'); updateSound(); actions.onSound(sound); });
  standingsButton.addEventListener('click', showStandings);
  restartButton.addEventListener('click', start);
  orderToggle.addEventListener('click', () => {
    orderToggle.setAttribute('aria-expanded', String(orderToggle.getAttribute('aria-expanded') !== 'true'));
  });
  element<HTMLButtonElement>('.close-dialog').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (event) => { if (event.target === dialog) { const b = dialog.getBoundingClientRect(); if (event.clientX < b.left || event.clientX > b.right || event.clientY < b.top || event.clientY > b.bottom) dialog.close(); } });
  updateSound();
  showSetup();
  setupInstall(installButton, element<HTMLDialogElement>('#install-help'));

  return { previewRacers, showSetup, showCountdown, showRace, updateRace, showResults, showFailure, setReady, soundEnabled: () => sound };
}
