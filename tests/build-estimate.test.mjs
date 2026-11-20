import assert from 'node:assert/strict';
import test from 'node:test';
import {estimateBuild} from '../lib/build-estimate.ts';

const catalog=[
 {slug:'ux-ui',amountMinor:6500000,billing:'once'},
 {slug:'frontend',amountMinor:8500000,billing:'once'},
 {slug:'launch',amountMinor:2500000,billing:'once'},
 {slug:'migration',amountMinor:1800000,billing:'once'},
 {slug:'support',amountMinor:1200000,billing:'monthly'},
];
test('no services retains the exact license price',()=>{
 const value=estimateBuild(4990000,catalog,[]);
 assert.equal(value.initialMinor,4990000);assert.equal(value.hasServices,false);
});
test('all selected services contribute to the initial estimate, with support for one month',()=>{
 const value=estimateBuild(4990000,catalog,catalog.map(service=>service.slug));
 assert.equal(value.licenseMinor,4990000);
 assert.equal(value.oneTimeMinor,19300000);
 assert.equal(value.monthlyMinor,1200000);
 assert.equal(value.initialMinor,25490000);
});
test('support stays separate from one-time work and responds to license changes',()=>{
 assert.equal(estimateBuild(4990000,catalog,['support']).initialMinor,6190000);
 assert.equal(estimateBuild(990000,catalog,['support']).initialMinor,2190000);
 assert.equal(estimateBuild(0,catalog,['support']).monthlyMinor,1200000);
});
test('deselection, duplicate keys and unknown selections do not overcharge the estimate',()=>{
 const selected=catalog.map(service=>service.slug).filter(slug=>slug!=='frontend');
 assert.equal(estimateBuild(4990000,catalog,selected).initialMinor,16990000);
 assert.equal(estimateBuild(4990000,catalog,['ux-ui','ux-ui','unknown']).initialMinor,11490000);
});
