"use client";

import { createContext, useContext, useEffect, useId, useRef, useState, type ReactNode } from "react";
import PanelIcon from "../components/PanelIcon";
import type { DemoEntity } from "./demo-data";
import { defaultSeoPreferences, normalizeResultView, readSeoPreferences, resultAddress, resultViewKey, resultViewSignature, saveSeoPreferences, searchEngineDocs, searchEngineNames, SEO_PREFERENCES_KEY, type ResultDevice, type SearchEngine, type SeoPreferences } from "./seo-preferences";
import "./seo-preview.css";

const SeoContext=createContext<{preferences:SeoPreferences;save:(value:SeoPreferences)=>void} | null>(null);
export function SeoPreferencesProvider({children}:{children:ReactNode}) {
  const [preferences,setPreferences]=useState(defaultSeoPreferences);
  useEffect(()=>{
    const refresh=()=>{try{setPreferences(readSeoPreferences(localStorage));}catch{/* Keep valid defaults if browser storage is blocked. */}};
    refresh();const storage=(event:StorageEvent)=>{if(event.key===SEO_PREFERENCES_KEY || event.key===null)refresh();};
    window.addEventListener("storage",storage);window.addEventListener("focus",refresh);
    return()=>{window.removeEventListener("storage",storage);window.removeEventListener("focus",refresh);};
  },[]);
  function save(value:SeoPreferences){const saved=saveSeoPreferences(localStorage,value);setPreferences(saved);}
  return <SeoContext.Provider value={{preferences,save}}>{children}</SeoContext.Provider>;
}
function useSeoPreferences(){const context=useContext(SeoContext);if(!context)throw new Error("SeoPreferencesProvider is required");return context;}

export function SeoPreferencesForm({onSaved}:{onSaved?:()=>void}) {
  const {preferences,save}=useSeoPreferences();
  const [draft,setDraft]=useState<SeoPreferences>(()=>({...preferences,engines:[...preferences.engines]}));
  const [notice,setNotice]=useState("");const [error,setError]=useState("");const dirty=useRef(false);
  useEffect(()=>{if(!dirty.current)setDraft({...preferences,engines:[...preferences.engines]});},[preferences]);
  function toggle(engine:SearchEngine){dirty.current=true;setNotice("");setError("");setDraft(current=>{
    const engines=current.engines.includes(engine)?current.engines.filter(item=>item!==engine):[...current.engines,engine];
    return {engines,preferred:engines.includes(current.preferred)?current.preferred:engines[0] || current.preferred};
  });}
  return <form className="seoPreferencesForm" onSubmit={event=>{event.preventDefault();setError("");setNotice("");try{save(draft);dirty.current=false;setNotice("Настройки SEO сохранены");onSaved?.();}catch(error){setError(error instanceof Error?error.message:"Не удалось сохранить настройки. Проверьте доступ к хранилищу браузера.");}}}>
    <h2>Поисковые системы</h2><p>Выберите системы для предпросмотра результатов. Эти настройки не ограничивают индексацию сайта.</p>
    <fieldset><legend>Показывать результат в поиске</legend>{(["google","yandex"] as SearchEngine[]).map(engine=><label className="seoEngineCheckbox" key={engine}><input type="checkbox" checked={draft.engines.includes(engine)} onChange={()=>toggle(engine)}/><span>{searchEngineNames[engine]}</span></label>)}</fieldset>
    <label className="seoPreferredLabel">Открывать первой<select value={draft.engines.includes(draft.preferred)?draft.preferred:""} disabled={!draft.engines.length} onChange={event=>{dirty.current=true;setDraft(current=>({...current,preferred:event.target.value as SearchEngine}));setNotice("");}}>{!draft.engines.length && <option value="">Сначала выберите систему</option>}{draft.engines.map(engine=><option key={engine} value={engine}>{searchEngineNames[engine]}</option>)}</select></label>
    <p className="seoSettingsHelp">Если отмечены обе системы, в редакторе доступны вкладки Google и Яндекс. Настройки сохраняются в этом браузере и применяются к открытым вкладкам демо.</p>
    {error && <p role="alert" className="seoPreferencesError">{error}</p>}{notice && <p role="status">{notice}</p>}
    <button type="submit" className="primary">Сохранить настройки SEO</button>
  </form>;
}

