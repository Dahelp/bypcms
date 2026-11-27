import test from 'node:test';
import assert from 'node:assert/strict';
import {checkoutComparisonSource,comparisonTag,parseComparisonTag,withComparisonSource,comparisonPayload,trackComparison} from '../lib/comparison-tracking.ts';

test('all attribution choices round-trip without a visitor ID',()=>{
  for(const edition of ['business','commerce','content'])for(const term of ['annual','lifetime'])for(const locale of ['ru','en']){
    const context={edition,term,locale};assert.deepEqual(parseComparisonTag(comparisonTag(context)),context);
  }
  for(const value of [null,'','business','commerce.monthly.ru','business.annual.de','content.annual.en.extra','email@example.test'])assert.equal(parseComparisonTag(value),null);
});
test('attribution preserves configuration and fragment and never decorates external URLs',()=>{
  const tag='commerce.lifetime.en';
  const href=withComparisonSource('/en/order/?edition=Commerce&term=lifetime&modules=&services=#details',tag,'details');
  const url=new URL(href,'https://bypcms.ru');assert.equal(url.searchParams.get('term'),'lifetime');assert.equal(url.searchParams.get('cmp'),tag);assert.equal(url.hash,'#details');
  assert.equal(url.searchParams.get('cmp_via'),'details');
  assert.equal(withComparisonSource('https://example.test/order/',tag),'https://example.test/order/');
  assert.equal(withComparisonSource('//example.test/order/',tag),'//example.test/order/');
  assert.equal(withComparisonSource('/order/','bad-tag'),'/order/');
});
test('payload is a closed set of catalog dimensions',()=>{
  assert.deepEqual(comparisonPayload('order_click',{edition:'content',term:'annual',locale:'ru'}),{event:'order_click',edition:'content',term:'annual',locale:'ru'});
});
test('transport is non-blocking, cookie-free, deduplicates page observations and respects privacy signals',async()=>{
  const previous={window:globalThis.window,fetch:globalThis.fetch,navigator:Object.getOwnPropertyDescriptor(globalThis,'navigator')};
  const sent=[];
  try {
    globalThis.window={};Object.defineProperty(globalThis,'navigator',{configurable:true,value:{doNotTrack:'1'}});
    globalThis.fetch=(url,options)=>{sent.push({url,...options});return Promise.resolve({ok:true});};
    const context={edition:'business',term:'lifetime',locale:'en'};
    trackComparison('order_click',context);assert.equal(sent.length,0);
    const sourceQuery=new URLSearchParams('cmp=business.lifetime.en&cmp_via=details');
    assert.equal(checkoutComparisonSource(sourceQuery),undefined);
    Object.defineProperty(globalThis,'navigator',{configurable:true,value:{globalPrivacyControl:true}});trackComparison('order_click',context);assert.equal(sent.length,0);
    assert.equal(checkoutComparisonSource(sourceQuery),undefined);
    Object.defineProperty(globalThis,'navigator',{configurable:true,value:{}});
    assert.deepEqual(checkoutComparisonSource(sourceQuery),{tag:'business.lifetime.en',via:'details'});
    assert.deepEqual(checkoutComparisonSource(new URLSearchParams('cmp=content.annual.ru')),{tag:'content.annual.ru',via:'unknown'});
    assert.equal(checkoutComparisonSource(new URLSearchParams('cmp=invalid&cmp_via=direct')),undefined);
    trackComparison('checkout_open',context,true);trackComparison('checkout_open',context,true);assert.equal(sent.length,1);
    trackComparison('order_click',context);trackComparison('order_click',context);assert.equal(sent.length,3);
    assert.equal(sent[0].credentials,'omit');assert.equal(sent[0].referrerPolicy,'no-referrer');assert.equal(sent[0].keepalive,true);
    assert.deepEqual(Object.keys(JSON.parse(sent[0].body)).sort(),['edition','event','locale','term']);
    globalThis.fetch=()=>Promise.reject(new Error('offline'));assert.doesNotThrow(()=>trackComparison('demo_click',context));await Promise.resolve();
    globalThis.fetch=()=>{throw new Error('blocked')};assert.doesNotThrow(()=>trackComparison('details_click',context));
  } finally {
    if(previous.window===undefined)delete globalThis.window;else globalThis.window=previous.window;
    globalThis.fetch=previous.fetch;
    if(previous.navigator)Object.defineProperty(globalThis,'navigator',previous.navigator);else delete globalThis.navigator;
  }
});
