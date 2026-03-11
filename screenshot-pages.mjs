#!/usr/bin/env node
/**
 * Capture full-page screenshots of all IPL Analytics pages.
 * Saves to /screenshots/*.png
 */
import { webkit } from 'playwright';
import { mkdirSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCREENSHOT_DIR = join(__dirname, 'screenshots');

const PAGES = [
  { url: 'http://localhost:3000', name: '1-dashboard' },
  { url: 'http://localhost:3000/matches', name: '2-matches' },
  { url: 'http://localhost:3000/players', name: '3-players' },
  { url: 'http://localhost:3000/analytics', name: '4-analytics' },
  { url: 'http://localhost:3000/teams', name: '5-teams' },
  { url: 'http://localhost:3000/matches/1473511', name: '6-match-detail' },
  { url: 'http://localhost:3000/players/V%20Kohli', name: '7-player-profile' },
  { url: 'http://localhost:3000/players/YS%20Chahal', name: '8-player-chahal' },
];

async function main() {
  if (!existsSync(SCREENSHOT_DIR)) {
    mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }

  const browser = await webkit.launch({ headless: true });
  const context = await browser.newContext({ 
    viewport: { width: 1280, height: 720 },
    ignoreHTTPSErrors: true 
  });

  for (const { url, name } of PAGES) {
    try {
      const page = await context.newPage();
      // Hard refresh: add cache-busting param, then load
      const freshUrl = url + (url.includes('?') ? '&' : '?') + '_refresh=' + Date.now();
      await page.goto(freshUrl, { waitUntil: 'load', timeout: 20000 });
      // Wait 8+ seconds for full load, streaming, skeleton replacement, charts
      await page.waitForTimeout(8000);
      const path = join(SCREENSHOT_DIR, `${name}.png`);
      await page.screenshot({ path, fullPage: true });
      console.log(`Saved: ${path}`);
      await page.close();
    } catch (err) {
      console.error(`Failed ${name} (${url}):`, err.message);
    }
  }

  await browser.close();
  console.log('Done.');
}

main().catch(e => { console.error(e); process.exit(1); });
