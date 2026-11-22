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
  page.on('pageerror', error => console.error('CAPTURE_PAGE_ERROR', String(error).slice(0, 900)));
  await page.route('**/*', async route => {
    const url = route.request().url();
    if (/^(https?:|wss?:)/i.test(url)) return route.abort();
    return route.continue();
  });
  const waitForBoard = async target => {
    try {
      await target.waitForFunction(() => {
        const root = document.getElementById('board') || document.querySelector('main');
        return !!root && root.getAttribute('aria-busy') !== 'true' &&
          root.textContent.length > 100 && document.querySelectorAll('tbody tr').length > 0;
      }, null, { timeout: 12000 });
    } catch (error) {
      const diagnosis = await target.evaluate(() => ({
        url: location.href, title: document.title,
        rootExists: !!document.getElementById('board'), rootBusy: document.getElementById('board')?.getAttribute('aria-busy'),
        textLength: document.body?.textContent?.length || 0,
        tableRows: document.querySelectorAll('tbody tr').length,
        scripts: [...document.scripts].map(s => s.getAttribute('src')).filter(Boolean)
      })).catch(e => ({ probeError: String(e) }));
      console.error('CAPTURE_NOT_READY_DIAGNOSIS', JSON.stringify(diagnosis));
      await target.screenshot({ path: join(dest, 'capture-debug.jpg'), type: 'jpeg', quality: 70 }).catch(() => {});
      throw error;
    }
  };
  const visit = async (fragment) => {
    await page.goto(file + fragment, { waitUntil: 'load' });
    await waitForBoard(page);
  };
  await visit('');
  // Verify visual default order, not just the correct ranking inside board.json.
  const firstRank = Number((await page.locator('tbody tr').first().locator('td').first().innerText()).trim());
  if (firstRank !== 1) throw new Error('VISUAL_SORT_FAIL: expected first visible rank 1, got ' + firstRank);
  await page.screenshot({ path: join(dest, '1-board.jpg'), type: 'jpeg', quality: 76 });

  // Open the real detail interaction through a user click, not a hash-only assumption.
  await page.locator('tbody tr').first().click();
  await page.locator('dialog.detail').waitFor({ state: 'visible', timeout: 12000 });
  await page.screenshot({ path: join(dest, '2-detail.jpg'), type: 'jpeg', quality: 76 });

  // A hash-only navigation may retain the open modal and produce an exact
  // duplicate of 2-detail.jpg. Use a genuinely fresh isolated page.
  const q = top.name.trim().split(/\s+/)[0];
  const filtered = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
  await filtered.route('**/*', async route => {
    const url = route.request().url();
    if (/^(https?:|wss?:)/i.test(url)) return route.abort();
    return route.continue();
  });
  try {
    await filtered.goto(file + '#q=' + encodeURIComponent(q), { waitUntil: 'load' });
    await waitForBoard(filtered);
    const search = filtered.locator('input[type=search]');
    await search.waitFor({ state: 'visible', timeout: 8000 });
    const visibleFilter = await search.inputValue();
    const visibleRows = await filtered.locator('tbody tr').count();
    const modalOpen = await filtered.locator('dialog.detail').evaluate(el => el.open);
    if (visibleFilter !== q || visibleRows < 1 || visibleRows >= board.rows.length || modalOpen) {
      throw new Error('FILTER_VIEW_NOT_VERIFIABLY_DISTINCT ' +
        JSON.stringify({ visibleFilter, q, visibleRows, modalOpen }));
    }
    await filtered.screenshot({ path: join(dest, '3-filtered.jpg'), type: 'jpeg', quality: 76 });
    const { createHash } = await import('node:crypto');
    const hashes = ['1-board.jpg', '2-detail.jpg', '3-filtered.jpg']
      .map(name => createHash('sha256').update(readFileSync(join(dest, name))).digest('hex'));
    if (new Set(hashes).size !== hashes.length) throw new Error('DUPLICATE_SCREENSHOT_CAPTURED');
    console.log(JSON.stringify({ capture: 'ok', pages: 3, top_slug: top.slug,
      filter: q, filtered_rows: visibleRows, distinct_hashes: true, offline: true }));
  } finally {
    await filtered.close();
  }
} finally {
  await browser.close();
}
