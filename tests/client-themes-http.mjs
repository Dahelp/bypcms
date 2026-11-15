// node tests/client-themes-http.mjs ignored-targets.json [fresh|packages]
// Exercises actual customer ZIP installations, never the production database.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
const targets=JSON.parse(await readFile(process.argv[2],'utf8')).filter(t=>t.group===(process.argv[3]||'fresh'));
assert.equal(targets.length,3,'One isolated installation per edition');
const allThemes={content:['journal','chronicle','focus'],business:['atelier','corporate','mono'],commerce:['gallery','market','luxe']};
let checks=0;const check=(ok,message)=>{assert.ok(ok,message);checks++};const results=[];
for(const t of targets){
 assert.match(t.origin,/^http:\/\/127\.0\.0\.1:\d+$/,'Loopback installations only');
 let r=await fetch(t.origin+'/api/index.php?action=auth.login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:t.email,password:t.password})});
 check(r.status===200,t.edition+' login');const auth=await r.json(),cookie=r.headers.getSetCookie().at(-1).split(';')[0];
 const api=async(action,body,token=auth.csrf)=>{const r=await fetch(t.origin+'/api/index.php?action='+action,{method:body?'POST':'GET',headers:{Cookie:cookie,'X-CSRF-Token':token,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});const text=await r.text();let data;try{data=JSON.parse(text)}catch{throw Error(action+': '+text.slice(0,300))}return {status:r.status,data}};
 const get=async(path,privatePage=false)=>{const r=await fetch(t.origin+path,{headers:privatePage?{Cookie:cookie}:{}});const html=await r.text();check(!/Warning:|Fatal error:|Deprecated:/.test(html),'clean '+path);return {status:r.status,html}};
 const manifest=JSON.parse(await readFile(t.root+'/build-manifest.json','utf8'));
 check(manifest.edition===t.edition,'package edition');check(JSON.stringify([...manifest.modules].sort())===JSON.stringify([...(await api('modules.list')).data.modules.map(m=>m.module_key)].sort()),'package modules');
 const before=(await api('content.list')).data.pages;
 const slug='qa-final-'+randomBytes(6).toString('hex'),page={kind:'page',title:'FINAL_CLIENT_PROOF',slug,status:'published',content:'<h2>FINAL_BODY</h2><p>Actual installed content.</p>',blocks:[{type:'quote',content:'FINAL_BLOCK'}],seo_title:'FINAL_SEO',create_token:randomBytes(16).toString('hex')};
 check((await api('content.save',page,'invalid')).status===403,'invalid CSRF cannot create');
 const pair=await Promise.all([api('content.save',page),api('content.save',page)]);check(pair.every(p=>p.status===200)&&pair[0].data.id===pair[1].data.id,'one record under repeated Save');const id=pair[0].data.id;
 check((await api('content.list')).data.pages.length===before.length+1,'exactly one new record');
 const original=(await api('content.list')).data.pages.find(p=>p.id===id);
 const article=(await api('content.list')).data.pages.find(p=>p.kind===(t.edition==='content'?'article':t.edition==='business'?'service':'page')&&p.status==='published');
 const themeResults=[];
 for(const theme of allThemes[t.edition]){
  check((await api('content.configure',{theme})).status===200,'select '+theme);
  const root=await get('/');check(root.status===200&&root.html.includes(t.edition==='commerce'?'g-theme-'+theme:theme+'.css'),'installed '+theme+' home');
  for(const path of t.edition==='content'?['/articles/','/search/?q=свет']:t.edition==='business'?['/services/','/projects/','/team/','/contact/']:['/catalog/','/cart/','/checkout/','/account/'])check((await get(path)).status===200,theme+' '+path);
  let proof=await get('/'+slug+'/');check(proof.status===200&&proof.html.includes('FINAL_BODY')&&proof.html.includes('FINAL_BLOCK')&&proof.html.includes('FINAL_SEO'),theme+' saved content and SEO');
  if(article)check((await get('/'+article.slug+'/')).status===200,theme+' real original detail');
  const preview=await api('content.preview',{...original,title:'UNSAVED_CLIENT_PROOF',content:'<p>UNSAVED_CLIENT_BODY</p>'});check(preview.status===200,'preview '+theme);
  const viewed=await get(preview.data.url,true);check(viewed.status===200&&viewed.html.includes('UNSAVED_CLIENT_BODY'),theme+' actual unsaved preview');check((await get(preview.data.url)).status===403,'private '+theme+' preview');
  check((await get('/missing-final-acceptance/')).status===404,'real 404 '+theme);
  const paths=[...root.html.matchAll(/(?:src|href)="([^" ]+\.(?:css|js)(?:\?[^" ]*)?)"/g)].map(m=>m[1].replaceAll('&amp;','&'));
  for(const path of new Set(paths)){const asset=await fetch(new URL(path,t.origin));check(asset.status===200&&!asset.headers.get('content-type')?.includes('text/html'),'actual theme resource '+path);await asset.arrayBuffer();}
  themeResults.push(theme);
 }
 check(JSON.stringify((await api('content.list')).data.pages.find(p=>p.id===id))===JSON.stringify(original),'theme switches and previews preserve record exactly');
 check((await api('content.configure',{theme:t.edition==='commerce'?'mono':'gallery'})).status===422,'edition boundary');
 check((await api('owner.bootstrap')).status===403&&(await api('build.download')).status===403,'client cannot run platform Owner/build');
 for(const path of ['/_storage/config.php','/_core/bootstrap.php','/_private/secret.txt','/_releases/secret.php'])check((await get(path)).status===403,'private '+path);
 const admin=await get('/admin/?section=updates');check(admin.status===200,'admin portal');for(const [,path]of admin.html.matchAll(/(?:src|href)="([^" ]+\.(?:js|css))"/g)){const asset=await fetch(new URL(path,t.origin));check(asset.status===200,'admin resource');await asset.arrayBuffer();}
 const reinstall=await fetch(t.origin+'/install/',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:'site_name=Overwrite&admin_password=Changed-Password-2026'});check((await reinstall.text()).includes('СИСТЕМА УЖЕ УСТАНОВЛЕНА'),'reinstall blocked');
 check((await api('content.list')).data.pages.some(p=>p.id===id&&p.title===original.title),'reinstall preserves actual content');
 results.push({edition:t.edition,origin:t.origin,themes:themeResults,proof:id});console.log('PASS '+t.edition+' installed themes, native routes, preview, repeat and private boundaries');
}
const result={checks,results};if(process.env.BYPCMS_ACCEPTANCE_RESULT)await writeFile(process.env.BYPCMS_ACCEPTANCE_RESULT,JSON.stringify(result,null,2));console.log(JSON.stringify(result));
