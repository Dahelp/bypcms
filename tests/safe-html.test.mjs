import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import ts from 'typescript';
const module={exports:{}};new Function('module','exports',ts.transpileModule(readFileSync(new URL('../app/demo/safe-html.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(module,module.exports);
const {safeHtmlUrl,sanitizeDemoHtml}=module.exports;
test('rich text links reject executable schemes and permit normal site links',()=>{
  for(const url of ['javascript:alert(1)','java\nscript:alert(1)','data:text/html,<script>','vbscript:msgbox(1)','file:///C:/secret'])assert.equal(safeHtmlUrl(url),false,url);
  for(const url of ['/about/','#details','https://example.test/','mailto:hello@example.test','tel:+123'])assert.equal(safeHtmlUrl(url),true,url);
  assert.equal(safeHtmlUrl('data:image/svg+xml;base64,PHN2Zz4=',true),false);
  assert.equal(safeHtmlUrl('data:image/png;base64,aGVsbG8=',true),true);
});
test('server rendering escapes unparsed markup rather than emitting unchecked HTML',()=>{
  assert.equal(sanitizeDemoHtml('<p onclick="alert(1)">A&B</p>'),'&lt;p onclick="alert(1)"&gt;A&amp;B&lt;/p&gt;');
});
