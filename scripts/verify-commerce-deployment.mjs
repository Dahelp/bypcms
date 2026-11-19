// Read-only deployment checks. Does not create accounts, orders, charges or emails.
const origin=process.env.BYPCMS_ORIGIN||'https://bypcms.ru';
for(const [path,expected]of [
 ['/commerce/index.php?action=bootstrap',200],
 ['/commerce/index.php?action=owner.status',401],
 ['/commerce/index.php?action=owner.order&id=0',401],
 ['/commerce/index.php?action=owner.refund.approve',401],
 ['/commerce/index.php?action=owner.bank.settings',401],
 ['/commerce/index.php?action=owner.mail.templates',401],
 ['/commerce/index.php?action=owner.mail&id=0',401],
 ['/commerce/index.php?action=owner.mail.resend',401],
 ['/commerce/index.php?action=owner.mail.test.process',401],
 ['/commerce/index.php?action=owner.invoice.confirm',401],
 ['/commerce/index.php?action=owner.invoice.issue',401],
 ['/account/invoice.php?id=0',404],
 ['/commerce/index.php?action=order&id=0',401],
 ['/_core/commerce-worker.php',403],
 ['/account/order.php?id=0',302],
]){
 const response=await fetch(origin+path,{redirect:'manual',signal:AbortSignal.timeout(20000)});
 if(response.status!==expected)throw new Error(`${path}: expected ${expected}, received ${response.status}`);
 if(path.includes('bootstrap')){
  const data=await response.json();
  if(data.catalog?.modules?.some(m=>m.module_key==='analytics')||data.catalog?.availability?.some(a=>a.module_key==='analytics'&&a.availability!=='hidden')||data.catalog?.availability?.some(a=>a.module_key==='forms'&&a.edition==='Commerce'&&a.availability!=='hidden'))throw new Error('Unaccepted capabilities exposed for sale');
  if(typeof data.bank_available!=='boolean')throw new Error('Invoice readiness missing');
  if(!data.catalog?.modules?.length||data.catalog.editions.content.annual!==790000)throw new Error('Commerce catalog missing or invalid');
  if(JSON.stringify(data).match(/shop_secret|smtp_password|_cipher|correspondent|account_hint/))throw new Error('Private setting appeared in public bootstrap');
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
 if(r.status!==200||!body.includes('/legal/documents/2026-11-13.1.json')||body.includes('Fatal error:'))throw new Error('Public legal document unavailable: '+key);
 console.log('PASS public legal document '+key);
}
const contacts=await fetch(origin+'/contacts/',{signal:AbortSignal.timeout(20000)});const text=await contacts.text();
if(contacts.status!==200||!text.includes('tel:+79296252500')||!text.includes('550519989590'))throw new Error('Confirmed public contacts missing');
console.log('PASS confirmed seller contacts');

// An expired buyer session must resume the same private purchase/download after login.
for(const target of ['/account/purchase.php?id=0','/account/purchase.php?id=0&download=1']){
 const r=await fetch(origin+target,{redirect:'manual',signal:AbortSignal.timeout(20000)});
 const login=new URL(r.headers.get('location')||'/',origin);
 if(r.status!==302||login.origin!==new URL(origin).origin||login.pathname!=='/account/'||login.searchParams.get('next')!==target)throw new Error('Private purchase sign-in return path lost');
 const form=await fetch(login,{signal:AbortSignal.timeout(20000)});const body=await form.text();
 if(form.status!==200||!body.includes('name="next" value="'+target.replaceAll('&','&amp;')+'"'))throw new Error('Sign-in rejected safe purchase return path');
 console.log('PASS expired session → sign-in → '+target);
}
for(const next of ['https://untrusted.example/','//untrusted.example/','/owner/','/account/purchase.php/invalid']){
 const r=await fetch(origin+'/account/?next='+encodeURIComponent(next),{signal:AbortSignal.timeout(20000)});
 if(r.status!==200||!(await r.text()).includes('name="next" value="/account/"'))throw new Error('Unsafe sign-in return path accepted');
}
console.log('PASS sign-in return URL allowlist');

// Read-only recovery checks; no reset request or email is generated.
if(!html.includes('/account/forgot.php'))throw new Error('Password recovery entry missing');
for(const [path,required] of [['/account/forgot.php','Восстановление пароля'],['/account/reset.php','Ссылка недействительна']]){
 const r=await fetch(origin+path,{redirect:'manual',signal:AbortSignal.timeout(20000)}),body=await r.text();
 if(r.status!==200||!body.includes(required)||body.includes('Fatal error:')||body.includes('Warning:'))throw new Error('Recovery page unavailable: '+path);
 if(!r.headers.get('cache-control')?.includes('no-store')||r.headers.get('referrer-policy')?.split(',').at(-1).trim()!=='no-referrer')throw new Error('Recovery privacy headers missing');
 console.log('PASS private recovery page '+path);
}

for(const edition of ['content','business','commerce']){const r=await fetch(origin+'/commerce/index.php?action=quote',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({edition,term:'annual',modules:['analytics'],services:[]}),signal:AbortSignal.timeout(20000)});const j=await r.json();if(r.status!==422||!j.error?.includes('недоступен'))throw new Error('Unsupported sales not blocked: '+edition);console.log('PASS unsupported Analytics sale rejected: '+edition);}
const planned=await fetch(origin+'/modules/analytics/',{signal:AbortSignal.timeout(20000)});const plannedHtml=await planned.text();if(planned.status!==200||!plannedHtml.includes('В разработке · не продаётся')||plannedHtml.includes('24 892'))throw new Error('Planned module still marketed as ready');console.log('PASS public planned module status');
