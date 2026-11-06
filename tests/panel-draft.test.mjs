import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import test from 'node:test';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import ts from 'typescript';
const require=createRequire(import.meta.url),module={exports:{}};
new Function('require','module','exports',ts.transpileModule(readFileSync(new URL('../app/components/PanelDraftForm.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText)(require,module,module.exports);
const {restoreDraftFields}=module.exports;
test('restoring a form preserves text, multi-value checkboxes and empty selections',()=>{
 const input=(name,type,props={})=>React.createElement('input',{key:name+'-'+(props.value||''),name,type,...props});
 const markup=renderToStaticMarkup(React.createElement('form',null,restoreDraftFields([
  input('title','text',{defaultValue:'server title'}),input('modules','checkbox',{value:'seo'}),input('modules','checkbox',{value:'forms',defaultChecked:true}),input('enabled','checkbox',{defaultChecked:true}),
 ],{title:['unsaved title'],modules:['seo'],enabled:[]})));
 assert.match(markup,/value="unsaved title"/);assert.match(markup,/checked=""[^>]*value="seo"/);assert.doesNotMatch(markup,/checked=""[^>]*value="forms"/);assert.doesNotMatch(markup,/name="enabled"[^>]*checked/);
});
test('draft restoration excludes credentials, files and controlled component values',()=>{
 const markup=renderToStaticMarkup(React.createElement('form',null,restoreDraftFields([
  React.createElement('input',{key:'password',name:'password',type:'password'}),React.createElement('input',{key:'image',name:'image',type:'file'}),React.createElement('input',{key:'managed',name:'managed',value:'component state',readOnly:true}),
 ],{password:['must not restore'],image:['fake path'],managed:['stale value']})));
 assert.doesNotMatch(markup,/must not restore|fake path|stale value/);assert.match(markup,/component state/);
});
