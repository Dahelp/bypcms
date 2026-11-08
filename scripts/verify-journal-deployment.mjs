import assert from'node:assert/strict';
const origin=process.env.BYPCMS_JOURNAL_ORIGIN||'https://demo.bypcms.ru';
for(const path of ['/journal/','/journal/articles/','/journal/space-and-light/','/journal/category/architecture/','/journal/author/journal/','/journal/search/?q=свет']){
 const r=await fetch(origin+path,{signal:AbortSignal.timeout(30000),cache:'no-store'});const html=await r.text();assert.equal(r.status,200,path);assert.ok(html.includes('journal.css')&&html.includes('j-footer'),path);assert.ok(!html.includes('Fatal error')&&!html.includes('Warning:'),path);
}
for(const path of ['/themes/journal/journal.css','/themes/journal/admin.js','/themes/journal/assets/story-1.jpg','/themes/journal/assets/manrope.ttf','/themes/journal/assets/cormorant.ttf']){const r=await fetch(origin+path,{signal:AbortSignal.timeout(30000)});assert.equal(r.status,200,path);assert.ok(!r.headers.get('content-type')?.includes('text/html'),path);await r.arrayBuffer();}
const missing=await fetch(origin+'/journal/no-such-story/');assert.equal(missing.status,404);await missing.text();
console.log(JSON.stringify({origin,journal:'verified',routes:7,assets:5}));

const preview=await fetch(origin+'/journal/preview.php',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({entities:[{id:1,kind:'pages',status:'Опубликовано',slug:'/',title:'OTHER_HOME'}],entity:{id:2,kind:'articles',slug:'/',title:'JOURNAL_UNSAVED_PREVIEW_PROOF',body:'<p>UNSAVED_BODY_PROOF</p>'},settings:{siteName:'Journal'},appearance:{accent:'#b7472f'}})});
assert.equal(preview.status,200,'unsaved preview endpoint');const snapshot=await preview.json();assert.ok(snapshot.url,'snapshot URL');const cookie=preview.headers.getSetCookie().map(v=>v.split(';')[0]).join('; ');const result=await fetch(origin+snapshot.url,{headers:{Cookie:cookie}});const body=await result.text();assert.equal(result.status,200);assert.ok(body.includes('JOURNAL_UNSAVED_PREVIEW_PROOF')&&body.includes('UNSAVED_BODY_PROOF')&&!body.includes('OTHER_HOME'),'new preview cannot resolve another page with the same empty slug');console.log('Unsaved Journal snapshot verified');