export function SearchResultPreview({entity,siteName,domain,settingsHref}:{entity:DemoEntity;siteName:string;domain:string;settingsHref:string}) {
  const {preferences}=useSeoPreferences();const uid=useId();
  const key=resultViewKey(entity.id,entity.kind);
  const [view,setView]=useState(()=>{try{return normalizeResultView(JSON.parse(sessionStorage.getItem(key) || "null"),preferences);}catch{return normalizeResultView(null,preferences);}});
  const signature=resultViewSignature(preferences);
  useEffect(()=>{try{setView(normalizeResultView(JSON.parse(sessionStorage.getItem(key) || "null"),preferences));}catch{setView(current=>({...current,engine:preferences.preferred}));}},[signature,key]);
  function change(engine:SearchEngine,device:ResultDevice){setView({engine,device});try{sessionStorage.setItem(key,JSON.stringify({engine,device,signature}));}catch{/* Preview controls remain usable without persistence. */}}
  const engine=preferences.engines.includes(view.engine)?view.engine:preferences.preferred;
  const name=searchEngineNames[engine];const address=resultAddress(domain,entity.slug);
  const panelId=`${uid}-result`;
  return <section className="serpPreview" aria-label="Предпросмотр поисковой выдачи" data-device={view.device} data-engine={engine}>
    <header><div><small>ПОИСКОВАЯ ВЫДАЧА</small><h3>Результат в поиске</h3></div><a href={settingsHref} target="_blank" rel="noopener" className="serpSettingsLink" aria-label="Настройки SEO — новая вкладка" title="Настройки SEO"><PanelIcon name="settings"/></a></header>
    <div className="serpControls">{preferences.engines.length>1 ? <div role="tablist" aria-label="Поисковая система" className="serpEngineTabs">{preferences.engines.map((item,index)=><button type="button" role="tab" key={item} id={`${uid}-${item}`} aria-selected={engine===item} aria-controls={panelId} tabIndex={engine===item?0:-1} onClick={()=>change(item,view.device)} onKeyDown={event=>{
      if(!["ArrowLeft","ArrowRight","Home","End"].includes(event.key))return;event.preventDefault();
      const next=event.key==="Home"?0:event.key==="End"?preferences.engines.length-1:(index+(event.key==="ArrowRight"?1:-1)+preferences.engines.length)%preferences.engines.length;
      change(preferences.engines[next],view.device);event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
    }}>{searchEngineNames[item]}</button>)}</div> : <span className="serpSingleEngine">{name}</span>}
    <div className="serpDevices" role="group" aria-label="Устройство предпросмотра">{(["desktop","mobile"] as ResultDevice[]).map(device=><button type="button" key={device} aria-label={device==="desktop"?"ПК":"Мобильная версия"} title={device==="desktop"?"ПК":"Мобильная версия"} aria-pressed={view.device===device} onClick={()=>change(engine,device)}><PanelIcon name={device==="desktop"?"desktop":"mobile"}/></button>)}</div></div>
    <div className="serpResult" id={panelId} role={preferences.engines.length>1?"tabpanel":undefined} aria-labelledby={preferences.engines.length>1?`${uid}-${engine}`:undefined}>
      <div className="serpSite"><span className="serpFavicon" aria-hidden="true">{siteName.trim().charAt(0) || "B"}</span><div><span className="serpSiteName">{siteName || address.host}</span><span className="serpBreadcrumb" title={address.url}>{engine==="google"?address.breadcrumb:address.host}</span></div></div>
      <h4 className="serpTitle">{entity.seoTitle || entity.title || "Заголовок страницы"}</h4>
      {engine==="yandex" && <span className="serpYandexPath">{address.breadcrumb}</span>}
      <p className="serpDescription">{entity.seoDescription || entity.excerpt || `Описание не задано. ${name} может использовать текст страницы.`}</p>
    </div>
    <p className="serpDisclaimer">Пример оформления. Поисковая система может изменить заголовок и описание с учётом запроса и устройства. <a href={searchEngineDocs[engine]} target="_blank" rel="noopener">Как формируется результат</a></p>
  </section>;
}
