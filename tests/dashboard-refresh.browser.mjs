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
 const page=await context.newPage();async function open(path) { await page.goto(`${base}${path}`);await page.waitForTimeout(200);await page.clock.runFor(1000); } const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.clock.install({time:new Date('2026-09-17T05:59:00Z')});
 await open('/mobile');await page.getByText('School reminder',{exact:true}).waitFor();
 await page.clock.pauseAt(new Date('2026-09-17T05:59:59Z'));await page.clock.runFor(1000);
 assert.equal(await page.getByText('School reminder',{exact:true}).count(),0);
 await open('/mobile/events');await page.getByRole('button',{name:'Edit School reminder',exact:true}).waitFor();
 // Expired records remain available to edit.
 await open('/');await page.clock.runFor(100);await page.getByRole('button',{name:'Refresh Calendar',exact:true}).waitFor();
 assert.equal(await page.getByText('School reminder',{exact:true}).count(),0);
 await page.evaluate(()=>window.reloadMarker=true);
 await page.clock.setSystemTime(new Date('2026-09-17T08:01:00Z'));
 await Promise.all([page.waitForEvent('load'),page.evaluate(()=>window.dispatchEvent(new Event('focus')))]);
 assert.equal(await page.evaluate(()=>window.reloadMarker),undefined);
 // An overdue reload must preserve a draft while in an editor.
 await open('/mobile/meals');await page.getByLabel('Title',{exact:true}).fill('Keep this draft');
 await page.clock.setSystemTime(new Date('2026-09-17T11:00:00Z'));
 await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await page.clock.runFor(30_000);
 assert.equal(await page.getByLabel('Title',{exact:true}).inputValue(),'Keep this draft');
 assert.deepEqual(errors,[]);
 console.log('PASS: Denver midnight hides expired reminders, editor retains history, two-hour home reload occurs, editor draft survives overdue reload.');
} finally {await browser.close();}
