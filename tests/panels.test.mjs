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
  const localRequire=name=>name==='./panel-bulk'?load('app/components/panel-bulk.ts'):require(name);
  new Function('require','module','exports',outputText)(localRequire,module,module.exports);
  return module.exports;
}
const {panelHref}=load('app/components/panel-route.ts');
const {default:PanelTable}=load('app/components/PanelTable.tsx');
const {selectionCsv,statusBulkActions,deleteBulkAction,requestPanelBulk,refreshAfterBulk}=load('app/components/panel-bulk.ts');

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

test('CSV exports only selected records and escapes formulas, separators, quotes and line breaks',()=>{
  const csv=selectionCsv([{name:'=SUM(A1)',note:'one;"two"\nthree'}],[{key:'name',label:'Имя',render:row=>React.createElement('b',null,row.name)},{key:'note',label:'Примечание',render:row=>row.note}]);
  assert.ok(csv.startsWith('\uFEFF'));
  assert.ok(csv.includes('"\'=SUM(A1)"'));
  assert.ok(csv.includes('"one;""two""\nthree"'));
  assert.equal(csv.includes('unselected'),false);
  const paths=selectionCsv([{slug:'about'}],[{key:'url',label:'URL',render:row=>React.createElement('code',null,'/',row.slug)}]);
  assert.ok(paths.includes('"/about"'));assert.ok(!paths.includes('/ about'));
});

test('bulk actions preserve selected row identity and require explicit deletion confirmation',async()=>{
  const rows=[{id:1},{id:3}];let received;
  const actions=statusBulkActions([['published','Опубликовать']],(selected,status)=>{received={selected,status};return {succeeded:selected.map(row=>row.id),failed:[]};});
  assert.ok(actions[0].confirmation);
  assert.deepEqual(await actions[0].run(rows),{succeeded:[1,3],failed:[]});
  assert.strictEqual(received.selected,rows);assert.equal(received.status,'published');
  const deletion=deleteBulkAction(()=>{});
  assert.equal(deletion.danger,true);assert.match(deletion.confirmation,/нельзя отменить/);
});

test('large selections are sent in bounded batches and preserve partial results after a network failure',async()=>{
  const originalFetch=globalThis.fetch;const calls=[];
  globalThis.fetch=async(url,request)=>{
    calls.push(JSON.parse(request.body));
    assert.equal(request.headers['X-CSRF-Token'],'csrf-test');
    if(calls.length===2)throw new Error('Connection lost');
    return {ok:true,json:async()=>({ok:true,succeeded:calls[0].ids,failed:[]})};
  };
  try{
    const result=await requestPanelBulk('pages','status',Array.from({length:205},(_,i)=>i+1),'csrf-test','draft');
    assert.equal(calls.length,2);assert.equal(calls[0].ids.length,200);assert.equal(calls[1].ids.length,5);
    assert.equal(result.succeeded.length,200);assert.deepEqual(result.failed.map(item=>item.id),[201,202,203,204,205]);
  }finally{globalThis.fetch=originalFetch;}
});

test('a refresh failure preserves the successful mutation result and asks for a manual refresh',async()=>{
  const result=await refreshAfterBulk({succeeded:[1],failed:[]},async()=>{throw new Error('offline');});
  assert.deepEqual(result.succeeded,[1]);assert.match(result.notice,/список не удалось обновить/);
});

test('bulk endpoint runs behind existing authentication and CSRF checks',()=>{
  const source=read('server/api/index.php');const route=source.indexOf("if ($action === 'panel.bulk'");
  assert.ok(route>source.indexOf('$user = $auth->requireUser();'));
  assert.ok(route>source.indexOf('$auth->verifyCsrf();',source.indexOf('$user = $auth->requireUser();')));
  assert.match(source,/PanelBulk::validate\(\$input, \$user\)/);
});
