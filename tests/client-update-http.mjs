// Signed update + exact product-data preservation + manual rollback, three editions.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {verifyUpdateAssets} from './update-assets.mjs';
const qa=process.argv[2];assert.ok(qa,'Explicit fixture directory required');
let checks=0;const check=(ok,m)=>{assert.ok(ok,m);checks++},op=()=>randomBytes(16).toString('hex');const results=[];
async function login(t){const r=await fetch(t.origin+'/api/index.php?action=auth.login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:t.email,password:t.password})});check(r.status===200,'owner login');t.cookie=r.headers.getSetCookie().at(-1).split(';')[0];t.csrf=(await r.json()).csrf;}
async function update(t,action,body,expected=200,csrf=true){const r=await fetch(t.origin+'/updates/index.php?action='+action,{method:body===undefined?'GET':'POST',headers:{Cookie:t.cookie||'','Content-Type':'application/json',...(csrf?{'X-CSRF-Token':t.csrf||''}:{})},body:body===undefined?undefined:JSON.stringify(body)});const text=await r.text();let data;try{data=JSON.parse(text)}catch{throw Error(action+': '+text.slice(0,400))}check(r.status===expected,action+': '+data.error);return data;}
async function api(t,action,body){const r=await fetch(t.origin+'/api/index.php?action='+action,{method:body?'POST':'GET',headers:{Cookie:t.cookie,'X-CSRF-Token':t.csrf,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});const data=await r.json();check(r.status===200,action+': '+data.error);return data;}
const fingerprint=(root,mode,file)=>{execFileSync(process.env.BYPCMS_TEST_PHP||'php',['tests/client-preservation.php',root,mode,file],{stdio:'pipe'});checks++;};
let published;
for(const edition of ['content','business','commerce']){
 const f=JSON.parse(await readFile(qa+'/update-'+edition+'.json','utf8'));for(const t of [f.platform,f.client])assert.match(t.origin,/^http:\/\/127\.0\.0\.1:\d+$/);
 await login(f.platform);await login(f.client);const t=f.client;
 if(!published){await update(f.platform,'publish',{},403,false);published=(await update(f.platform,'publish',{})).release;check((await update(f.platform,'publish',{})).release.id===published.id,'publication retry');}
 await update({origin:t.origin},'status',undefined,401);await update(t,'publish',{},403);
 const baseline=(await update(t,'check',{})).current.version;const release=(await update(t,'status')).releases.find(r=>r.id===published.id);check(release?.compatible,'signed compatible release');
 const proof=qa+'/preservation-'+edition+'.json';fingerprint(f.client_root,'record',proof);
 const operation=op();await update(t,'begin',{package:release.id,operation_id:operation},403,false);
 let job=(await update(t,'begin',{package:release.id,operation_id:operation})).job;check((await update(t,'begin',{package:release.id,operation_id:operation})).job.id===job.id,'begin retry');let maintenance=false;
 for(let i=0;i<500;i++){job=(await update(t,'step',{id:job.id})).job;if(job.phase==='backup_files'&&!maintenance){maintenance=true;check((await fetch(t.origin+'/')).status===503,'maintenance protects snapshot');check((await fetch(t.origin+'/api/index.php?action=content.list',{headers:{Cookie:t.cookie}})).status===503,'API cannot bypass backup lock');await update(t,'begin',{package:release.id,operation_id:op()},422);}if(['completed','failed','rolled_back','recovery_required'].includes(job.state))break;}
 check(job.state==='completed',JSON.stringify(job));check(maintenance,'backup protected by maintenance');check((await api(t,'status')).version===release.version,'new actual runtime');
 fingerprint(f.client_root,'verify',proof);
 const themes={content:['journal','chronicle','focus'],business:['atelier','corporate','mono'],commerce:['gallery','market','luxe']}[edition];
 const settings=(await api(t,'content.list')).settings;
 for(const theme of themes){await api(t,'content.configure',{theme});const r=await fetch(t.origin+'/'),html=await r.text();check(r.status===200&&html.includes(edition==='commerce'?'g-theme-'+theme:theme+'.css'),'upgraded '+theme);
  const paths=[...new Set([...html.matchAll(/(?:src|href)="([^" ]+)"/g)].map(m=>m[1].replaceAll('&amp;','&')).filter(p=>p.startsWith('/_update-assets/')))];check(paths.length>0,'active release resources '+theme);for(const path of paths){check(path.includes('/_update-assets/'+job.id+'/'),'resource uses selected release');const a=await fetch(t.origin+path);check(a.status===200,'upgraded resource '+path);await a.arrayBuffer();}
 }
 check(await verifyUpdateAssets(t.origin,job.id)>0,'admin and lazy chunks follow release');
 check((await fetch(t.origin+'/_releases/'+job.id+'/api/app.php')).status===403,'release PHP is private');check((await update(t,'step',{id:job.id})).job.state==='completed','completed retry');
 await update(t,'rollback',{id:job.id});for(let i=0;i<500;i++){job=(await update(t,'step',{id:job.id})).job;if(['rolled_back','recovery_required'].includes(job.state))break;}
 check(job.state==='rolled_back',JSON.stringify(job));check((await api(t,'status')).version===baseline,'previous actual runtime restored');fingerprint(f.client_root,'verify',proof);
 const restored=(await update(t,'status')).current.release;check(await verifyUpdateAssets(t.origin,restored)>0,'restored admin assets');check((await update(t,'rollback',{id:job.id})).job.state==='rolled_back','rollback retry');
 check((await api(t,'content.list')).settings.theme===settings.theme,'rollback restores selected customer theme');check((await fetch(t.origin+'/')).status===200,'restored public site');
 results.push({edition,baseline,version:release.version,job:job.id,themes,exactDataAndFiles:true,rollback:true});console.log('PASS '+edition+' signed update, three themes, exact product preservation and rollback');
}
const result={checks,results};await writeFile(qa+'/updates-result.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
