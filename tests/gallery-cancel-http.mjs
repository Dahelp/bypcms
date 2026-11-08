import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFile,writeFile} from 'node:fs/promises';
const origin=process.env.BYPCMS_SHOP_TEST_ORIGIN||'http://127.0.0.1:8059';
assert.match(origin,/^http:\/\/127\.0\.0\.1:\d+$/);
const fixture=JSON.parse(await readFile('outputs/gallery-acceptance/final-fixture.json','utf8'));
const product=fixture.products[0],php=process.env.BYPCMS_TEST_PHP||'C:/xampp82/php/php.exe';
let checks=0;const check=(ok,message)=>{assert.ok(ok,message);checks++};
const inspect=ref=>JSON.parse(execFileSync(php,['tests/gallery-final-fixture.php',fixture.root,'inspect',ref,String(product.variant)],{encoding:'utf8'}));
class Buyer{
 jar=new Map;
 async request(path,data){const r=await fetch(origin+path,{method:data?'POST':'GET',redirect:'manual',headers:{Cookie:[...this.jar].map(([k,v])=>k+'='+v).join('; '),...(data?{'Content-Type':'application/x-www-form-urlencoded'}:{})},body:data?new URLSearchParams(data):undefined});for(const c of r.headers.getSetCookie()){const [k,...v]=c.split(';')[0].split('=');this.jar.set(k,v.join('='))}return{status:r.status,text:await r.text(),location:r.headers.get('location')}}
}
const field=(html,name)=>html.match(new RegExp('name="'+name+'" value="([^"]*)"'))?.[1];
const prepare=async()=>{
 const buyer=new Buyer;const p=await buyer.request('/product/'+product.slug+'/');const csrf=field(p.text,'csrf');
 await buyer.request('/cart/',{action:'add',variant:product.variant,quantity:2,csrf});
 const form=await buyer.request('/checkout/?shipping=pickup');
 const data={action:'checkout',csrf,token:field(form.text,'token'),quote:field(form.text,'quote'),name:'QA Cancel Buyer',email:'cancel@example.test',phone:'+79000000000',shipping:'pickup',promo:'',terms:1,consent:1};
 const r=await buyer.request('/checkout/',data);check(r.status===303,'order created');const ref=new URL(r.location,origin).searchParams.get('ref');return{buyer,csrf,ref,url:r.location};
};
const initial=inspect('').variant.stock;
const a=await prepare();check(inspect(a.ref).variant.stock===initial-2,'checkout reserves two');
let r=await a.buyer.request(a.url+'&cancel=1');check(r.text.includes('Да, отменить заказ')&&r.text.includes('Оставить заказ')&&!r.text.includes('data-confirm="Отменить заказ'),'native confirmation without JavaScript');
await a.buyer.request(a.url);check(inspect(a.ref).order.state==='pending'&&inspect(a.ref).variant.stock===initial-2,'leave confirmation keeps reservation');
r=await a.buyer.request('/order/',{action:'cancel',csrf:'invalid',ref:a.ref});check(r.status===422&&inspect(a.ref).order.state==='pending','cancel checks CSRF');
const stranger=new Buyer;r=await stranger.request(a.url);check(r.status===404,'foreign order not exposed');
const cancel={action:'cancel',ref:a.ref,csrf:a.csrf};
const replies=await Promise.all([a.buyer.request('/order/',cancel),a.buyer.request('/order/',cancel)]);check(replies.every(x=>x.status===303),'repeated concurrent cancellation succeeds safely');
let state=inspect(a.ref);check(state.order.state==='canceled'&&Number(state.order.stock_released)===1&&state.variant.stock===initial,'stock released exactly once');check(Number(state.payments.n)===0&&Number(state.mail.n)===1,'cancel does not create payment or duplicate notice');
await a.buyer.request('/order/',cancel);check(inspect(a.ref).variant.stock===initial,'third click cannot add stock');
const b=await prepare();r=await b.buyer.request('/order/',{action:'pay',csrf:b.csrf,ref:b.ref});check(r.status===303&&r.location.startsWith('http://127.0.0.1:8049/pay/'),'mock payment started');const paymentId=r.location.split('/').pop();
r=await b.buyer.request('/order/',{action:'cancel',csrf:b.csrf,ref:b.ref});state=inspect(b.ref);check(r.status===422&&state.order.state==='pending'&&state.variant.stock===initial-2,'unconfirmed provider payment keeps stock reserved');
const control=async data=>(await fetch('http://127.0.0.1:8049/control',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)})).json();
await control({id:paymentId,patch:{status:'canceled',paid:false}});
await b.buyer.request(b.url);state=inspect(b.ref);check(state.order.state==='canceled'&&state.variant.stock===initial,'verified provider cancellation releases stock');
await Promise.all([b.buyer.request('/order/',{action:'cancel',csrf:b.csrf,ref:b.ref}),b.buyer.request(b.url)]);check(inspect(b.ref).variant.stock===initial&&Number(inspect(b.ref).mail.n)===1,'provider replay cannot release stock or notify twice');
const c=await prepare();r=await c.buyer.request('/order/',{action:'pay',csrf:c.csrf,ref:c.ref});const paidId=r.location.split('/').pop();await control({id:paidId,patch:{status:'succeeded',paid:true}});await c.buyer.request(c.url);
r=await c.buyer.request('/order/',{action:'cancel',csrf:c.csrf,ref:c.ref});state=inspect(c.ref);check(r.status===422&&state.order.state==='paid'&&Number(state.order.stock_released)===0&&state.variant.stock===initial-2,'paid cancellation rejected without freeing sold units');
const d=await prepare();await Promise.all([d.buyer.request('/order/',{action:'pay',csrf:d.csrf,ref:d.ref}),d.buyer.request('/order/',{action:'cancel',csrf:d.csrf,ref:d.ref})]);
let raced=inspect(d.ref);check(Number(raced.payments.n)<=1&&raced.variant.stock===(raced.order.state==='canceled'?initial-2:initial-4),'pay/cancel race keeps reservation consistent');
if(raced.order.state==='pending'){const all=await (await fetch('http://127.0.0.1:8049/control')).json();const remote=all.payments.find(x=>x.metadata.shop_order===d.ref);check(Boolean(remote),'racing payment recoverable');await control({id:remote.id,patch:{status:'canceled',paid:false}});await d.buyer.request(d.url);}
check(inspect(d.ref).variant.stock===initial-2,'race releases reservation once after confirmed cancellation');
await writeFile('outputs/gallery-acceptance/cancel-http-result.json',JSON.stringify({checks,origin,initial,finalStock:state.variant.stock,canceled:[a.ref,b.ref],paid:c.ref},null,2));
console.log('Gallery cancellation HTTP: '+checks+' checks passed');
