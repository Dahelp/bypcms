// Read-only acceptance of every reachable page and local asset in the nine demos.
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
const origin=process.env.BYPCMS_STOREFRONT_ORIGIN||'http://127.0.0.1:8021';
assert.match(origin,/^http:\/\/127\.0\.0\.1:\d+$/,'Disposable loopback demos only');
const themes=['journal','chronicle','focus','atelier','corporate','mono','gallery','market','luxe'];
const decode=s=>s.replaceAll('&amp;','&').replaceAll('&#039;',"'").replaceAll('&quot;','"');
const assets=new Map(),results=[];
async function asset(url){if(assets.has(url))return assets.get(url);const promise=(async()=>{const r=await fetch(url);assert.equal(r.status,200,'asset '+url);assert.ok(!r.headers.get('content-type')?.includes('text/html'),'asset MIME '+url);assert.ok((await r.arrayBuffer()).byteLength>0,'nonempty '+url);})();assets.set(url,promise);return promise;}
for(const theme of themes){
 const base=new URL('/'+theme+'/',origin),todo=[base.href],seen=new Set();
 while(todo.length){
  const url=todo.shift();if(seen.has(url))continue;seen.add(url);assert.ok(seen.size<=100,'Bounded page graph '+theme);
  const r=await fetch(url,{signal:AbortSignal.timeout(20000)}),html=await r.text();assert.equal(r.status,200,url);
  assert.ok(!/(?:Warning:|Fatal error:|Deprecated:|Parse error:)/.test(html),'clean runtime '+url);
  assert.ok(/<main\b/.test(html)&&/<h1\b/.test(html),'page structure '+url);
  const ids=new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(m=>decode(m[1])));
  for(const [,raw]of html.matchAll(/\bhref="([^"]+)"/g)){
   const link=new URL(decode(raw),url);if(link.origin!==base.origin)continue;
   if(link.hash&&link.pathname===new URL(url).pathname&&link.search===new URL(url).search){assert.ok(ids.has(decodeURIComponent(link.hash.slice(1))),'anchor '+link.href);continue;}
   link.hash='';if(!link.pathname.startsWith(base.pathname))continue;
   if(/\.[a-z0-9]+$/i.test(link.pathname))continue;
   if(!seen.has(link.href))todo.push(link.href);
  }
  const paths=[...html.matchAll(/\bsrc="([^"]+)"/g)].map(m=>decode(m[1]));
  for(const [,set]of html.matchAll(/\bsrcset="([^"]+)"/g))paths.push(...decode(set).split(',').map(p=>p.trim().split(/\s+/)[0]));
  for(const path of paths){if(path.startsWith('data:'))continue;const source=new URL(path,url);if(source.origin===base.origin)await asset(source.href);}
 }
 results.push({theme,pages:seen.size});console.log('PASS '+theme+': '+seen.size+' reachable pages');
}
const result={origin,themes:results,pages:results.reduce((n,r)=>n+r.pages,0),assets:assets.size};
if(process.argv[2])await writeFile(process.argv[2],JSON.stringify(result,null,2));
console.log(JSON.stringify(result));
