// Run only against explicitly prepared, disposable loopback installations.
// node tests/runtime-http.mjs path/to/ignored-local-targets.json
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
if (!process.argv[2]) throw new Error('Provide a local JSON fixture: [{origin,edition,email,password,modules}].');
const targets=JSON.parse(await readFile(process.argv[2],'utf8'));
for(const target of targets) {
  const {origin,edition,email,password,modules}=target;
  assert.ok(['127.0.0.1','localhost','[::1]'].includes(new URL(origin).hostname),'Acceptance is restricted to disposable loopback sites');
  const login=await fetch(origin+'/api/index.php?action=auth.login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password})});
  assert.equal(login.status,200,edition+' login');const session=await login.json();const cookie=login.headers.getSetCookie().at(-1)?.split(';')[0];assert.ok(cookie);
  async function api(action,body,csrf=session.csrf){const response=await fetch(origin+'/api/index.php?action='+action,{method:body?'POST':'GET',headers:{Cookie:cookie,...(body?{'Content-Type':'application/json','X-CSRF-Token':csrf}:{})},body:body?JSON.stringify(body):undefined});return {response,data:await response.json()};}
  const overview=await api('dashboard');assert.equal(overview.data.license.edition.toLowerCase(),edition);
  const installed=await api('modules.list');assert.deepEqual(installed.data.modules.map(item=>item.module_key).sort(),modules.slice().sort());
  const html=await (await fetch(origin+'/admin/')).text();const assets=[...html.matchAll(/(?:src|href)="([^"]*\/_next\/[^"<>]+)"/g)].map(match=>new URL(match[1].replaceAll('&amp;','&'),origin));assert.ok(assets.length);
  for(const asset of assets){assert.equal(asset.origin,origin);assert.equal((await fetch(asset)).status,200);}
  for(const path of ['/','/about/','/contacts/'])assert.equal((await fetch(origin+path)).status,200);
  assert.equal((await fetch(origin+'/missing-acceptance-page/')).status,404);
  for(const path of ['/_core/bootstrap.php','/_storage/config.php','/_private/test.txt'])assert.equal((await fetch(origin+path)).status,403);
  const pages=await api('pages.list');const fixture=pages.data.pages.find(item=>item.slug.startsWith('qa-'));assert.ok(fixture,'Create a disposable qa-* page before this test');
  const rejected=await api('pages.update',{id:fixture.id,title:'QA request must be rejected'},'invalid-csrf');assert.equal(rejected.response.status,403);assert.equal(rejected.data.details.code,'csrf_expired');
  assert.equal((await api('pages.list')).data.pages.find(item=>item.id===fixture.id).title,fixture.title);
  assert.equal((await api('auth.logout',{})).response.status,200);assert.equal((await api('auth.me')).response.status,401);
  console.log('PASS '+edition+': Apache routes, private paths, local assets, module manifest, server login/logout and CSRF');
}
