import assert from 'node:assert/strict';
import { weatherFixture } from './weather-fixture.mjs';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,chromiumSandbox:true});
const base=process.env.KIOSK_TEST_URL||'http://127.0.0.1:3105';
try {
 const context=await browser.newContext({viewport:{width:390,height:844},timezoneId:'UTC'});
 await context.route('**/api/weather',r=>r.fulfill({json:{forecast:weatherFixture}}));
 await context.route('**/api/family',r=>r.fulfill({json:{data:{version:1,revision:1,legacyImports:[],dinners:[{id:'d',date:'2026-09-16',title:'Tacos',description:'Dinner description',link:''}],todos:[{id:'t',text:'Pack bag',person:'Lilly',completed:false,sortOrder:0,createdAt:'2026-09-15T12:00:00Z'}],importantEvents:[{id:'r',startDate:'2026-09-16',endDate:'',description:'School reminder',highImportance:true}]}}}));
 await context.route('**/api/calendar',r=>r.fulfill({json:{configured:true,authenticated:true,missingVariables:[],calendarAccess:true,selectedIds:['family'],cache:{rangeStart:'2026-09-01',rangeEnd:'2026-10-01',timeZone:'America/Denver',refreshedAt:'2026-09-15T18:00:00Z',events:[{id:'e',calendarId:'family',calendarName:'Family',title:'Soccer',start:'2026-09-16',end:'2026-09-17',allDay:true,days:['2026-09-16']}]}}}));
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));let navigations=0;page.on('framenavigated',frame=>{if(frame===page.mainFrame())navigations++;});
 await page.clock.install({time:new Date('2026-09-16T02:59:00Z')});
 await page.goto(`${base}/mobile/meals`);await page.getByLabel('Title',{exact:true}).fill('Unsaved dinner edit');
 await page.clock.pauseAt(new Date('2026-09-16T02:59:59Z'));
 assert.equal(await page.locator('html').getAttribute('data-theme'),'light');
 const before=navigations;await page.clock.runFor(1000);
 assert.equal(await page.locator('html').getAttribute('data-theme'),'dark');assert.equal(navigations,before);assert.equal(await page.getByLabel('Title',{exact:true}).inputValue(),'Unsaved dinner edit');
 assert.equal(await page.locator('body').evaluate(n=>getComputedStyle(n).backgroundColor),'rgb(16, 21, 28)');
 assert.equal(await page.getByLabel('Title',{exact:true}).evaluate(n=>getComputedStyle(n).backgroundColor),'rgb(16, 24, 32)');
 await page.clock.setSystemTime(new Date('2026-09-16T10:59:59Z'));
 await page.evaluate(()=>window.dispatchEvent(new Event('pageshow')));await page.clock.runFor(1000);
 assert.equal(await page.locator('html').getAttribute('data-theme'),'light');assert.equal(navigations,before);assert.equal(await page.getByLabel('Title',{exact:true}).inputValue(),'Unsaved dinner edit');
 assert.equal(await page.locator('body').evaluate(n=>getComputedStyle(n).backgroundColor),'rgb(242, 234, 219)');
 await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});
 await page.clock.setSystemTime(new Date('2026-09-17T04:00:00Z'));
 await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:false});document.dispatchEvent(new Event('visibilitychange'));});
 assert.equal(await page.locator('html').getAttribute('data-theme'),'dark');
 // Direct night loads and client navigation retain the same theme.
 await page.goto(`${base}/mobile`);await page.clock.runFor(100);await page.getByText('School reminder',{exact:true}).waitFor();
 assert.equal(await page.locator('html').getAttribute('data-theme'),'dark');
 await page.screenshot({path:'/tmp/home-dashboard-mobile-dark.png',fullPage:true});
 await page.getByRole('link',{name:'Pi dashboard',exact:true}).click();await page.clock.runFor(100);await page.setViewportSize({width:1920,height:1080});await page.locator('.app-header').waitFor();await page.waitForTimeout(100);await page.clock.runFor(1000);await page.getByRole('button',{name:'Refresh Calendar',exact:true}).waitFor();
 assert.equal(await page.locator('html').getAttribute('data-theme'),'dark');assert.equal(await page.locator('.app-header').evaluate(n=>getComputedStyle(n).backgroundColor),'rgb(27, 36, 48)');
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await page.screenshot({path:'/tmp/home-dashboard-desktop-dark.png'});
 assert.deepEqual(errors,[]);console.log('PASS: Denver 9PM/5AM switches in a UTC browser, no reload or lost draft, native controls and cards themed, hidden resume and route navigation, direct night load; no hydration errors.');
} finally {await browser.close();}
