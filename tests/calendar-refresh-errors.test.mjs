import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import fs from 'node:fs';
import ts from 'typescript';

function load(fetch) {
 const exports = {};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(new URL('../src/lib/google-calendar.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{exports,fetch,URLSearchParams,Intl,Date,setTimeout:fn=>fn(),process:{env:{}}});
 return exports;
}
test('403 identifies the failed calendar without returning a partial replacement cache or exposing Google messages', async () => {
 const responses=[{items:[]},{error:{message:'sensitive upstream detail',errors:[{reason:'forbidden'}]}}];
 let calls=0;
 const api=load(async()=>new Response(JSON.stringify(responses[calls]),{status:calls++===0?200:403}));
 await assert.rejects(api.fetchEventsForCalendars('private-token',[{id:'a',name:'Family'},{id:'b',name:'School'}],'America/Denver'), error=>{
  assert.equal(error.calendarName,'School');
  const result=api.calendarRefreshFailure(error);
  assert.match(result.error,/School/);assert.match(result.error,/forbidden/);assert.match(result.error,/deselect/);
  assert.doesNotMatch(result.error,/private-token|sensitive upstream/);assert.equal(result.reconnect,false);
  return true;
 });
 assert.equal(calls,2);
});
test('permission, quota, disabled API and internal failures give appropriate actions',()=>{
 const api=load(()=>{});
 for(const [status,reason,match,reconnect] of [[403,'ACCESS_TOKEN_SCOPE_INSUFFICIENT',/Reconnect Google Calendar/,true],[401,'refresh_failed',/Reconnect Google Calendar/,true],[403,'rateLimitExceeded',/request limit/,false],[403,'SERVICE_DISABLED',/Enable it in Google Cloud Console/,false],[500,undefined,/try again later/,false]]) {
  const result=api.calendarRefreshFailure(new api.GoogleCalendarError(status,'secret upstream detail',reason));
  assert.match(result.error,match);assert.equal(result.reconnect,reconnect);assert.doesNotMatch(result.error,/secret upstream/);
 }
});
test('retryable quota error retains bounded retries and safe reason',async()=>{
 let calls=0;
 const api=load(async()=>{calls++;return new Response(JSON.stringify({error:{errors:[{reason:'rateLimitExceeded'}]}}),{status:403});});
 await assert.rejects(api.fetchEventsForCalendars('token',[{id:'a',name:'Family'}],'America/Denver'),error=>error.reason==='rateLimitExceeded');
 assert.equal(calls,4);
});
