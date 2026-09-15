import { weatherFixture } from "./weather-fixture.mjs";
// Optional browser checks; install Playwright separately (see docs/pi5-kiosk.md).
import assert from "node:assert/strict";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
  headless: true,
  chromiumSandbox: true,
});
const base = process.env.KIOSK_TEST_URL || "http://127.0.0.1:3105";
const errors = [];
const results = [];
const cache = {
  rangeStart: "2026-08-01", rangeEnd: "2026-12-01", timeZone: "America/Denver",
  refreshedAt: "2026-09-13T17:00:00Z",
  events: [13, 14, 15, 16].map((day) => ({
    id: `event-${day}`, calendarId: "family", calendarName: "Family",
    title: `Family event ${day}`, start: `2026-09-${day}`, end: `2026-09-${day + 1}`,
    allDay: true, days: [`2026-09-${day}`],
  })),
};
const state = { configured: true, authenticated: true, cache, selectedIds: ["family"],
  missingVariables: [], calendarAccess: true, account: { name: "Kiosk Test", email: "test@example.invalid" } };
async function advance(page, milliseconds) {
  await page.clock.runFor(milliseconds);
  // Let mocked network responses settle before advancing the next retry deadline.
  await page.waitForTimeout(100);
  // React effects may schedule a zero-delay timer after the clock step commits.
  await page.clock.runFor(1);
  await page.waitForTimeout(100);
}
async function fixture(options = {}) {
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, hasTouch: true, timezoneId: "America/Denver" });
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  await page.clock.install({ time: new Date("2026-09-13T18:00:30Z") });
  await context.route("**/api/family", route => route.fulfill({ json: { data: { version: 1, revision: 0, dinners: [], todos: [], legacyImports: [] } } }));
  await context.route("**/api/weather", route => route.fulfill({ json: { forecast: weatherFixture } }));
  const counts = {};
  let fail = Boolean(options.fail);
  let nextState = structuredClone(state);
  await context.route("**/api/calendar**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    counts[path] = (counts[path] || 0) + 1;
    if (fail && path === "/api/calendar") return route.fulfill({ status: 503, json: { error: "Temporary outage" } });
    if (path === "/api/calendar") return route.fulfill({ json: nextState });
    if (path === "/api/calendar/refresh") return route.fulfill({ status: options.refreshFails ? 503 : 200, json: options.refreshFails ? { error: "Refresh unavailable" } : { cache } });
    if (path === "/api/calendar/calendars") return route.fulfill({ json: route.request().method() === "PUT" ? { selectedIds: ["family"] } : { calendars: [{ id: "family", name: "Family", selected: true }] } });
    if (path === "/api/calendar/reconnect") return route.fulfill({ json: { calendars: [{ id: "family", name: "Family", selected: true }], selectedIds: ["family"], cache } });
    if (path === "/api/calendar/disconnect") return route.fulfill({ json: { disconnected: true } });
    return route.abort();
  });
  return { page, context, counts, setFail: (value) => { fail = value; }, setState: (value) => { nextState = value; } };
}
try {
  const f = await fixture();
  await f.page.goto(base);
  await f.page.getByText("Family event 13", { exact: true }).waitFor();
  assert.equal(await f.page.locator("h1").textContent(), "Home dashboard");
  assert.deepEqual(await f.page.evaluate(() => ({ x: document.documentElement.scrollWidth > innerWidth, y: document.documentElement.scrollHeight > innerHeight })), { x: false, y: false });
  await f.page.getByRole("button", { name: "Next day", exact: true }).click();
  await f.page.getByText("Family event 14", { exact: true }).waitFor();
  const reads = f.counts["/api/calendar"];
  await f.page.getByRole("button", { name: "Today", exact: true }).click();
  assert.equal(f.counts["/api/calendar"], reads);
  await f.page.goto(`${base}/calendar-settings`);
  await f.page.getByRole("checkbox", { name: "Family" }).waitFor();
  await f.page.getByRole("button", { name: "Save calendars" }).click();
  await f.page.getByText("Calendar selection saved.", { exact: false }).waitFor();
  await f.page.goto(base);
  await f.page.getByRole("button", { name: "Refresh Calendar", exact: true }).click();
  await f.page.getByRole("button", { name: "Refresh Calendar", exact: true }).waitFor();
  await f.page.getByRole("button", { name: "Refresh Calendar", exact: true }).click();
  await f.page.getByText("Calendar was refreshed recently.", { exact: false }).waitFor();
  assert.equal(f.counts["/api/calendar/refresh"], 1);
  await f.page.screenshot({ path: "/tmp/home-dashboard-pi5-1080p.png" });
  await f.page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await f.page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await f.page.screenshot({ path: "/tmp/home-dashboard-pi5-mobile.png", fullPage: true });
  results.push("1080p fit, mobile width, calendar navigation, settings, refresh/cooldown");
  await f.context.close();

  const r = await fixture({ fail: true });
  await r.page.goto(base);
  await r.page.getByText("Calendar connection unavailable.", { exact: false }).waitFor();
  await advance(r.page, 14_000);
  assert.equal(r.counts["/api/calendar"], 1);
  r.setFail(false);
  await advance(r.page, 1_100);
  await r.page.getByText("Family event 13", { exact: true }).waitFor();
  assert.equal(r.counts["/api/calendar"], 2);
  r.setFail(true);
  await r.page.evaluate(() => window.dispatchEvent(new Event("online")));
  await r.page.getByText("Calendar connection unavailable.", { exact: false }).waitFor();
  await r.page.getByText("Family event 13", { exact: true }).waitFor();
  await advance(r.page, 15_100);
  assert.equal(r.counts["/api/calendar"], 4);
  await advance(r.page, 59_000);
  assert.equal(r.counts["/api/calendar"], 4);
  await advance(r.page, 1_100);
  assert.equal(r.counts["/api/calendar"], 5);
  await advance(r.page, 300_100);
  assert.equal(r.counts["/api/calendar"], 6);
  r.setFail(false);
  await r.page.evaluate(() => window.dispatchEvent(new Event("online")));
  await r.page.waitForFunction(() => !document.body.textContent.includes("Calendar connection unavailable."));
  const idleCount = r.counts["/api/calendar"];
  const cdp = await r.context.newCDPSession(r.page);
  const heap = [];
  for (let i = 0; i < 4; i++) {
    await advance(r.page, 2 * 60 * 60 * 1000);
    await cdp.send("HeapProfiler.collectGarbage");
    heap.push((await cdp.send("Runtime.getHeapUsage")).usedSize);
  }
  assert.equal(r.counts["/api/calendar"], idleCount);
  assert.ok(heap.at(-1) < heap[0] + 5_000_000, JSON.stringify(heap));
  results.push({ recovery: "15s/60s/300s backoff, stale-content retention, online recovery, no healthy polling", acceleratedEightHourHeapBytes: heap });
  console.log(JSON.stringify({ acceleratedEightHourHeapBytes: heap }));
  // Cross midnight separately so the mocked HTTP reply can complete before its deadline.
  await r.page.clock.pauseAt(new Date("2026-09-14T05:59:59Z"));
  await advance(r.page, 1_100);
  await r.page.getByText("Family event 14", { exact: true }).waitFor();
  await advance(r.page, 100);
  assert.equal(r.counts["/api/calendar"], idleCount + 1);
  await r.context.setOffline(true);
  await r.page.getByText("Offline.", { exact: false }).first().waitFor();
  await r.page.getByText("Family event 14", { exact: true }).waitFor();
  const offlineCount = r.counts["/api/calendar"];
  await advance(r.page, 300_100);
  assert.equal(r.counts["/api/calendar"], offlineCount);
  await r.context.setOffline(false);
  await r.page.waitForFunction(() => !document.body.textContent.includes("Offline."));
  const clockText = await r.page.locator(".clock").textContent();
  await r.page.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, value: true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await advance(r.page, 3_600_000);
  assert.equal(await r.page.locator(".clock").textContent(), clockText);
  await r.page.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, value: false });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await r.page.waitForFunction((old) => document.querySelector(".clock").textContent !== old, clockText);
  results.push("offline event preserves content; hidden clock pauses and resumes");
  results.push("midnight advances Today and reads only the cache");
  await r.context.close();

  const a = await fixture();
  a.setState({ ...state, authenticated: false, account: null, cache: null });
  let signIns = 0;
  await a.context.route("**/api/auth/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/providers")) return route.fulfill({ json: { google: { id: "google", name: "Google", type: "oauth", signinUrl: `${base}/api/auth/signin/google`, callbackUrl: `${base}/api/auth/callback/google` } } });
    if (path.endsWith("/csrf")) return route.fulfill({ json: { csrfToken: "test-csrf" } });
    if (path.endsWith("/signin/google")) { signIns++; return route.fulfill({ json: { url: `${base}/?auth-test=ok` } }); }
    return route.fulfill({ json: {} });
  });
  await a.page.goto(base);
  await a.page.getByRole("button", { name: "Connect Google Calendar", exact: true }).click();
  await a.page.waitForURL("**/?auth-test=ok");
  assert.equal(signIns, 1);
  assert.equal(a.context.pages().length, 1);
  results.push("lazy authentication client starts same-window sign-in (mocked OAuth)");
  await a.context.close();

  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ passed: results, pageErrors: errors }, null, 2));
} finally {
  await browser.close();
}
