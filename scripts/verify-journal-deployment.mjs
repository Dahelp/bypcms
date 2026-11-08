import assert from'node:assert/strict';
const origin=process.env.BYPCMS_JOURNAL_ORIGIN||'https://demo.bypcms.ru';
for(const path of ['/journal/','/journal/articles/','/journal/space-and-light/','/journal/category/architecture/','/journal/author/journal/','/journal/search/?q=свет']){
 const r=await fetch(origin+path,{signal:AbortSignal.timeout(30000),cache:'no-store'});const html=await r.text();assert.equal(r.status,200,path);assert.ok(html.includes('journal.css')&&html.includes('j-footer'),path);assert.ok(!html.includes('Fatal error')&&!html.includes('Warning:'),path);
}
for(const path of ['/themes/journal/journal.css','/themes/journal/admin.js','/themes/journal/assets/story-1.jpg','/themes/journal/assets/manrope.ttf','/themes/journal/assets/cormorant.ttf']){const r=await fetch(origin+path,{signal:AbortSignal.timeout(30000)});assert.equal(r.status,200,path);assert.ok(!r.headers.get('content-type')?.includes('text/html'),path);await r.arrayBuffer();}
const missing=await fetch(origin+'/journal/no-such-story/');assert.equal(missing.status,404);await missing.text();
console.log(JSON.stringify({origin,journal:'verified',routes:7,assets:5}));
