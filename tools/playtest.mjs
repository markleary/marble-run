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
async function capture(name) {
  await page.screenshot({ path: resolve(output, name + '.png') });
}
try {
  await mkdir(output, { recursive: true });
  await page.goto(game);
  const startButton = page.getByRole('button', { name: 'Start race' });
  await page.waitForFunction(() => document.querySelector('.start-button')?.disabled === false, undefined, { timeout: 90000 });
  await page.evaluate(() => document.fonts.ready);
  await capture('setup');
  console.log('Captured setup', output);
  await page.getByRole('button', { name: fieldSize + ' marbles' }).click();
  await page.getByRole('button', { name: 'Violet' }).click();
  await page.getByRole('textbox', { name: 'Name' }).fill('Amethyst');
  await startButton.click();
  await page.waitForSelector('body[data-view="race"]', { timeout: 30000, state: 'attached' });
  await page.waitForFunction(() => document.querySelector('.race-clock')?.textContent >= '0:07.00');
  await capture('racing');
  const tally = () => page.evaluate(() => Object.keys(localStorage).filter(key => key.startsWith('marble-run:win:')).length);
  assert.equal(await tally(), 0);
  await page.getByRole('button', { name: 'Restart' }).click();
  await page.waitForSelector('body[data-view="countdown"]', { state: 'attached' });
  await page.waitForSelector('body[data-view="results"]', { timeout: 150000, state: 'attached' });
  assert.equal(await page.locator('.finish-order li').count(), fieldSize);
  assert.equal(await tally(), 1);
  await capture('results');
  console.log('First complete heat', await page.locator('.finish-order').innerText());
  await page.getByRole('button', { name: 'Race again' }).click();
  await page.waitForSelector('body[data-view="results"]', { timeout: 150000, state: 'attached' });
  assert.equal(await tally(), 2);
  await page.getByRole('button', { name: 'Change setup' }).click();
  assert.equal(await page.getByRole('textbox', { name: 'Name' }).inputValue(), 'Amethyst');
  await page.reload();
  assert.equal(await page.getByRole('textbox', { name: 'Name' }).inputValue(), 'Amethyst');
  await page.getByRole('button', { name: 'Standings' }).click();
  assert.equal(await page.locator('.all-wins li strong').allTextContents().then(numbers => numbers.reduce((sum, n) => sum + Number(n), 0)), 2);
  await page.getByRole('button', { name: 'Close standings' }).click();
  assert.deepEqual(issues, []);
  console.log('Passed setup, restart, two timed finishes, rematch, persistent standings and reload:', game);
} finally {
  await browser.close();
  if (server) await new Promise(resolve => server.httpServer.close(resolve));
}
