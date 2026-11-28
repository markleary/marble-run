import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium, devices, webkit } from 'playwright';
import { preview } from 'vite';
import { tsImport } from 'tsx/esm/api';
import orreryLayout from '../src/courses/orrery-layout.json' with { type: 'json' };
import keplerLayout from '../src/courses/kepler-layout.json' with { type: 'json' };
import cruxLayout from '../src/courses/crux-layout.json' with { type: 'json' };
import spectralLayout from '../src/courses/spectral-layout.json' with { type: 'json' };
import { cruxScore } from './crux-score.mjs';

const { courses } = await tsImport('../src/courses/catalog.ts', import.meta.url);
const { checkpointCount } = await tsImport('../src/courses/checkpoints.ts', import.meta.url);
const checkpointTracks = Object.fromEntries(Object.entries(courses)
  .filter(([id]) => checkpointCount(id) > 0)
  .map(([id, course]) => [course.title, checkpointCount(id)]));

const url = process.env.MARBLE_URL;
const base = '/marble-run/';
const server = url ? undefined : await preview({ base, preview: { host: '127.0.0.1', port: 0 } });
const address = server?.httpServer.address();
const game = url ?? 'http://127.0.0.1:' + address.port + base;
const mobile = process.argv.includes('--mobile');
const engine = process.env.MARBLE_BROWSER === 'webkit' ? webkit : chromium;
const browser = await engine.launch({
  ...(process.env.MARBLE_CHROME ? { executablePath: process.env.MARBLE_CHROME } : {}),
  ...(engine === chromium ? { args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] } : {})
});
const output = resolve('test-results', (mobile ? 'mobile' : 'desktop') + (url?.startsWith('https') ? '-live' : ''));
const portrait = { width: 390, height: 844 };
const page = await browser.newPage(mobile ? {
  ...devices[engine === webkit ? 'iPhone 13' : 'Pixel 7'],
  viewport: portrait
} : { viewport: { width: 1440, height: 900 } });
const issues = [];
const loadedMusic = new Set();
const featuredMusicBytes = new Map();
page.on('pageerror', error => issues.push(error.message));
page.on('response', response => {
  if (response.status() >= 400) issues.push(response.status() + ' ' + response.url());
  const music = new URL(response.url()).pathname.match(/\/audio\/music-([a-z]+)\.mp3$/);
  if (music && response.ok()) {
    loadedMusic.add(music[1]);
    if (music[1] === 'crux' || music[1] === 'santa') featuredMusicBytes.set(music[1], response.body().catch(() => null));
  }
});
const fieldSize = mobile ? 2 : 6;
const frostField = mobile ? 5 : 6;
const entrants = [
  { name: 'Amethyst', color: '#995bd8', label: 'Violet', livery: '4' },
  { name: 'Rose <3', color: '#e95d97', label: 'Rose', livery: '5' },
  { name: 'Blue Jay', color: '#168bd2', label: 'Azure', livery: '3' },
  { name: 'Lucky Clover', color: '#179a74', label: 'Emerald', livery: '2' },
  { name: 'Sol', color: '#edae17', label: 'Golden yellow', livery: '1' },
  { name: 'Scarlet', color: '#ef442a', label: 'Vermilion', livery: '0' }
];
const previousWinner = { name: 'Legacy Gold', color: '#edae17', label: 'Golden yellow' };
const expectedScores = new Map([[previousWinner.name, { wins: 1, points: 3, color: previousWinner.color }]]);
const trackButton = name => page.getByRole('button', {name, exact: true});
const nameInput = number => page.getByRole('textbox', { name: 'Player ' + number + ' name', exact: true });
const colorInput = number => page.getByRole('combobox', { name: 'Player ' + number + ' color', exact: true });
const fieldButton = size => page.getByRole('button', { name: size + ' marbles', exact: true });
const marker = page.getByRole('combobox', { name: 'Race marker', exact: true });
const enterFullscreen = page.getByRole('button', { name: 'Enter full screen', exact: true });
const exitFullscreen = page.getByRole('button', { name: 'Exit full screen', exact: true });

async function assertFullscreen(active) {
  await page.waitForFunction(expected => {
    const element = document.fullscreenElement ?? document.webkitFullscreenElement;
    return expected ? element === document.documentElement : !element;
  }, active);
  await (active ? exitFullscreen : enterFullscreen).waitFor();
}

async function capture(name) {
  await page.screenshot({ path: resolve(output, name + '.png'), scale: 'css' });
}

async function assertCompactOrder(count) {
  const rows = await page.locator('.running-order li').evaluateAll(items => items.map(item => ({
    visible: item.getClientRects().length > 0,
    marked: item.hasAttribute('data-marked')
  })));
  assert.equal(rows.length, count);
  assert.equal(rows.filter(row => row.marked).length, 1);
  rows.forEach((row, index) => assert.equal(row.visible, index === 0 || row.marked));
}

