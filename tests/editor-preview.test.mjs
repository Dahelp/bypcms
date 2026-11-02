import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import test from 'node:test';
import ts from 'typescript';

const source=readFileSync(new URL('../app/demo/editor-session.ts',import.meta.url),'utf8');
const {outputText}=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}});
const module={exports:{}};
new Function('require','module','exports',outputText)(createRequire(import.meta.url),module,module.exports);
const {createEntity,prepareEntitySave,editorSessionKey,isPersistedEntity,readEditorSession,writeEditorSession,clearEditorSession,commitDemoEntity,cameFromEditor,readNewEditorSession,writeNewEditorSession,clearNewEditorSession,writeSiteSnapshot,readSiteSnapshot}=module.exports;
class MemoryStorage{
  values=new Map();fail=false;
  getItem(key){return this.values.get(key)??null;}
  setItem(key,value){if(this.fail)throw new Error('QuotaExceededError');this.values.set(key,value);}
  removeItem(key){this.values.delete(key);}
  get length(){return this.values.size;}
  key(index){return [...this.values.keys()][index]??null;}
}
const entity={id:12,kind:'articles',title:'Свет',slug:'/journal/light',body:'Saved body',excerpt:'Saved excerpt',seoTitle:'SEO',seoDescription:'Description',status:'Черновик',updated:'Сегодня',image:0};
const context={edition:'content',kind:'articles',id:12};
const snapshot={draft:{...entity,title:'Unsaved title',body:'Unsaved body',author:'Анна Левина',publishAt:'2026-12-20T12:30',includeInSitemap:false,passwordProtected:true,allowIndexing:false,blocks:[{id:1,type:'heading',title:'Unsaved block',content:'Block text'}]},tab:'settings',scrollY:624,blockOrder:['image','text','excerpt'],codeBlock:true,customCode:'<p>Unsaved HTML</p>'};

test('creation starts without a cover, publication date or invented save history',()=>{
  for(const kind of ['articles','pages','products','projects']){
    const draft=createEntity(kind);
    assert.equal(draft.image,-1);assert.equal(draft.publishAt,'');assert.equal(draft.updated,'');
    assert.equal(draft.saveHistory,undefined);assert.equal(draft.body,'');assert.equal(draft.title,'');
  }
});

test('history records successful writes only and uses the last committed history',()=>{
  const storage=new MemoryStorage();const draft={...createEntity('articles'),title:'New',slug:'/new'};
  storage.fail=true;assert.throws(()=>commitDemoEntity(storage,{entities:[]},draft));
  assert.equal(storage.getItem('bypcms-real-demo-v1'),null);assert.equal(draft.saveHistory,undefined);
  storage.fail=false;
  const first=commitDemoEntity(storage,{entities:[]},draft)[0];
  assert.equal(first.saveHistory.length,1);assert.equal(first.saveHistory[0].title,'New');
  assert.equal(first.saveHistory[0].status,'Черновик');assert.ok(Number.isFinite(Date.parse(first.saveHistory[0].savedAt)));
  const second=commitDemoEntity(storage,{entities:[first]},{...first,title:'Changed',saveHistory:[]})[0];
  assert.equal(second.saveHistory.length,2);assert.equal(second.saveHistory[0].title,'Changed');
  assert.deepEqual(second.saveHistory[1],first.saveHistory[0]);assert.equal(first.saveHistory.length,1);
});

test('explicit publication sets the actual status and date without changing an ordinary draft save',()=>{
  const draft=createEntity('articles');const now=new Date('2026-11-02T12:30:00Z');
  assert.equal(prepareEntitySave(draft),draft);assert.equal(draft.publishAt,'');
  const published=prepareEntitySave(draft,true,now);
  assert.equal(published.status,'Опубликовано');assert.equal(draft.status,'Черновик');
  assert.equal(published.publishAt,new Date(now.getTime()-now.getTimezoneOffset()*60000).toISOString().slice(0,16));
  assert.equal(prepareEntitySave({...draft,publishAt:'2026-12-20T12:30'},true,now).publishAt,'2026-12-20T12:30');
});

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

