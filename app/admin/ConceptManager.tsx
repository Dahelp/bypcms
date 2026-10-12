"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import "./concepts-admin.css";

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
  const request=useCallback(async(action:string,body?:Record<string,unknown>)=>{
    const response=await fetch(`/api/index.php?action=${action}`,{method:body?"POST":"GET",credentials:"same-origin",cache:"no-store",
      headers:{"Content-Type":"application/json",...(body?{"X-CSRF-Token":csrf}:{})},body:body?JSON.stringify(body):undefined});
    const payload=await response.json();
    if(!response.ok||!payload.ok)throw new Error(payload.error||"Ошибка запроса");
    return payload;
  },[csrf]);
  const load=useCallback(async()=>{try{const data=await request("concepts.list");setItems(data.concepts)}catch(e){setError(e instanceof Error?e.message:"Не удалось загрузить концепции")}},[request]);
  useEffect(()=>{void load()},[load]);
  function edit(item:Concept){setEditing(item);setCreating(false);const parsed=JSON.parse(item.translations||"{}");setTranslations(parsed);setLanguage(Object.keys(parsed)[0]||"ru");setError("");}
  function create(){setEditing(null);setCreating(true);setTranslations({ru:""});setLanguage("ru");setError("");}
  function close(){setEditing(null);setCreating(false);}
  async function save(event:FormEvent<HTMLFormElement>){event.preventDefault();const f=new FormData(event.currentTarget);setError("");try{
    await request("concepts.save",{id:editing?.id||0,slug:f.get("slug"),title:f.get("title"),status:f.get("status"),asset_base:f.get("asset_base"),translations});
    close();setMessage("Концепция сохранена");await load();
  }catch(e){setError(e instanceof Error?e.message:"Не удалось сохранить")}}
  async function rotate(item:Concept){if(!window.confirm("Создать новый ключ? Старая ссылка перестанет работать."))return;try{await request("concepts.rotate",{id:item.id});setMessage("Ключ обновлён. Скопируйте новую ссылку.");await load()}catch(e){setError(e instanceof Error?e.message:"Не удалось обновить ключ")}}
  async function remove(item:Concept){if(!window.confirm(`Удалить концепцию «${item.title}» без возможности восстановления?`))return;try{await request("concepts.delete",{id:item.id});setMessage("Концепция удалена");await load()}catch(e){setError(e instanceof Error?e.message:"Не удалось удалить")}}
  async function upload(file:File|undefined){if(!file)return;setError("");try{const form=new FormData();form.append("image",file);const response=await fetch("/api/index.php?action=concepts.upload",{method:"POST",credentials:"same-origin",headers:{"X-CSRF-Token":csrf},body:form});const data=await response.json();if(!response.ok||!data.ok)throw new Error(data.error||"Ошибка загрузки");setUploaded(data.url)}catch(e){setError(e instanceof Error?e.message:"Не удалось загрузить изображение")}}
  function url(item:Concept){return `${window.location.origin}/concepts/${item.slug}/#key=${item.share_token}`}
  return <section className="conceptManager">
    <div className="conceptIntro"><div><p>ПЕРСОНАЛЬНЫЕ ПРЕЗЕНТАЦИИ</p><h2>Концепции</h2><span>Содержимое выдаётся только по ссылке с ключом. Ключ можно отозвать в любой момент.</span></div><button onClick={create}>＋ Создать концепцию</button></div>
    {message&&<p className="conceptNotice">{message}</p>}{error&&<p className="conceptError">{error}</p>}
    <div className="conceptList">{items.map(item=><article key={item.id}><div><small>{item.status==="shared"?"Доступна по ссылке":item.status==="draft"?"Черновик":"Архив"} · {Object.keys(JSON.parse(item.translations||"{}")).map(x=>x.toUpperCase()).join(" / ")}</small><h3>{item.title}</h3><code>/concepts/{item.slug}/</code></div><div className="conceptActions"><button onClick={()=>edit(item)}>Редактировать</button>{item.status==="shared"&&<><a href={url(item)} target="_blank" rel="noreferrer">Просмотр ↗</a><button onClick={()=>void navigator.clipboard.writeText(url(item)).then(()=>setMessage("Ссылка скопирована"))}>Копировать ссылку</button></>}<button onClick={()=>void rotate(item)}>Сменить ключ</button><button className="danger" onClick={()=>void remove(item)}>Удалить</button></div></article>)}</div>
    {!items.length&&<p>Концепций пока нет.</p>}
    {(creating||editing)&&<div className="conceptModalShade" onMouseDown={close}><form className="conceptModal" onSubmit={save} onMouseDown={e=>e.stopPropagation()}><header><div><small>РЕДАКТОР КОНЦЕПЦИИ</small><h2>{editing?.title||"Новая концепция"}</h2></div><button type="button" onClick={close}>×</button></header><div className="conceptFields"><label>Название<input name="title" required defaultValue={editing?.title||""}/></label><label>Адрес после /concepts/<input name="slug" required pattern="[a-z0-9][a-z0-9-]*" defaultValue={editing?.slug||""} placeholder="project-name"/></label><label>Путь к изображениям<input name="asset_base" required defaultValue={editing?.asset_base||"/"} placeholder="/uploads/concepts/"/></label><label>Доступ<select name="status" defaultValue={editing?.status||"draft"}><option value="draft">Черновик</option><option value="shared">Доступна по ссылке</option><option value="archived">Архив</option></select></label></div><p className="conceptHelp">Для каждого языка вставьте полную HTML-презентацию. Перевод редактируется отдельно. Если язык не добавлен, посетитель увидит первый доступный вариант.</p><div className="conceptUpload"><label>Загрузить изображение (до 8 МБ)<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={e=>void upload(e.target.files?.[0])}/></label>{uploaded&&<span>Адрес файла: <code>{uploaded}</code> — вставьте в HTML</span>}</div><div className="conceptLangs">{Object.keys(translations).map(lang=><button key={lang} type="button" className={language===lang?"active":""} onClick={()=>setLanguage(lang)}>{lang.toUpperCase()}</button>)}<select aria-label="Добавить язык" value="" onChange={e=>{const lang=e.target.value;if(lang){setTranslations(x=>({...x,[lang]:""}));setLanguage(lang)}}}><option value="">＋ Язык</option>{Object.entries(languages).filter(([key])=>!(key in translations)).map(([key,name])=><option key={key} value={key}>{name}</option>)}</select></div><label className="conceptHtml">HTML · {languages[language]||language}<textarea value={translations[language]||""} onChange={e=>setTranslations(x=>({...x,[language]:e.target.value}))} rows={18} spellCheck={false} placeholder="<!doctype html>..."/></label><details className="conceptPreview"><summary>Предпросмотр выбранного языка</summary><iframe title="Предпросмотр концепции" sandbox="allow-scripts allow-forms" referrerPolicy="no-referrer" srcDoc={(translations[language]||"").replace(/<head([^>]*)>/i,`<head$1><base href="${window.location.origin}${editing?.asset_base||"/"}">`)}/></details><div className="conceptModalActions">{Object.keys(translations).length>1&&<button type="button" onClick={()=>{const copy={...translations};delete copy[language];setTranslations(copy);setLanguage(Object.keys(copy)[0])}}>Удалить перевод</button>}<button type="submit">Сохранить концепцию →</button></div></form></div>}
  </section>;
}
