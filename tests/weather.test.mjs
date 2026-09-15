import {test} from 'node:test';
import assert from 'node:assert/strict';
import {weatherDescription} from '../src/lib/weather.ts';
test('forecast WMO codes describe clear, rain, snow and storm days',()=>{
 for(const [code,label] of [[0,'Clear'],[2,'Partly cloudy'],[3,'Cloudy'],[45,'Fog'],[51,'Drizzle'],[63,'Rain'],[73,'Snow'],[80,'Showers'],[85,'Snow showers'],[95,'Thunderstorms']])assert.equal(weatherDescription(code),label);
});