function clock(seconds) {
  const hundredths = Math.round(seconds * 100);
  const remainder = (hundredths % 6000) / 100;
  return Math.floor(hundredths / 6000) + ':' + remainder.toFixed(2).padStart(5, '0');
}

function clockSeconds(time) {
  assert.match(time, /^\d+:\d{2}\.\d{2}$/);
  const [minutes, seconds] = time.split(':').map(Number);
  return minutes * 60 + seconds;
}

// Rehearse the featured grids so screenshots follow course landmarks after tuning.
async function landmarkTimes(id, seed, sections, format = 'endurance') {
  const { buildTrack } = await tsImport('../src/track.ts', import.meta.url);
  const { RaceSimulation, initPhysics } = await tsImport('../src/simulation.ts', import.meta.url);
  await initPhysics();
  const track = buildTrack(id);
  const marks = sections.map(name => {
    const section = track.sections.find(section => section.name === name);
    assert.ok(section, id + ' is missing the ' + name + ' camera section.');
    return [name, (section.start + section.end) / 2];
  });
  const jump = id === 'orrery' ? orreryLayout.jumps[0] : id === 'kepler' ? keplerLayout.jump
    : id === 'crux' ? cruxLayout.jumps[0] : undefined;
  if (jump) {
    const { takeoff, landing } = jump;
    marks.push(['Airborne', (takeoff + landing) / 2]);
  }
  const heat = new RaceSimulation(track, 6, seed, format);
  const times = {};
  try {
    if (id === 'spectral' && format === 'endurance') {
      marks.push(['Freefall', spectralLayout.launch.drop / 2]);
      marks.push(['Fan entry', spectralLayout.fan.startS + 1], ['Fan exit', spectralLayout.fan.endS - 1]);
      for (const gate of heat.competition.gates) marks.push([gate.name, gate.entryS + 1]);
    }
    marks.sort((a, b) => a[1] - b[1]);
    heat.release();
    const featureShots = {};
    if (id === 'santa') {
      const { santaMachines, santaCue, pinwheel, pinwheelLift } = await tsImport('../src/courses/santaObstacles.ts', import.meta.url);
      const { wheels } = santaMachines(track), cue = santaCue(seed);
      // The center of the straight can coincide with all three heads retracted.
      // Frame the first exposed candy arm that the leading pack reaches.
      featureShots['Peppermint Pinwheels'] = () => {
        const leader = Math.max(...heat.marbles.map(marble => marble.distance));
        return wheels.some(wheel => pinwheelLift(wheel, heat.elapsed + cue) > -.08
          && heat.marbles.some(marble => leader - marble.distance < 4
            && Math.hypot(marble.position.x - wheel.at.x, marble.position.z - wheel.at.z)
              < pinwheel.reach + pinwheel.tipRadius + track.radius));
      };
    }
    for (const [name, distance] of marks) {
      const visible = featureShots[name] ?? (() => heat.marbles.some(marble => marble.distance >= distance));
      while (!heat.failure && !heat.finished && !visible()) {
        heat.step();
      }
      assert.ok(!heat.failure && !heat.finished, name + ' rehearsal failed: ' + heat.failure);
      times[name] = heat.elapsed;
    }
    if (format === 'knockout') {
      const gate = heat.competition.gates.find(gate => gate.cut);
      while (!heat.failure && !heat.finished && gate.releasedAt === null) {
        heat.step();
        if (gate.seated.length === gate.field - 1 && gate.releasedAt === null) times.Rack ??= heat.elapsed;
      }
      assert.ok(times.Rack && gate.releasedAt !== null, 'All qualifying marbles must reach the rack before release.');
      assert.ok(gate.divertedAt !== null && gate.pocketAt > gate.divertedAt, 'The cut marble must roll through the side branch.');
      times.Pocket = (gate.divertedAt + gate.pocketAt) / 2;
      times.Rack = (times.Rack + gate.releasedAt) / 2;
      times.Release = gate.releasedAt + .5;
    }
    return times;
  } finally {
    heat.dispose();
  }
}

async function assertRacers(list, active) {
  const rows = await page.locator(list + ' li').evaluateAll(items => items.map(item => ({
    text: item.textContent,
    color: item.querySelector('.identity-dot')?.style.getPropertyValue('--livery').trim()
  })));
  assert.equal(rows.length, active.length, list);
  for (const entrant of active) {
    assert.ok(rows.some(row => row.color === entrant.color && row.text.includes(entrant.name)),
      list + ' should show ' + entrant.name + ' in ' + entrant.label);
  }
}

