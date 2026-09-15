import {test} from 'node:test';
import assert from 'node:assert/strict';
import {weatherDescription} from '../src/lib/weather.ts';
test('forecast WMO codes describe clear, rain, snow and storm days',()=>{
 for(const [code,label] of [[0,'Clear'],[2,'Partly cloudy'],[3,'Cloudy'],[45,'Fog'],[51,'Drizzle'],[63,'Rain'],[73,'Snow'],[80,'Showers'],[85,'Snow showers'],[95,'Thunderstorms']])assert.equal(weatherDescription(code),label);
});
import {parseWeatherResponse} from '../src/lib/weather-response.ts';
const payload={current:{time:'2026-09-15T12:00',temperature_2m:72,apparent_temperature:70,weather_code:0,wind_speed_10m:8},daily:{time:Array.from({length:7},(_,i)=>`2026-09-${15+i}`),weather_code:[0,2,3,61,71,95,45],temperature_2m_max:[80,81,82,83,84,85,86],temperature_2m_min:[40,41,42,43,44,45,46],precipitation_probability_max:[0,10,20,30,40,50,60]}};
test('normalizes current weather and seven days with units already supplied by Open-Meteo',()=>{
 const result=parseWeatherResponse(payload);assert.equal(result.location,'Windsor, Colorado');assert.equal(result.current.temperature,72);assert.equal(result.current.feelsLike,70);assert.equal(result.current.wind,8);assert.equal(result.days.length,7);assert.equal(result.days[0].precipitation,0);assert.equal(result.days[6].high,86);
});
test('missing current data and incomplete forecasts fail; missing optional values remain unknown',()=>{
 assert.throws(()=>parseWeatherResponse({}),/Invalid weather/);
 assert.throws(()=>parseWeatherResponse({...payload,daily:{...payload.daily,time:[]}}),/Incomplete/);
 const result=parseWeatherResponse({...payload,current:{...payload.current,apparent_temperature:null},daily:{...payload.daily,precipitation_probability_max:[null,10,20,30,40,50,60]}});assert.equal(result.current.feelsLike,null);assert.equal(result.days[0].precipitation,null);
 assert.equal(weatherDescription(999),'Unavailable');assert.equal(weatherDescription(66),'Freezing rain');
});
