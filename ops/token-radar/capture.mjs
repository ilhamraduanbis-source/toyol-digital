// Capture genuine offline browser renders of the generated contest entry.
// Requires TOYOL_TOOLS_DIR/node_modules/playwright and system Chrome; no network in the page.
import { createRequire } from 'node:module';
import { readFileSync, mkdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const tools = process.env.TOYOL_TOOLS_DIR;
if (!tools) throw new Error('TOYOL_TOOLS_DIR_NOT_SET');
const { chromium } = require(join(tools, 'node_modules', 'playwright'));
const [outputDir, screenshotDir] = process.argv.slice(2);
if (!outputDir || !screenshotDir) throw new Error('Usage: node capture.mjs OUTPUT_DIR SCREENSHOTS_DIR');
const out = resolve(outputDir);
const dest = resolve(screenshotDir);
mkdirSync(dest, { recursive: true });

const board = JSON.parse(readFileSync(join(out, 'board.json'), 'utf8'));
if (!Array.isArray(board.rows) || board.rows.length < 100) throw new Error('BOARD_MISSING');
const top = board.rows[0];
if (!top?.slug || !top?.name) throw new Error('TOP_ROW_MISSING');
const file = pathToFileURL(join(out, 'dashboard', 'index.html')).href;
const chrome = process.env.CHROME_BIN || '/usr/bin/google-chrome';
const browser = await chromium.launch({ executablePath: chrome, headless: true, args: ['--no-sandbox', '--disable-gpu'] });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
  await page.route('**/*', async route => {
    const url = route.request().url();
    if (/^(https?:|wss?:)/i.test(url)) return route.abort();
    return route.continue();
  });
  const visit = async (fragment) => {
    await page.goto(file + fragment, { waitUntil: 'load' });
    await page.waitForFunction(() => {
      const root = document.getElementById('board');
      return root && root.getAttribute('aria-busy') === 'false' && root.textContent.length > 100;
    }, { timeout: 15000 });
  };
  await visit('');
  await page.screenshot({ path: join(dest, '1-board.jpg'), type: 'jpeg', quality: 76 });

  // Open the real detail interaction through a user click, not a hash-only assumption.
  await page.locator('tbody tr').first().click();
  await page.locator('dialog.detail').waitFor({ state: 'visible', timeout: 12000 });
  await page.screenshot({ path: join(dest, '2-detail.jpg'), type: 'jpeg', quality: 76 });

  // Use a unique-ish name from the actual board for an authentic filtered view.
  const q = top.name.trim().split(/\s+/)[0];
  await visit('#q=' + encodeURIComponent(q));
  const search = page.locator('input[type=search]');
  await search.waitFor({ state: 'visible', timeout: 8000 });
  await page.screenshot({ path: join(dest, '3-filtered.jpg'), type: 'jpeg', quality: 76 });
  console.log(JSON.stringify({ capture: 'ok', pages: 3, top_slug: top.slug, filter: q, offline: true }));
} finally {
  await browser.close();
}
