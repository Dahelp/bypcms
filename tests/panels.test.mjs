import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const require=createRequire(import.meta.url);
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
function load(path){
  const {outputText}=ts.transpileModule(read(path),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}});
  const module={exports:{}};
  new Function('require','module','exports',outputText)(require,module,module.exports);
  return module.exports;
}
const {panelHref}=load('app/components/panel-route.ts');
const {default:PanelTable}=load('app/components/PanelTable.tsx');

test('document links preserve both standalone-demo and primary panel paths',()=>{
  for(const base of ['https://demo.bypcms.ru/','https://bypcms.ru/demo/','https://bypcms.ru/admin/','https://bypcms.ru/owner/']){
    const href=panelHref({edition:'content',section:'pages',record:3,unused:undefined});
    const list=new URL(panelHref({edition:'content',section:'pages'}),base);
    const editor=new URL(href,list);
    assert.equal(editor.pathname,new URL(base).pathname);
    assert.equal(editor.searchParams.get('record'),'3');
    assert.equal(list.searchParams.has('record'),false);
    assert.equal(editor.searchParams.has('unused'),false);
  }
  assert.equal(new URL(panelHref({section:'modules',module:'name & value'}),'https://example.test/admin/').searchParams.get('module'),'name & value');
});

test('every rendered table provides independent row checkboxes, select-all and real editor links',()=>{
  const rows=[{id:1,title:'О компании'},{id:2,title:'Контакты'}];
  const html=renderToStaticMarkup(React.createElement(PanelTable,{label:'Страницы',rows,rowId:row=>row.id,rowLabel:row=>row.title,
    columns:[{key:'title',label:'Название',render:row=>React.createElement('a',{href:panelHref({section:'pages',record:row.id})},row.title)}],
    actions:row=>[{label:'Редактировать',href:panelHref({section:'pages',record:row.id})}]}));
  assert.equal((html.match(/type="checkbox"/g)||[]).length,3);
  assert.match(html,/aria-label="Выбрать все строки: Страницы"/);
  assert.match(html,/aria-label="Выбрать: Контакты"/);
  assert.equal((html.match(/aria-haspopup="menu"/g)||[]).length,2);
  assert.match(html,/<a href="\?section=pages&amp;record=2">Контакты<\/a>/);
  assert.doesNotMatch(html,/<button[^>]*>[^<]*<a/);
});

test('empty tables disable select-all and expose an empty state',()=>{
  const html=renderToStaticMarkup(React.createElement(PanelTable,{label:'Клиенты',rows:[],rowId:row=>row.id,rowLabel:row=>row.title,columns:[{key:'title',label:'Клиент',render:()=>null}]}));
  assert.match(html,/type="checkbox" disabled=""/);
  assert.match(html,/Записей пока нет/);
});

test('workspace documents do not mutate browser history or route by click handlers',()=>{
  for(const path of ['app/demo/page.tsx','app/owner/page.tsx','app/admin/page.tsx','app/admin/ConceptManager.tsx']){
    const source=read(path);
    assert.doesNotMatch(source,/history\.(pushState|replaceState)|["']popstate["']/i,path);
    assert.doesNotMatch(source,/onClick=\{[^\n]*?\b(setView|setActive|setSection|setEditingPage|setEditingModule|setModal)\(/,path);
    assert.match(source,/PanelTable/,path);
  }
});
