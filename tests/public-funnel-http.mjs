import assert from 'node:assert/strict';
const origin='http://127.0.0.1:8030';let checks=0;
function check(value,message){assert.ok(value,message);checks++;}
async function send(payload,options={}){
  const r=await fetch(origin+'/metrics/index.php',{method:options.method||'POST',headers:{'Content-Type':'application/json',Origin:origin,...options.headers},body:options.method==='GET'?undefined:options.raw??JSON.stringify(payload),signal:AbortSignal.timeout(15000)});
  check(r.status===(options.status??204),'metrics HTTP '+r.status);check(!r.headers.has('set-cookie'),'collector sets no cookie');return r;
}
async function login(role){
  const r=await fetch(origin+'/api/index.php?action=auth.login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'comparison-'+role+'@example.test',password:'Comparison-QA-2026-password'})});
  check(r.ok,'local synthetic sign-in '+role);return r.headers.getSetCookie().at(-1).split(';')[0];
}
async function report(cookie,days=30,status=200){const r=await fetch(origin+'/api/index.php?action=owner.public-funnel&days='+days,{headers:{Cookie:cookie||''}});check(r.status===status,'report HTTP '+r.status);return r.json();}
const base={event:'order_click',edition:'business',term:'annual',locale:'ru'};
await send(base,{method:'GET',status:405});
await send(base,{headers:{Origin:'https://other.example'},status:403});
await send(base,{headers:{Origin:''},status:403});
await send(base,{headers:{'Sec-Fetch-Site':'cross-site'},status:403});
await send(base,{headers:{'Content-Type':'text/plain'},status:415});
await send(base,{raw:'x'.repeat(1025),status:413});
await send(base,{raw:'{',status:422});
await send({...base,email:'must-not-be-stored@example.test'},{status:422});
await send({...base,event:'payment_confirmed'},{status:422});
const owner=await login('owner'),editor=await login('editor');
await report('',30,401);await report(editor,30,403);await report(owner,8,422);
const beforeReport=(await report(owner)).report;
const before=beforeReport.rows.reduce((n,row)=>n+row.hits,0);
await send(base,{headers:{DNT:'1'}});await send(base,{headers:{'Sec-GPC':'1'}});
check((await report(owner)).report.rows.reduce((n,row)=>n+row.hits,0)===before,'privacy signals add no events');
await Promise.all(Array.from({length:12},()=>send(base)));
for(const event of ['comparison_view','details_click','demo_click','product_order_click','checkout_open'])await send({...base,event,edition:event==='comparison_view'?'all':'business'});
await send({...base,event:'checkout_open',edition:'content',term:'lifetime',locale:'en'});
const result=(await report(owner)).report;
check(result.days===30&&result.timezone==='UTC','explicit report period and timezone');
const previousBusinessClicks=(beforeReport.rows.find(row=>row.event==='order_click'&&row.edition==='business'&&row.term==='annual'&&row.locale==='ru')?.hits??0);
check(result.rows.some(row=>row.event==='order_click'&&row.edition==='business'&&row.term==='annual'&&row.locale==='ru'&&row.hits===previousBusinessClicks+12),'atomic increments retain every accepted event');
const previousContentOpens=(beforeReport.rows.find(row=>row.event==='checkout_open'&&row.edition==='content'&&row.term==='lifetime'&&row.locale==='en')?.hits??0);
check(result.rows.some(row=>row.event==='checkout_open'&&row.edition==='content'&&row.term==='lifetime'&&row.locale==='en'&&row.hits===previousContentOpens+1),'edition, term and language dimensions stored');
check(result.rows.every(row=>['edition,event,hits,locale,term','edition,event,hits,locale,path,term'].includes(Object.keys(row).sort().join(','))),'report contains no raw visitor data');
console.log(checks+' collector, privacy, aggregate persistence and report access checks passed');
