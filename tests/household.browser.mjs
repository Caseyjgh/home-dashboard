// UI contract tests with a shared in-memory API fixture; live Redis/OAuth are not exercised.
import assert from 'node:assert/strict';
import { applyFamilyCommand, emptyFamily } from '../src/lib/family-model.ts';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true, chromiumSandbox: true });
const base = process.env.KIOSK_TEST_URL || 'http://127.0.0.1:3105';
let data = emptyFamily(), id = 0;
const errors = [];
async function device() {
 const context = await browser.newContext({viewport:{width:1920,height:1080},timezoneId:'America/Denver'});
 await context.route('**/api/calendar**', route => route.fulfill({json:{configured:true,authenticated:true,calendarAccess:true,selectedIds:[],cache:null,account:{email:'test@example.invalid'}}}));
 await context.route('**/api/family', route => {
  if (route.request().method() === 'POST') {
   const body = route.request().postDataJSON();
   if (body.revision !== data.revision) return route.fulfill({status:409,json:{error:'Another device saved first.',data}});
   try { data = applyFamilyCommand(data,body.command,{id:()=>String(++id),now:new Date().toISOString(),hash:value=>value}); }
   catch(error) { return route.fulfill({status:error.status || 400,json:{error:error.message,data}}); }
  }
  return route.fulfill({json:{data}});
 });
 const page = await context.newPage(); page.on('pageerror', e=>errors.push(e.message));
 return {context,page};
}
try {
 const {page,context} = await device();
 await page.goto(`${base}/dinner`);
 await page.getByLabel('Title',{exact:true}).fill('Lemon chicken');
 await page.getByLabel('Description',{exact:true}).fill('Rice and roasted vegetables');
 await page.getByLabel('Recipe Link',{exact:true}).fill('https://example.org/recipe');
 await page.getByRole('button',{name:'Save dinner',exact:true}).click();
 await page.getByText('Dinner saved.',{exact:true}).waitFor();
 await page.reload();
 await page.getByLabel('Title',{exact:true}).waitFor();
 await page.waitForFunction(()=>document.querySelector('input[maxlength="200"]').value==='Lemon chicken');
 await page.goto(base);
 const card=page.getByRole('link',{name:/Lemon chicken/}); await card.waitFor();
 assert.equal(await card.getAttribute('target'),'_blank');
 assert.equal(await card.getAttribute('href'),'https://example.org/recipe');
 assert.ok(!(await card.textContent()).includes('https://'));
 await context.route('https://example.org/recipe',route=>route.fulfill({body:'Recipe'}));
 const popupPromise=page.waitForEvent('popup'); await card.click(); const popup=await popupPromise; await popup.waitForLoadState(); assert.equal(popup.url(),'https://example.org/recipe'); await popup.close();
 const widths=await page.evaluate(()=>[document.querySelector('.calendar-panel').getBoundingClientRect().width,document.querySelector('.household-column').getBoundingClientRect().width]);
 assert.ok(widths[0]/(widths[0]+widths[1])>=.70 && widths[0]/(widths[0]+widths[1])<=.75);
 for (const [width,height] of [[1920,1080],[1366,768],[390,844]]) {
  await page.setViewportSize({width,height});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  if(width===1920) assert.equal(await page.evaluate(()=>document.documentElement.scrollHeight>innerHeight),false);
 }
 await page.setViewportSize({width:1920,height:1080});
 await page.goto(`${base}/todos`);
 for (const text of ['Feed cat','Pack bag']) {
  await page.getByLabel('New task for Lilly').fill(text); await page.getByRole('button',{name:'Add task for Lilly',exact:true}).click(); await page.getByRole('checkbox',{name:text,exact:true}).waitFor();
 }
 await page.getByLabel('New task for Sawyer').fill('Water plants'); await page.getByRole('button',{name:'Add task for Sawyer',exact:true}).click(); await page.getByRole('checkbox',{name:'Water plants',exact:true}).waitFor();
 await page.getByRole('button',{name:'Move Pack bag up',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('.editable-todos .todo-check').textContent==='Pack bag');
 await page.getByRole('checkbox',{name:'Feed cat',exact:true}).click();
 await page.getByText('Completed ·',{exact:false}).waitFor();
 await page.goto(base); await page.getByRole('checkbox',{name:'Pack bag',exact:true}).waitFor();
 assert.equal(await page.getByRole('checkbox',{name:'Feed cat',exact:true}).count(),0);
 const second=await device(); await second.page.goto(base); await second.page.getByRole('checkbox',{name:'Pack bag',exact:true}).waitFor(); await second.page.getByRole('link',{name:/Lemon chicken/}).waitFor();
 await page.goto(`${base}/todos`); await page.getByRole('checkbox',{name:'Feed cat',exact:true}).click();
 await page.getByRole('button',{name:'Edit Feed cat',exact:true}).click(); await page.getByLabel('Task text').fill('Feed dog'); await page.getByRole('combobox',{name:/Person/}).selectOption('Sawyer'); await page.getByRole('button',{name:'Save task',exact:true}).click(); await page.getByRole('checkbox',{name:'Feed dog',exact:true}).waitFor();
 await page.getByRole('button',{name:'Delete Feed dog',exact:true}).click(); await page.getByRole('button',{name:'Confirm delete task',exact:true}).click(); await page.getByRole('checkbox',{name:'Feed dog',exact:true}).waitFor({state:'detached'});
 await page.goto(`${base}/dinner`); await page.getByLabel('Title',{exact:true}).fill('Updated dinner'); await page.getByLabel('Date',{exact:true}).fill('2026-10-01'); await page.getByRole('button',{name:'Save dinner',exact:true}).click(); await page.getByText('Dinner saved.',{exact:true}).waitFor();
 assert.equal(data.dinners.length,1); assert.equal(data.dinners[0].date,'2026-10-01');
 await page.getByRole('button',{name:'Delete dinner',exact:true}).click(); await page.getByRole('button',{name:'Confirm delete dinner',exact:true}).click(); await page.getByText('Dinner deleted.',{exact:true}).waitFor(); assert.equal(data.dinners.length,0);
 await page.goto(`${base}/settings`); await page.getByRole('heading',{name:'Settings',exact:true}).waitFor();
 await page.getByText('Menu',{exact:true}).click();
 for(const title of ['Home','Edit Dinner','Edit To-Dos','Calendar Settings','Settings']) assert.ok(await page.getByRole('navigation').getByRole('link',{name:title,exact:true}).isVisible());
 assert.deepEqual(errors,[]);
 console.log('PASS: dinner CRUD/date move/recipe popup, task CRUD/completion/reorder/reassignment, shared fixture across devices/reload, responsive layout, navigation; no browser errors.');
 await second.context.close(); await context.close();
} finally { await browser.close(); }
