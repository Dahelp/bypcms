import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import test from 'node:test';
import ts from 'typescript';
const nativeRequire=createRequire(import.meta.url);
function load(relative){const {outputText}=ts.transpileModule(readFileSync(new URL(relative,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}});const module={exports:{}};new Function('require','module','exports',outputText)(name=>name==='../components/panel-route'?load('../app/components/panel-route.ts'):nativeRequire(name),module,module.exports);return module.exports;}
const {readDemoSession,startDemoSession,endDemoSession,DEMO_SESSION_KEY,LEGACY_DEMO_SESSION_KEY,DEMO_SESSION_TTL}=load('../app/demo/demo-session.ts');
const {editorReturnHref,resolveDemoSection}=load('../app/demo/demo-navigation.ts');
class Storage{values=new Map();fail=false;getItem(key){return this.values.get(key)??null;}setItem(key,value){if(this.fail)throw new Error('Storage unavailable');this.values.set(key,value);}removeItem(key){this.values.delete(key);}}
const now=Date.parse('2026-11-02T12:00:00Z');

test('a demo sign-in is visible to an independent new tab without opener or sessionStorage cloning',()=>{
  const shared=new Storage(),firstTab=new Storage(),newTab=new Storage();
  const loggedIn=startDemoSession(shared,firstTab,now);
  assert.deepEqual(readDemoSession(shared,newTab,now+1000),loggedIn);
  assert.equal(loggedIn.expiresAt,now+DEMO_SESSION_TTL);assert.equal(newTab.getItem(LEGACY_DEMO_SESSION_KEY),null);
  assert.deepEqual([...shared.values.keys()],[DEMO_SESSION_KEY]);
});
test('an existing signed-in tab is migrated without logging in again or touching editor data',()=>{
  const shared=new Storage(),legacyTab=new Storage(),newTab=new Storage();
  legacyTab.setItem(LEGACY_DEMO_SESSION_KEY,'active');legacyTab.setItem('bypcms-real-demo-v1','content');legacyTab.setItem('bypcms-demo-editor-v1:content:articles:12','draft');
  const session=readDemoSession(shared,legacyTab,now);assert.ok(session);
  assert.deepEqual(readDemoSession(shared,newTab,now+1000),session);
  assert.equal(legacyTab.getItem(LEGACY_DEMO_SESSION_KEY),null);assert.equal(legacyTab.getItem('bypcms-real-demo-v1'),'content');assert.equal(legacyTab.getItem('bypcms-demo-editor-v1:content:articles:12'),'draft');
});
test('logout is authoritative for all tabs and cannot be undone by a stale legacy marker',()=>{
  const shared=new Storage(),tab1=new Storage(),oldTab=new Storage();startDemoSession(shared,tab1,now);
  oldTab.setItem(LEGACY_DEMO_SESSION_KEY,'active');endDemoSession(shared,tab1,now+1000);
  assert.equal(readDemoSession(shared,oldTab,now+2000),null);assert.equal(oldTab.getItem(LEGACY_DEMO_SESSION_KEY),null);
  assert.equal(JSON.parse(shared.getItem(DEMO_SESSION_KEY)).status,'signed-out');
  assert.ok(startDemoSession(shared,tab1,now+3000));assert.ok(readDemoSession(shared,oldTab,now+4000));
});
test('navigation does not extend session lifetime, and an expired or corrupt session requires an explicit login',()=>{
  const shared=new Storage(),tab=new Storage();startDemoSession(shared,tab,now);
  assert.equal(readDemoSession(shared,tab,now+10000).expiresAt,now+DEMO_SESSION_TTL);
  assert.equal(readDemoSession(shared,tab,now+DEMO_SESSION_TTL),null);
  shared.setItem(DEMO_SESSION_KEY,'bad JSON');tab.setItem(LEGACY_DEMO_SESSION_KEY,'active');assert.equal(readDemoSession(shared,tab,now),null);
  shared.setItem(DEMO_SESSION_KEY,JSON.stringify({status:'active',expiresAt:'tomorrow'}));assert.equal(readDemoSession(shared,tab,now),null);
});
test('storage write failures do not pretend that login or logout succeeded',()=>{
  const shared=new Storage(),tab=new Storage();tab.setItem(LEGACY_DEMO_SESSION_KEY,'active');shared.fail=true;
  assert.throws(()=>startDemoSession(shared,tab,now),/Storage unavailable/);assert.equal(tab.getItem(LEGACY_DEMO_SESSION_KEY),'active');
  shared.fail=false;const session=startDemoSession(shared,tab,now);const stored=shared.getItem(DEMO_SESSION_KEY);shared.fail=true;
  assert.throws(()=>endDemoSession(shared,tab,now),/Storage unavailable/);assert.equal(shared.getItem(DEMO_SESSION_KEY),stored);assert.deepEqual(readDemoSession(shared,tab,now),session);
});
test('the settings return link preserves the exact saved record or draft and strips unrelated preview actions',()=>{
  const saved='?edition=content&section=articles&record=12&tab=seo';assert.equal(editorReturnHref(saved),saved);
  const draft='?edition=content&section=articles&editor=new&draft=1793610000000&tab=seo';assert.equal(editorReturnHref(draft),draft);
  assert.equal(editorReturnHref(saved+'&preview=12&sitePreview=token'),saved);
  for(const invalid of ['https://other.test/','//other.test/','?edition=content&section=articles&record=NaN','?edition=content&section=articles&editor=new','?edition=content&section=articles&record=12&editor=new','?edition=bad&section=articles&record=12'])assert.equal(editorReturnHref(invalid),null);
});
test('unknown or disabled sections keep their requested URL state and show an error rather than silently opening Overview',()=>{
  const menu=[{id:'articles'},{id:'seo'}];assert.deepEqual(resolveDemoSection('seo',menu),{view:'seo',error:''});
  assert.deepEqual(resolveDemoSection('overview',menu),{view:'overview',error:''});
  const unknown=resolveDemoSection('disabled-module',menu);assert.equal(unknown.view,'disabled-module');assert.match(unknown.error,/не найден|отключён/);
});
