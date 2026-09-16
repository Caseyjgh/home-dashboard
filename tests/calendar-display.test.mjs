import assert from 'node:assert/strict';
import test from 'node:test';
import { calendarEventTime, upcomingCalendarDays } from '../src/lib/calendar-display.ts';
test('upcoming uses existing cache dates and selected calendars, with at most seven dates', () => {
 const events = Array.from({length:12},(_,i)=>({id:String(i),calendarId:'family',calendarName:'Family',title:'Event',start:`2026-09-${15+i}`,end:`2026-09-${16+i}`,allDay:true,days:[`2026-09-${15+i}`]}));
 events.push({...events[1],id:'hidden',calendarId:'hidden'});
 const groups=upcomingCalendarDays(events,['family'],'2026-09-15');
 assert.equal(groups.length,7);assert.equal(groups[0].date,'2026-09-16');assert.equal(groups[0].events.length,1);
 assert.equal(calendarEventTime(events[0],'America/Denver'),'All day');
 assert.equal(calendarEventTime({...events[0],allDay:false,start:'2026-09-15T16:00:00Z',end:'2026-09-15T17:00:00Z'},'America/Denver'),'10:00 AM – 11:00 AM');
});