async function assertSetup(size) {
  assert.equal(await page.getByRole('textbox', { name: /^Player \d+ name$/ }).count(), size);
  for (let slot = 0; slot < size; slot++) {
    assert.equal(await nameInput(slot + 1).inputValue(), entrants[slot].name);
    assert.equal(await colorInput(slot + 1).inputValue(), entrants[slot].livery);
  }
}

async function verifyResults(track, count, marked, format = 'endurance') {
  const longHeat = track === 'Crux Mountain Masters' || track === 'Spectral Relay';
  await page.waitForSelector('body[data-view="results"], body[data-view="failure"]', { timeout: longHeat ? 300000 : 150000, state: 'attached' });
  const failure = await page.locator('.failure-message').allTextContents();
  if (failure.length) assert.fail(track + ' heat failed at seed ' + await page.evaluate(() => window.playtestGridSeed) + ': ' + failure.join(' '));
  assert.equal(await page.locator('.result-course').innerText(), track);
  if (track === 'Kepler Relay') {
    assert.ok(await page.locator('.winner-card p').innerText() >= '1:00.00', 'Kepler Relay winner must race for at least a minute.');
  }
  if ((track === 'Afterglow FM' && format === 'endurance') || track === "Santa's Balls") {
    const max = track === 'Afterglow FM' ? 90 : 120;
    const times = await page.locator('.finish-time').evaluateAll(cells => cells.map(cell => cell.firstChild.textContent));
    assert.equal(times.length, count);
    assert.ok(times.map(clockSeconds).every(seconds => seconds >= 60 && seconds <= max),
      `Every ${track} racer must cross the finish in 60–${max} seconds.`);
  }
  await assertRacers('.finish-order', entrants.slice(0, count));
  await assertMarked('.finish-order', marked);
  if (track === 'Spectral Relay' || track === 'Crux Mountain Masters') {
    assert.ok(clockSeconds(await page.locator('.winner-card p').innerText()) >= 120);
  }
  if (track in checkpointTracks) await verifyCheckpointSplits(track, count, format);
  else assert.equal(await page.locator('.checkpoint-results').count(), 0);
  const rows = await page.locator('.finish-order li').evaluateAll(items => items.map(item => ({
    name: item.querySelector('.finish-name span:nth-child(2)').firstChild.textContent,
    points: Number(item.querySelector('strong').textContent),
  })));
  rows.forEach((result, index) => {
    const points = [3, 2, 1][index] ?? 0;
    assert.equal(result.points, points, result.name + ' race points');
    const score = expectedScores.get(result.name) ?? { wins: 0, points: 0, color: entrants.find(e => e.name === result.name).color };
    score.points += points;
    if (index === 0) score.wins++;
    expectedScores.set(result.name, score);
  });
  console.log('Verified', track, 'with', count, 'classified racers');
}

async function verifyCheckpointSplits(track, count, format) {
  const total = checkpointTracks[track];
  const cuts = format === 'knockout' ? count - 2 : 0;
  const finishes = await page.locator('.finish-order li').evaluateAll(rows => rows.map(row => [
    row.querySelector('.finish-name span:nth-child(2)').firstChild.textContent,
    row.querySelector('.finish-time').firstChild.textContent,
  ]));
  const finishByName = new Map(finishes);
  assert.deepEqual(finishes.slice(count - cuts).map(([, time]) => time),
    Array.from({ length: cuts }, (_, index) => 'Out at CP ' + (total - index)));
  const active = new Set(entrants.slice(0, count).map(entrant => entrant.name));
  const lastSplit = new Map();
  await page.getByText('Checkpoint splits', { exact: true }).click();
  const gates = page.locator('.split-detail');
  assert.equal(await gates.count(), total);
  for (let gate = 0; gate < total; gate++) {
    const details = gates.nth(gate);
    const summary = details.locator('summary');
    await summary.click();
    const rows = details.locator('li:visible');
    assert.equal(await rows.count(), active.size);
    const splits = await rows.evaluateAll(items => items.map(item => ({
      name: item.querySelector('span').textContent,
      color: item.querySelector('.identity-dot').style.getPropertyValue('--livery').trim(),
      time: item.querySelector('time').textContent,
    })));
    assert.equal(await summary.innerText(), 'CP ' + (gate + 1) + ' · ' + splits[0].name + ' · ' + splits[0].time);
    const seconds = splits.map(split => clockSeconds(split.time));
    assert.deepEqual(seconds, [...seconds].sort((a, b) => a - b));
    assert.deepEqual(new Set(splits.map(split => split.name)), active);
    for (const { name, time, color } of splits) {
      assert.equal(color, entrants.find(entrant => entrant.name === name).color);
      const crossing = clockSeconds(time);
      assert.ok((lastSplit.get(name) ?? 0) < crossing, name + ' split at CP ' + (gate + 1));
      const finish = finishByName.get(name);
      if (!finish.startsWith('Out')) assert.ok(crossing < clockSeconds(finish));
      lastSplit.set(name, crossing);
    }
    if (gate >= total - cuts) {
      const last = splits.at(-1).name;
      assert.equal(finishByName.get(last), 'Out at CP ' + (gate + 1));
      active.delete(last);
    }
    if (track === 'Spectral Relay' && gate === 0) await capture('spectral-' + format + '-splits');
    await summary.click();
  }
  await page.getByText('Checkpoint splits', { exact: true }).click();
}

