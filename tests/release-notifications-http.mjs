import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import http from 'node:http';
const qa=process.argv[2],f=JSON.parse(await readFile(qa+'/targets.json','utf8')),php=process.env.BYPCMS_TEST_PHP||'C:/xampp82/php/php.exe';
for(const t of [f.platform,...f.clients])assert.match(t.origin,/^http:\/\/127\.0\.0\.1:\d+$/);
let checks=0;const check=(v,m)=>{assert.ok(v,m);checks++;},op=()=>randomBytes(16).toString('hex');
const fixture=(...args)=>execFileSync(php,['tests/release-notifications-fixture.php',qa,...args],{stdio:'pipe'});
async function login(t){const r=await fetch(t.origin+'/api/index.php?action=auth.login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:t.email,password:t.password})});check(r.ok,'fixture login');t.cookie=r.headers.getSetCookie().at(-1).split(';')[0];t.csrf=(await r.json()).csrf;}
async function call(t,action,body,expected=200,path='/api/index.php',csrf=true){const r=await fetch(t.origin+path+'?action='+action,{method:body===undefined?'GET':'POST',headers:{Cookie:t.cookie||'','Content-Type':'application/json',...(csrf?{'X-CSRF-Token':t.csrf||''}:{})},body:body===undefined?undefined:JSON.stringify(body)});const j=await r.json();check(r.status===expected,action+': '+(j.error||r.status));return j;}
const upd=(t,a,b,e=200,csrf=true)=>call(t,a,b,e,'/updates/index.php',csrf);
await login(f.platform);const release=(await upd(f.platform,'publish',{})).release;check(release.version==='2.7.2'&&release.notes?.length,'real release notes published with signed package');
const baselines=[];
for(const t of f.clients){
 await login(t);let s=await upd(t,'check',{});check(s.current.version==='2.7.1','genuine existing client baseline');const proof=qa+'/before-'+t.edition+'.json';execFileSync(php,['tests/client-preservation.php',t.root,'record',proof]);
 const operation=op();await upd(t,'begin',{package:release.id,operation_id:operation,confirmed:true},403,false);let job=(await upd(t,'begin',{package:release.id,operation_id:operation,confirmed:true})).job;
 for(let i=0;i<500;i++){job=(await upd(t,'step',{id:job.id})).job;if(['completed','failed','rolled_back','recovery_required'].includes(job.state))break;}
 check(job.state==='completed',JSON.stringify(job));execFileSync(php,['tests/client-preservation.php',t.root,'verify',proof]);check(true,'all customer data preserved');baselines.push({edition:t.edition,job:job.id,proof});
 await call({origin:t.origin},'client.updates.status',undefined,401);await call(t,'client.updates.discover',{},403,'/api/index.php',false);
 s=await call(t,'client.updates.discover',{});check(s.current.version==='2.7.2'&&s.releases.find(r=>r.id===release.id).installed,'active new client code discovers installed release');check(!s.maintenance&&s.jobs.length===1,'discovery starts no jobs or maintenance');
 const manage=await (await fetch(t.origin+'/manage/',{headers:{Cookie:t.cookie}})).text();check(manage.includes('client-release-notice')&&manage.includes('версия 2.7.2'),'owner banner and actual version present');
 const cron=s.cron_command.slice('*/5 * * * * php -r '.length);check(cron.includes('UpdateRuntime')&&cron.includes('client-release-worker.php'),'cron follows stable bootstrap across releases');
 const workerCode=`require ${JSON.stringify(t.root+'/_core/UpdateRuntime.php')}; BYPCMS\\Core\\UpdateRuntime::serve(${JSON.stringify(t.root)},'_core/client-release-worker.php');`;
 execFileSync(php,['-r',workerCode]);s=await call(t,'client.updates.status');check(s.discovery.worker_last_run&&s.jobs.length===1,'real CLI discovery heartbeat without installation');
}
fixture('future');const future=(await upd(f.platform,'publish',{})).release;fixture('restore-candidate');check(future.version==='2.7.3','synthetic future release is signed');
for(const t of f.clients){fixture('due',t.edition);let s=await call(t,'client.updates.discover',{});check(s.discovery.latest?.id===future.id&&s.discovery.unread&&s.jobs.length===1,'future release produces one notice without installing '+t.edition);const when=s.discovery.last_attempt;
 s=await call(t,'client.updates.discover',{});check(s.discovery.last_attempt===when,'repeat uses catalogue cache');await call(t,'client.updates.read',{id:future.id});s=await call(t,'client.updates.read',{id:future.id});check(!s.discovery.unread,'read retry is idempotent');fixture('due',t.edition);s=await call(t,'client.updates.discover',{});check(!s.discovery.unread,'same release never reopens read notice');
 await call(t,'client.updates.preferences',{auto_check:false});fixture('due',t.edition);s=await call(t,'client.updates.discover',{});check(s.discovery.last_attempt===0,'opt-out prevents background request');s=await call(t,'client.updates.discover',{force:true});check(s.discovery.last_attempt>0,'manual check works with automatic check off');await call(t,'client.updates.preferences',{auto_check:true});
}
const bad=http.createServer((req,res)=>{res.setHeader('Content-Type','application/json');if(req.url.includes('licensing.')){res.statusCode=503;res.end('{"error":"Synthetic offline server"}');}else res.end(JSON.stringify({catalog:{schema:'bypcms.updates/v1',payload:Buffer.from('{}').toString('base64'),signature:'invalid',key_id:'invalid'}}));});await new Promise(r=>bad.listen(8160,'127.0.0.1',r));
try{const t=f.clients[0];fixture('bad-issuer',t.edition);let s=await call(t,'client.updates.discover',{});check(s.discovery.state==='failed'&&s.discovery.error&&s.discovery.latest.id===future.id,'invalid signature retains previous verified catalogue');check(s.jobs.length===1&&!s.maintenance,'invalid signature cannot initiate an update');const when=s.discovery.last_attempt;s=await call(t,'client.updates.discover',{});check(s.discovery.last_attempt===when,'failure retry is rate-limited');fixture('restore-issuer',t.edition);s=await call(t,'client.updates.discover',{});check(s.discovery.state==='available'&&!s.discovery.error,'retry after correction recovers');}finally{bad.close();}
await writeFile(qa+'/http-result.json',JSON.stringify({checks,release:release.id,future:future.id,baselines,realPayments:0,realEmails:0},null,2));console.log(checks+' signed updates, discovery, permissions, cron, invalid signature and repeat checks passed');
