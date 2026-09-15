import assert from 'node:assert/strict';
import { weatherFixture } from './weather-fixture.mjs';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,chromiumSandbox:true});
try {
 const context=await browser.newContext({viewport:{width:1920,height:1080},timezoneId:'UTC'});
 await context.route('**/api/weather',r=>r.fulfill({json:{forecast:weatherFixture}}));
 await context.route('**/api/family',r=>r.fulfill({json:{data:{version:1,revision:1,legacyImports:[],dinners:[],todos:[],importantEvents:[{id:'r',startDate:'2026-09-15',endDate:'',description:'Reminder',highImportance:false}]}}}));
 await context.route('**/api/calendar',r=>r.fulfill({json:{configured:true,authenticated:false}}));
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.clock.install({time:new Date('2026-09-16T05:59:30Z')});
 await page.goto(process.env.KIOSK_TEST_URL||'http://127.0.0.1:3105');
 await page.getByText('BLUE DAY',{exact:true}).waitFor();
 assert.deepEqual(await page.locator('.school-day-half').allTextContents(),['BLUE DAY','MAROON DAY']);
 assert.deepEqual(await page.locator('.school-day-half').evaluateAll(nodes=>nodes.map(n=>[getComputedStyle(n).backgroundColor,getComputedStyle(n).color])),[['rgb(11, 45, 77)','rgb(255, 255, 255)'],['rgb(128, 0, 32)','rgb(255, 255, 255)']]);
 await page.getByText('Reminder',{exact:false}).waitFor();
 for(const [width,height] of [[1920,1080],[1366,768],[390,844]]) {
  await page.setViewportSize({width,height});
  const banner=await page.locator('.school-day-banner').boundingBox();
  const events=await page.locator('.important-events').boundingBox();
  assert.equal(banner.x,events.x);assert.equal(banner.width,events.width);assert.equal(banner.height,80);assert.equal(events.y,banner.y+banner.height+8);
  const halves=await page.locator('.school-day-half').evaluateAll(ns=>ns.map(n=>n.getBoundingClientRect().width));assert.ok(Math.abs(halves[0]-halves[1])<1);
 }
 await page.clock.runFor(120_000);
 assert.deepEqual(await page.locator('.school-day-half').allTextContents(),['GREEN DAY','GOLD DAY']);
 await page.clock.setSystemTime(new Date('2027-03-15T18:00:00Z'));
 await page.clock.runFor(120_000);
 assert.equal((await page.locator('.school-day-half').allTextContents())[1],'—');
 assert.deepEqual(errors,[]);
 console.log('PASS: correct static statuses, white text on navy/maroon, equal halves, placement, Denver midnight rollover in UTC browser, and neutral special date.');
} finally {await browser.close();}
