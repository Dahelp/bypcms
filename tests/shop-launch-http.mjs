// Complete launch-state regression on a disposable installed store.
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
const origin=process.env.BYPCMS_SHOP_TEST_ORIGIN||'http://127.0.0.1:8073';assert.match(origin,/^http:\/\/127\.0\.0\.1:\d+$/);
const publishOnly=process.argv[2]==='publish';let checks=0;const check=(ok,m)=>{assert.ok(ok,m);checks++};
const login=await fetch(origin+'/api/index.php?action=auth.login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'shop-owner@example.test',password:'BYPCMS-Shop-Only-2026'})});check(login.ok,'isolated owner');const auth=await login.json(),owner=login.headers.getSetCookie().at(-1).split(';')[0];
const api=async(action,body)=>{const r=await fetch(origin+'/api/index.php?action='+action,{method:body?'POST':'GET',headers:{Cookie:owner,'X-CSRF-Token':auth.csrf,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});const data=await r.json();check(r.status===200,action+': '+data.error);return data};
const records=async()=>(await api('content.list')).pages;
const documents=['terms','delivery','returns','privacy'];
async function publish(){for(const slug of documents){const p=(await records()).find(p=>p.slug===slug);check(!!p,'editable '+slug);await api('content.save',{...p,status:'published',published_at:null,content:'<h2>QA published '+slug+'</h2><p>Explicit synthetic terms for isolated acceptance only.</p>'});}}
if(publishOnly){await publish();console.log('Published synthetic fixture documents through the real CMS');process.exit(0);}
for(const slug of documents){const p=(await records()).find(p=>p.slug===slug);check(!!p,'starter '+slug);if(p.status!=='draft')await api('content.save',{...p,status:'draft'});}
const jar=new Map();async function request(path,body){const r=await fetch(origin+path,{method:body?'POST':'GET',redirect:'manual',headers:{Cookie:[...jar].map(v=>v.join('=')).join('; '),...(body?{'Content-Type':'application/x-www-form-urlencoded'}:{})},body:body?new URLSearchParams(body):undefined});for(const h of r.headers.getSetCookie()){const [k,...v]=h.split(';')[0].split('=');jar.set(k,v.join('='))}const html=await r.text();check(!/Warning:|Fatal error:/.test(html),'clean '+path);return {status:r.status,html,location:r.headers.get('location')}}
const field=(h,n)=>h.match(new RegExp('name="'+n+'" value="([^"]*)"'))?.[1];
for(const theme of ['gallery','market','luxe']){await api('content.configure',{theme});const root=await request('/');for(const slug of documents)check(!root.html.includes('href="/'+slug+'/"'),theme+' does not link to unpublished '+slug);check((await request('/privacy/')).status===404,'draft document private');}
const admin=await fetch(origin+'/manage/',{headers:{Cookie:owner}});const adminHtml=await admin.text();check(adminHtml.includes('Подготовьте магазин к приёму заказов')&&documents.every(slug=>adminHtml.includes('editor=')),'owner sees launch steps');
const product=await request('/product/forma-chair/'),csrf=field(product.html,'csrf');check(!!csrf,'buyer CSRF');
check((await request('/cart/',{csrf,action:'add',variant:1,quantity:1})).status===303,'cart remains usable before launch');
const cart=await request('/cart/');check(cart.html.includes('Оформление временно недоступно')&&!cart.html.includes('href="/checkout/?'),'cart explains launch state before contact input');
const unavailable=await request('/checkout/');check(unavailable.status===200&&!unavailable.html.includes('id="shop-checkout"')&&unavailable.html.includes('Вернуться в корзину'),'direct checkout does not request personal data before launch');
await publish();
const ready=await request('/checkout/');check(ready.html.includes('id="shop-checkout"'),'publication enables checkout');
const privacy=(await records()).find(p=>p.slug==='privacy');await api('content.save',{...privacy,status:'published',published_at:'2099-01-01T12:00'});
const rejected=await request('/checkout/',{action:'checkout',csrf,token:field(ready.html,'token'),quote:field(ready.html,'quote'),name:'KEEP_LAUNCH_NAME',email:'buyer@example.test',phone:'+79990000000',address:'QA address',shipping:'delivery',promo:'',consent:1,terms:1});
check(rejected.status===422&&!rejected.location&&rejected.html.includes('Магазин ещё не опубликовал условия покупки'),'backend rejects terms unpublished during checkout');check(rejected.html.includes('value="KEEP_LAUNCH_NAME"')&&rejected.html.includes('value="buyer@example.test"'),'rejected checkout retains entered values');check((await request('/product/forma-chair/')).html.match(/В наличии: (\d+)/)?.[1]===product.html.match(/В наличии: (\d+)/)?.[1],'failed checkout reserves no stock');
const current=(await records()).find(p=>p.slug==='privacy');await api('content.save',{...current,status:'published',published_at:null});
check((await request('/cart/')).html.includes('href="/checkout/?'),'correcting publication reopens same cart');
check(!(await (await fetch(origin+'/manage/',{headers:{Cookie:owner}})).text()).includes('id="launch-documents"'),'launch notice resolves after publication');
await api('content.configure',{theme:'gallery'});console.log('Shop launch: '+checks+' checks passed');
