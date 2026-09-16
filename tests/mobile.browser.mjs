// Shared API fixture verifies both UIs use the same household commands and records.
import assert from 'node:assert/strict';
import { applyFamilyCommand, emptyFamily } from '../src/lib/family-model.ts';
import { weatherFixture } from './weather-fixture.mjs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,chromiumSandbox:true});
const base=process.env.KIOSK_TEST_URL || 'http://127.0.0.1:3105';
let data={...emptyFamily(),revision:1,dinners:[{id:'d',date:'2026-09-15',title:'Pasta night',description:'Tomato sauce and salad',link:''}],todos:[{id:'t',text:'Pack bag',person:'Lilly',completed:false,sortOrder:0,createdAt:'2026-09-15T12:00:00Z'}],importantEvents:[{id:'r',startDate:'2026-09-18',endDate:'',description:'School photos',highImportance:true}]},id=0;
const cache={rangeStart:'2026-08-01',rangeEnd:'2026-12-01',timeZone:'America/Denver',refreshedAt:'2026-09-15T12:00:00Z',events:[{id:'e',calendarId:'family',calendarName:'Family',title:'Soccer practice',start:'2026-09-15T22:00:00Z',end:'2026-09-15T23:00:00Z',allDay:false,days:['2026-09-15']},{id:'e2',calendarId:'family',calendarName:'Family',title:'Parent night',start:'2026-09-16',end:'2026-09-17',allDay:true,days:['2026-09-16']}]};
const calendar={configured:true,authenticated:true,calendarAccess:true,missingVariables:[],selectedIds:['family'],account:{email:'fixture@example.invalid'},cache};
const errors=[];
async function device(width=390) {
 const context=await browser.newContext({viewport:{width,height:844},timezoneId:'America/Denver'});
 const counts={family:0,weather:0,calendar:0,refresh:0};
 await context.route('**/api/family',route=>{
  counts.family++;
  if(route.request().method()==='POST'){
   const body=route.request().postDataJSON();assert.equal(body.revision,data.revision);
   data=applyFamilyCommand(data,body.command,{id:()=>`new-${++id}`,now:'2026-09-15T18:00:00Z',hash:s=>s});
  }
  return route.fulfill({json:{data}});
 });
 await context.route('**/api/weather',r=>{counts.weather++;return r.fulfill({json:{forecast:weatherFixture}});});
 await context.route('**/api/calendar',r=>{counts.calendar++;return r.fulfill({json:calendar});});
 await context.route('**/api/calendar/refresh',r=>{counts.refresh++;return r.fulfill({json:{cache}});});
 await context.route('**/api/calendar/calendars',r=>r.fulfill({json:{calendars:[{id:'family',name:'Family',selected:true}],selectedIds:['family']}}));
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.clock.install({time:new Date('2026-09-15T18:00:00Z')});
 return {context,page,counts};
}
try {
 const phone=await device();const {page}=phone;
 const pi=await device(1920);await pi.page.setViewportSize({width:1920,height:1080});await pi.page.goto(base);await pi.page.getByText('Pasta night',{exact:true}).waitFor();
 await page.goto(`${base}/mobile`);await page.getByText('Soccer practice',{exact:true}).waitFor();
 for(const text of ['WCA','WHS','BLUE DAY','MAROON DAY','Pasta night','School photos','Pack bag']) assert.ok(await page.getByText(text,{exact:true}).isVisible(),text);
 assert.equal(await page.locator('.app-header').count(),0);
 const routes=['/mobile','/mobile/calendar','/mobile/meals','/mobile/todos','/mobile/events'];
 for(const width of [375,390,430]) {
  await page.setViewportSize({width,height:844});
  for(const route of routes){
   await page.goto(base+route);await page.locator('.mobile-bottom-nav').waitFor();await page.waitForTimeout(100);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`${width} ${route}`);
   const out=await page.locator('.mobile-content input,.mobile-content textarea,.mobile-content select,.mobile-card,.editor-card').evaluateAll(ns=>ns.filter(n=>n.getClientRects().length&&n.getBoundingClientRect().right>innerWidth+1).map(n=>n.outerHTML));assert.deepEqual(out,[],`${width} ${route} child overflow`);
   assert.equal(await page.locator('.mobile-bottom-nav [aria-current="page"]').getAttribute('href'),route);
   const small=await page.locator('.mobile-app button,.mobile-bottom-nav a,.mobile-app .todo-check').evaluateAll(ns=>ns.filter(n=>n.getClientRects().length&&n.getBoundingClientRect().height<44).map(n=>n.outerHTML));assert.deepEqual(small,[]);
  }
  await page.goto(`${base}/mobile`);await page.getByText('Pasta night',{exact:true}).waitFor();await page.screenshot({path:`/tmp/mobile-home-${width}.png`,fullPage:true});
 }
 await page.goto(`${base}/mobile/meals`);await page.getByLabel('Title',{exact:true}).fill('Chicken Tacos');await page.getByLabel('Description',{exact:true}).fill('Corn tortillas, salsa, and avocado.');await page.getByLabel('Recipe Link',{exact:true}).fill('https://example.org/tacos');await page.getByRole('button',{name:'Save dinner',exact:true}).click();await page.getByText('Dinner saved.',{exact:true}).waitFor();
 const piCounts={...pi.counts};await pi.page.clock.runFor(31_000);await pi.page.getByText('Chicken Tacos',{exact:true}).waitFor();assert.equal(pi.counts.weather,piCounts.weather);assert.equal(pi.counts.calendar,piCounts.calendar);assert.equal(pi.counts.family,piCounts.family+1);
 await page.reload();await page.waitForFunction(()=>document.querySelector('input[maxlength="200"]').value==='Chicken Tacos');
 await page.goto(`${base}/mobile/todos`);await page.getByLabel('New task for Sawyer').fill('Mop hallway');await page.getByRole('button',{name:'Add task for Sawyer',exact:true}).click();await page.getByRole('checkbox',{name:'Mop hallway',exact:true}).waitFor();
 await page.getByRole('button',{name:'Edit Mop hallway',exact:true}).click();await page.getByLabel('Task text').fill('Mop kitchen');await page.getByRole('button',{name:'Save task',exact:true}).click();await page.getByRole('checkbox',{name:'Mop kitchen',exact:true}).click();await page.getByText('Completed ·',{exact:false}).waitFor();await page.getByRole('checkbox',{name:'Mop kitchen',exact:true}).click();await page.getByText('Completed ·',{exact:false}).waitFor({state:'detached'});
 await page.getByLabel('New task for Lilly').fill('Clean bathroom');await page.getByRole('button',{name:'Add task for Lilly',exact:true}).click();await page.getByRole('button',{name:'Move Clean bathroom up',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.editable-todos .todo-check').textContent==='Clean bathroom');
 await pi.page.clock.runFor(31_000);await pi.page.getByRole('checkbox',{name:'Mop kitchen',exact:true}).waitFor();
 await page.getByRole('button',{name:'Delete Mop kitchen',exact:true}).click();await page.getByRole('button',{name:'Confirm delete task',exact:true}).click();await page.getByRole('checkbox',{name:'Mop kitchen',exact:true}).waitFor({state:'detached'});
 await page.goto(`${base}/mobile/events`);await page.getByLabel('Start date',{exact:true}).fill('2026-09-20');await page.getByLabel('Description',{exact:true}).fill('Bring forms');await page.getByLabel('High importance',{exact:true}).check();await page.getByRole('button',{name:'Save important event',exact:true}).click();await page.getByText('Important event saved.',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Edit Bring forms',exact:true}).click();await page.getByLabel('Description',{exact:true}).fill('Bring signed forms');await page.getByRole('button',{name:'Save important event',exact:true}).click();await page.getByText('Important event saved.',{exact:true}).waitFor();
 await pi.page.clock.runFor(31_000);await pi.page.getByText('Bring signed forms',{exact:false}).waitFor();
 await page.reload();await page.getByRole('button',{name:'Delete Bring signed forms',exact:true}).click();await page.getByRole('button',{name:'Confirm delete important event',exact:true}).click();await page.getByRole('button',{name:'Delete Bring signed forms',exact:true}).waitFor({state:'detached'});
 await page.goto(`${base}/mobile/calendar`);await page.getByText('Soccer practice',{exact:true}).waitFor();await page.getByText('Parent night',{exact:true}).waitFor();await page.getByRole('button',{name:'Refresh Calendar',exact:true}).click();assert.equal(phone.counts.refresh,1);await page.getByRole('button',{name:'Calendars',exact:true}).click();await page.getByText('Choose calendars',{exact:true}).waitFor();await page.getByRole('button',{name:'Close calendar settings',exact:true}).click();
 await page.goto(`${base}/mobile/meals`);await page.getByRole('button',{name:'Delete dinner',exact:true}).click();await page.getByRole('button',{name:'Cancel deletion',exact:true}).click();assert.equal(data.dinners.length,1);await page.getByRole('button',{name:'Delete dinner',exact:true}).click();await page.getByRole('button',{name:'Confirm delete dinner',exact:true}).click();await page.getByText('Dinner deleted.',{exact:true}).waitFor();
 await page.goto(`${base}/mobile`);assert.equal(await page.locator('meta[name="mobile-web-app-capable"]').getAttribute('content'),'yes');const manifest=await(await page.request.get(`${base}/mobile.webmanifest`)).json();assert.equal(manifest.start_url,'/mobile');assert.equal(manifest.display,'standalone');
 // Visible household refresh runs independently of weather/calendar; hidden pages stop.
 await page.getByRole('checkbox',{name:'Clean bathroom',exact:true}).waitFor();await page.getByText('Soccer practice',{exact:true}).waitFor();
 const oldCounts={...phone.counts};for(let i=0;i<2;i++){const read=page.waitForResponse(r=>r.url().endsWith('/api/family')&&r.request().method()==='GET');await page.clock.runFor(31_000);await read;await page.waitForTimeout(200);}assert.equal(phone.counts.family,oldCounts.family+2);assert.equal(phone.counts.weather,oldCounts.weather);assert.equal(phone.counts.calendar,oldCounts.calendar);
 await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});const hidden=phone.counts.family;await page.clock.runFor(91_000);assert.equal(phone.counts.family,hidden);
 await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:false});document.dispatchEvent(new Event('visibilitychange'));});await page.waitForTimeout(100);assert.equal(phone.counts.family,hidden+1);
 // Same Auth.js provider, CSRF flow and mobile return URL (external Google consent is mocked).
 await phone.context.route('**/api/family',r=>r.fulfill({status:401,json:{error:'Sign in'}}));
 let signIns=0;await phone.context.route('**/api/auth/**',r=>{
  const path=new URL(r.request().url()).pathname;
  if(path.endsWith('/providers'))return r.fulfill({json:{google:{id:'google',name:'Google',type:'oauth',signinUrl:`${base}/api/auth/signin/google`}}});
  if(path.endsWith('/csrf'))return r.fulfill({json:{csrfToken:'test'}});
  if(path.endsWith('/signin/google')){signIns++;assert.equal(new URLSearchParams(r.request().postData()).get('callbackUrl'),'/mobile');return r.fulfill({json:{url:`${base}/mobile?auth-test=ok`}});}
  return r.fulfill({json:{}});
 });
 await page.goto(`${base}/mobile`);await page.getByRole('button',{name:'Sign in with Google',exact:true}).click();await page.waitForURL('**/mobile?auth-test=ok');assert.equal(signIns,1);
 assert.deepEqual(errors,[]);
 console.log('PASS: mobile routes at 375/390/430, shared dinner/task/event CRUD and Pi sync within 30s, calendar/cache/manual refresh, school/weather, navigation/touch targets, PWA metadata, polling isolation/cleanup and mocked Google sign-in; no page errors.');
} catch(error) { for (const ctx of browser.contexts()) for (const p of ctx.pages()) { console.log(p.url(), await p.locator('body').innerText()); console.log(await p.locator('label').allTextContents()); } throw error; } finally {await browser.close();}
