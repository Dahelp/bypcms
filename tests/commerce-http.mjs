// Disposable loopback fixture; no production purchases or emails.
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
const origin='http://127.0.0.1:8019';
const fixture=JSON.parse(await readFile(process.argv[2],'utf8'));let checks=0;
async function call(action,body,cookie='',csrf=''){const r=await fetch(origin+'/commerce/index.php?action='+action,{method:body===undefined?'GET':'POST',headers:{Cookie:cookie,'Content-Type':'application/json','X-CSRF-Token':csrf},body:body===undefined?undefined:JSON.stringify(body),redirect:'manual'});return {r,json:await r.json()};}
function check(value,message){assert.ok(value,message);checks++;}
let {r,json}=await call('bootstrap');check(r.status===200&&json.catalog.modules.length>0,'published module catalog');let cookie=r.headers.getSetCookie().at(-1).split(';')[0];
for(const action of ['owner.status','order&id='+fixture.order_id])check((await call(action)).r.status===401,'anonymous denied '+action);
check((await call('owner.settings',{})).r.status===401,'anonymous cannot change settings');
let page=await fetch(origin+'/account/?next='+encodeURIComponent('/order/?edition=content'),{headers:{Cookie:cookie}});let html=await page.text();check(!html.includes('Warning'),'no PHP warnings');let csrf=html.match(/name="csrf" value="([a-f0-9]+)"/)[1];
const login=await fetch(origin+'/account/',{method:'POST',redirect:'manual',headers:{Cookie:cookie,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({csrf,action:'login',email:fixture.email,password:'BYPCMS-QA-Buyer-2026',next:'/order/?edition=content'})});check(login.status===302&&login.headers.get('location')==='/order/?edition=content','exact checkout return after login');cookie=login.headers.getSetCookie().at(-1).split(';')[0];
({json}=await call('bootstrap',undefined,cookie));csrf=json.csrf;
const body={edition:'content',term:'annual',domain:'qa.example.test',operation_id:randomBytes(16).toString('hex')};
check((await call('create',body,cookie,'invalid')).r.status===403,'customer CSRF enforced');
const first=await call('create',body,cookie,csrf),second=await call('create',body,cookie,csrf);check(first.r.status===200&&first.json.order.id===second.json.order.id,'HTTP repeat creates one order');
check((await call('order&id=1',undefined,cookie)).r.status===404,'buyer cannot read another order');
check((await call('owner.status',undefined,cookie)).r.status===401,'customer is not platform owner');
let owner=await fetch(origin+'/api/index.php?action=auth.login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'qa-owner@example.test',password:'BYPCMS-QA-Owner-2026'})});let ownerJson=await owner.json();check(owner.status===200,'owner login');const ownerCookie=owner.headers.getSetCookie().at(-1).split(';')[0];
const state=await call('owner.status',undefined,ownerCookie);check(state.r.status===200&&!JSON.stringify(state.json).includes('qa-payment-secret')&&!JSON.stringify(state.json).includes('qa-smtp-password'),'owner response secrets masked');
check(state.json.outbox.length<=40&&state.json.orders.length<=20,'bounded pages');
const search=await call('owner.status&q='+encodeURIComponent(fixture.email),undefined,ownerCookie);check(search.r.status===200&&search.json.orders.every(o=>o.email===fixture.email),'search across server-side order pages');
check((await call('owner.sync',{id:first.json.order.id},ownerCookie,ownerJson.csrf)).r.status===422,'bulk member without payment reports per-row reason');
check((await call('owner.settings',{payments_enabled:false},ownerCookie,'invalid')).r.status===403,'owner CSRF enforced');
const editor=await fetch(origin+'/api/index.php?action=auth.login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'qa-editor@example.test',password:'BYPCMS-QA-Editor-2026'})});check(editor.status===200,'editor login');const editorCookie=editor.headers.getSetCookie().at(-1).split(';')[0];check((await call('owner.status',undefined,editorCookie)).r.status===403,'editor cannot read payment settings');
const unknown=await call('webhook',{type:'notification',event:'payment.succeeded',object:{id:'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'}});check(unknown.r.status===200,'unrelated webhook ignored');
// Unsafe return URLs are discarded without leaving the site.
page=await fetch(origin+'/account/?next='+encodeURIComponent('//evil.test/'));html=await page.text();check(html.includes('name="next" value="/account/"'),'open redirect rejected');
console.log(`${checks} commerce authentication/CSRF/idempotence HTTP checks passed`);
