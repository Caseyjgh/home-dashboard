import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readAuthConfig,authDiagnostics,authOrigin} from '../src/lib/auth-config.ts';
const credentials={CLIENT_ID:'123-example.apps.googleusercontent.com',SECRET:'test-client-secret',AUTH_SECRET:'test-session-secret'};
test('existing variable names initialize the provider and diagnostics omit secrets',()=>{
 const config=readAuthConfig(credentials);assert.equal(config.clientId,credentials.CLIENT_ID);assert.equal(config.clientSecret,credentials.SECRET);
 const diagnostics=authDiagnostics({...credentials,AUTH_URL:'https://home.example'},'http://localhost:3000');
 assert.equal(diagnostics.callbackUrl,'https://home.example/api/auth/callback/google');assert.equal(diagnostics.clientIdPresent,true);
 for(const secret of Object.values(credentials))assert.ok(!JSON.stringify(diagnostics).includes(secret));
});
test('missing, blank, quoted and swapped credentials fail without leaking their values',()=>{
 for(const name of ['CLIENT_ID','SECRET','AUTH_SECRET'])for(const value of [undefined,'','  '])assert.throws(()=>readAuthConfig({...credentials,[name]:value}),new RegExp(`Missing ${name}`));
 for(const value of [' '+credentials.CLIENT_ID,'"'+credentials.CLIENT_ID+'"',credentials.SECRET])assert.throws(()=>readAuthConfig({...credentials,CLIENT_ID:value}),/OAuth configuration/);
 assert.throws(()=>readAuthConfig({AUTH_GOOGLE_ID:credentials.CLIENT_ID,AUTH_GOOGLE_SECRET:credentials.SECRET,AUTH_SECRET:credentials.AUTH_SECRET}),/Missing CLIENT_ID/);
});
test('canonical URLs use branch/production aliases and never ephemeral VERCEL_URL',()=>{
 const env={VERCEL:'1',VERCEL_ENV:'preview',VERCEL_BRANCH_URL:'home-git-pi5.example',VERCEL_PROJECT_PRODUCTION_URL:'home.example',VERCEL_URL:'temporary.example'};
 assert.equal(authOrigin(env),'https://home-git-pi5.example');assert.equal(authOrigin({...env,VERCEL_ENV:'production'}),'https://home.example');
 assert.equal(authOrigin({...env,AUTH_URL:'https://pi.example'}),'https://pi.example');
 assert.equal(authOrigin({NEXTAUTH_URL:'https://home.example/api/auth'}),'https://home.example');
 assert.throws(()=>authOrigin({...env,AUTH_URL:'https://home.example'}),/points at Production/);
 assert.throws(()=>authOrigin({...env,AUTH_URL:'http://localhost:3000'}),/public HTTPS/);
 assert.throws(()=>authOrigin({...env,AUTH_URL:'https://pi.example',NEXTAUTH_URL:'https://old.example'}),/disagree/);
 assert.throws(()=>authOrigin({VERCEL:'1',VERCEL_URL:'temporary.example'}),/stable public origin/);
});
