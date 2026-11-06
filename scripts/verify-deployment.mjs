import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

export function applicationAssets(html,page){
  const origin=new URL(page).origin;
  const assets=[...new Set([...html.matchAll(/(?:src|href)="([^"]*\/_next\/[^"<>]+\.(?:js|css)(?:\?[^"<>]*)?)"/g)].map(match=>new URL(match[1].replaceAll('&amp;','&'),page).href))];
  if(!assets.length)throw new Error('Application assets are missing from '+page);
  for(const asset of assets)if(new URL(asset).origin!==origin)throw new Error('Application asset must use its own origin: '+asset);
  return assets;
}

export async function verifySite(page,{fetcher=fetch,attempts=3,delay=2000}={}){
  async function request(url,type){
    let failure;
    for(let attempt=0;attempt<attempts;attempt++){
      try{
        const response=await fetcher(url,{cache:'no-store',headers:{'Cache-Control':'no-cache'},signal:AbortSignal.timeout(30000)});
        if(!response.ok)throw new Error(url+' HTTP '+response.status);
        const contentType=response.headers.get('content-type')||'';
        if(type && !(type==='css'?/text\/css/i:/javascript/i).test(contentType))throw new Error(url+' invalid content type '+contentType);
        return await response.text();
      }catch(error){failure=error;if(attempt+1<attempts)await new Promise(resolve=>setTimeout(resolve,delay));}
    }
    throw failure;
  }
  const assets=applicationAssets(await request(page),page);
  const results=await Promise.allSettled(assets.map(url=>request(url,new URL(url).pathname.endsWith('.css')?'css':'js')));
  const failed=results.filter(result=>result.status==='rejected');if(failed.length)throw new Error(failed.map(result=>result.reason.message).join('\n'));
  return {page,assets:assets.length,status:'verified'};
}

if(process.argv[1] && fileURLToPath(import.meta.url)===resolve(process.argv[1])){
  const release=process.env.GITHUB_SHA||'local';
  for(const page of ['https://bypcms.ru/admin/','https://bypcms.ru/owner/','https://demo.bypcms.ru/'])console.log(JSON.stringify(await verifySite(page+'?release='+release)));
}
