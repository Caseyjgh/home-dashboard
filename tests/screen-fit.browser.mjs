import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,chromiumSandbox:true});
const base=process.env.KIOSK_TEST_URL||'http://127.0.0.1:3105';
const context=await browser.newContext({viewport:{width:1920,height:1080},timezoneId:'America/Denver'});
const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.clock.install({time:new Date('2026-09-13T18:00:30Z')});
await context.route('**/api/weather',route=>route.fulfill({json:{forecast:{location:'Test town',date:'2026-09-13',high:75,low:48,code:2}}}));
await context.route('**/api/family',route=>route.fulfill({json:{data:{version:1,revision:1,legacyImports:[],dinners:[{id:'d',date:'2026-09-13',title:'Lemon chicken',description:'Rice and roasted vegetables',link:''}],todos:Array.from({length:40},(_,i)=>({id:String(i),text:`Task ${i+1}`,person:i<20?'Lilly':'Sawyer',completed:false,sortOrder:i,createdAt:'2026-09-13T12:00:00Z'}))}}}));
await context.route('**/api/calendar',route=>route.fulfill({json:{configured:true,authenticated:true,missingVariables:[],calendarAccess:true,selectedIds:['family'],account:{email:'test@example.invalid'},cache:{rangeStart:'2026-08-01',rangeEnd:'2026-12-01',timeZone:'America/Denver',refreshedAt:'2026-09-13T17:00:00Z',events:Array.from({length:30},(_,i)=>({id:`e${i}`,calendarId:'family',calendarName:'Family',title:`Event ${i+1}`,start:'2026-09-13',end:'2026-09-14',allDay:true,days:['2026-09-13']}))}}}));
try{
 await page.goto(base);await page.getByText('Event 1',{exact:true}).waitFor();
 for(const [width,height] of [[1920,1080],[1366,768],[1024,600],[390,844]]){
  await page.setViewportSize({width,height});await page.waitForTimeout(200);
  assert.deepEqual(await page.evaluate(()=>({x:document.documentElement.scrollWidth>innerWidth,y:document.documentElement.scrollHeight>innerHeight})),{x:false,y:false});
  assert.ok(await page.locator('.header-date').isVisible());assert.ok(await page.locator('.header-weather').isVisible());
  const scrolling=await page.locator('.home-grid,.calendar-panel,.dinner-card,.todos-card,.fit-list').evaluateAll(nodes=>nodes.filter(n=>['auto','scroll'].includes(getComputedStyle(n).overflowY)&&n.scrollHeight>n.clientHeight).length);assert.equal(scrolling,0);
  const controls=await page.locator('.home-grid button,.todo-check,.navigation-menu summary').evaluateAll(nodes=>nodes.filter(n=>n.getClientRects().length).filter(n=>n.getBoundingClientRect().height<44).map(n=>n.outerHTML));assert.deepEqual(controls,[]);
  await page.screenshot({path:`/tmp/home-dashboard-fit-${width}.png`});
 }
 const next=page.getByRole('button',{name:'Next calendar events',exact:true});
 while(await next.isEnabled())await next.click();
 await page.getByText('Event 30',{exact:true}).waitFor();
 const tasks=page.getByRole('button',{name:'Next Lilly tasks',exact:true});while(await tasks.isEnabled())await tasks.click();await page.getByText('Task 20',{exact:true}).waitFor();
 assert.deepEqual(errors,[]);console.log('PASS: no document or panel scrolling at 1920×1080, 1366×768, 1024×600 and 390×844; date/forecast visible; 44px controls; all overflow events/tasks reachable by pages.');
}catch(error){console.log(await page.locator("body").innerText());console.log(errors);await page.screenshot({path:"/tmp/screen-fit-failure.png"});throw error;}finally{await browser.close();}