test('new timestamp-based IDs are not treated as saved records until a successful commit',()=>{
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

test('new-material preview restores a working copy on Back, reload or explicit Close without creating a record',()=>{
  const storage=new MemoryStorage();const draft={...createEntity('articles'),title:'Unsaved new title',image:4};
  const working=JSON.parse(JSON.stringify({...snapshot,draft,tab:'seo'}));const context={edition:'content',kind:'articles',id:draft.id};
  storage.setItem('bypcms-real-demo-v1',JSON.stringify({entities:[]}));
  writeNewEditorSession(storage,context,working);
  assert.deepEqual(readNewEditorSession(storage,context,null,'back_forward'),working);
  assert.deepEqual(readNewEditorSession(storage,context,null,'reload'),working);
  assert.deepEqual(readNewEditorSession(storage,context,String(draft.id),'navigate'),working);
  assert.equal(readNewEditorSession(storage,context,null,'navigate'),null);
  assert.equal(readNewEditorSession(storage,context,String(draft.id+1),'navigate'),null);
  assert.equal(readNewEditorSession(storage,{...context,kind:'pages'},String(draft.id),'navigate'),null);
  assert.deepEqual(JSON.parse(storage.getItem('bypcms-real-demo-v1')).entities,[]);
  clearNewEditorSession(storage,context);assert.equal(readNewEditorSession(storage,context,null,'back_forward'),null);
});

test('Close from an unsaved preview uses native history only for the matching new editor',()=>{
  const editor='https://demo.bypcms.ru/?edition=content&section=articles&editor=new';
  const close='?edition=content&section=articles&editor=new&draft=123456789';
  const preview=editor+'&draft=123456789&previewDraft=123456789';
  assert.equal(cameFromEditor(editor,close,preview),true);
  assert.equal(cameFromEditor(editor+'&draft=123456789',close,preview),true);
  assert.equal(cameFromEditor(editor+'&draft=987654321',close,preview),false);
  assert.equal(cameFromEditor(editor.replace('articles','pages'),close,preview),false);
  assert.equal(cameFromEditor(preview,close,preview),false);
});

test('opening the saved site in another tab copies committed data only into a bounded disposable snapshot',()=>{
  const storage=new MemoryStorage();storage.setItem('bypcms-real-demo-v1','committed');storage.setItem('bypcms-demo-seo-preferences-v1','preferences');
  const payload={entities:[entity],theme:{accent:'#555'},settings:{siteName:'Site'}};
  writeSiteSnapshot(storage,'snapshot-one',payload);
  assert.deepEqual(JSON.parse(readSiteSnapshot(storage,'snapshot-one')),payload);
  assert.equal(storage.getItem('bypcms-real-demo-v1'),'committed');
  for(let id=0;id<12;id++)writeSiteSnapshot(storage,`snapshot-${id}`,payload);
  assert.equal([...storage.values.keys()].filter(key=>key.startsWith('bypcms-demo-site-preview-v1:')).length,8);
  assert.equal(storage.getItem('bypcms-demo-seo-preferences-v1'),'preferences');
  assert.equal(readSiteSnapshot(storage,'../../invalid'),null);
  storage.setItem('bypcms-demo-site-preview-v1:expired-one',JSON.stringify({createdAt:Date.now()-86400001,payload}));
  assert.equal(readSiteSnapshot(storage,'expired-one'),null);
});

test('the single Save action respects the selected status and supplies a date only for publication',()=>{
  const draft=createEntity('articles');
  assert.equal(prepareEntitySave(draft).status,'Черновик');assert.equal(prepareEntitySave(draft).publishAt,'');
  const published=prepareEntitySave({...draft,status:'Опубликовано'});
  assert.equal(published.status,'Опубликовано');assert.ok(published.publishAt);
  assert.equal(prepareEntitySave({...draft,status:'Скрыт'}).status,'Скрыт');
});
