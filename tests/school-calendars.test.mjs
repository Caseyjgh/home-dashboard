import assert from 'node:assert/strict';
import test from 'node:test';
import { getSchoolDayStatuses, getWcaDayType, getWhsDayType, getDenverDateKey } from '../lib/schoolCalendars.ts';

test('verified WCA dates', () => {
  for (const [date, status] of Object.entries({'2026-09-15':'blue','2026-09-16':'green','2026-11-25':'no-school','2027-01-05':'green','2027-01-06':'blue','2027-03-24':'no-school','2027-05-20':'blue'})) assert.equal(getWcaDayType(date),status,date);
});
test('verified WHS dates and unclassified special date', () => {
  for (const [date, status] of Object.entries({'2026-09-15':'maroon','2026-09-16':'gold','2026-09-21':'gold','2026-09-22':'maroon','2027-02-16':'gold','2027-02-17':'maroon','2027-05-19':'gold','2027-05-20':'maroon','2027-03-15':null})) assert.equal(getWhsDayType(date),status,date);
});
test('Denver midnight determines rotation in summer and winter, never UTC midnight', () => {
  assert.deepEqual(getSchoolDayStatuses(new Date('2026-09-16T00:00:00Z')), {dateKey:'2026-09-15',wca:'blue',whs:'maroon'});
  assert.equal(getDenverDateKey(new Date('2026-09-16T05:59:59Z')),'2026-09-15');
  assert.deepEqual(getSchoolDayStatuses(new Date('2026-09-16T06:00:00Z')), {dateKey:'2026-09-16',wca:'green',whs:'gold'});
  assert.equal(getWcaDayType(new Date('2027-01-06T06:59:59Z')),'green');
  assert.equal(getWcaDayType(new Date('2027-01-06T07:00:00Z')),'blue');
  assert.deepEqual(getSchoolDayStatuses('2030-01-01'),{dateKey:'2030-01-01',wca:null,whs:null});
});
