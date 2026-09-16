import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { scheduledThemeScript } from '../src/lib/scheduled-theme.ts';
function boot(iso) {
 let now=Date.parse(iso), id=0, writes=0;const timers=new Map();
 const docEvents=new Map(),winEvents=new Map();
 const dataset=new Proxy({}, {set(target,key,value){writes++;target[key]=value;return true;}});
 const document={hidden:false,documentElement:{dataset},addEventListener:(name,fn)=>docEvents.set(name,fn)};
 class ClockDate extends Date {constructor(...args){super(...(args.length?args:[now]));}static now(){return now;}}
 vm.runInNewContext(scheduledThemeScript,{Date:ClockDate,Intl,document,window:{addEventListener:(name,fn)=>winEvents.set(name,fn)},setTimeout:(fn,delay)=>{timers.set(++id,{fn,delay});return id;},clearTimeout:key=>timers.delete(key)});
 return {document,timers,get theme(){return dataset.theme;},get writes(){return writes;},setTime:iso=>now=Date.parse(iso),event:name=>(docEvents.get(name)||winEvents.get(name))(),tick:()=>{const [key,{fn}]=timers.entries().next().value;timers.delete(key);fn();}};
}
test('Denver 9pm and 5am schedule, summer/winter and DST transition days',()=>{
 for(const [iso,expected] of [
  ['2026-09-16T02:59:59Z','light'],['2026-09-16T03:00:00Z','dark'],['2026-09-16T10:59:59Z','dark'],['2026-09-16T11:00:00Z','light'],
  ['2027-01-06T03:59:59Z','light'],['2027-01-06T04:00:00Z','dark'],['2027-01-06T11:59:59Z','dark'],['2027-01-06T12:00:00Z','light'],
  ['2027-03-14T10:59:59Z','dark'],['2027-03-14T11:00:00Z','light'],['2026-11-01T11:59:59Z','dark'],['2026-11-01T12:00:00Z','light'],
  ['2026-09-16T00:00:00Z','light'],['2026-09-16T06:00:00Z','dark']
 ]) assert.equal(boot(iso).theme,expected,iso);
});
test('switches at the boundary, retains one timer and avoids redundant DOM changes',()=>{
 const app=boot('2026-09-16T02:59:59.999Z');assert.equal([...app.timers.values()][0].delay,1);
 app.setTime('2026-09-16T03:00:00Z');app.tick();assert.equal(app.theme,'dark');assert.equal(app.writes,2);assert.equal(app.timers.size,1);
 app.setTime('2026-09-16T03:01:00Z');app.tick();assert.equal(app.writes,2);
 app.setTime('2026-09-16T11:00:00Z');app.tick();assert.equal(app.theme,'light');
});
test('hidden tabs and page cache stop timers and immediately catch up on resume',()=>{
 const app=boot('2026-09-16T02:59:00Z');app.document.hidden=true;app.event('visibilitychange');assert.equal(app.timers.size,0);
 app.setTime('2026-09-16T04:00:00Z');app.document.hidden=false;app.event('visibilitychange');assert.equal(app.theme,'dark');assert.equal(app.timers.size,1);
 app.event('focus');assert.equal(app.timers.size,1);app.event('pagehide');assert.equal(app.timers.size,0);
 app.setTime('2026-09-16T12:00:00Z');app.event('pageshow');assert.equal(app.theme,'light');assert.equal(app.timers.size,1);
});
