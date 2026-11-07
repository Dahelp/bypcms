import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import ts from 'typescript';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
const require=createRequire(import.meta.url);
function compile(file,localRequire=require){const source=readFileSync(new URL('../'+file,import.meta.url),'utf8');const {outputText}=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}});const module={exports:{}};new Function('require','module','exports',outputText)(localRequire,module,module.exports);return module.exports;}
const routing=compile('app/components/panel-route.ts');
test('unresolved URL stays neutral, but the panel root still opens Overview',()=>{
 assert.equal(routing.panelSection(null),'');
 assert.equal(routing.panelSection(new URLSearchParams()),'overview');
 assert.equal(routing.panelSection(new URLSearchParams('section=settings')),'settings');
});
test('canonical settings, operations and old bookmarks resolve without rewriting browser history',()=>{
 for(const [query,expected]of [
  ['section=payments&order=3',{section:'payments',settingsTab:'general'}],
  ['section=mail&q=hello&mail_page=2',{section:'mail',settingsTab:'general'}],
  ['section=settings&tab=payments',{section:'settings',settingsTab:'payments'}],
  ['section=settings&tab=mail',{section:'settings',settingsTab:'mail'}],
  ['section=payments&panel=connection',{section:'settings',settingsTab:'payments'}],
  ['section=payments&panel=mail&q=hello',{section:'mail',settingsTab:'general'}],
 ]){const params=new URLSearchParams(query);assert.deepEqual(routing.ownerSectionRoute(params),expected);assert.equal(params.toString(),query);}
});
test('saving mail cannot change payment configuration or its secret, and vice versa',()=>{
 const settings={payments_enabled:true,shop_id:'123',clear_shop_secret:true,smtp_enabled:false,smtp_host:'smtp.example.test',clear_smtp_password:true};
 const secrets={shop_secret:'payment-test-value',smtp_password:'mail-test-value'};
 assert.deepEqual(routing.commerceSettingsPayload('payment-settings',settings,secrets),{payments_enabled:true,shop_id:'123',clear_shop_secret:true,shop_secret:'payment-test-value'});
 assert.deepEqual(routing.commerceSettingsPayload('mail-settings',settings,secrets),{smtp_enabled:false,smtp_host:'smtp.example.test',clear_smtp_password:true,smtp_password:'mail-test-value'});
 assert.throws(()=>routing.commerceSettingsPayload('orders',settings,secrets));
});
const user={id:1,name:'QA Owner',email:'qa@example.test',role:'owner',role_name:'Владелец'};
const data={user,clients:[],tasks:[],services:[],modules:[],edition_modules:[],licenses:[],portfolio:[],orders:[],builds:[],notifications:[],settings:{},csrf:'qa'};
function renderBeforeRoute(file,bootstrap=false){
 let supplied=false;
 const react={...React,useState(initial){const value=bootstrap&&!supplied&&initial===null?(supplied=true,data):initial;return React.useState(value);}};
 const stub={__esModule:true,default:()=>null};
 const imports=name=>{
  if(name.endsWith('.css'))return {};
  if(name==='react')return react;
  if(name==='react/jsx-runtime')return require(name);
  if(name.endsWith('/PanelRouteLoading'))return compile('app/components/PanelRouteLoading.tsx',imports);
  if(name.endsWith('/panel-route'))return routing;
  if(name.endsWith('/PanelSession'))return {usePanelSession:()=>({user,phase:'active',csrf:'qa'}),PanelSessionGate:({children})=>children};
  if(name.endsWith('/panel-bulk'))return {statusBulkActions:()=>[],deleteBulkAction:()=>({})};
  if(name.endsWith('/panel-api'))return {};
  if(name==='next/link')return {__esModule:true,default:({children,...props})=>React.createElement('a',props,children)};
  return stub;
 };
 return renderToStaticMarkup(React.createElement(compile(file,imports).default));
}
test('Owner never renders Overview after bootstrap arrives while the requested route is unresolved',()=>{
 const html=renderBeforeRoute('app/owner/page.tsx',true);
 assert.match(html,/Загрузка выбранного раздела/);assert.doesNotMatch(html,/<h1|Договорная стоимость|ownerApp/);
});
test('Admin renders only neutral loading until the URL is resolved',()=>{
 const html=renderBeforeRoute('app/admin/page.tsx');
 assert.match(html,/Загрузка выбранного раздела/);assert.doesNotMatch(html,/<h1|Здоровье системы|cmsSidebar/);
});
