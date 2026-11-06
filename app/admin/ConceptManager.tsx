"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import "./concepts-admin.css";
import PanelDraftForm, {clearPanelDrafts} from "../components/PanelDraftForm";
import PanelTable from "../components/PanelTable";
import { deleteBulkAction, refreshAfterBulk, requestPanelBulk, statusBulkActions } from "../components/panel-bulk";
import { panelHref } from "../components/panel-route";
import WorkspaceIcon from "../components/WorkspaceIcon";
import { panelRequest } from "../components/panel-api";

type Concept = {id:number;slug:string;title:string;status:string;share_token:string;asset_base:string;translations:string;updated_at:string};
const languages:Record<string,string>={ru:"Русский",en:"English",de:"Deutsch",it:"Italiano",fr:"Français",es:"Español"};

export default function ConceptManager({csrf}:{csrf:string}) {
  const [items,setItems]=useState<Concept[]>([]);
  const [editing,setEditing]=useState<Concept|null>(null);
  const [creating,setCreating]=useState(false);
  const [language,setLanguage]=useState("ru");
  const [translations,setTranslations]=useState<Record<string,string>>({ru:""});
  const [message,setMessage]=useState("");
  const [error,setError]=useState("");
  const [uploaded,setUploaded]=useState("");
  const [loaded,setLoaded]=useState(false);
  const [routeReady,setRouteReady]=useState(false);
  const listHref=panelHref({section:"concepts"});
  const editHref=(item:Concept)=>panelHref({section:"concepts",concept:item.id});
  const request=useCallback(async(action:string,body?:Record<string,unknown>)=>{
    return panelRequest<any>(action,{method:body?"POST":"GET",body:body?JSON.stringify(body):undefined},csrf);
  },[csrf]);
  const load=useCallback(async()=>{try{const data=await request("concepts.list");setItems(data.concepts);setLoaded(true)}catch(e){setError(e instanceof Error?e.message:"Не удалось загрузить концепции")}},[request]);
  useEffect(()=>{void load()},[load]);
  useEffect(()=>{
    if(!loaded||routeReady)return;
    setRouteReady(true);
    const concept=new URLSearchParams(location.search).get("concept");
    setCreating(concept==="new");
    if(concept&&concept!=="new"){
      const item=items.find(item=>String(item.id)===concept);
      if(!item){setError("Концепция не найдена.");return;}
      setEditing(item);
      try{const parsed=JSON.parse(item.translations||"{}");setTranslations(parsed);setLanguage(Object.keys(parsed)[0]||"ru");}
      catch{setError("Не удалось прочитать переводы концепции.");}
    }
  },[items,loaded,routeReady]);
  const reloadRecords=async()=>{const result=await request("concepts.list");setItems(result.concepts);};
  const bulkActions=[
    ...statusBulkActions<Concept>([["shared","Открыть доступ по ссылке"],["draft","В черновики"],["archived","В архив"]],async(rows,status)=>refreshAfterBulk(await requestPanelBulk("concepts","status",rows.map(row=>row.id),csrf,status),reloadRecords)),
    deleteBulkAction<Concept>(async rows=>refreshAfterBulk(await requestPanelBulk("concepts","delete",rows.map(row=>row.id),csrf),reloadRecords)),
  ];
  async function save(event:FormEvent<HTMLFormElement>){event.preventDefault();const f=new FormData(event.currentTarget);setError("");try{
    await request("concepts.save",{id:editing?.id||0,slug:f.get("slug"),title:f.get("title"),status:f.get("status"),asset_base:f.get("asset_base"),translations});
    clearPanelDrafts();
    window.location.assign(listHref);
  }catch(e){setError(e instanceof Error?e.message:"Не удалось сохранить")}}
  async function rotate(item:Concept){if(!window.confirm("Создать новый ключ? Старая ссылка перестанет работать."))return;try{await request("concepts.rotate",{id:item.id});setMessage("Ключ обновлён. Скопируйте новую ссылку.");await load()}catch(e){setError(e instanceof Error?e.message:"Не удалось обновить ключ")}}
  async function remove(item:Concept){if(!window.confirm(`Удалить концепцию «${item.title}» без возможности восстановления?`))return;try{await request("concepts.delete",{id:item.id});setMessage("Концепция удалена");await load()}catch(e){setError(e instanceof Error?e.message:"Не удалось удалить")}}
  async function upload(file:File|undefined){if(!file)return;setError("");try{const form=new FormData();form.append("image",file);const data=await panelRequest<{url:string}>("concepts.upload",{method:"POST",body:form},csrf);setUploaded(data.url)}catch(e){setError(e instanceof Error?e.message:"Не удалось загрузить изображение")}}
  function url(item:Concept){return `${window.location.origin}/concepts/${item.slug}/#key=${item.share_token}`}
  if(creating||editing) return <section className="conceptEditorPage"><PanelDraftForm draftId="concept" extra={{translations,language}} onRestore={draft=>{const extra=draft.extra as {translations?:Record<string,string>;language?:string}|undefined;if(extra?.translations)setTranslations(extra.translations);if(extra?.language)setLanguage(extra.language);}} className="conceptEditorForm workspaceEditorForm" onSubmit={save}><header><a className="editorBack" href={listHref}><WorkspaceIcon symbol="←"/> К концепциям</a><div><small>РЕДАКТОР КОНЦЕПЦИИ</small><h2>{editing?.title||"Новая концепция"}</h2></div></header><div className="editorFormSurface">{error&&<p className="conceptError" role="alert">{error}</p>}<div className="conceptFields"><label>Название<input name="title" required defaultValue={editing?.title||""}/></label><label>Адрес после /concepts/<input name="slug" required pattern="[a-z0-9][a-z0-9-]*" defaultValue={editing?.slug||""} placeholder="project-name"/></label><label>Путь к изображениям<input name="asset_base" required defaultValue={editing?.asset_base||"/"} placeholder="/uploads/concepts/"/></label><label>Доступ<select name="status" defaultValue={editing?.status||"draft"}><option value="draft">Черновик</option><option value="shared">Доступна по ссылке</option><option value="archived">Архив</option></select></label></div><p className="conceptHelp">Для каждого языка вставьте полную HTML-презентацию. Перевод редактируется отдельно. Если язык не добавлен, посетитель увидит первый доступный вариант.</p><div className="conceptUpload"><label>Загрузить изображение (до 8 МБ)<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={e=>void upload(e.target.files?.[0])}/></label>{uploaded&&<span>Адрес файла: <code>{uploaded}</code> — вставьте в HTML</span>}</div><div className="conceptLangs">{Object.keys(translations).map(lang=><button key={lang} type="button" className={language===lang?"active":""} onClick={()=>setLanguage(lang)}>{lang.toUpperCase()}</button>)}<select aria-label="Добавить язык" value="" onChange={e=>{const lang=e.target.value;if(lang){setTranslations(x=>({...x,[lang]:""}));setLanguage(lang)}}}><option value="">＋ Язык</option>{Object.entries(languages).filter(([key])=>!(key in translations)).map(([key,name])=><option key={key} value={key}>{name}</option>)}</select></div><label className="conceptHtml">HTML · {languages[language]||language}<textarea value={translations[language]||""} onChange={e=>setTranslations(x=>({...x,[language]:e.target.value}))} rows={18} spellCheck={false} placeholder="<!doctype html>..."/></label><details className="conceptPreview"><summary>Предпросмотр выбранного языка</summary><iframe title="Предпросмотр концепции" sandbox="allow-scripts allow-forms" referrerPolicy="no-referrer" srcDoc={(translations[language]||"").replace(/<head([^>]*)>/i,`<head$1><base href="${window.location.origin}${editing?.asset_base||"/"}">`)}/></details><div className="conceptEditorFormActions">{Object.keys(translations).length>1&&<button type="button" onClick={()=>{const copy={...translations};delete copy[language];setTranslations(copy);setLanguage(Object.keys(copy)[0])}}>Удалить перевод</button>}<button type="submit">Сохранить концепцию →</button></div></div></PanelDraftForm></section>;
  return <section className="conceptManager">
    <div className="conceptIntro"><div><p>ПЕРСОНАЛЬНЫЕ ПРЕЗЕНТАЦИИ</p><h2>Концепции</h2><span>Содержимое выдаётся только по ссылке с ключом. Ключ можно отозвать в любой момент.</span></div><a className="panelLinkButton panelPrimaryLink" href={panelHref({section:"concepts",concept:"new"})}>＋ Создать концепцию</a></div>
    {message&&<p className="conceptNotice">{message}</p>}{error&&<p className="conceptError">{error}</p>}
    <PanelTable bulkActions={bulkActions} label="Концепции" rows={items} rowId={item=>item.id} rowLabel={item=>item.title} columns={[
      {key:"title",label:"Название",render:item=><span className="panelCellText"><a href={editHref(item)}>{item.title}</a><small>/concepts/{item.slug}/</small></span>},
      {key:"status",label:"Доступ",render:item=><em>{item.status==="shared"?"Доступна по ссылке":item.status==="draft"?"Черновик":"Архив"}</em>},
      {key:"languages",label:"Языки",render:item=>Object.keys(JSON.parse(item.translations||"{}")).map(x=>x.toUpperCase()).join(" / ")},
      {key:"updated",label:"Обновлено",render:item=>new Date(item.updated_at).toLocaleDateString("ru-RU")},
    ]} actions={item=>[{label:"Редактировать",href:editHref(item)},...(item.status==="shared"?[
      {label:"Просмотр",href:url(item),newTab:true},
      {label:"Копировать ссылку",onClick:()=>{void navigator.clipboard.writeText(url(item)).then(()=>setMessage("Ссылка скопирована")).catch(()=>setError("Не удалось скопировать ссылку"));}},
    ]:[]),{label:"Сменить ключ",onClick:()=>void rotate(item)},{label:"Удалить",danger:true,onClick:()=>void remove(item)}]} empty="Концепций пока нет."/>

  </section>;
}
