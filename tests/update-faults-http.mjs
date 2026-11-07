import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const qa=resolve(process.argv[2]);const fixture=JSON.parse(await readFile(qa+'/license-targets.json','utf8'));const target=fixture.client;assert.match(target.origin,/^http:\/\/127\.0\.0\.1:\d+$/);
let checks=0;const check=(ok,message)=>{assert.ok(ok,message);checks++;};
function cli(mode,crash=false){try{execFileSync('php',['tests/update-faults.integration.php',qa,mode],{stdio:'pipe',env:{...process.env,OPENSSL_CONF:'C:/xampp82/apache/conf/openssl.cnf'}});if(crash)throw new Error('Expected hard process interruption');}catch(error){if(!crash||error.status!==77)throw error;}checks++;}
async function request(action,body){const r=await fetch(target.origin+'/updates/index.php?action='+action,{method:body===undefined?'GET':'POST',headers:{Cookie:target.cookie||'','Content-Type':'application/json','X-CSRF-Token':target.csrf||''},body:body===undefined?undefined:JSON.stringify(body)});const cookies=r.headers.getSetCookie();if(cookies.length)target.cookie=cookies.at(-1).split(';')[0];const j=await r.json();assert.equal(r.status,200,action+': '+j.error);checks++;return j;}
async function recoverLogin(){const r=await fetch(target.origin+'/updates/index.php?action=csrf');const j=await r.json();target.cookie=r.headers.getSetCookie().at(-1).split(';')[0];target.csrf=j.csrf;const logged=await request('recover.login',{email:target.email,password:target.password});target.csrf=logged.csrf;const me=await fetch(target.origin+'/updates/index.php?action=status',{headers:{Cookie:target.cookie}});assert.equal(me.status,200);checks++;}
cli('seed');
for(const mode of (process.argv[3]?[process.argv[3]]:['migration-ok','migration-fail','health-fail','crash-users','role-fail'])){
 cli(mode,mode==='crash-users');const {id}=JSON.parse(await readFile(qa+'/update-fault-case.json','utf8'));
 check((await fetch(target.origin+'/')).status===(mode==='migration-ok'?200:503),'correct public availability during update outcome');
 check((await fetch(target.origin+'/updates/recovery.php')).status===200,'independent recovery page survives failed code and auth schema');
 await recoverLogin();
 if(mode==='migration-ok'){cli('deny');await request('rollback',{id});}
 if(mode==='migration-fail'){
   cli('corrupt');const {job}=await request('step',{id});check(job.state==='recovery_required','corrupt snapshot stops before destructive restore');check((await fetch(target.origin+'/')).status===503,'corrupt backup does not reopen inconsistent site');cli('repair');
 }
 let last;for(let i=0;i<500;i++){last=(await request('step',{id})).job;if(['rolled_back','failed','recovery_required','completed'].includes(last.state))break;}
 assert.equal(last.state,'rolled_back',JSON.stringify(last));cli('verify');
 if(mode==='migration-ok')cli('allow');
 check((await fetch(target.origin+'/')).status===200,'public site restored');
 check((await fetch(target.origin+'/api/index.php?action=status')).status===200,'real API restored');
 console.log('PASS '+mode);
}
console.log(`${checks} real DDL/runtime/crash/corrupt-backup recovery checks passed`);
