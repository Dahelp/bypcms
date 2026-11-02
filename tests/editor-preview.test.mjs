import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import test from 'node:test';
import ts from 'typescript';

const source=readFileSync(new URL('../app/demo/editor-session.ts',import.meta.url),'utf8');
const {outputText}=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}});
const module={exports:{}};
new Function('require','module','exports',outputText)(createRequire(import.meta.url),module,module.exports);
const {editorSessionKey,isPersistedEntity,readEditorSession,writeEditorSession,clearEditorSession,commitDemoEntity,cameFromEditor}=module.exports;
class MemoryStorage{
  values=new Map();fail=false;
  getItem(key){return this.values.get(key)??null;}
  setItem(key,value){if(this.fail)throw new Error('QuotaExceededError');this.values.set(key,value);}
  removeItem(key){this.values.delete(key);}
}
const entity={id:12,kind:'articles',title:'Свет',slug:'/journal/light',body:'Saved body',excerpt:'Saved excerpt',seoTitle:'SEO',seoDescription:'Description',status:'Черновик',updated:'Сегодня',image:0};
const context={edition:'content',kind:'articles',id:12};
const snapshot={draft:{...entity,title:'Unsaved title',body:'Unsaved body',author:'Анна Левина',publishAt:'2026-12-20T12:30',includeInSitemap:false,passwordProtected:true,allowIndexing:false,blocks:[{id:1,type:'heading',title:'Unsaved block',content:'Block text'}]},tab:'settings',scrollY:624,blockOrder:['image','text','excerpt'],codeBlock:true,customCode:'<p>Unsaved HTML</p>'};

test('working copies preserve editor data, active tab and scroll without saving a material',()=>{
  const storage=new MemoryStorage();
  storage.setItem('bypcms-real-demo-v1',JSON.stringify({entities:[entity]}));
  const committed=storage.getItem('bypcms-real-demo-v1');
  writeEditorSession(storage,context,snapshot);
  assert.deepEqual(readEditorSession(storage,context),snapshot);
  assert.equal(storage.getItem('bypcms-real-demo-v1'),committed);
  assert.equal(readEditorSession(storage,{...context,id:11}),null);
  assert.equal(readEditorSession(storage,{...context,edition:'business'}),null);
});

test('new timestamp-based IDs do not enable preview until a successful commit',()=>{
  const storage=new MemoryStorage();const draft={...entity,id:Date.now(),title:'Новый материал'};
  const payload={entities:[entity],settings:{siteName:'QA'}};
  assert.equal(isPersistedEntity(payload.entities,draft),false);
  assert.equal(isPersistedEntity([{...entity,id:draft.id}],draft),true);
  storage.fail=true;
  assert.throws(()=>commitDemoEntity(storage,payload,draft),/QuotaExceededError/);
  assert.equal(payload.entities.length,1);
  assert.equal(isPersistedEntity(payload.entities,draft),false);
  assert.equal(storage.getItem('bypcms-real-demo-v1'),null);
  storage.fail=false;
  const saved=commitDemoEntity(storage,payload,draft);
  assert.equal(isPersistedEntity(saved,draft),true);
  assert.equal(JSON.parse(storage.getItem('bypcms-real-demo-v1')).entities.length,2);
  assert.equal(payload.entities.length,1);
});

test('a failed save keeps the working copy and the last committed version intact',()=>{
  const storage=new MemoryStorage();
  storage.setItem('bypcms-real-demo-v1',JSON.stringify({entities:[entity]}));
  writeEditorSession(storage,context,snapshot);
  storage.fail=true;
  assert.throws(()=>commitDemoEntity(storage,{entities:[entity]},snapshot.draft));
  assert.equal(JSON.parse(storage.getItem('bypcms-real-demo-v1')).entities[0].title,'Свет');
  assert.equal(readEditorSession(storage,context).draft.title,'Unsaved title');
  storage.fail=false;
  commitDemoEntity(storage,{entities:[entity]},snapshot.draft);clearEditorSession(storage,context);
  assert.equal(readEditorSession(storage,context),null);
  assert.equal(JSON.parse(storage.getItem('bypcms-real-demo-v1')).entities[0].title,'Unsaved title');
});

test('invalid or unrelated cached state is ignored without crashing the editor',()=>{
  const storage=new MemoryStorage();const key=editorSessionKey(context);
  storage.setItem(key,'invalid JSON');assert.equal(readEditorSession(storage,context),null);
  storage.setItem(key,JSON.stringify({...snapshot,draft:{...entity,id:11}}));assert.equal(readEditorSession(storage,context),null);
  storage.setItem(key,JSON.stringify({...snapshot,draft:{...entity,title:null}}));assert.equal(readEditorSession(storage,context),null);
  storage.setItem(key,JSON.stringify({...snapshot,tab:'unknown',scrollY:-10,blockOrder:['text','text','image']}));
  const restored=readEditorSession(storage,context);assert.equal(restored.tab,'content');assert.equal(restored.scrollY,0);assert.deepEqual(restored.blockOrder,['excerpt','text','image']);
  assert.throws(()=>writeEditorSession(storage,{...context,id:11},snapshot));
});

test('Close uses native history only when the previous document is the same editor',()=>{
  for(const base of ['https://demo.bypcms.ru/','https://bypcms.ru/demo/']){
    const editor=base+'?edition=content&section=articles&record=12';
    const preview=editor+'&preview=12&tab=settings';
    const close='?edition=content&section=articles&record=12&tab=settings';
    assert.equal(cameFromEditor(editor,close,preview),true);
    assert.equal(cameFromEditor(editor,close,preview+'#details'),false);
    assert.equal(cameFromEditor(editor.replace('record=12','record=11'),close,preview),false);
    assert.equal(cameFromEditor(preview,close,preview),false);
    assert.equal(cameFromEditor('https://other.test/?edition=content&section=articles&record=12',close,preview),false);
    assert.equal(cameFromEditor('',close,preview),false);
    assert.equal(cameFromEditor(base+'?edition=content&section=articles',close,preview),false);
  }
});
