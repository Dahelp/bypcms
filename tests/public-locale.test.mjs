import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {localeHref,publicMetadata} from '../lib/public-locale.ts';

test('switching languages preserves a configured build and its anchor',()=>{
 const ru='/order/?edition=Commerce&term=lifetime&modules=seo&services=launch%2Csupport';
 assert.equal(localeHref(ru,'en'),'/en'+ru);
 assert.equal(localeHref('/en/?edition=Content&term=annual#builder','ru'),'/?edition=Content&term=annual#builder');
 assert.equal(localeHref('/en/portfolio/chronicle/?view=full#details','en'),'/en/portfolio/chronicle/?view=full#details');
});
test('buyer login returns to the same checkout in the selected language',()=>{
 const link=new URL(localeHref('/account/?next=%2Forder%2F%3Fedition%3DCommerce%26term%3Dlifetime','en'),'https://bypcms.ru');
 assert.equal(link.pathname,'/account/');assert.equal(link.searchParams.get('lang'),'en');
 assert.equal(link.searchParams.get('next'),'/en/order/?edition=Commerce&term=lifetime');
});
test('external destinations and download assets keep their URLs',()=>{
 for(const href of ['https://demo.bypcms.ru/gallery/','mailto:hello@bypcms.ru','/showcase/gallery.jpg','/legal/documents/2026-11-13.1.en.json','//example.test'])assert.equal(localeHref(href,'en'),href);
});
test('each localized page has corresponding canonical and alternate URLs',()=>{
 const meta=publicMetadata('/portfolio/chronicle/','Chronicle','An editorial demo','en');
 assert.equal(meta.alternates.canonical,'/en/portfolio/chronicle/');
 assert.equal(meta.alternates.languages.ru,'/portfolio/chronicle/');
 assert.equal(meta.alternates.languages.en,'/en/portfolio/chronicle/');
});
test('English legal documents retain every source section and paragraph',async()=>{
 const ru=JSON.parse(await readFile(new URL('../server/legal/documents/2026-11-13.1.json',import.meta.url),'utf8'));
 const en=JSON.parse(await readFile(new URL('../server/legal/documents/2026-11-13.1.en.json',import.meta.url),'utf8'));
 assert.equal(en.version,ru.version);assert.deepEqual(Object.keys(en.documents),Object.keys(ru.documents));
 for(const [key,doc]of Object.entries(ru.documents))assert.deepEqual(en.documents[key].sections.map(s=>s.paragraphs.length),doc.sections.map(s=>s.paragraphs.length),key);
});
test('public frontend and PHP buyer pages use the same translation catalog',async()=>{
 const frontend=JSON.parse(await readFile(new URL('../lib/public-en.json',import.meta.url),'utf8'));
 const account=JSON.parse(await readFile(new URL('../server/_core/public-en.json',import.meta.url),'utf8'));
 assert.deepEqual(frontend,account);
 for(const [key,value]of Object.entries(frontend)){assert.ok(value.trim(),key);assert.doesNotMatch(value,/[А-Яа-яЁё]/,key);}
});
