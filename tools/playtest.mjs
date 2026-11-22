import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium, webkit } from 'playwright';
import { preview } from 'vite';

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
page.on('pageerror', error => issues.push(error.message));
page.on('response', response => { if (response.status() >= 400) issues.push(response.status() + ' ' + response.url()); });
const fieldSize = mobile ? 2 : 4;
const entrants = [
  { name: 'Amethyst', color: '#995bd8', label: 'Violet', livery: '4' },
  { name: 'Rose <3', color: '#e95d97', label: 'Rose', livery: '5' },
  { name: 'Blue Jay', color: '#168bd2', label: 'Azure', livery: '3' },
  { name: 'Lucky Clover', color: '#179a74', label: 'Emerald', livery: '2' }
];
const previousWinner = { name: 'Legacy Gold', color: '#edae17', label: 'Golden yellow' };
const expectedWins = new Map([[previousWinner.name, 1]]);
const nameInput = number => page.getByRole('textbox', { name: 'Player ' + number + ' name', exact: true });
const colorInput = number => page.getByRole('combobox', { name: 'Player ' + number + ' color', exact: true });
const fieldButton = size => page.getByRole('button', { name: size + ' marbles', exact: true });
const marker = page.getByRole('combobox', { name: 'Race marker', exact: true });

async function capture(name) {
  await page.screenshot({ path: resolve(output, name + '.png') });
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

async function verifyResults() {
  await page.waitForSelector('body[data-view="results"]', { timeout: 150000, state: 'attached' });
  await assertRacers('.finish-order', entrants.slice(0, fieldSize));
  await assertMarked('.finish-order');
  const winner = await page.locator('.winner-card h2').textContent();
  expectedWins.set(winner, (expectedWins.get(winner) ?? 0) + 1);
}

async function assertMarked(list) {
  const markedRows = page.locator(list + ' li').filter({ has: page.getByText('Marked', { exact: true }) });
  assert.equal(await markedRows.count(), 1);
  assert.ok((await markedRows.textContent()).includes(entrants[1].name));
}
try {
  await mkdir(output, { recursive: true });
  // Exercise an existing installation's first visit after the roster update.
  await page.addInitScript(winner => {
    if (sessionStorage.getItem('playtest-initialized')) return;
    localStorage.setItem('marble-run:setup:v1', JSON.stringify({ count: 3, name: 'Veteran', livery: 2 }));
    localStorage.setItem('marble-run:win:v1:previous-heat', JSON.stringify(winner));
    sessionStorage.setItem('playtest-initialized', '1');
  }, previousWinner);
  await page.goto(game);
  const startButton = page.getByRole('button', { name: 'Start race' });
  await page.waitForFunction(() => document.querySelector('.start-button')?.disabled === false, undefined, { timeout: 90000 });
  await page.evaluate(() => document.fonts.ready);
  assert.equal(await nameInput(1).inputValue(), 'Veteran');
  assert.equal(await colorInput(1).inputValue(), '2');
  assert.equal(await nameInput(2).inputValue(), 'Riptide');
  assert.equal(await colorInput(2).inputValue(), '3');
  assert.equal(await nameInput(3).inputValue(), 'Sunbeam');
  assert.equal(await colorInput(3).inputValue(), '1');
  assert.equal(await fieldButton(3).getAttribute('aria-pressed'), 'true');
  await fieldButton(4).click();
  for (let slot = 0; slot < 4; slot++) {
    await nameInput(slot + 1).fill(entrants[slot].name);
    await colorInput(slot + 1).selectOption(entrants[slot].livery);
  }
  await assertSetup(4);
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
  for (const size of [2, 3, 4, fieldSize]) {
    await fieldButton(size).click();
    await assertSetup(size);
  }
  await marker.selectOption('none');
  assert.equal(await marker.inputValue(), 'none');
  await marker.selectOption('1');
  await capture('setup');
  console.log('Captured setup', output);
  await startButton.click();
  await page.waitForSelector('body[data-view="race"]', { timeout: 30000, state: 'attached' });
  await page.waitForFunction(() => document.querySelector('.race-clock')?.textContent >= '0:07.00');
  await assertRacers('.running-order', entrants.slice(0, fieldSize));
  await assertMarked('.running-order');
  await capture('racing');
  const tally = () => page.evaluate(() => Object.keys(localStorage).filter(key => key.startsWith('marble-run:win:')).length);
  assert.equal(await tally(), 1);
  await page.getByRole('button', { name: 'Restart' }).click();
  await page.waitForSelector('body[data-view="countdown"]', { state: 'attached' });
  await verifyResults();
  assert.equal(await tally(), 2);
  await capture('results');
  console.log('First complete heat', await page.locator('.finish-order').innerText());
  await page.getByRole('button', { name: 'Race again' }).click();
  await verifyResults();
  assert.equal(await tally(), 3);
  await page.getByRole('button', { name: 'Change setup' }).click();
  await assertSetup(fieldSize);
  await page.reload();
  await nameInput(1).waitFor();
  await assertSetup(fieldSize);
  assert.equal(await marker.inputValue(), '1');
  await fieldButton(4).click();
  await assertSetup(4);
  await page.getByRole('button', { name: 'Standings' }).click();
  const winners = [previousWinner, ...entrants].filter(entrant => expectedWins.has(entrant.name));
  await assertRacers('.all-wins', winners);
  for (const winner of winners) {
    const total = await page.locator('.all-wins li').filter({ hasText: winner.name }).locator('strong').textContent();
    assert.equal(Number(total), expectedWins.get(winner.name), winner.name + ' wins');
  }
  await page.getByRole('button', { name: 'Close standings' }).click();
  assert.deepEqual(issues, []);
  console.log('Passed setup, restart, two timed finishes, rematch, persistent standings and reload:', game);
} finally {
  await browser.close();
  if (server) await new Promise(resolve => server.httpServer.close(resolve));
}
