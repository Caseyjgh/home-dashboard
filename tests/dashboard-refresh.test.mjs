import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import fs from 'node:fs';
import ts from 'typescript';
import { getDenverDateKey } from '../lib/schoolCalendars.ts';
import { startDashboardReload, DASHBOARD_RELOAD_INTERVAL } from '../src/lib/dashboard-reload.ts';

// Load the actual TS helper with its existing extensionless Next.js import.
const exports = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(new URL('../src/lib/active-important-events.ts', import.meta.url), 'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText, {exports, require:()=>({getDenverDateKey})});
const {activeImportantEvents} = exports;
test('reminders expire after their inclusive Denver end date, without deleting history', () => {
 const entries = [{id:'single',startDate:'2026-09-28',endDate:''}, {id:'range',startDate:'2026-09-27',endDate:'2026-09-29'}, {id:'future',startDate:'2026-10-01',endDate:''}];
 const ids = iso => Array.from(activeImportantEvents(entries, new Date(iso)), e=>e.id);
 assert.deepEqual(ids('2026-09-29T05:59:59Z'), ['single','range','future']);
 assert.deepEqual(ids('2026-09-29T06:00:00Z'), ['range','future']);
 assert.deepEqual(ids('2026-09-30T06:00:00Z'), ['future']);
 assert.equal(entries.length,3);
 assert.equal(activeImportantEvents(entries,null).length,0);
 const winter=[{startDate:'2027-01-05',endDate:''}];
 assert.equal(activeImportantEvents(winter,new Date('2027-01-06T06:59:59Z')).length,1);
 assert.equal(activeImportantEvents(winter,new Date('2027-01-06T07:00:00Z')).length,0);
});
test('two-hour reload defers offline, hidden, and editing; listeners and timers clean up', t => {
 t.mock.timers.enable({apis:['Date','setTimeout'],now:0});
 const document = Object.assign(new EventTarget(),{hidden:false});
 const window = new EventTarget();
 const navigator = {onLine:true};
 for(const [name,value] of Object.entries({document,window,navigator})) {
  const original=Object.getOwnPropertyDescriptor(globalThis,name);
  Object.defineProperty(globalThis,name,{configurable:true,value});
  t.after(()=>original ? Object.defineProperty(globalThis,name,original) : delete globalThis[name]);
 }
 let count=0, safe=true;
 let stop=startDashboardReload(()=>safe,()=>count++,DASHBOARD_RELOAD_INTERVAL);
 t.mock.timers.tick(DASHBOARD_RELOAD_INTERVAL-1);assert.equal(count,0);
 t.mock.timers.tick(1);assert.equal(count,1);
 window.dispatchEvent(new Event('focus'));assert.equal(count,1);stop();
 safe=false;
 stop=startDashboardReload(()=>safe,()=>count++,Date.now()+DASHBOARD_RELOAD_INTERVAL);
 t.mock.timers.tick(DASHBOARD_RELOAD_INTERVAL);assert.equal(count,1);
 t.mock.timers.tick(30_000);assert.equal(count,1);
 safe=true;document.hidden=true;
 window.dispatchEvent(new Event('focus'));assert.equal(count,1);
 document.hidden=false;navigator.onLine=false;
 document.dispatchEvent(new Event('visibilitychange'));assert.equal(count,1);
 navigator.onLine=true;window.dispatchEvent(new Event('online'));assert.equal(count,2);stop();
 stop=startDashboardReload(()=>true,()=>count++,Date.now()+DASHBOARD_RELOAD_INTERVAL);
 stop();t.mock.timers.tick(DASHBOARD_RELOAD_INTERVAL);window.dispatchEvent(new Event('focus'));assert.equal(count,2);
});
