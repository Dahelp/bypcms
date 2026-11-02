import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import ts from 'typescript';
const {outputText}=ts.transpileModule(readFileSync(new URL('../app/demo/seo-preferences.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}});
const module={exports:{}};new Function('module','exports',outputText)(module,module.exports);
const {normalizeSeoPreferences,validateSeoPreferences,readSeoPreferences,saveSeoPreferences,normalizeResultView,resultViewSignature,resultAddress,SEO_PREFERENCES_KEY}=module.exports;
class Storage{values=new Map();fail=false;getItem(key){return this.values.get(key)??null;}setItem(key,value){if(this.fail)throw new Error('Storage unavailable');this.values.set(key,value);}}

test('corrupt or unsupported saved settings recover valid Google/Yandex defaults without shared mutable arrays',()=>{
  assert.deepEqual(normalizeSeoPreferences(null),{engines:['google','yandex'],preferred:'google'});
  assert.deepEqual(normalizeSeoPreferences({engines:['bing','yandex','yandex'],preferred:'google'}),{engines:['yandex'],preferred:'yandex'});
  const storage=new Storage();storage.setItem(SEO_PREFERENCES_KEY,'invalid JSON');assert.deepEqual(readSeoPreferences(storage).engines,['google','yandex']);
  const a=normalizeSeoPreferences(null);a.engines.pop();assert.equal(normalizeSeoPreferences(null).engines.length,2);
});
test('checkbox combinations save one or both engines with a valid preferred system',()=>{
  const storage=new Storage();
  for(const preferences of [{engines:['google'],preferred:'google'},{engines:['yandex'],preferred:'yandex'},{engines:['google','yandex'],preferred:'yandex'}]){
    assert.equal(validateSeoPreferences(preferences),null);saveSeoPreferences(storage,preferences);assert.deepEqual(readSeoPreferences(storage),preferences);
  }
});
test('empty selection or storage failure leaves the last successful module configuration intact',()=>{
  const storage=new Storage();saveSeoPreferences(storage,{engines:['yandex'],preferred:'yandex'});const saved=storage.getItem(SEO_PREFERENCES_KEY);
  assert.throws(()=>saveSeoPreferences(storage,{engines:[],preferred:'google'}),/хотя бы одну/);assert.equal(storage.getItem(SEO_PREFERENCES_KEY),saved);
  storage.fail=true;assert.throws(()=>saveSeoPreferences(storage,{engines:['google'],preferred:'google'}),/Storage unavailable/);assert.equal(storage.getItem(SEO_PREFERENCES_KEY),saved);
});
test('preview remembers device and selected engine until module preferences require a valid fallback',()=>{
  const both={engines:['google','yandex'],preferred:'google'};
  const stored={engine:'yandex',device:'mobile',signature:resultViewSignature(both)};
  assert.deepEqual(normalizeResultView(stored,both),{engine:'yandex',device:'mobile'});
  assert.deepEqual(normalizeResultView(stored,{engines:['google'],preferred:'google'}),{engine:'google',device:'mobile'});
  assert.deepEqual(normalizeResultView({device:'invalid'},both),{engine:'google',device:'desktop'});
});
test('snippets use the configured host and safe site paths rather than a hard-coded domain',()=>{
  assert.deepEqual(resultAddress('example.test','/journal/photo'),{host:'example.test',url:'https://example.test/journal/photo',breadcrumb:'example.test › journal › photo'});
  assert.equal(resultAddress('https://example.test:8443','new page').url,'https://example.test:8443/new%20page');
  assert.equal(resultAddress('javascript://bad','/').host,'demo.bypcms.ru');
  assert.equal(resultAddress('example.test','//other.test').host,'demo.bypcms.ru');
});
