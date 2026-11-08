import assert from 'node:assert/strict';
const origin=process.env.BYPCMS_CHRONICLE_ORIGIN||'https://demo.bypcms.ru';
let checks=0;
for(const path of ['/chronicle/','/chronicle/articles/','/chronicle/articles/?page=2','/chronicle/category/city/','/chronicle/category/letters/','/chronicle/author/editors/','/chronicle/author/guest/','/chronicle/walkable-city/','/chronicle/about/','/chronicle/contacts/','/chronicle/search/?q=маршрут','/chronicle/search/?q=NO_MATCH_XYZ',...['library-as-place','reading-beyond-headlines','slow-route','old-buildings-new-life','paper-and-screen','home-without-display','attention-needs-structure','bench-in-the-square','light-through-the-day','neighbourhood-memory','repair-as-a-choice','category/culture','category/ideas','category/environment','author/city-desk','author/culture-desk'].map(path=>'/chronicle/'+path+'/')]){
 const r=await fetch(origin+path,{signal:AbortSignal.timeout(30000),cache:'no-store'}),html=await r.text();assert.equal(r.status,200,path);assert.ok(html.includes('chronicle.css')&&html.includes('c-footer')&&!/Fatal error|Warning:/.test(html),path);checks++;
}
for(const path of ['/themes/chronicle/chronicle.css','/themes/chronicle/chronicle.js','/themes/chronicle/theme.json','/themes/chronicle/assets/manrope.woff2','/themes/chronicle/assets/cormorant.woff2',...Array.from({length:8},(_,i)=>'/themes/chronicle/assets/editorial-'+(i+1)+'-480.webp')]){
 const r=await fetch(origin+path,{signal:AbortSignal.timeout(30000)});assert.equal(r.status,200,path);assert.ok(!r.headers.get('content-type')?.includes('text/html'),path);assert.ok((await r.arrayBuffer()).byteLength>100,path);checks++;
}
let r=await fetch(origin+'/chronicle/missing-story/');assert.equal(r.status,404);await r.text();checks++;
r=await fetch(origin+'/chronicle/articles/?month=13');assert.equal(r.status,400);assert.ok((await r.text()).includes('role="alert"'));checks++;
r=await fetch(origin+'/chronicle/feed.xml');assert.equal(r.status,200);assert.match(r.headers.get('content-type'),/rss\+xml/);assert.equal(((await r.text()).match(/<item>/g)||[]).length,12);checks++;
r=await fetch(origin+'/chronicle/preview.php',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({entity:{id:2,kind:'articles',slug:'/',title:'CHRONICLE_UNSAVED_PROOF',body:'<h2>UNSAVED_BODY_PROOF</h2>'},entities:[],settings:{siteName:'Chronicle QA'},appearance:{accent:'#a82b24'}})});
assert.equal(r.status,200);const snapshot=await r.json();assert.ok(snapshot.url);const cookie=r.headers.getSetCookie().map(v=>v.split(';')[0]).join('; ');
r=await fetch(origin+snapshot.url,{headers:{Cookie:cookie}});const html=await r.text();assert.equal(r.status,200);assert.ok(html.includes('CHRONICLE_UNSAVED_PROOF')&&html.includes('UNSAVED_BODY_PROOF')&&r.headers.get('x-robots-tag').includes('noindex'));checks++;
r=await fetch(origin+snapshot.url);assert.equal(r.status,410);await r.text();checks++;
console.log(JSON.stringify({origin,chronicle:'verified',checks}));
