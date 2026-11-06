import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import ts from 'typescript';
const source=readFileSync(new URL('../app/components/panel-api.ts',import.meta.url),'utf8');
const module={exports:{}};new Function('module','exports',ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(module,module.exports);
const {panelRequest,PanelRequestError}=module.exports;

test('server requests distinguish expiry, CSRF, service failure and offline without redirects',async()=>{
  const fetchBefore=globalThis.fetch,windowBefore=globalThis.window,events=[];
  globalThis.window={dispatchEvent:event=>events.push(event.detail)};
  try {
    for(const status of [401,419,403,503]) {
      globalThis.fetch=async()=>({ok:false,status,json:async()=>({ok:false,error:'server '+status})});
      await assert.rejects(panelRequest('pages.update',{method:'POST',body:'{}'},'csrf'),error=>error instanceof PanelRequestError && error.status===status);
    }
    assert.deepEqual(events,[401,419]);
    globalThis.fetch=async()=>({ok:false,status:403,json:async()=>({ok:false,error:'CSRF',details:{code:'csrf_expired'}})});
    await assert.rejects(panelRequest('pages.update',{method:'POST',body:'{}'},'stale'),error=>error.status===403 && /Повторите действие/.test(error.message));
    assert.deepEqual(events,[401,419,419]);
    globalThis.fetch=async()=>{throw new TypeError('offline')};
    await assert.rejects(panelRequest('auth.me'),error=>error.status===0);
    assert.deepEqual(events,[401,419,419]);
  }finally{globalThis.fetch=fetchBefore;globalThis.window=windowBefore;}
});

test('cookie auth and refreshed CSRF use no-store; multipart keeps the browser boundary',async()=>{
  const fetchBefore=globalThis.fetch;const calls=[];
  globalThis.fetch=async(url,options)=>{calls.push({url,options});return {ok:true,json:async()=>({ok:true,id:7})}};
  try {
    assert.equal((await panelRequest('pages.update',{method:'POST',body:'{}'},'new-csrf')).id,7);
    const body=new FormData();body.set('image',new Blob(['image']),'qa.png');
    await panelRequest('concepts.upload',{method:'POST',body},'csrf');
    assert.equal(calls[0].options.credentials,'same-origin');assert.equal(calls[0].options.cache,'no-store');assert.equal(calls[0].options.headers['X-CSRF-Token'],'new-csrf');
    assert.equal(calls[1].options.headers['Content-Type'],undefined);assert.strictEqual(calls[1].options.body,body);
  }finally{globalThis.fetch=fetchBefore;}
});

test('auth probing and failed logins do not recursively trigger a session event',async()=>{
  const fetchBefore=globalThis.fetch,windowBefore=globalThis.window;let events=0;
  globalThis.window={dispatchEvent:()=>events++};globalThis.fetch=async()=>({ok:false,status:401,json:async()=>({ok:false,error:'unauthorized'})});
  try{await assert.rejects(panelRequest('auth.me',{},'',false));await assert.rejects(panelRequest('auth.login',{method:'POST',body:'{}'},'',false));assert.equal(events,0);}
  finally{globalThis.fetch=fetchBefore;globalThis.window=windowBefore;}
});
