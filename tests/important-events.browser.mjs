import { weatherFixture } from "./weather-fixture.mjs";
import assert from 'node:assert/strict';
import {applyFamilyCommand,emptyFamily} from '../src/lib/family-model.ts';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,chromiumSandbox:true});
const context=await browser.newContext({viewport:{width:1920,height:1080}});
const page=await context.newPage();let data=emptyFamily(),id=0;const errors=[];page.on('pageerror',e=>errors.push(e.message));
const base=process.env.KIOSK_TEST_URL||'http://127.0.0.1:3105';
await context.route('**/api/family',route=>{
 if(route.request().method()==='POST') {const body=route.request().postDataJSON();assert.equal(body.revision,data.revision);data=applyFamilyCommand(data,body.command,{id:()=>String(++id),now:new Date().toISOString(),hash:s=>s});}
 return route.fulfill({json:{data}});
});
await context.route('**/api/calendar',route=>route.fulfill({json:{configured:true,authenticated:true,missingVariables:[],calendarAccess:true,selectedIds:[],cache:null,account:{email:'fixture@example.invalid'}}}));
await context.route('**/api/weather',route=>route.fulfill({json:{forecast: weatherFixture}}));
try{
 await page.goto(base);await page.getByText('Menu',{exact:true}).click();await page.getByRole('link',{name:'Edit Important Events',exact:true}).click();
 await page.getByLabel('Start date',{exact:true}).fill('2026-10-05');await page.getByLabel('End date (optional)',{exact:true}).fill('2026-10-08');await page.getByLabel('Description',{exact:true}).fill('School closed');await page.getByLabel('High importance',{exact:true}).check();await page.getByRole('button',{name:'Save important event',exact:true}).click();await page.getByText('Important event saved.',{exact:true}).waitFor();
 await page.goto(base);await page.locator('.important-events li').waitFor();
 assert.match(await page.locator('.important-events li').innerText(),/Oct 5, 2026 – Oct 8, 2026.*School closed/);
 assert.equal(await page.locator('.important-events li').evaluate(n=>getComputedStyle(n).fontWeight),'700');assert.equal(await page.locator('.important-events li').evaluate(n=>getComputedStyle(n).backgroundColor),'rgb(251, 224, 223)');
 const one=await page.locator('.important-events').boundingBox();const calendar=await page.locator('.calendar-panel').boundingBox();assert.equal(calendar.y,one.y+one.height+8);
 await page.goto(`${base}/important-events`);await page.getByLabel('Start date',{exact:true}).fill('2026-10-10');await page.getByLabel('Description',{exact:true}).fill('Bring permission slip');await page.getByRole('button',{name:'Save important event',exact:true}).click();await page.getByText('Important event saved.',{exact:true}).waitFor();
 await page.goto(base);await page.waitForFunction(()=>document.querySelectorAll('.important-events li').length===2);assert.ok((await page.locator('.important-events').boundingBox()).height>one.height);
 await page.screenshot({path:'/tmp/important-reminders-desktop.png'});
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(200);assert.equal(await page.evaluate(()=>document.documentElement.scrollHeight>innerHeight),false);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await page.getByRole('button',{name:'Next important reminders',exact:true}).click();await page.getByText('Bring permission slip',{exact:false}).waitFor();
 await page.goto(`${base}/important-events`);await page.getByRole('button',{name:'Edit School closed',exact:true}).click();await page.getByLabel('Description',{exact:true}).fill('School open');await page.getByLabel('High importance',{exact:true}).uncheck();await page.getByRole('button',{name:'Save important event',exact:true}).click();await page.getByText('Important event saved.',{exact:true}).waitFor();
 await page.reload();await page.getByRole('button',{name:'Delete School open',exact:true}).click();await page.getByRole('button',{name:'Confirm delete important event',exact:true}).click();await page.getByRole('button',{name:'Edit School open',exact:true}).waitFor({state:'detached'});assert.equal(data.importantEvents.length,1);
 assert.deepEqual(errors,[]);console.log('PASS: reminder CRUD/reload, dates/ranges, red bold importance, dynamic height, calendar placement, menu and mobile no-scroll paging. Shared API fixture.');
}finally{await browser.close();}