async function assertMarked(list, slot) {
  const markedRows = page.locator(list + ' li').filter({ has: page.getByText('Marked', { exact: true }) });
  assert.equal(await markedRows.count(), 1);
  assert.ok((await markedRows.textContent()).includes(entrants[slot].name));
}
try {
  await mkdir(output, { recursive: true });
  await page.addInitScript(() => {
    // Keep random rematches reproducible if a browser finds a physics failure.
    const randomValues = crypto.getRandomValues.bind(crypto);
    crypto.getRandomValues = array => {
      const values = randomValues(array);
      if (array instanceof Uint32Array && array.length === 1) {
        if (window.playtestNextSeed !== undefined) {
          array[0] = window.playtestNextSeed;
          delete window.playtestNextSeed;
        }
        window.playtestGridSeed = array[0];
      }
      return values;
    };
    // Music is the only looping buffer longer than the four-second rolling sounds.
    const start = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function (...args) {
      start.apply(this, args);
      if (this.loop && this.buffer?.duration > 10) window.playtestMusicSeconds = this.buffer.duration;
    };
  });
  // Keep the fixed physics steps. Fast runs take several per frame, and a
  // designated action shot holds its race clock while Playwright captures it.
  await page.addInitScript(fast => {
    const frame = window.requestAnimationFrame.bind(window);
    let lastFrame = 0, gameTime = 0;
    window.requestAnimationFrame = callback => frame(time => {
      if (time !== lastFrame) {
        let step = (time - lastFrame) * (fast ? 6 : 1);
        if (window.playtestActionShot) {
          const clock = document.querySelector('.race-clock')?.textContent;
          const { approach, target, release } = window.playtestActionShot;
          if (release) {
            const status = document.querySelector('.checkpoint-status')?.textContent ?? '';
            if (status.startsWith(release)) step = 0;
            else if (status.endsWith(' out')) step = Math.min(step, 1000 / 60);
          } else if (clock >= approach) step = clock >= target ? 0 : Math.min(step, 1000 / 60);
        }
        gameTime += step;
        lastFrame = time;
      }
      callback(gameTime);
    });
  }, process.argv.includes('--fast'));
  // Exercise an existing installation's first visit after the roster update.
  await page.addInitScript(({winner, mobile}) => {
    if (sessionStorage.getItem('playtest-initialized')) return;
    localStorage.setItem('marble-run:setup:v1', JSON.stringify({ count: 3, name: 'Veteran', livery: 2 }));
    if (mobile) {
      localStorage.setItem('marble-run:setup:v2', JSON.stringify({
        count: 3, marker: 2,
        entries: [{name:'Veteran', livery:2}, {name:'Riptide', livery:3}, {name:'Sunbeam', livery:1}, {name:'Old Violet', livery:4}],
      }));
    }
    localStorage.setItem('marble-run:win:v1:previous-heat', JSON.stringify(winner));
    sessionStorage.setItem('playtest-initialized', '1');
  }, {winner: previousWinner, mobile});
  await page.goto(game);
  const startButton = page.getByRole('button', { name: 'Start race' });
  if (mobile && server) {
    // Relaunch on the Pages subpath with the network disabled, including courses never selected online.
    await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller), undefined, { timeout: 60000 });
    const manifestUrl = await page.locator('link[rel="manifest"]').evaluate(link => link.href);
    const manifest = await (await page.request.get(manifestUrl)).json();
    assert.equal(new URL(manifest.start_url, manifestUrl).href, game);
    assert.equal(new URL(manifest.scope, manifestUrl).href, game);
    assert.equal(manifest.display, 'standalone');
    if (engine === chromium) {
      const session = await page.context().newCDPSession(page);
      assert.equal((await session.send('Page.getAppId')).appId, game);
      await session.detach();
    }
    await page.context().setOffline(true);
    await page.reload();
  }
  await page.waitForFunction(() => document.querySelector('.start-button')?.disabled === false, undefined, { timeout: 90000 });
  const byTime = Object.values(courses).sort((a, b) => a.averageSeconds - b.averageSeconds).map(course => course.title);
  const checkpoints = byTime.filter(name => name in checkpointTracks);
  for (const [title, count] of [['Afterglow FM', 4], ['Crux Mountain Masters', 4], ['Spectral Relay', 5]]) {
    assert.equal(checkpointTracks[title], count);
  }
  assert.deepEqual(await page.locator('.track-picker [data-course]').allTextContents(),
    [...byTime.filter(name => !(name in checkpointTracks)), ...checkpoints]);
  assert.deepEqual(await page.getByRole('group', { name: 'Checkpoint tracks', exact: true }).getByRole('button').allTextContents(), checkpoints);
  await page.evaluate(() => document.fonts.ready);
  const canFullscreen = await page.evaluate(() => document.fullscreenEnabled ?? document.webkitFullscreenEnabled);
  if (canFullscreen) {
    await enterFullscreen.focus();
    await page.keyboard.press('Enter');
    await assertFullscreen(true);
    // A browser-initiated exit should update the toolbar without clicking its toggle.
    await page.evaluate(() => (document.exitFullscreen ?? document.webkitExitFullscreen).call(document));
    await assertFullscreen(false);
  } else {
    assert.equal(await enterFullscreen.isVisible(), false);
  }
  await page.getByRole('button', { name: 'Mute sound' }).click();
  await page.getByRole('button', { name: 'Enable sound' }).click();
  assert.equal(await nameInput(1).inputValue(), 'Veteran');
  assert.equal(await colorInput(1).inputValue(), '2');
  assert.equal(await nameInput(2).inputValue(), 'Riptide');
  assert.equal(await colorInput(2).inputValue(), '3');
  assert.equal(await nameInput(3).inputValue(), 'Sunbeam');
  assert.equal(await colorInput(3).inputValue(), '1');
  assert.equal(await fieldButton(3).getAttribute('aria-pressed'), 'true');
  if (mobile) {
    await nameInput(3).tap();
    await nameInput(3).press('Enter');
    assert.equal(await page.locator('body').getAttribute('data-view'), 'setup');
  }
  await fieldButton(6).click();
  if (mobile) assert.equal(await nameInput(4).inputValue(), 'Old Violet');
  for (let slot = 0; slot < 6; slot++) {
    await nameInput(slot + 1).fill(entrants[slot].name);
    await colorInput(slot + 1).selectOption(entrants[slot].livery);
  }
  await assertSetup(6);
  // Two players trading colors must keep their names and the field must stay distinct.
  await colorInput(1).selectOption(entrants[1].livery);
  assert.equal(await colorInput(2).inputValue(), entrants[0].livery);
  assert.equal(await nameInput(1).inputValue(), entrants[0].name);
  assert.equal(await nameInput(2).inputValue(), entrants[1].name);
  await colorInput(1).selectOption(entrants[0].livery);
  // The same name on two colors is valid and must survive a saved setup round trip.
  await nameInput(2).fill(entrants[0].name);
  await page.reload();
  assert.equal(await nameInput(1).inputValue(), entrants[0].name);
  assert.equal(await nameInput(2).inputValue(), entrants[0].name);
  assert.equal(await colorInput(1).inputValue(), entrants[0].livery);
  assert.equal(await colorInput(2).inputValue(), entrants[1].livery);
  await nameInput(2).fill(entrants[1].name);
  await fieldButton(2).click();
  await colorInput(1).selectOption(entrants[3].livery);
  await fieldButton(4).click();
  assert.equal(await colorInput(1).inputValue(), entrants[3].livery);
  assert.equal(await colorInput(4).inputValue(), entrants[0].livery);
  assert.equal(await nameInput(1).inputValue(), entrants[0].name);
  assert.equal(await nameInput(4).inputValue(), entrants[3].name);
  await colorInput(1).selectOption(entrants[0].livery);
  for (const size of [2, 3, 4, 5, 6, fieldSize]) {
    await fieldButton(size).click();
    await assertSetup(size);
  }
  await marker.selectOption('none');
  assert.equal(await marker.inputValue(), 'none');
  const marked = fieldSize - 1;
  await marker.selectOption(String(marked));
  await trackButton('Frostline Rally').click();
  await trackButton('Prism Speedway').click();
  assert.equal(await trackButton('Prism Speedway').getAttribute('aria-pressed'), 'true');
  await capture('prism-setup');
  console.log('Captured setup', output);
  if (mobile) await startButton.tap();
  else await startButton.click();
  await page.waitForSelector('body[data-view="race"]', { timeout: 30000, state: 'attached' });
  await page.waitForFunction(() => document.querySelector('.race-clock')?.textContent >= '0:07.00');
  await assertRacers('.running-order', entrants.slice(0, fieldSize));
  await assertMarked('.running-order', marked);
  await capture('racing');
  const tally = () => page.evaluate(() => Object.keys(localStorage).filter(key => key.startsWith('marble-run:finish:v1:')).length);
  assert.equal(await tally(), 0);
  await page.getByRole('button', { name: 'Restart' }).click();
  await page.waitForSelector('body[data-view="countdown"]', { state: 'attached' });
  await verifyResults('Prism Speedway', fieldSize, marked);
  if (canFullscreen) {
    await enterFullscreen.click();
    await assertFullscreen(true);
    await exitFullscreen.click();
    await assertFullscreen(false);
  }
  assert.equal(await tally(), 1);
  await capture('prism-results');
  await page.getByRole('button', { name: 'Change setup' }).click();

  await trackButton('Frostline Rally').click();
  await fieldButton(frostField).click();
  await marker.selectOption(String(frostField - 1));
  await page.reload();
  await nameInput(1).waitFor();
  assert.equal(await trackButton('Frostline Rally').getAttribute('aria-pressed'), 'true');
  assert.equal(await marker.inputValue(), String(frostField - 1));
  await assertSetup(frostField);
  await page.evaluate(() => window.scrollTo(0, 0));
  await capture('frostline-setup');
  await startButton.click();
  await page.waitForSelector('body[data-view="race"]', { timeout: 30000, state: 'attached' });
  if (mobile) {
    await assertCompactOrder(frostField);
    await page.setViewportSize({ width: portrait.height, height: portrait.width });
    const fullOrder = page.getByRole('button', { name: 'Full running order' });
    await fullOrder.tap();
    assert.equal(await fullOrder.getAttribute('aria-expanded'), 'true');
    assert.equal(await page.locator('.running-order li:visible').count(), frostField);
    await capture('landscape-racing');
    await fullOrder.tap();
    await assertCompactOrder(frostField);
    await page.setViewportSize(portrait);
  }
  await page.waitForFunction(() => document.querySelector('.race-clock')?.textContent >= '0:26.00', undefined, { timeout: 60000 });
  await assertRacers('.running-order', entrants.slice(0, frostField));
  await capture('frostline-racing');
  await verifyResults('Frostline Rally', frostField, frostField - 1);
  await capture('frostline-results');
  await page.getByRole('button', { name: 'Race again' }).click();
  await verifyResults('Frostline Rally', frostField, frostField - 1);
  assert.equal(await tally(), 3);
  await page.getByRole('button', { name: 'Change setup' }).click();
  const seeds = { orrery: 82, tideglass: 58, kepler: 23, crux: 23, spectral: 23, afterglow: 23, santa: 25 };
  const orrery = await landmarkTimes('orrery', seeds.orrery, ['Escapement Gallery', 'Ecliptic Underpass']);
  const tideglass = await landmarkTimes('tideglass', seeds.tideglass, ['Standing Wave Gallery', 'Twin Frond Sluice']);
  const kepler = await landmarkTimes('kepler', seeds.kepler, ['Solar Array Esses', 'Gravity Dive', 'Aurora Catch', 'Orbital Return']);
  const crux = await landmarkTimes('crux', seeds.crux, ['Chalk Velodrome'], 'knockout');
  const spectral = await landmarkTimes('spectral', seeds.spectral, ['Halo Carousel', 'Induction Gallery', 'Polarity Inverter']);
  const afterglow = await landmarkTimes('afterglow', seeds.afterglow, ['Crossfader Alley', 'Carrier Spiral', 'Mono Bridge', 'Sideband Turn']);
  const santa = await landmarkTimes('santa', seeds.santa, ['Peppermint Pinwheels', 'Tannenbaum Turn', 'Pop-Up Parcel Works', 'North Pole Post']);
  const jumpShots = {};
  for (const [id, time] of [['orrery', orrery.Airborne], ['kepler', kepler.Airborne], ['crux', crux.Airborne]]) {
    jumpShots[id] = clock(time - .04);
  }
  for (const [title, id, shots] of [
    ["Santa's Balls", 'santa', Object.entries(santa).map(([name, time]) => [clock(time), name.toLowerCase().replaceAll(' ', '-')])],
    ['Timber Corkscrew', 'timber', [['0:13.00', 'racing']]],
    ['Wireworks Drop', 'wireworks', [['0:07.00', 'rails'], ['0:25.00', 'racing']]],
    ['Midnight Orrery', 'orrery', [
      [clock(orrery['Escapement Gallery']), 'escapement'],
      [clock(orrery['Ecliptic Underpass']), 'underpass'],
      [jumpShots.orrery, 'comet-skips'],
    ]],
    ['Tideglass Conservatory', 'tideglass', [
      [clock(tideglass['Standing Wave Gallery']), 'standing-wave'],
      [clock(tideglass['Twin Frond Sluice']), 'twin-sluice'],
    ]],
    ['Kepler Relay', 'kepler', [
      [clock(kepler['Solar Array Esses']), 'arrays'],
      [clock(kepler['Gravity Dive']), 'gravity-dive'],
      [jumpShots.kepler, 'vacuum-transfer'],
      [clock(kepler['Aurora Catch']), 'aurora-catch'],
      [clock(kepler['Orbital Return']), 'orbital-return'],
    ]],
    ['Crux Mountain Masters', 'crux', [
      [jumpShots.crux, 'headwall-gap'],
      [clock(crux['Chalk Velodrome']), 'chalk-velodrome'],
      [clock(crux.Pocket), 'side-pocket'],
      [clock(crux.Rack), 'qualification-rack'],
      [clock(crux.Release), 'gate-release'],
    ].sort(([a], [b]) => clockSeconds(a) - clockSeconds(b))],
    ['Spectral Relay', 'spectral', Object.entries(spectral).map(([name, time]) => [clock(time), name.toLowerCase().replaceAll(' ', '-')])],
    ['Afterglow FM', 'afterglow', [
      ['0:03.00', 'launch'],
      [clock(afterglow['Crossfader Alley']), 'crossfaders'],
      [clock(afterglow['Carrier Spiral']), 'spiral'],
      [clock(afterglow['Mono Bridge']), 'mono-bridge'],
      [clock(afterglow['Sideband Turn']), 'sideband'],
    ]],
  ]) {
    await trackButton(title).click();
    if (id === 'crux') {
      // With three entrants the first three stations record open splits before the cut at CP 4.
      await fieldButton(3).click();
      await startButton.click();
      await page.getByText('CP 1 · Open gate', { exact: true }).waitFor();
      await page.getByText(/^CP 1 · .+ leads$/).waitFor({ timeout: 90000 });
      await page.reload();
    }
    await fieldButton(6).click();
    await marker.selectOption('5');
    // Cover both booting a saved course and changing physics/audio in the same session.
    if (id !== 'wireworks') await page.reload();
    await page.waitForFunction(() => document.querySelector('.start-button')?.disabled === false);
    assert.equal(await trackButton(title).getAttribute('aria-pressed'), 'true');
    const format = id === 'crux' ? 'knockout' : 'endurance';
    const formatButton = mode => page.getByRole('button', { name: mode === 'knockout' ? 'Knockout' : 'Endurance', exact: true });
    if (title in checkpointTracks) {
      await formatButton(format).click();
      assert.equal(await formatButton(format).getAttribute('aria-pressed'), 'true');
    } else {
      assert.equal(await formatButton('knockout').isVisible(), false);
    }
    await assertSetup(6);
    await page.evaluate(() => window.scrollTo(0, 0));
    await capture(id + '-setup');
    await page.evaluate(() => { window.playtestMusicSeconds = 0; });
    if (id in seeds) {
      // Apply the rehearsed grid once. The rematch still draws a random grid.
      await page.evaluate(seed => {
        window.playtestNextSeed = seed;
      }, seeds[id]);
    }
    if (id === 'spectral') {
      await page.evaluate(() => { window.playtestActionShot = { approach: '0:00.00', target: '0:00.00' }; });
    }
    await startButton.click();
    if (id === 'spectral') {
      await page.waitForSelector('body[data-view="countdown"]', { state: 'attached' });
      await capture('spectral-grid');
      if (mobile) {
        await page.setViewportSize({ width: portrait.height, height: portrait.width });
        await capture('spectral-grid-landscape');
        await page.setViewportSize(portrait);
      }
      await page.evaluate(() => { delete window.playtestActionShot; });
    }
    for (const [time, shot] of shots) {
      const freeze = id === 'spectral' || time === jumpShots[id]
        || ['peppermint-pinwheels', 'side-pocket', 'qualification-rack', 'gate-release'].includes(shot);
      if (freeze) {
        const approach = clock(Math.max(0, clockSeconds(time) - 1));
        await page.evaluate(spec => { window.playtestActionShot = spec; }, { approach, target: time });
      }
      await page.waitForFunction(target => document.querySelector('.race-clock')?.textContent >= target, time, { timeout: 90000 });
      if (id === 'kepler' && shot === 'arrays' && canFullscreen) {
        await enterFullscreen.click();
        await assertFullscreen(true);
        await exitFullscreen.click();
        await assertFullscreen(false);
      }
      await capture(id + '-' + shot);
      if (id === 'spectral') {
        assert.deepEqual(await page.locator('.checkpoint-steps span:visible').allTextContents(), ['1', '2', '3', '4', '5']);
        assert.equal(await page.locator('.running-order .cut-row').count(), 0);
        if (shot === 'freefall') assert.equal(await page.locator('.checkpoint-status').innerText(), 'Checkpoint 1 of 5 ahead');
        if (shot.startsWith('cp-')) {
          const number = Number(shot.slice(3));
          assert.equal(await page.locator('.checkpoint-steps .cleared').count(), number);
          const message = await page.locator('.checkpoint-status').innerText();
          const [gate, leader, split] = message.split(' · ');
          assert.equal(gate, 'CP ' + number);
          assert.ok(entrants.some(entrant => entrant.name === leader));
          assert.match(split, /^\d+:\d{2}\.\d{2}$/);
          if (mobile && number === 1) await assertCompactOrder(6);
        }
        await assertRacers('.running-order', entrants);
        await assertMarked('.running-order', 5);
      }
      if (freeze) await page.evaluate(() => { delete window.playtestActionShot; });
      if (title in checkpointTracks) assert.ok(await page.locator('.checkpoint-status').isVisible());
      if (shot === 'gate-release') assert.match(await page.locator('.checkpoint-status').innerText(), /5 released/);
    }
    await assertRacers('.running-order', entrants);
    assert.ok(loadedMusic.has(id), title + ' must load its own soundtrack.');
    const musicSeconds = await page.evaluate(() => window.playtestMusicSeconds);
    assert.ok(musicSeconds > (id === 'spectral' ? 120 : 10), title + ' must play its decoded music loop.');
    if (id === 'crux') {
      const scoreSeconds = cruxScore.bars * 4 * 60 / cruxScore.bpm;
      assert.ok(Math.abs(musicSeconds - scoreSeconds) < .25, 'Crux must play the full house arrangement.');
    }
    if (id === 'crux' || id === 'santa') {
      const master = await readFile(new URL('../public/audio/music-' + id + '.mp3', import.meta.url));
      assert.ok(master.equals((await featuredMusicBytes.get(id)) ?? Buffer.alloc(0)), title + ' must play its released recording.');
    }
    await verifyResults(title, 6, 5, format);
    await capture(id + '-results');
    await page.getByRole('button', { name: 'Race again' }).click();
    await verifyResults(title, 6, 5, format);
    await page.getByRole('button', { name: 'Change setup' }).click();
    if (title in checkpointTracks) {
      const other = format === 'endurance' ? 'knockout' : 'endurance';
      await formatButton(other).click();
      await page.reload();
      assert.equal(await formatButton(other).getAttribute('aria-pressed'), 'true');
      await page.evaluate(seed => { window.playtestNextSeed = seed; }, seeds[id]);
      await startButton.click();
      if (other === 'knockout') {
        const release = 'CP ' + (checkpointTracks[title] - 3) + ' · 5 released';
        await page.evaluate(release => { window.playtestActionShot = { release }; }, release);
        await page.waitForFunction(release => document.querySelector('.checkpoint-status')?.textContent.startsWith(release),
          release, { timeout: 90000 });
        assert.equal(await page.locator('.running-order .cut-row').count(), 1);
        await capture(id + '-gate-release');
        await page.evaluate(() => { delete window.playtestActionShot; });
      }
      await verifyResults(title, 6, 5, other);
      await page.getByRole('button', { name: 'Change setup' }).click();
    }
  }
  assert.equal(await tally(), 24);
  assert.deepEqual([...loadedMusic].sort(), Object.keys(courses).sort());
  await page.reload();
  await fieldButton(6).click();
  await assertSetup(6);
  await page.getByRole('button', { name: 'Standings' }).click();
  const scores = await page.locator('.scores tbody tr').evaluateAll(rows => rows.map(row => ({
    name: row.cells[0].textContent, wins: Number(row.cells[1].textContent),
    points: Number(row.cells[2].textContent), color: row.querySelector('.identity-dot').style.getPropertyValue('--livery').trim(),
  })));
  assert.equal(scores.length, expectedScores.size);
  for (const {name, ...score} of scores) assert.deepEqual(score, expectedScores.get(name), name + ' cumulative scoring');
  assert.deepEqual(scores.map(s => s.points), scores.map(s => s.points).sort((a,b) => b - a));
  await capture('standings');
  await page.getByRole('button', { name: 'Close standings' }).click();
  assert.deepEqual(issues, []);
  console.log('Passed eleven courses, eleven soundtracks, named entrants, restart, twenty-four timed heats and cumulative podium scoring:', game);
} finally {
  await browser.close();
  if (server) await new Promise(resolve => server.httpServer.close(resolve));
}
