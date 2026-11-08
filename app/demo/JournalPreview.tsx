"use client";
import {useEffect,useState} from "react";
import type {DemoEntity} from "./demo-data";
import {useDemoMedia} from "./DemoMedia";
import {readMediaBlob} from "./media-store";

export default function JournalPreview({entities,entity,settings,appearance,renderer="journal"}:{renderer?:"journal"|"chronicle"|"focus"|"atelier"|"gallery";appearance:{accent:string;font:string;headingFont?:string;focusHeadingFont?:string};entities?:DemoEntity[];entity:DemoEntity|null;settings:{siteName:string;slogan?:string;logo?:string}}){
 const media=useDemoMedia();const [state,setState]=useState<{renderer?:string;url?:string;error?:string}>({});const [retry,setRetry]=useState(0);
 const item=entity?media.lookup(entity.image):undefined;
 useEffect(()=>{const controller=new AbortController();let active=true;setState({renderer});const timer=setTimeout(()=>{void (async()=>{
  try{let cover="";if(renderer!=="focus"&&item?.source==="upload"&&entity){const blob=await readMediaBlob(entity.image,true);cover=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(Error("Не удалось прочитать обложку."));reader.readAsDataURL(blob);});}
   let resolvedMedia:Record<number,{url:string;width:number;height:number;alt:string}>|undefined;
   if(renderer==='focus'){
    resolvedMedia={};const records=[...(entities||[]).filter(v=>['pages','articles'].includes(v.kind)&&['Опубликован','Опубликовано'].includes(v.status)),...(entity?[entity]:[])];
    const ids=[...new Set(records.flatMap(v=>[v.image,...(v.blocks||[]).flatMap(b=>(b.images||[]).map(image=>image.image))]).filter(id=>id>=0))];
    if(ids.length>60)throw Error('Для демо-предпросмотра откройте одну фотоисторию: в выпуске слишком много локальных изображений.');
    await Promise.all(ids.map(async id=>{const record=media.lookup(id);if(!record||record.type!=='image'||record.trashedAt)return;let url='';if(record.source==='seed')url='/themes/gallery/assets/object-'+id+'.webp';else{const blob=await readMediaBlob(id,true);url=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(Error('Не удалось прочитать фотографию галереи.'));reader.readAsDataURL(blob);});}resolvedMedia![id]={url,width:record.width||1200,height:record.height||800,alt:record.alt};}));
    cover=entity?resolvedMedia[entity.image]?.url||'':'';
   }
   const payload=JSON.stringify({entities,entity,settings,cover,appearance,media:resolvedMedia});
   if(renderer==='focus'&&new TextEncoder().encode(payload).length>690000)throw Error('Предпросмотр содержит много локальных фотографий. Откройте одну фотоисторию или уменьшите изображения.');
   const r=await fetch('/'+renderer+'/preview.php',{method:'POST',headers:{'Content-Type':'application/json'},body:payload,signal:controller.signal});const data=await r.json();if(!r.ok||!data.url)throw Error(data.error||'Не удалось открыть тему.');if(active)setState({renderer,url:data.url});
  }catch(e){if(active)setState({renderer,error:e instanceof Error?e.message:'Предпросмотр недоступен.'});}
 })();},150);return()=>{active=false;clearTimeout(timer);controller.abort();};},[entities,entity,settings,appearance,item?.source,retry,renderer,media.loading,media.items]);
 const visible=state.renderer===renderer?state:{};
 return <section className="journalSitePreview" aria-label={"Тема "+(renderer==="focus"?"Focus":renderer==="chronicle"?"Chronicle":renderer==="atelier"?"Atelier":renderer==="gallery"?"Gallery":"Journal")}>{visible.error?<div role="alert"><p>{visible.error}</p><button onClick={()=>setRetry(v=>v+1)}>Повторить</button></div>:visible.url?<iframe key={visible.url} title={"Сайт "+(renderer==="focus"?"Focus":renderer==="chronicle"?"Chronicle":renderer==="atelier"?"Atelier":renderer==="gallery"?"Gallery":"Journal")} src={visible.url}/>:<p role="status">Загрузка сайта…</p>}</section>;
}
