// Read-only deployment checks. Does not create accounts, orders, charges or emails.
const origin=process.env.BYPCMS_ORIGIN||'https://bypcms.ru';
for(const [path,expected]of [
 ['/commerce/index.php?action=bootstrap',200],
 ['/commerce/index.php?action=owner.status',401],
 ['/commerce/index.php?action=owner.order&id=0',401],
 ['/commerce/index.php?action=owner.refund.approve',401],
 ['/commerce/index.php?action=order&id=0',401],
 ['/_core/commerce-worker.php',403],
 ['/account/order.php?id=0',302],
]){
 const response=await fetch(origin+path,{redirect:'manual',signal:AbortSignal.timeout(20000)});
 if(response.status!==expected)throw new Error(`${path}: expected ${expected}, received ${response.status}`);
 if(path.includes('bootstrap')){
  const data=await response.json();
  if(!data.catalog?.modules?.length||data.catalog.editions.content.annual!==790000)throw new Error('Commerce catalog missing or invalid');
  if(JSON.stringify(data).match(/shop_secret|smtp_password|_cipher/))throw new Error('Private setting appeared in public bootstrap');
  console.log('PASS commerce catalog; online payments '+(data.payments_available?'enabled':'disabled'));
 }else await response.arrayBuffer();
 console.log(`PASS ${path} → ${expected}`);
}
const response=await fetch(origin+'/account/',{signal:AbortSignal.timeout(20000)});const html=await response.text();
if(response.status!==200||!html.includes('Личный кабинет')||html.includes('Warning:')||html.includes('Fatal error:'))throw new Error('Customer account unavailable');
console.log('PASS customer sign-in screen → 200');
if(!html.includes('name="accept_privacy"')||!html.includes('/legal/consent/'))throw new Error('Separate registration consent missing');
for(const key of ['offer','privacy','consent','refunds']){
 const r=await fetch(origin+'/legal/'+key+'/',{signal:AbortSignal.timeout(20000)});const body=await r.text();
 if(r.status!==200||!body.includes('/legal/documents/2026-11-07.1.json')||body.includes('Fatal error:'))throw new Error('Public legal document unavailable: '+key);
 console.log('PASS public legal document '+key);
}
const contacts=await fetch(origin+'/contacts/',{signal:AbortSignal.timeout(20000)});const text=await contacts.text();
if(contacts.status!==200||!text.includes('tel:+79296252500')||!text.includes('550519989590'))throw new Error('Confirmed public contacts missing');
console.log('PASS confirmed seller contacts');
