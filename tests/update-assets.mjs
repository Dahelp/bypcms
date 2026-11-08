import assert from 'node:assert/strict';
export async function verifyUpdateAssets(origin,id){
 assert.match(origin,/^http:\/\/127\.0\.0\.1:\d+$/);assert.match(id,/^[a-f0-9]{32}$/);
 const html=await (await fetch(origin+'/admin/?section=updates')).text();assert.ok(html.includes('/_update-assets/'+id+'/_next/'));
 const assets=[...new Set([...html.matchAll(/(?:src|href)="([^" ]+\.(?:js|css))"/g)].map(x=>x[1]))];assert.ok(assets.length>0);
 for(const asset of assets){const r=await fetch(origin+asset);assert.equal(r.status,200,asset);if(asset.includes('webpack-')){const text=await r.text();assert.ok(text.includes('"/_update-assets/'+id+'/_next/"'),'lazy chunks follow the active release');}else await r.arrayBuffer();}
 return assets.length;
}
