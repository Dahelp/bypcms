// Full recovery on a disposable paid buyer. No real email, payment or customer database.
import assert from 'node:assert/strict';
import {execFileSync,execFile} from 'node:child_process';
import {writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const root=resolve(process.argv[2]||'outputs/purchase-acceptance-20261118/site'),php=process.env.BYPCMS_TEST_PHP||'C:/xampp82/php/php.exe',origin='http://127.0.0.1:8019';
const fixture=data=>JSON.parse(execFileSync(php,['tests/customer-recovery-fixture.php',root],{input:JSON.stringify(data),encoding:'utf8',timeout:180000}));
let checks=0;const check=(v,label)=>{assert.ok(v,label);checks++;};
const qa=fixture({action:'setup'}),own=data=>fixture({customer:qa.customer,...data});
class Browser {
 cookie='';
 async call(path,body){const r=await fetch(origin+path,{method:body?'POST':'GET',headers:{Cookie:this.cookie,...(body?{'Content-Type':'application/x-www-form-urlencoded'}:{})},body:body?new URLSearchParams(body):undefined,redirect:'manual',signal:AbortSignal.timeout(120000)});for(const c of r.headers.getSetCookie())if(c.startsWith('bypcms_session='))this.cookie=c.split(';')[0];return {r,html:await r.text()};}
 async open(path){let out=await this.call(path);for(let i=0;i<6&&[302,303].includes(out.r.status);i++)out=await this.call(out.r.headers.get('location'));return out;}
}
const csrf=html=>html.match(/name="csrf" value="([a-f0-9]{64})"/)?.[1];
async function login(browser,password){const p=await browser.open('/account/');return browser.call('/account/',{csrf:csrf(p.html),action:'login',email:qa.email,password});}
async function request(browser,email=qa.email,next='/account/purchase.php?id='+qa.order){const p=await browser.open('/account/forgot.php');return browser.call('/account/forgot.php',{csrf:csrf(p.html),email,next});}
async function control(mail){return (await fetch('http://127.0.0.1:8049/control',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({mail})})).json();}
const forgotten=new Browser(),oldSession=new Browser(),otherSession=new Browser(),scanner=new Browser();
check((await login(oldSession,'BYPCMS-QA-Buyer-2026')).r.status===302,'old password signs in');
check((await login(otherSession,'BYPCMS-QA-Buyer-2026')).r.status===302,'independent old session signs in');
check((await oldSession.open('/account/order.php?id='+qa.order)).html.includes('Оплата подтверждена'),'paid order visible before recovery');
let page=await forgotten.open('/account/forgot.php');check(page.r.headers.get('referrer-policy').split(',').at(-1).trim()==='no-referrer'&&page.r.headers.get('cache-control').includes('no-store'),'private recovery headers');
check((await forgotten.call('/account/forgot.php',{csrf:'bad',email:qa.email})).r.status===403,'request CSRF rejected');
check((await request(forgotten,'invalid')).r.status===422,'invalid email rejected');
const unknown=await request(forgotten,'missing-'+Date.now()+'@example.test');check(unknown.r.status===303,'unknown address uses normal response');
let result=await request(forgotten);check(result.r.status===303&&result.r.headers.get('location')===unknown.r.headers.get('location'),'known and unknown responses identical');
let latest=own({action:'latest'}),token=latest.token,id=latest.mail_id;
check(latest.count===1&&latest.tokenOnlyHashed,'one random token stored as digest with encrypted delivery');
check(!JSON.stringify(latest.outbox).includes(token)&&!JSON.stringify(latest.outbox).includes('payload_cipher'),'Owner mail detail cannot reveal usable token');
check(own({action:'status',password:'BYPCMS-QA-Buyer-2026'}).passwordMatches,'request does not change password');
await request(forgotten);check(own({action:'latest'}).count===1,'double request does not duplicate queued email');
fixture({action:'clear-rate'});
const landing=await scanner.call('/account/reset.php?token='+token);check(landing.r.status===303&&landing.r.headers.get('location')==='/account/reset.php','link strips token immediately');
page=await scanner.open('/account/reset.php');check(page.html.includes('name="confirmation"')&&!page.html.includes(token),'clean reset form has no token');
check(own({action:'latest'}).valid,'GET scanner does not consume link');
fixture({action:'smtp',enabled:false});check(own({action:'process',id}).disabled,'disabled SMTP leaves message queued');
check((await request(new Browser(),'unknown-again@example.test')).html.includes('Отправка писем временно недоступна'),'disabled SMTP explained without account disclosure');
fixture({action:'smtp',enabled:true});
await control('temporary');own({action:'process',id});latest=own({action:'latest'});check(latest.outbox.state==='retry','SMTP 451 safely schedules retry');
await control('accept');own({action:'due',id});check(own({action:'process',id}).accepted===1,'same recovery mail delivered after temporary failure');
latest=own({action:'latest'});check(Number(latest.outbox.attempts)===2,'SMTP attempt history retained');
check(own({action:'retry',id}).rejected,'Owner cannot resend recovery link');
const sink=await control('accept');check(sink.messages.some(m=>m.replace(/=\r?\n/g,'').replace(/=([A-F0-9]{2})/g,(_,h)=>String.fromCharCode(parseInt(h,16))).includes('token='+token)),'actual TLS SMTP contains reset link');
const resetPost=(password,confirmation=password,formCsrf=csrf(page.html))=>scanner.call('/account/reset.php',{csrf:formCsrf,form_key:page.html.match(/name="form_key" value="([a-f0-9]{64})"/)?.[1]||'',password,confirmation});
check((await resetPost('A-new-password-2026','A-new-password-2026','bad')).r.status===403,'reset CSRF rejected');
check((await resetPost('short')).r.status===422,'weak password rejected');
check((await resetPost('A-new-password-2026','different')).r.status===422,'confirmation mismatch rejected');
check(own({action:'latest'}).valid,'form errors preserve valid link');
fixture({action:'trigger',enabled:true});try{check((await resetPost('A-new-password-2026')).r.status===503,'database failure is a recoverable error');}finally{fixture({action:'trigger',enabled:false});}
check(own({action:'status',password:'BYPCMS-QA-Buyer-2026'}).passwordMatches&&own({action:'latest'}).valid,'failed transaction preserves password and token');
fixture({action:'queue-trigger',enabled:true});try{check((await resetPost('A-new-password-2026')).r.status===503,'notification persistence failure rolls reset back');}finally{fixture({action:'queue-trigger',enabled:false});}
check(own({action:'status',password:'BYPCMS-QA-Buyer-2026'}).passwordMatches,'outbox failure cannot silently change password');
own({action:'cooldown'});fixture({action:'clear-rate'});await request(forgotten);const sibling=own({action:'latest'});check(sibling.count===2&&sibling.token!==token,'fresh request issues independent link');
await scanner.open('/account/reset.php?token='+sibling.token);check((await resetPost('A-new-password-2026')).r.status===422,'stale tab cannot use another link');page=await scanner.open('/account/reset.php?token='+token);
result=await resetPost('A-new-password-2026');check(result.r.status===303&&result.r.headers.get('location')==='/account/?next='+encodeURIComponent('/account/purchase.php?id='+qa.order),'successful reset returns to intended purchase via sign in');
page=await scanner.open(result.r.headers.get('location'));check(page.html.includes('Войдите с новым паролем')&&page.html.includes('name="action" value="login"'),'reset never auto logs in');
let state=own({action:'status',password:'A-new-password-2026'});check(state.passwordMatches&&state.remainingSecrets===0,'password changed and all sibling delivery secrets erased');
check(state.snapshot===qa.snapshot,'all orders, payments, invoices, deliveries, licences and activations unchanged');
check((await oldSession.call('/account/order.php?id='+qa.order)).r.status===302,'old session loses order access');
check((await otherSession.call('/account/purchase.php?id='+qa.order+'&download=1')).r.status===302,'other old session loses archive access');
let api=await oldSession.open('/commerce/index.php?action=bootstrap');check(JSON.parse(api.html).customer===null,'old session cannot use commerce API');
check((await oldSession.call('/account/invoice.php?id=0')).r.status===404,'invoice boundary remains private');
const reused=new Browser();page=await reused.open('/account/reset.php?token='+token);check(!page.html.includes('name="password"')&&page.html.includes('уже использована'),'used link rejected');
page=await reused.open('/account/reset.php?token='+sibling.token);check(!page.html.includes('name="password"'),'sibling link also revoked');
check((await login(new Browser(),'BYPCMS-QA-Buyer-2026')).r.status===200,'old password rejected');
const restored=new Browser();check((await login(restored,'A-new-password-2026')).r.status===302,'new password signs in');
check((await restored.open('/account/order.php?id='+qa.order)).html.includes('Оплата подтверждена'),'paid order remains accessible after recovery');
check((await restored.open('/account/purchase.php?id='+qa.order)).html.includes('Ключ покупки'),'existing licence still accessible');
const download=await restored.call('/account/purchase.php?id='+qa.order+'&download=1');check(download.r.headers.get('content-type')?.includes('application/zip'),'existing purchased archive still downloadable');
own({action:'cooldown'});fixture({action:'clear-rate'});await request(forgotten);latest=own({action:'latest'});own({action:'expire',id:latest.mail_id});
page=await new Browser().open('/account/reset.php?token='+latest.token);check(page.html.includes('срок её действия истёк')&&!page.html.includes('name="password"'),'expired link rejected');
check(own({action:'process',id:latest.mail_id}).superseded===1,'expired email never sent from delayed queue');
own({action:'cooldown'});fixture({action:'clear-rate'});await request(forgotten);latest=own({action:'latest'});
await control('reject');own({action:'process',id:latest.mail_id});check(own({action:'latest'}).outbox.state==='failed','SMTP 550 recorded without changing password');await control('accept');
own({action:'cooldown'});fixture({action:'clear-rate'});await request(forgotten);latest=own({action:'latest'});check(latest.valid,'new link available after permanent mail failure');
// Two independent processes exercise the row locks rather than PHP session serialization.
const racing=data=>new Promise((ok,fail)=>{const p=execFile(php,['tests/customer-recovery-fixture.php',root],{encoding:'utf8'},(e,out)=>e?fail(e):ok(JSON.parse(out)));p.stdin.end(JSON.stringify({action:'race',customer:qa.customer,token:latest.token,...data}));});
const race=await Promise.all([racing({password:'Race-winner-password-2026'}),racing({password:'Race-winner-password-2026'})]);check(race.filter(r=>r.changed).length===1,'simultaneous reset submissions win once');
check(own({action:'snapshot'}).snapshot===qa.snapshot,'concurrent reset still preserves every purchase record');
fixture({action:'clear-rate'});for(let n=0;n<10;n++)await request(forgotten,'limit-'+n+'@example.test');check((await request(forgotten,'limit-final@example.test')).r.status===422,'IP abuse limit enforced');
fixture({action:'clear-rate'});fixture({action:'smtp',enabled:false});
const report={checks,customer:qa.customer,order:qa.order,email:qa.email,preservedProductData:true,realPayments:0,realEmails:0};
await writeFile('outputs/customer-recovery-20261118/http-result.json',JSON.stringify(report,null,2));
console.log(`${checks} customer recovery, TLS mail, expiry, replay, revocation and purchase preservation checks passed`);
