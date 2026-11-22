import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium, webkit } from 'playwright';
import { preview } from 'vite';
import { tsImport } from 'tsx/esm/api';
import orreryLayout from '../src/courses/orrery-layout.json' with { type: 'json' };
import keplerLayout from '../src/courses/kepler-layout.json' with { type: 'json' };

const url = process.env.MARBLE_URL;
const server = url ? undefined : await preview({ preview: { host: '127.0.0.1', port: 0 } });
const address = server?.httpServer.address();
const game = url ?? 'http://127.0.0.1:' + address.port + '/';
const mobile = process.argv.includes('--mobile');
const engine = process.env.MARBLE_BROWSER === 'webkit' ? webkit : chromium;
const browser = await engine.launch({
  ...(process.env.MARBLE_CHROME ? { executablePath: process.env.MARBLE_CHROME } : {}),
  ...(engine === chromium ? { args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] } : {})
});
const output = resolve('test-results', (mobile ? 'mobile' : 'desktop') + (url?.startsWith('https') ? '-live' : ''));
const page = await browser.newPage({
  viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 },
  deviceScaleFactor: 1,
  hasTouch: mobile,
  isMobile: mobile
});
const issues = [];
const loadedMusic = new Set();
page.on('pageerror', error => issues.push(error.message));
page.on('response', response => {
  if (response.status() >= 400) issues.push(response.status() + ' ' + response.url());
  const music = new URL(response.url()).pathname.match(/\/audio\/music-([a-z]+)\.mp3$/);
  if (music && response.ok()) loadedMusic.add(music[1]);
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
  await page.screenshot({ path: resolve(output, name + '.png') });
}

function clock(seconds) {
  const hundredths = Math.round(seconds * 100);
  const remainder = (hundredths % 6000) / 100;
  return Math.floor(hundredths / 6000) + ':' + remainder.toFixed(2).padStart(5, '0');
}

// Rehearse the featured grids so screenshots follow course landmarks after tuning.
async function landmarkTimes(id, seed, sections) {
  const { buildTrack } = await tsImport('../src/track.ts', import.meta.url);
  const { RaceSimulation, initPhysics } = await tsImport('../src/simulation.ts', import.meta.url);
  await initPhysics();
  const track = buildTrack(id);
  const marks = sections.map(name => {
    const section = track.sections.find(section => section.name === name);
    assert.ok(section, id + ' is missing the ' + name + ' camera section.');
    return [name, (section.start + section.end) / 2];
  });
  const jump = id === 'orrery' ? orreryLayout.jumps[0] : id === 'kepler' ? keplerLayout.jump : undefined;
  if (jump) {
    const { takeoff, landing } = jump;
    marks.push(['Airborne', (takeoff + landing) / 2]);
  }
  marks.sort((a, b) => a[1] - b[1]);
  const heat = new RaceSimulation(track, 6, seed, id === 'crux' ? 'knockout' : 'endurance');
  const times = {};
  try {
    heat.release();
    for (const [name, distance] of marks) {
      while (!heat.failure && !heat.finished && heat.marbles.every(marble => marble.distance < distance)) {
        heat.step();
      }
      assert.ok(!heat.failure && !heat.finished, name + ' rehearsal failed: ' + heat.failure);
      times[name] = heat.elapsed;
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

async function verifyResults(track, count, marked) {
  await page.waitForSelector('body[data-view="results"], body[data-view="failure"]', { timeout: track === 'Crux Mountain Masters' ? 300000 : 150000, state: 'attached' });
  const failure = await page.locator('.failure-message').allTextContents();
  if (failure.length) assert.fail(track + ' heat failed at seed ' + await page.evaluate(() => window.playtestGridSeed) + ': ' + failure.join(' '));
  assert.equal(await page.locator('.result-course').innerText(), track);
  if (track === 'Kepler Relay') {
    assert.ok(await page.locator('.winner-card p').innerText() >= '1:00.00', 'Kepler Relay winner must race for at least a minute.');
  }
  await assertRacers('.finish-order', entrants.slice(0, count));
  await assertMarked('.finish-order', marked);
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
      if (this.loop && this.buffer?.duration > 10) window.playtestMusicStarted = true;
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
          const { approach, target } = window.playtestActionShot;
          if (clock >= approach) step = clock >= target ? 0 : Math.min(step, 1000 / 60);
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
  await page.waitForFunction(() => document.querySelector('.start-button')?.disabled === false, undefined, { timeout: 90000 });
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
  await startButton.click();
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
  await page.waitForFunction(() => document.querySelector('.race-clock')?.textContent >= '0:26.00', undefined, { timeout: 60000 });
  await assertRacers('.running-order', entrants.slice(0, frostField));
  await capture('frostline-racing');
  await verifyResults('Frostline Rally', frostField, frostField - 1);
  await capture('frostline-results');
  await page.getByRole('button', { name: 'Race again' }).click();
  await verifyResults('Frostline Rally', frostField, frostField - 1);
  assert.equal(await tally(), 3);
  await page.getByRole('button', { name: 'Change setup' }).click();
  const seeds = { orrery: 82, tideglass: 58, kepler: 23, crux: 23 };
  const orrery = await landmarkTimes('orrery', seeds.orrery, ['Escapement Gallery', 'Ecliptic Underpass']);
  const tideglass = await landmarkTimes('tideglass', seeds.tideglass, ['Standing Wave Gallery', 'Twin Frond Sluice']);
  const kepler = await landmarkTimes('kepler', seeds.kepler, ['Solar Array Esses', 'Gravity Dive', 'Aurora Catch', 'Orbital Return']);
  const crux = await landmarkTimes('crux', seeds.crux, ['Volume Alley', 'Slab Switches']);
  const jumpShots = {};
  for (const [id, time] of [['orrery', orrery.Airborne], ['kepler', kepler.Airborne]]) {
    jumpShots[id] = { approach: clock(time - 1), target: clock(time - .04) };
  }
  for (const [title, id, shots] of [
    ['Timber Corkscrew', 'timber', [['0:13.00', 'racing']]],
    ['Wireworks Drop', 'wireworks', [['0:07.00', 'rails'], ['0:25.00', 'racing']]],
    ['Midnight Orrery', 'orrery', [
      [clock(orrery['Escapement Gallery']), 'escapement'],
      [clock(orrery['Ecliptic Underpass']), 'underpass'],
      [jumpShots.orrery.target, 'comet-skips'],
    ]],
    ['Tideglass Conservatory', 'tideglass', [
      [clock(tideglass['Standing Wave Gallery']), 'standing-wave'],
      [clock(tideglass['Twin Frond Sluice']), 'twin-sluice'],
    ]],
    ['Kepler Relay', 'kepler', [
      [clock(kepler['Solar Array Esses']), 'arrays'],
      [clock(kepler['Gravity Dive']), 'gravity-dive'],
      [jumpShots.kepler.target, 'vacuum-transfer'],
      [clock(kepler['Aurora Catch']), 'aurora-catch'],
      [clock(kepler['Orbital Return']), 'orbital-return'],
    ]],
    ['Crux Mountain Masters', 'crux', [
      [clock(crux['Volume Alley']), 'volume-alley'],
      [clock(crux['Slab Switches']), 'slab-switches'],
    ]],
  ]) {
    await trackButton(title).click();
    await fieldButton(6).click();
    await marker.selectOption('5');
    // Cover both booting a saved course and changing physics/audio in the same session.
    if (id !== 'wireworks') await page.reload();
    await page.waitForFunction(() => document.querySelector('.start-button')?.disabled === false);
    assert.equal(await trackButton(title).getAttribute('aria-pressed'), 'true');
    await assertSetup(6);
    await page.evaluate(() => window.scrollTo(0, 0));
    await capture(id + '-setup');
    await page.evaluate(() => { window.playtestMusicStarted = false; });
    if (id in seeds) {
      // Apply the rehearsed grid once. The rematch still draws a random grid.
      await page.evaluate(({ seed, shot }) => {
        window.playtestNextSeed = seed;
        window.playtestActionShot = shot;
      }, { seed: seeds[id], shot: jumpShots[id] });
    }
    await startButton.click();
    for (const [time, shot] of shots) {
      await page.waitForFunction(target => document.querySelector('.race-clock')?.textContent >= target, time, { timeout: 90000 });
      if (id === 'kepler' && shot === 'arrays' && canFullscreen) {
        await enterFullscreen.click();
        await assertFullscreen(true);
        await exitFullscreen.click();
        await assertFullscreen(false);
      }
      await capture(id + '-' + shot);
      if (time === jumpShots[id]?.target) await page.evaluate(() => { delete window.playtestActionShot; });
      if (id === 'crux') assert.ok(await page.locator('.checkpoint-status').isVisible());
    }
    await assertRacers('.running-order', entrants);
    assert.ok(loadedMusic.has(id), title + ' must load its own soundtrack.');
    assert.ok(await page.evaluate(() => window.playtestMusicStarted), title + ' must play a decoded music loop.');
    await verifyResults(title, 6, 5);
    if (id === 'crux') {
      assert.deepEqual(await page.locator('.finish-time').allTextContents().then(times => times.slice(2)),
        ['Out at CP 4', 'Out at CP 3', 'Out at CP 2', 'Out at CP 1']);
      assert.ok((await page.locator('.winner-card p').innerText()) >= '2:00.00');
      await page.getByText('Checkpoint leaders', { exact: true }).click();
      assert.equal(await page.locator('.checkpoint-results li:visible').count(), 4);
    }
    await capture(id + '-results');
    await page.getByRole('button', { name: 'Race again' }).click();
    await verifyResults(title, 6, 5);
    await page.getByRole('button', { name: 'Change setup' }).click();
    if (id === 'crux') {
      await page.getByRole('button', { name: 'Endurance', exact: true }).click();
      await page.reload();
      assert.equal(await page.getByRole('button', { name: 'Endurance', exact: true }).getAttribute('aria-pressed'), 'true');
      await startButton.click();
      await verifyResults(title, 6, 5);
      assert.ok((await page.locator('.finish-time').allTextContents()).every(time => /^\d+:\d\d\.\d\d/.test(time)));
      await page.getByRole('button', { name: 'Change setup' }).click();
    }
  }
  assert.equal(await tally(), 16);
  assert.deepEqual([...loadedMusic].sort(), ['crux', 'frostline', 'kepler', 'orrery', 'prism', 'tideglass', 'timber', 'wireworks']);
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
  console.log('Passed eight courses, eight soundtracks, named entrants, restart, sixteen timed heats and cumulative podium scoring:', game);
} finally {
  await browser.close();
  if (server) await new Promise(resolve => server.httpServer.close(resolve));
}
