"use client";
import {useCallback,useEffect,useState} from "react";
import WorkspaceFrame from "../components/WorkspaceFrame";
import {PanelSessionGate,usePanelSession} from "../components/PanelSession";
import {panelRequest} from "../components/panel-api";
import PanelRouteLoading from "../components/PanelRouteLoading";
import PanelSearch from "../components/PanelSearch";
import PanelIcon from "../components/PanelIcon";
import LicenseSettings from "../components/LicenseSettings";
import UpdateSettings from "../components/UpdateSettings";
import ClientReleaseNotice from "../components/ClientReleaseNotice";
import ClientSearch from "./ClientSearch";
import ClientRecords from "./ClientRecords";
import ClientSettings from "./ClientSettings";
import ClientData from "./ClientData";
import type {Manifest,Request} from "./types";
import "../demo/demo.css";
import "./client.css";

export default function ClientWorkspace(){
 const session=usePanelSession();const [manifest,setManifest]=useState<Manifest|null>(null),[query,setQuery]=useState<URLSearchParams|null>(null),[error,setError]=useState(""),[retry,setRetry]=useState(0),[search,setSearch]=useState<string|null>(null);
 const request:Request=useCallback((action,body,params={},signal)=>panelRequest(`client.workspace.${action}`,{method:body===undefined?"GET":"POST",body:body===undefined?undefined:JSON.stringify(body),signal},session.csrf,true,params),[session.csrf]);
 useEffect(()=>{const next=new URLSearchParams(location.search);if(next.get('section')==='staff')next.set('section','users');if(/^\d+$/.test(next.get('editor')||''))next.set('record',next.get('editor')!);setQuery(next);},[]);
 useEffect(()=>{if(session.phase!=="active")return;const controller=new AbortController();setError("");void request<Manifest>('bootstrap',undefined,{},controller.signal).then(setManifest).catch(e=>{if(!controller.signal.aborted)setError(e.message)});return()=>controller.abort();},[session.phase,request,retry]);
 const href=(section:string,extra:Record<string,string|number|undefined>={})=>{const params=new URLSearchParams({section});for(const [key,value]of Object.entries(extra))if(value!==undefined)params.set(key,String(value));return `/manage/?${params}`;};
 const section=query?.get('section')||manifest?.navigation[0]?.id||'overview';const label=manifest?.navigation.find(item=>item.id===section)?.label;
 useEffect(()=>{if(label)document.title=`${label} · ${manifest?.site_name} · BYPCMS`;},[label,manifest?.site_name]);
 const owner=session.user?.role==='owner';
 return <PanelSessionGate session={session}>{error?<section className="clientStartup"><h1>Панель временно недоступна</h1><p role="alert">{error}</p><button onClick={()=>setRetry(n=>n+1)}>Повторить подключение</button></section>:!manifest||!query?<PanelRouteLoading/>:
 <WorkspaceFrame className="clientWorkspace" edition={manifest.edition[0].toUpperCase()+manifest.edition.slice(1)} project={manifest.site_name} active={section} items={manifest.navigation} href={href}
  status={<><b>{session.user?.name}</b><span>{manifest.version} · {manifest.project.name||manifest.theme}</span></>}
  logout={<button className="demoLogout workspaceMenuExit" disabled={session.busy} onClick={()=>void session.logout()}>Выйти</button>}
  topbar={<><div className="clientEdition">{manifest.edition[0].toUpperCase()+manifest.edition.slice(1)}<small>Управление сайтом</small></div><PanelSearch onOpen={()=>setSearch("")}/><a className="openSite panelLinkButton" href="/" target="_blank" rel="noopener">Открыть сайт <PanelIcon name="external"/></a></>}
  overlay={search!==null&&<ClientSearch value={search} onChange={setSearch} onClose={()=>setSearch(null)} items={manifest.navigation} href={href}/>}>
   {manifest.project.needs_import&&owner&&<section className="clientSurface clientForm"><h2>Новая установка 3В</h2><p>Импорт страниц RU / EN / DE и команды. Существующие собственные материалы не заменяются.</p><form noValidate method="post" action="/site-manage/"><input type="hidden" name="csrf" value={session.csrf}/><button name="action" value="import-project">Импортировать страницы 3В</button></form></section>}
   {query.get('saved')==='1'&&<p className="demoNotice" role="status">Изменения сохранены.</p>}
   {owner&&section!=='updates'&&<ClientReleaseNotice csrf={session.csrf}/>}
   {!label?<section><h1>Раздел недоступен</h1><p>Выберите раздел в меню вашей сборки.</p><a href={href(manifest.navigation[0]?.id||'overview')}>Открыть панель</a></section>:
    ['pages','articles','services','projects','team'].includes(section)?<ClientRecords key={section+query.toString()} section={section} label={label} query={query} manifest={manifest} request={request} csrf={session.csrf}/>:
    section==='license'?<><Heading title="Лицензия"/><LicenseSettings csrf={session.csrf} owner={owner}/></>:
    section==='updates'?<><Heading title="Обновления"/><UpdateSettings csrf={session.csrf} owner={owner}/></>:
    ['design','forms','mail',...Object.keys(manifest.project.sections||{})].includes(section)?<ClientSettings key={section} section={section} request={request} csrf={session.csrf} onSaved={()=>setRetry(n=>n+1)}/>:
    <ClientData key={section+query.toString()} section={section} label={label} query={query} manifest={manifest} request={request} csrf={session.csrf}/>}
 </WorkspaceFrame>}</PanelSessionGate>;
}
export function Heading({title,description,actions}:{title:string;description?:string;actions?:React.ReactNode}){return <header className="realPageHeading"><div className="clientHeadingCopy"><h1>{title}</h1>{description&&<p>{description}</p>}</div><div>{actions}</div></header>;}
