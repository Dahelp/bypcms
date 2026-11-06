import assert from 'node:assert/strict';
import test from 'node:test';
import {applicationAssets,verifySite} from '../scripts/verify-deployment.mjs';
const page='https://demo.example.test/';
const html='<link rel="stylesheet" href="/_next/static/style.css"><script src="/_next/static/app.js"></script><script src="/_next/static/app.js"></script>';
test('deployment checks use unique scripts and styles on the actual site origin',()=>{
 assert.deepEqual(applicationAssets(html,page),[page+'_next/static/style.css',page+'_next/static/app.js']);
 assert.throws(()=>applicationAssets('<script src="https://main.example.test/_next/app.js"></script>',page),/own origin/);
});
test('uploaded HTML with a missing CSS file cannot pass deployment verification',async()=>{
 const fetcher=async url=>new Response(url===page?html:'not found',{status:url.endsWith('.css')?404:200,headers:{'content-type':url.endsWith('.js')?'application/javascript':'text/html'}});
 await assert.rejects(verifySite(page,{fetcher,attempts:1}),/style.css HTTP 404/);
});
test('valid local assets pass, but an HTML fallback returned for JavaScript fails',async()=>{
 const fetcher=async url=>new Response(url===page?html:'asset',{headers:{'content-type':url.endsWith('.css')?'text/css':url.endsWith('.js')?'application/javascript':'text/html'}});
 assert.equal((await verifySite(page,{fetcher,attempts:1})).assets,2);
 await assert.rejects(verifySite(page,{fetcher:async url=>new Response(url===page?html:'fallback',{headers:{'content-type':'text/html'}}),attempts:1}),/invalid content type/);
});
