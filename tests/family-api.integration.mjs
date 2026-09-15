// Exercises the production Next route/auth/Redis client against an isolated REST fixture.
// The fixture models Redis GET/CAS; this is not a live Upstash or Google OAuth test.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { encode } from '@auth/core/jwt';
const records = new Map();
function execute(command) {
 const [name,...args]=command;
 if(name.toLowerCase()==='get') return {result:records.get(args[0]) ?? null};
 if(name.toLowerCase()==='eval') {
  const [, , key, revision, next]=args;
  if((JSON.parse(records.get(key)||'{"revision":0}').revision)!==Number(revision)) return {result:0};
  records.set(key,next); return {result:1};
 }
 throw new Error(`Unexpected Redis operation: ${name}`);
}
const store=createServer(async(req,res)=>{
 try {
  let body='';for await(const chunk of req) body+=chunk;
  const command=JSON.parse(body);
  const result=req.url==='/pipeline'?command.map(execute):execute(command);
  res.setHeader('Content-Type','application/json');res.end(JSON.stringify(result));
 }catch(error){res.statusCode=500;res.end(JSON.stringify({error:error.message}));}
});
store.listen(0,'127.0.0.1');await once(store,'listening');
const base='http://127.0.0.1:3106';
const canonicalOrigin='http://oauth.example.invalid';
const secret='isolated-integration-test-secret-not-a-deployed-credential';
const app=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','3106'],{env:{...process.env,AUTH_SECRET:secret,AUTH_TRUST_HOST:'true',AUTH_URL:canonicalOrigin,CLIENT_ID:'fixture.apps.googleusercontent.com',SECRET:'fixture',KV_REST_API_URL:`http://127.0.0.1:${store.address().port}`,KV_REST_API_TOKEN:'fixture'},stdio:['ignore','pipe','pipe']});
let log='';app.stdout.on('data',c=>log+=c);app.stderr.on('data',c=>log+=c);
const cookie=async(email)=>`authjs.session-token=${await encode({token:{email},secret,salt:'authjs.session-token',maxAge:600})}`;
try {
 for(let i=0;i<100;i++){try{await fetch(base);break;}catch{await new Promise(r=>setTimeout(r,100));}}
 const providers=await (await fetch(`${base}/api/auth/providers`)).json();
 assert.equal(providers.google.callbackUrl,`${canonicalOrigin}/api/auth/callback/google`);
 const diagnostics=await (await fetch(`${base}/api/auth/config`)).json();
 assert.equal(diagnostics.clientIdPresent,true);assert.equal(diagnostics.callbackUrl,`${canonicalOrigin}/api/auth/callback/google`);
 assert.ok(!JSON.stringify(diagnostics).includes(secret));
 const first=await cookie('family@example.invalid'), second=await cookie('other@example.invalid');
 const get=(auth=first)=>fetch(`${base}/api/family`,{headers:{Cookie:auth}});
 const post=(revision,command,origin=base)=>fetch(`${base}/api/family`,{method:'POST',headers:{Cookie:first,Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({revision,command})});
 assert.equal((await get('')).status,401);
 const initial=await get();assert.equal(initial.status,200,log);assert.equal((await initial.json()).data.revision,0);
 assert.equal((await post(0,{type:'addTodo',text:'Task',person:'Lilly'},'https://other.invalid')).status,403);
 const saved=await post(0,{type:'addTodo',text:'Task',person:'Lilly'});assert.equal(saved.status,200,await saved.clone().text());
 assert.equal((await (await get()).json()).data.todos[0].text,'Task');
 assert.equal((await (await get(second)).json()).data.todos.length,0);
 assert.equal((await post(0,{type:'addTodo',text:'Stale',person:'Sawyer'})).status,409);
 const races=await Promise.all([post(1,{type:'addTodo',text:'One',person:'Lilly'}),post(1,{type:'addTodo',text:'Two',person:'Sawyer'})]);
 assert.deepEqual(races.map(r=>r.status).sort(),[200,409]);
 const latest=await get();const etag=latest.headers.get('etag');assert.equal((await fetch(`${base}/api/family`,{headers:{Cookie:first,'If-None-Match':etag}})).status,304);
 const data=(await latest.json()).data;
 assert.equal((await post(data.revision,{type:'saveDinner',date:'2026-09-14',title:'Soup',description:'Bread',link:'https://example.org'})).status,200);
 assert.equal((await (await get()).json()).data.dinners[0].title,'Soup');
 const reminder=await post(data.revision+1,{type:'saveImportantEvent',startDate:'2026-10-05',endDate:'2026-10-08',description:'School closed',highImportance:true});assert.equal(reminder.status,200);
 const persisted=(await (await get()).json()).data;assert.equal(persisted.importantEvents[0].description,'School closed');assert.equal(persisted.importantEvents[0].highImportance,true);assert.equal(persisted.dinners[0].title,'Soup');
 console.log('PASS: production API authentication, account isolation, origin checks, Redis-client round trips, dinner/task persistence across requests, conflict/CAS responses, conditional reads. Redis transport and session are fixtures.');
}finally{app.kill('SIGTERM');await once(app,'exit');store.close();}
