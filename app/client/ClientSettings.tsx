"use client";
import {useEffect,useState,type FormEvent} from "react";
import ClientFields from "./ClientFields";
import ClientPending from "../components/PanelPending";
import {useClientGuard} from "./ClientRouter";
import {Heading} from "./ClientWorkspace";
import type {Field,Request} from "./types";
type Settings={title:string;description?:string;fields:Field[];revision?:string};
export default function ClientSettings({section,label,locales,request,onSaved,csrf}:{section:string;label:string;locales:string[];request:Request;onSaved:()=>void;csrf:string}){
 const [data,setData]=useState<Settings|null>(null),[values,setValues]=useState<Record<string,unknown>>({}),[error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[retry,setRetry]=useState(0),[preview,setPreview]=useState(0),[dirty,setDirty]=useState(false);
 useClientGuard(dirty,busy);
 useEffect(()=>{const controller=new AbortController();setError('');void request<Settings>('settings',undefined,{section},controller.signal).then(next=>{setData(next);setValues(Object.fromEntries(next.fields.map(field=>[field.name,field.value])))}).catch(e=>{if(!controller.signal.aborted)setError(e.message)});return()=>controller.abort();},[section,request,retry]);
 async function save(event:FormEvent){event.preventDefault();if(busy)return;setBusy(true);setError('');setNotice('');try{const next=await request<Settings>('settings.save',{section,values,revision:data?.revision});setData(next);setValues(Object.fromEntries(next.fields.map(field=>[field.name,field.value])));setDirty(false);setNotice('Настройки сохранены.');setPreview(n=>n+1);onSaved();}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
 return <><Heading title={data?.title||label} description={data?.description}/>{error&&<p className="clientError" role="alert">{error} {!data&&<button onClick={()=>setRetry(n=>n+1)}>Повторить</button>}</p>}{notice&&<p className="demoNotice" role="status">{notice}</p>}{!data&&!error?<ClientPending label="Загружаем настройки…"/>:data&&<div className={section==='design'?'clientDesignGrid':''}><form className="clientSurface clientForm" noValidate onSubmit={save} aria-busy={busy}><ClientFields locales={locales} csrf={csrf} fields={data.fields} values={values} disabled={busy} setValue={(key,value)=>{setDirty(true);setValues(previous=>({...previous,[key]:value}))}}/><button className="clientPrimary" disabled={busy}>{busy?'Сохраняем…':'Сохранить настройки'}</button></form>{section==='design'&&<aside className="clientSitePreview"><h2>Опубликованный сайт</h2><p>После сохранения настройки применяются к действующему макету.</p><a href="/" target="_blank" rel="noopener">Открыть сайт</a><iframe key={preview} title="Опубликованный сайт" src={`/?workspace_preview=${preview}`}/></aside>}</div>}</>;
}
