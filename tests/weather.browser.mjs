import assert from 'node:assert/strict';
import {weatherFixture} from './weather-fixture.mjs';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,chromiumSandbox:true});
const context=await browser.newContext({viewport:{width:1920,height:1080}});const page=await context.newPage();
const errors=[];page.on('pageerror',e=>errors.push(e.message));let reads=0,fail=false;
await context.route('**/api/weather',route=>{reads++;return route.fulfill({status:fail?503:200,json:fail?{error:'Unavailable'}:{forecast:weatherFixture}});});
await context.route('**/api/calendar',route=>route.fulfill({json:{configured:true,authenticated:false,missingVariables:[],cache:null,selectedIds:[]}}));
await context.route('**/api/family',route=>route.fulfill({status:401,json:{error:'Sign in'}}));
try{
 await page.clock.install({time:new Date('2026-09-15T18:00:00Z')});
 await page.goto(process.env.KIOSK_TEST_URL||'http://127.0.0.1:3105');await page.locator('.weather-temperature').waitFor();assert.equal(reads,1);
 assert.match(await page.locator('.weather-current').innerText(),/72°.*F/s);assert.match(await page.locator('.weather-current').innerText(),/Partly cloudy/);assert.match(await page.locator('.weather-details').innerText(),/High 78° · Low 48° · Precip 10%/);assert.equal(await page.locator('.weather-days li').count(),5);
 for(const [width,height] of [[1920,1080],[1366,768],[1024,600],[390,844]]){
  await page.setViewportSize({width,height});await page.waitForTimeout(100);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth||document.documentElement.scrollHeight>innerHeight),false);
  assert.equal(await page.locator('.weather-card').evaluate(n=>n.scrollHeight>n.clientHeight),false,`Weather clipped at ${width}`);
  await page.screenshot({path:`/tmp/windsor-weather-${width}.png`});
 }
 await page.clock.runFor(14*60000);assert.equal(reads,1);fail=true;await page.clock.runFor(61000);await page.getByText('Saved forecast',{exact:false}).waitFor();assert.equal(reads,2);assert.equal(await page.locator('.weather-days li').count(),5);
 await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});await page.clock.runFor(60*60000);assert.equal(reads,2);
 await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:false});document.dispatchEvent(new Event('visibilitychange'));});fail=false;await page.clock.runFor(10);await page.waitForFunction(()=>!document.querySelector('.weather-extras').textContent.includes('Saved forecast'));
 fail=true;await page.reload();await page.getByText('Weather is temporarily unavailable.',{exact:false}).waitFor();assert.ok(await page.locator('.calendar-panel').isVisible());
 assert.deepEqual(errors,[]);console.log('PASS: weather fields/5-day forecast, one shared request, 15-minute interval, hidden pause, failure retention/recovery and non-blocking cold failure; responsive card fits four viewport sizes.');
}finally{await browser.close();}
