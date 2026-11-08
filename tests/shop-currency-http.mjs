import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
const origin=process.env.BYPCMS_SHOP_TEST_ORIGIN||'http://127.0.0.1:8059';
assert.match(origin,/^http:\/\/127\.0\.0\.1:\d+$/);
let checks=0;const check=(ok,message)=>{assert.ok(ok,message);checks++};
class Visitor{
 jar=new Map;
 async request(path,body){const r=await fetch(origin+path,{method:body?'POST':'GET',redirect:'manual',headers:{Cookie:[...this.jar].map(([k,v])=>k+'='+v).join('; '),...(body?{'Content-Type':'application/x-www-form-urlencoded'}:{})},body:body?new URLSearchParams(body):undefined});for(const cookie of r.headers.getSetCookie()){const [k,...v]=cookie.split(';')[0].split('=');this.jar.set(k,v.join('='))}return{status:r.status,text:await r.text(),location:r.headers.get('location'),policy:r.headers.get('content-security-policy')}}
}
const hidden=(html,key)=>html.match(new RegExp('name="'+key+'" value="([^"]*)"'))?.[1];
const admin=new Visitor,buyer=new Visitor;let r=await admin.request('/manage/');
await admin.request('/manage/',{csrf:hidden(r.text,'csrf'),action:'login',email:'shop-owner@example.test',password:'BYPCMS-Shop-Only-2026'});
r=await admin.request('/manage/');const adminCsrf=hidden(r.text,'csrf');check(Boolean(adminCsrf),'native admin signed in');
const slug='kopecks-'+Date.now();
r=await admin.request('/manage/?section=products&product=new',{csrf:adminCsrf,action:'product',id:0,revision:0,title:'Товар с копейками',slug,category:'Проверка цен',collection:'QA',brand:'QA',description:'<p>Изолированный тест</p>',specs:'Тест',cover:'/themes/gallery/assets/object-2.webp',status:'published',variants:JSON.stringify([{sku:slug,title:'Основной',price:'37.45',stock:4,active:1}])});
check(r.status===303,'fractional product saved');
const product=await buyer.request('/product/'+slug+'/');check(product.text.includes('37,45 ₽')&&!product.text.includes('38 ₽'),'product price is not rounded');
const variant=hidden(product.text,'variant'),csrf=hidden(product.text,'csrf');check(Boolean(variant&&csrf),'actual variant and CSRF');
check(product.policy.endsWith("form-action 'self'")&&!product.policy.includes('8049'),'product has same-origin form policy');
for(const [min,max,found] of [['37.45','37.45',true],['37.46','',false],['','37.44',false],['37,45','37,45',true]]){
 const f=await buyer.request('/catalog/?'+new URLSearchParams({q:slug,min,max}));check(f.text.includes('g-card-photo')===found,'exact filter '+min+' / '+max);
}
for(const query of ['min=50&max=10','min=0.001','min=1e3','min[]=10']){const f=await buyer.request('/catalog/?q='+slug+'&'+query);check(f.text.includes('role="alert"')&&!f.text.includes('g-card-photo')&&!f.text.includes('Warning:'),'invalid price filter '+query)}
await buyer.request('/cart/',{csrf,action:'add',variant,quantity:3});
r=await buyer.request('/cart/?shipping=pickup&promo=WELCOME');check(r.text.includes('112,35 ₽')&&r.text.includes('11,23 ₽')&&r.text.includes('101,12 ₽'),'pickup and discount retain kopecks');
r=await buyer.request('/cart/?shipping=delivery&promo=INVALID');check(r.text.includes('Промокод не действует')&&!r.text.includes('К оформлению'),'invalid promo cannot proceed');
r=await buyer.request('/cart/?shipping=delivery&promo=WELCOME');check(r.text.includes('1 001,12 ₽'),'delivery total retains kopecks');
r=await buyer.request('/checkout/');check(r.text.includes('1 001,12 ₽'),'checkout uses cart preferences and exact total');
const data={csrf,action:'checkout',name:'Currency Buyer',email:'buyer@example.test',phone:'+79990000000',address:'QA address',shipping:'delivery',promo:'WELCOME',terms:1,consent:1,token:hidden(r.text,'token'),quote:hidden(r.text,'quote')};
r=await buyer.request('/checkout/',{...data,email:'wrong'});check(r.status===422&&r.text.includes('value="Currency Buyer"')&&r.text.includes('value="wrong"'),'validation retains entered data');
r=await buyer.request('/checkout/',data);check(r.status===303&&r.location.startsWith('/order/?ref='),'order saved');const orderUrl=r.location,ref=new URL(origin+orderUrl).searchParams.get('ref');
r=await buyer.request(orderUrl+'\u0026test_payment_origin=http://127.0.0.1:8443');check(r.text.includes('1 001,12 ₽'),'saved order exact total');
check(r.policy.includes('https://*.yoomoney.ru')&&r.policy.includes('https://*.yookassa.ru'),'order permits gateway redirect origins');
check(r.policy.includes('http://127.0.0.1:8049')&&!r.policy.includes('8443'),'test origin comes from protected configuration, not query');
check(r.policy.includes("script-src 'self'")&&!r.policy.includes("script-src *"),'script restrictions retained');
const pay={csrf,action:'pay',ref};const results=await Promise.all([buyer.request('/order/',pay),buyer.request('/order/',pay)]);
check(results.every(p=>p.status===303)&&results[0].location===results[1].location,'repeated pay uses same confirmation URL');
const control=await(await fetch('http://127.0.0.1:8049/control')).json(),payments=control.payments.filter(p=>p.metadata.shop_order===ref);
check(payments.length===1&&payments[0].amount.value==='1001.12','provider receives exact amount once');
check((await buyer.request(orderUrl)).text.includes('Ожидает оплаты'),'unconfirmed return remains pending');
await fetch(results[0].location,{method:'POST',redirect:'manual'});r=await buyer.request(orderUrl);check(r.text.includes('g-order-state">Оплачен')&&r.text.includes('1 001,12 ₽'),'provider confirmation updates exact saved order');
check((await buyer.request('/checkout/',data)).location===orderUrl,'repeated checkout returns same order');
await writeFile('outputs/gallery-acceptance/currency-http-result.json',JSON.stringify({origin,checks,reference:ref,amount:'1001.12',orderPolicy:r.policy,visualBrowser:false},null,2));
console.log('Gallery currency and payment HTTP: '+checks+' checks passed');
