import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import {verifyUpdateAssets} from './update-assets.mjs';
const f=JSON.parse(await readFile(process.argv[2],'utf8'));for(const t of [f.platform,f.client])assert.match(t.origin,/^http:\/\/127\.0\.0\.1:\d+$/);
let checks=0;const check=(ok,message)=>{assert.ok(ok,message);checks++;};const op=()=>randomBytes(16).toString('hex');
async function login(t){const r=await fetch(t.origin+'/api/index.php?action=auth.login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(t)});assert.equal(r.status,200);t.cookie=r.headers.getSetCookie().at(-1).split(';')[0];t.csrf=(await r.json()).csrf;}
async function call(t,action,body,expected=200,csrf=true){const r=await fetch(t.origin+'/updates/index.php?action='+action,{method:body===undefined?'GET':'POST',headers:{Cookie:t.cookie||'','Content-Type':'application/json',...(csrf?{'X-CSRF-Token':t.csrf||''}:{})},body:body===undefined?undefined:JSON.stringify(body)});const raw=await r.text();let j;try{j=JSON.parse(raw);}catch{throw new Error(t.origin+' '+action+': '+raw.slice(0,1400));}assert.equal(r.status,expected,action+': '+j.error);checks++;return j;}
await login(f.platform);await login(f.client);
await call({origin:f.client.origin},'status',undefined,401);
await call(f.platform,'publish',{},403,false);
await call(f.client,'publish',{},403);
const published=(await call(f.platform,'publish',{})).release;
check((await call(f.platform,'publish',{})).release.id===published.id,'publication retry is idempotent');
let state=await call(f.client,'check',{});const baseline=state.current.version;
const release=state.releases.find(r=>r.id===published.id);check(release.compatible,'signed release is compatible');
await call(f.client,'begin',{package:release.id,operation_id:op()},403,false);
const operation=op();let job=(await call(f.client,'begin',{package:release.id,operation_id:operation})).job;
check((await call(f.client,'begin',{package:release.id,operation_id:operation})).job.id===job.id,'begin retry returns same durable job');
let sawMaintenance=false;
for(let i=0;i<300;i++){
 job=(await call(f.client,'step',{id:job.id})).job;
 if(job.phase==='backup_files'){
   sawMaintenance=true;check((await fetch(f.client.origin+'/')).status===503,'site enters maintenance before snapshot');
   check((await fetch(f.client.origin+'/api/index.php?action=pages.list',{headers:{Cookie:f.client.cookie}})).status===503,'API writes/reads cannot bypass maintenance');
   check((await fetch(f.client.origin+'/api/app.php',{headers:{Cookie:f.client.cookie}})).status===403,'raw API application cannot bypass bootstrap');
   await call(f.client,'begin',{package:release.id,operation_id:op()},422);
 }
 if(['completed','rolled_back','failed','recovery_required'].includes(job.state))break;
}
assert.equal(job.state,'completed',JSON.stringify(job));check(sawMaintenance,'snapshot was protected by maintenance');
const status=await (await fetch(f.client.origin+'/api/index.php?action=status')).json();check(status.version===release.version,'real runtime switches to new code');
check((await fetch(f.client.origin+'/')).status===200,'public frontend works after update');
check((await fetch(f.client.origin+'/_releases/'+job.id+'/api/app.php')).status===403,'release PHP is private');
check((await fetch(f.client.origin+'/_storage/updates/jobs/'+job.id+'.json')).status===403,'journal and backup paths are private');
const admin=await (await fetch(f.client.origin+'/admin/')).text();check(admin.includes('/_update-assets/'+job.id+'/_next/'),'admin uses release assets');
const assets=[...new Set([...admin.matchAll(/(?:src|href)="([^" ]+\.(?:js|css))"/g)].map(x=>x[1]))];
for(const asset of assets){const response=await fetch(f.client.origin+asset);check(response.status===200,'versioned admin asset available');if(asset.includes('webpack-')){const body=await response.text();check(body.includes('"/_update-assets/'+job.id+'/_next/"'),'lazy webpack chunks use the same release path');}else await response.arrayBuffer();}
check((await call(f.client,'step',{id:job.id})).job.state==='completed','terminal step retry does not reapply update');
await call(f.client,'rollback',{id:job.id});
for(let i=0;i<300;i++){job=(await call(f.client,'step',{id:job.id})).job;if(['rolled_back','recovery_required'].includes(job.state))break;}
assert.equal(job.state,'rolled_back',JSON.stringify(job));
check((await (await fetch(f.client.origin+'/api/index.php?action=status')).json()).version===baseline,'manual rollback restores previous runtime');
check((await fetch(f.client.origin+'/')).status===200,'public site returns after rollback');
const restoredRelease=(await call(f.client,'status')).current.release;if(restoredRelease)check(await verifyUpdateAssets(f.client.origin,restoredRelease)>0,'restored admin and lazy chunks use the restored release');else check((await (await fetch(f.client.origin+'/admin/')).text()).includes('/_next/'),'first-update rollback restores original admin assets');
check((await (await fetch(f.client.origin+'/uploads/qa-preserve.txt')).text())==='Do not change user media','media file preserved');
check((await (await fetch(f.client.origin+'/project/qa-preserve.txt')).text())==='Do not change user project','project file preserved');
check((await call(f.client,'rollback',{id:job.id})).job.state==='rolled_back','rollback retry is idempotent');
if(process.argv[3])await writeFile(process.argv[3],JSON.stringify({job:job.id,baseline,release:release.id}));
console.log(`${checks} update/install/rollback HTTP checks passed`);
