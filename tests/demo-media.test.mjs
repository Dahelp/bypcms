import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import ts from 'typescript';
const transpile=path=>ts.transpileModule(readFileSync(new URL(path,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const data={exports:{}};new Function('module','exports',transpile('../app/demo/demo-data.ts'))(data,data.exports);
const module={exports:{}};new Function('require','module','exports',transpile('../app/demo/media-store.ts'))(name=>{assert.equal(name,'./demo-data');return data.exports;},module,module.exports);
const {queryMedia,validateMediaFile,mediaDetails,seedMedia,MEDIA_PAGE_SIZE,MAX_MEDIA_BYTES,mediaError}=module.exports;
const filters={query:'',sort:'newest',type:'image',period:'all',origin:'all',page:1};
const now=Date.parse('2026-11-02T12:00:00Z');
const items=Array.from({length:1031},(_,id)=>({id:id+6,name:`photo-${id+1}.jpg`,alt:id%2?'Москва вечер':'Интерьер утро',caption:'Архив проекта',source:'upload',type:'image',mime:'image/jpeg',size:1000+id,createdAt:now-id*3600000}));

test('a catalog of 1000+ files returns bounded pages, stable order and a reachable last page',()=>{
  const first=queryMedia(items,filters,now);assert.equal(first.total,1031);assert.equal(first.items.length,MEDIA_PAGE_SIZE);assert.equal(first.pages,43);assert.equal(first.items[0].id,6);
  const second=queryMedia(items,{...filters,page:2},now);assert.equal(second.items[0].id,30);assert.ok(!second.items.some(item=>first.items.includes(item)));
  const last=queryMedia(items,{...filters,page:10000},now);assert.equal(last.page,43);assert.equal(last.items.length,23);assert.equal(last.items.at(-1).id,1036);
  assert.equal(queryMedia(items,{...filters,page:-20},now).page,1);assert.equal(items[0].id,6);
});
test('search matches all terms across filename, Alt and caption without changing the original catalog',()=>{
  const result=queryMedia(items,{...filters,query:'МОСКВА архив'},now);assert.equal(result.total,515);assert.ok(result.items.every(item=>item.alt==='Москва вечер'));
  assert.equal(queryMedia(items,{...filters,query:'photo-1031.jpg'},now).items[0].id,1036);
  const empty=queryMedia(items,{...filters,query:'не существует',page:20},now);assert.equal(empty.total,0);assert.equal(empty.page,1);assert.equal(empty.pages,1);assert.deepEqual(empty.items,[]);
});
test('date and source filters distinguish actual uploads from seed files and exclude hidden items',()=>{
  const hidden={...items[0],id:5000,trashedAt:now};
  const mixed=[...seedMedia,...items,hidden,{...items[0],id:5001,name:'report.pdf',type:'document'}];
  assert.equal(queryMedia(mixed,{...filters,period:'7'},now).total,169);
  assert.equal(queryMedia(mixed,{...filters,origin:'upload'},now).total,1031);
  assert.equal(queryMedia(mixed,{...filters,type:'document'},now).total,1);
  assert.equal(queryMedia(mixed,{...filters,type:'all'},now).total,1038);
  assert.equal(queryMedia(mixed,{...filters,trashed:true},now).total,1);
  assert.equal(queryMedia(mixed,{...filters,trashed:true},now).items[0].id,5000);
  assert.ok(seedMedia.every(item=>item.createdAt===undefined && item.size===undefined));
});
test('sorting supports newest, oldest, natural filenames and real file size',()=>{
  assert.equal(queryMedia(items,{...filters,sort:'oldest'},now).items[0].id,1036);
  assert.equal(queryMedia(items,{...filters,sort:'name'},now).items[1].name,'photo-2.jpg');
  assert.equal(queryMedia(items,{...filters,sort:'largest'},now).items[0].id,1036);
});
test('image uploads reject empty, oversized, unsupported or misleading files while library documents remain supported',()=>{
  assert.equal(validateMediaFile({name:'Фото.JPG',type:'image/jpeg',size:100},true),null);
  assert.equal(validateMediaFile({name:'photo.webp',type:'image/webp',size:MAX_MEDIA_BYTES},true),null);
  assert.match(validateMediaFile({name:'photo.png',type:'image/png',size:0},true),/пустой/);
  assert.match(validateMediaFile({name:'photo.png',type:'image/png',size:MAX_MEDIA_BYTES+1},true),/15 МБ/);
  assert.ok(validateMediaFile({name:'photo.jpg',type:'text/html',size:100},true));
  assert.ok(validateMediaFile({name:'photo.svg',type:'image/svg+xml',size:100},true));
  assert.ok(validateMediaFile({name:'report.pdf',type:'application/pdf',size:100},true));
  assert.equal(validateMediaFile({name:'report.pdf',type:'application/pdf',size:100},false),null);
});
test('displayed metadata never invents dimensions, dates or sizes, and storage errors explain recovery',()=>{
  assert.match(mediaDetails(seedMedia[0]),/512 × 512.*Демо-файл/);assert.doesNotMatch(mediaDetails(seedMedia[0]),/МБ|КБ/);
  assert.match(mediaDetails({...items[0],width:1200,height:800,size:1048576}),/1200 × 800.*1.0 МБ/);
  assert.match(mediaError(new DOMException('Quota','QuotaExceededError')),/Недостаточно места/);
});
