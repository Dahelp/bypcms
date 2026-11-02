import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import test from 'node:test';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import ts from 'typescript';
const nativeRequire=createRequire(import.meta.url);const cache=new Map();
function load(path){
  if(cache.has(path))return cache.get(path).exports;
  const module={exports:{}};cache.set(path,module);
  const {outputText}=ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}});
  new Function('require','module','exports',outputText)(name=>{
    if(name.endsWith('.css'))return {};
    if(name.startsWith('.')){const base=resolve(dirname(path),name);const file=[base,base+'.ts',base+'.tsx'].find(existsSync);assert.ok(file,name);return load(file);}
    return nativeRequire(name);
  },module,module.exports);return module.exports;
}
const {SeoPreferencesProvider,SeoPreferencesForm,SearchResultPreview}=load(fileURLToPath(new URL('../app/demo/SeoPreview.tsx',import.meta.url)));
const entity={id:12,kind:'articles',title:'Материал',slug:'/journal/photo',seoTitle:'Свет & геометрия',seoDescription:'Описание материала'};
const render=element=>renderToStaticMarkup(React.createElement(SeoPreferencesProvider,null,element));
test('the actual result component renders both engines, accessible device controls and current metadata',()=>{
  const html=render(React.createElement(SearchResultPreview,{entity,siteName:'Студия',domain:'studio.test',settingsHref:'/?edition=content&section=seo&panel=settings'}));
  assert.match(html,/role="tablist" aria-label="Поисковая система"/);
  assert.match(html,/>Google<\/button>/);assert.match(html,/>Яндекс<\/button>/);
  assert.match(html,/aria-label="ПК"[^>]*aria-pressed="true"/);assert.match(html,/aria-label="Мобильная версия"[^>]*aria-pressed="false"/);
  assert.match(html,/Свет &amp; геометрия/);assert.match(html,/Описание материала/);assert.match(html,/studio.test/);assert.match(html,/Студия/);
  assert.match(html,/target="_blank" rel="noopener"/);assert.doesNotMatch(html,/ПРИМЕР РЕЗУЛЬТАТА GOOGLE/);
  const settingsLink=html.match(/<a[^>]+class="serpSettingsLink"[^>]*>/)?.[0];assert.ok(settingsLink);
  assert.doesNotMatch(settingsLink,/target="_blank"/);assert.match(settingsLink,/aria-label="Настройки SEO"/);
});
test('the module form exposes real multi-selection and one explicit settings save',()=>{
  const html=render(React.createElement(SeoPreferencesForm));
  assert.equal((html.match(/type="checkbox"/g)||[]).length,2);assert.equal((html.match(/checked=""/g)||[]).length,2);
  assert.match(html,/Открывать первой/);assert.match(html,/>Сохранить настройки SEO<\/button>/);
  assert.match(html,/не ограничивают индексацию/);
});
