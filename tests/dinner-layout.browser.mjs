import assert from 'node:assert/strict';
import { weatherFixture } from './weather-fixture.mjs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true, chromiumSandbox: true });
try {
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, timezoneId: 'America/Denver' });
  const description = 'Roasted chicken with lemon and herbs, served with buttery mashed potatoes, steamed green beans, a fresh garden salad, and warm bread. Save the leftovers for lunch tomorrow.';
  await context.route('**/api/weather', r => r.fulfill({ json: { forecast: weatherFixture } }));
  await context.route('**/api/family', r => r.fulfill({ json: { data: { version: 1, revision: 1, legacyImports: [], importantEvents: [], dinners: [{ id: 'd', date: '2026-09-15', title: 'Lemon herb chicken', description, link: '' }], todos: Array.from({ length: 20 }, (_, i) => ({ id: String(i), text: `Task ${i + 1}`, person: i < 10 ? 'Lilly' : 'Sawyer', completed: false, sortOrder: i, createdAt: '2026-09-15T12:00:00Z' })) } } }));
  await context.route('**/api/calendar', r => r.fulfill({ json: { configured: true, authenticated: false } }));
  const page = await context.newPage();
  await page.clock.install({ time: new Date('2026-09-15T18:00:00Z') });
  await page.goto(process.env.KIOSK_TEST_URL || 'http://127.0.0.1:3105');
  await page.getByText(description, { exact: true }).waitFor();
  const heights = () => page.locator('.weather-card,.dinner-card,.todos-card').evaluateAll(nodes => nodes.map(n => n.getBoundingClientRect().height));
  const updatedHeights = await heights();
  const baselineStyle = await page.addStyleTag({ content: '.household-column { grid-template-rows:auto minmax(100px,.35fr) minmax(0,1fr); } .home-grid .dinner-card { min-height:0; overflow:hidden; } .dinner-card h3 { margin-bottom:8px; } .dinner-card p { display:-webkit-box; -webkit-box-orient:vertical; -webkit-line-clamp:4; overflow:hidden; }' });
  const previousHeights = await heights();
  await baselineStyle.evaluate(n => n.remove());
  assert.ok(Math.abs(updatedHeights[0] - previousHeights[0]) < 1, 'Weather height unchanged apart from subpixel rounding');
  const extraDinner = updatedHeights[1] - previousHeights[1];
  assert.ok(extraDinner >= 35 && extraDinner <= 50, `Dinner gained ${extraDinner}px`);
  assert.ok(Math.abs(previousHeights[2] - updatedHeights[2] - extraDinner) < 1, 'To-do gives Dinner the same height');
  for (const [width, height] of [[1920, 1080], [1366, 768]]) {
    await page.setViewportSize({ width, height });
    await page.waitForTimeout(200);
    const metrics = await page.evaluate(() => {
      const card = document.querySelector('.dinner-card');
      const p = card.querySelector('p');
      const title = card.querySelector('h3');
      const right = document.querySelector('.household-column').getBoundingClientRect();
      const left = document.querySelector('.calendar-column').getBoundingClientRect();
      return { contained: p.getBoundingClientRect().bottom <= card.getBoundingClientRect().bottom - 15, clipped: p.scrollHeight > p.clientHeight, clamp: getComputedStyle(p).webkitLineClamp, overflow: getComputedStyle(card).overflowY, titleSize: getComputedStyle(title).fontSize, textSize: getComputedStyle(p).fontSize, gap: p.getBoundingClientRect().top - title.getBoundingClientRect().bottom, aligned: Math.abs(right.bottom - left.bottom) < 1, scroll: document.documentElement.scrollHeight > innerHeight };
    });
    assert.equal(metrics.contained, true); assert.equal(metrics.clipped, false); assert.equal(metrics.clamp, 'none'); assert.equal(metrics.overflow, 'visible');
    assert.equal(metrics.titleSize, '26px'); assert.equal(metrics.textSize, '19px'); assert.equal(metrics.gap, 4); assert.equal(metrics.aligned, true); assert.equal(metrics.scroll, false);
    for (const person of ['Lilly', 'Sawyer']) {
      const next = page.getByRole('button', { name: `Next ${person} tasks`, exact: true });
      assert.equal(await next.isEnabled(), true); await next.click();
    }
    if (width === 1366) assert.equal(await page.locator('.person-todos + .person-todos').evaluate(n => getComputedStyle(n).borderLeftWidth), '1px');
  }
  console.log('PASS: full wrapped dinner description inside card, unchanged fonts, 4px gap, aligned columns, no page scroll, both task pagers usable and divider preserved.');
} finally { await browser.close(); }
