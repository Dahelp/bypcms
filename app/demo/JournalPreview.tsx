"use client";
import {useEffect,useState} from "react";
import type {DemoEntity} from "./demo-data";
import {useDemoMedia} from "./DemoMedia";
import {readMediaBlob} from "./media-store";

export default function JournalPreview({entities,entity,settings,appearance,renderer="journal"}:{renderer?:"journal"|"chronicle"|"atelier"|"gallery";appearance:{accent:string;font:string;headingFont?:string};entities?:DemoEntity[];entity:DemoEntity|null;settings:{siteName:string;slogan?:string;logo?:string}}){
 const media=useDemoMedia();const [state,setState]=useState<{renderer?:string;url?:string;error?:string}>({});const [retry,setRetry]=useState(0);
 const item=entity?media.lookup(entity.image):undefined;
 useEffect(()=>{const controller=new AbortController();let active=true;setState({renderer});const timer=setTimeout(()=>{void (async()=>{
  try{let cover="";if(item?.source==="upload"&&entity){const blob=await readMediaBlob(entity.image,true);cover=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(Error("Не удалось прочитать обложку."));reader.readAsDataURL(blob);});}
   const r=await fetch('/'+renderer+'/preview.php',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({entities,entity,settings,cover,appearance}),signal:controller.signal});const data=await r.json();if(!r.ok||!data.url)throw Error(data.error||'Не удалось открыть тему.');if(active)setState({renderer,url:data.url});
  }catch(e){if(active)setState({renderer,error:e instanceof Error?e.message:'Предпросмотр недоступен.'});}
 })();},150);return()=>{active=false;clearTimeout(timer);controller.abort();};},[entities,entity,settings,appearance,item?.source,retry,renderer]);
 const visible=state.renderer===renderer?state:{};
 return <section className="journalSitePreview" aria-label={"Тема "+(renderer==="chronicle"?"Chronicle":renderer==="atelier"?"Atelier":renderer==="gallery"?"Gallery":"Journal")}>{visible.error?<div role="alert"><p>{visible.error}</p><button onClick={()=>setRetry(v=>v+1)}>Повторить</button></div>:visible.url?<iframe key={visible.url} title={"Сайт "+(renderer==="chronicle"?"Chronicle":renderer==="atelier"?"Atelier":renderer==="gallery"?"Gallery":"Journal")} src={visible.url}/>:<p role="status">Загрузка сайта…</p>}</section>;
}
