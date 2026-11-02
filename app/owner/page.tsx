"use client";

import Link from "next/link";
import PanelTable from "../components/PanelTable";
import { panelHref } from "../components/panel-route";
import PanelSearch from "../components/PanelSearch";
import WorkspaceIcon from "../components/WorkspaceIcon";
import NotificationDropdown from "../components/NotificationDropdown";
import { FormEvent, useEffect, useMemo, useState } from "react";
import "./owner.css";
import "./gate.css";

type User={id:number;name:string;email:string;role:string;role_name:string};
type Client={id:number;name:string;company:string;email:string;phone:string;status:string;notes:string;task_count:number;done_count:number;contract_total:number};
type Task={id:number;client_id:number;client_name:string;service_id:number|null;service_name:string|null;title:string;description:string;contract_ref:string;assignee:string;status:string;progress:number;price:number;due_at:string|null};
type Service={id:number;service_key:string;name:string;description:string;price_from:number;billing_unit:string;status:string};
type Module={id:number;module_key:string;name:string;category:string;description:string;current_version:string;price:number;compatibility:string;status:string};
type EditionModule={edition:string;module_key:string;availability:"included"|"optional"|"hidden"};
type License={id:number;client_id:number;client_name:string;license_hint:string;domain:string;edition:string;license_term:"annual"|"lifetime";purchase_price:number;core_version:string;installed_version:string;entitlements:string;status:string;valid_until:string|null;last_seen_at:string|null};
type Notice={id:number;title:string;message:string;severity:string;is_read:number;created_at:string};
type Portfolio={id:number;slug:string;title:string;category:string;edition:string;project_year:string;lead:string;description:string;result_text:string;cover_image:string;gallery:string;features:string;modules:string;services:string;project_url:string;status:string;sort_order:number};
type OwnerData={user:User;clients:Client[];tasks:Task[];services:Service[];modules:Module[];edition_modules:EditionModule[];licenses:License[];portfolio:Portfolio[];orders:unknown[];builds:unknown[];notifications:Notice[];settings:Record<string,string>;csrf:string};
type EditorRoute={type:"client"|"task"|"service"|"license"|"module"|"portfolio";record?:Record<string,unknown>}|null;

const editions:Record<string,{annual:number;lifetime:number;description:string}>={
  Business:{annual:9900,lifetime:24900,description:"Корпоративные сайты, услуги и CRM"},
  Commerce:{annual:19900,lifetime:49900,description:"Каталог, корзина, заказы и платежи"},
  Content:{annual:7900,lifetime:19900,description:"Блог, медиа и база знаний"},
};
const taskStatuses:Record<string,string>={planned:"Запланировано",in_progress:"В работе",review:"Проверка",done:"Завершено",blocked:"Заблокировано"};
const clientStatuses:Record<string,string>={lead:"Лид",active:"Активный",paused:"Приостановлен",closed:"Завершён"};
const licenseStatuses:Record<string,string>={active:"Активна",renewal:"Продление",expired:"Истекла",trial:"Тестовая"};
const editorSection:Record<string,string>={client:"clients",task:"clients",license:"licenses",module:"modules",service:"services",portfolio:"portfolio"};
const nav=[["overview","Обзор"],["clients","Клиенты и работы"],["licenses","Лицензии"],["builder","Конструктор"],["modules","Модули"],["services","Услуги"],["portfolio","Портфолио"],["notifications","Оповещения"],["settings","Настройки"]];

export default function Owner(){
  const[access,setAccess]=useState<"loading"|"login"|"granted">("loading");
  const[data,setData]=useState<OwnerData|null>(null);
  const[section,setSection]=useState("overview");
  const[editor,setEditor]=useState<EditorRoute>(null);
  const[routeError,setRouteError]=useState("");
  const[routeReady,setRouteReady]=useState(false);
  useEffect(()=>{
    if(!data||routeReady)return;
    const query=new URLSearchParams(location.search);
    const next=query.get("section")||"overview";
    const section=nav.some(item=>item[0]===next)?next:"overview";
    setSection(section);
    const type=query.get("editor") as NonNullable<EditorRoute>["type"];
    const collections:Record<string,unknown[]>={client:data.clients,task:data.tasks,service:data.services,license:data.licenses,module:data.modules,portfolio:data.portfolio||[]};
    if(type && Object.hasOwn(collections,type) && editorSection[type]===section){
      const record=(collections[type] as Record<string,unknown>[]).find(item=>String(item.id)===query.get("record"));
      if(query.has("record")&&!record)setRouteError("Запись не найдена. Вернитесь к списку.");
      else {
        const prepared: Record<string,unknown> | undefined=record ? {...record} : type==="task"&&query.has("client") ? {client_id:Number(query.get("client"))} : undefined;
        if(prepared&&type==="license")prepared.entitlements=safeJson(String(prepared.entitlements||"[]"));
        if(prepared&&type==="module")prepared.availability=Object.fromEntries(data.edition_modules.filter(item=>item.module_key===prepared.module_key).map(item=>[item.edition,item.availability]));
        setEditor({type,record:prepared});
      }
    }
    setRouteReady(true);
  },[data,routeReady]);
  const sectionHref=(section:string)=>panelHref({section});
  const editorHref=(type:NonNullable<EditorRoute>["type"],record?:number,client?:number)=>panelHref({section:editorSection[type],editor:type,record,client});
  const[error,setError]=useState("");
  const[toast,setToast]=useState("");
  const[search,setSearch]=useState("");
  const[edition,setEdition]=useState("Business");
  const[licenseTerm,setLicenseTerm]=useState<"annual"|"lifetime">("annual");
  const[selectedModules,setSelectedModules]=useState<string[]>([]);
  const[buildName,setBuildName]=useState("Новый проект");
  const notify=(text:string)=>{setToast(text);window.setTimeout(()=>setToast(""),3000)};
  const request=async(action:string,options:RequestInit={})=>{
    const response=await fetch(`/api/index.php?action=${encodeURIComponent(action)}`,{credentials:"same-origin",headers:{"Content-Type":"application/json",...(data?.csrf?{"X-CSRF-Token":data.csrf}:{}),...(options.headers||{})},...options});
    const payload=await response.json().catch(()=>({error:"Некорректный ответ сервера"}));
    if(!response.ok||!payload.ok)throw new Error(payload.error||"Ошибка запроса");
    return payload;
  };
  const load=async()=>{
    try{const payload=await request("owner.bootstrap");setData(payload);setAccess("granted")}
    catch(e){if(e instanceof Error&&e.message.includes("авторизац"))setAccess("login");else{setError(e instanceof Error?e.message:"Ошибка загрузки");setAccess("login")}}
  };
  useEffect(()=>{void load()},[]);
  const login=async(event:FormEvent<HTMLFormElement>)=>{
    event.preventDefault();setError("");const f=new FormData(event.currentTarget);
    try{const r=await fetch("/api/index.php?action=auth.login",{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:f.get("email"),password:f.get("password")})});if(!r.ok)throw new Error("Неверный email или пароль");await load()}
    catch(e){setError(e instanceof Error?e.message:"Ошибка входа")}
  };
  const save=async(action:string,payload:Record<string,unknown>)=>{setError("");try{await request(action,{method:"POST",body:JSON.stringify(payload)});if(editor){window.location.assign(sectionHref(editorSection[editor.type]));return;}await load();notify("Изменения сохранены")}catch(e){setError(e instanceof Error?e.message:"Ошибка сохранения")}};
  const initials=(data?.user.name||"Владелец").split(/\s+/).map(x=>x[0]).join("").slice(0,2).toUpperCase();
  const unread=data?.notifications.filter(n=>!Number(n.is_read)).length||0;
  const compatibility=useMemo(()=>new Map((data?.edition_modules||[]).filter(x=>x.edition===edition).map(x=>[x.module_key,x.availability])),[data,edition]);
  const availableModules=(data?.modules||[]).filter(m=>(compatibility.get(m.module_key)||"hidden")!=="hidden");
  const included=availableModules.filter(m=>compatibility.get(m.module_key)==="included").map(m=>m.module_key);
  useEffect(()=>{if(data)setSelectedModules(current=>Array.from(new Set([...included,...current.filter(k=>compatibility.get(k)==="optional")])));},[edition,data]);
  const moduleTotal=availableModules.filter(m=>selectedModules.includes(m.module_key)&&compatibility.get(m.module_key)==="optional").reduce((sum,m)=>sum+Number(m.price),0);
  const editionPrice=editions[edition][licenseTerm];
  const filteredClients=(data?.clients||[]).filter(c=>`${c.name} ${c.company} ${c.email}`.toLowerCase().includes(search.toLowerCase()));
  const revenue=(data?.tasks||[]).reduce((sum,t)=>sum+Number(t.price||0),0);
  const activeLicenses=(data?.licenses||[]).filter(l=>l.status==="active").length;
  const openTasks=(data?.tasks||[]).filter(t=>t.status!=="done").length;

  if(access==="loading")return <main className="ownerGate loading"><b>B</b><p>Загрузка центра управления…</p></main>;
  if(access==="login")return <main className="ownerGate"><section><Link href="/" className="ownerBrand"><b>B</b><span>BYPCMS<strong>OWNER</strong></span></Link><div><small>ЗАЩИЩЁННАЯ ЗОНА</small><h1>Управление платформой.</h1><p>Клиенты, договорные работы, лицензии, сборки и обновления доступны только владельцу.</p></div></section><form onSubmit={login}><small>АВТОРИЗАЦИЯ ВЛАДЕЛЬЦА</small><h2>Войти в Control Center</h2>{error&&<em>{error}</em>}<label>Email<input name="email" type="email" required/></label><label>Пароль<input name="password" type="password" required/></label><button>Войти <WorkspaceIcon symbol="→"/></button><Link href="/"><WorkspaceIcon symbol="←"/> На главную</Link></form></main>;

  return <main className="ownerApp">
    <aside className="ownerSidebar workspaceMenu"><Link href="/" className="ownerBrand workspaceMenuBrand"><b>B</b><span>BYPCMS</span><i>Owner</i></Link><p className="workspaceMenuGroup">УПРАВЛЕНИЕ</p><nav aria-label="Разделы владельца">{nav.map(([id,label])=><a key={id} href={sectionHref(id)} aria-label={label} title={label} aria-current={section===id?"page":undefined} className={section===id?"active":""}><i><WorkspaceIcon symbol={id}/></i><span>{label}</span>{id==="notifications"&&unread>0&&<em>{unread}</em>}</a>)}</nav><div className="ownerStatus workspaceMenuStatus"><i/><span><b>Production</b><small>Данные подключены к MySQL</small></span></div><Link className="ownerExit workspaceMenuExit" href="/admin">Панель сайта <WorkspaceIcon symbol="↗"/></Link></aside>
    <section className="ownerMain"><header><PanelSearch value={search} onChange={setSearch} placeholder="Поиск клиента, лицензии, домена…" /><div><NotificationDropdown items={data?.notifications||[]} hrefForItem={()=>sectionHref("notifications")} onRead={async(id)=>{await request("owner.notification.read",{method:"POST",body:JSON.stringify({id}),keepalive:true});}} /><a className="ownerProfileButton" href={sectionHref("settings")}><span className="ownerAvatar">{initials}</span><p><b>{data?.user.name}</b><small>{data?.user.role_name}</small></p></a></div></header>
      <div className={`ownerContent ${editor ? "editorRouteOpen" : ""}`}><div className="ownerHeading"><div><small>BYPCMS CONTROL CENTER</small><h1>{nav.find(x=>x[0]===section)?.[1]}</h1><p>{section==="overview"?"Реальные данные платформы, клиентов и договорных обязательств.":"Создание, редактирование и контроль без перехода в демонстрационные экраны."}</p></div>
        {section==="clients"&&<a className="panelLinkButton panelPrimaryLink" href={editorHref("client")}><WorkspaceIcon symbol="＋"/> Клиент</a>}
        {section==="licenses"&&<a className="panelLinkButton panelPrimaryLink" href={editorHref("license")}><WorkspaceIcon symbol="＋"/> Лицензия</a>}
        {section==="modules"&&<a className="panelLinkButton panelPrimaryLink" href={editorHref("module")}><WorkspaceIcon symbol="＋"/> Модуль</a>}
        {section==="services"&&<a className="panelLinkButton panelPrimaryLink" href={editorHref("service")}><WorkspaceIcon symbol="＋"/> Услуга</a>}
        {section==="portfolio"&&<a className="panelLinkButton panelPrimaryLink" href={editorHref("portfolio")}><WorkspaceIcon symbol="＋"/> Проект</a>}
      </div>{routeError&&<p role="alert">{routeError} <a href={sectionHref(section)}>К списку</a></p>}{toast&&<div className="ownerToast"><WorkspaceIcon symbol="✓"/> {toast}<button onClick={()=>setToast("")}><WorkspaceIcon symbol="×"/></button></div>}{error&&<div className="ownerError">{error}<button onClick={()=>setError("")}><WorkspaceIcon symbol="×"/></button></div>}

      {section==="overview"&&<><div className="ownerKpis">
        <article><span className="kpiIcon"><WorkspaceIcon symbol="payments"/></span><div><small>Договорная стоимость</small><strong>{revenue.toLocaleString("ru-RU")} ₽</strong><em>по всем работам</em></div></article>
        <article><span className="kpiIcon k1"><WorkspaceIcon symbol="licenses"/></span><div><small>Активные лицензии</small><strong>{activeLicenses}</strong><em>из {data?.licenses.length||0}</em></div></article>
        <article><span className="kpiIcon k2"><WorkspaceIcon symbol="tasks"/></span><div><small>Работы в процессе</small><strong>{openTasks}</strong><em>контролируются</em></div></article>
        <article><span className="kpiIcon k3"><WorkspaceIcon symbol="clients"/></span><div><small>Клиенты</small><strong>{data?.clients.length||0}</strong><em>в единой базе</em></div></article>
      </div><div className="ownerDashboard lower"><article className="ownerTable"><header><div><small>ДОГОВОРНЫЕ ОБЯЗАТЕЛЬСТВА</small><h2>Текущие работы</h2></div><a className="panelLinkButton" href={sectionHref("clients")}>Все работы <WorkspaceIcon symbol="→"/></a></header><PanelTable label="Текущие работы" rows={(data?.tasks||[]).slice(0,6)} rowId={t=>t.id} rowLabel={t=>t.title} columns={[
        {key:"title",label:"Работа",render:t=><span className="panelCellText"><a href={editorHref("task",t.id)}>{t.title}</a><small>{t.client_name} · {t.contract_ref||"без договора"}</small></span>},
        {key:"status",label:"Статус",render:t=><em>{taskStatuses[t.status]||t.status}</em>},
        {key:"progress",label:"Готовность",render:t=>`${t.progress}%`},
      ]} actions={t=>[{label:"Редактировать",href:editorHref("task",t.id)}]}/></article><article className="quickActions"><small>БЫСТРЫЕ ДЕЙСТВИЯ</small><h2>Создать</h2><a href={editorHref("client")}><i><WorkspaceIcon symbol="clients"/></i><span><b>Клиента</b><small>Контакты и реквизиты</small></span><WorkspaceIcon symbol="→"/></a><a href={editorHref("task")}><i><WorkspaceIcon symbol="✓"/></i><span><b>Договорную работу</b><small>Срок, стоимость, ответственный</small></span><WorkspaceIcon symbol="→"/></a><a href={sectionHref("builder")}><i><WorkspaceIcon symbol="builder"/></i><span><b>Сборку CMS</b><small>Редакция и совместимые модули</small></span><WorkspaceIcon symbol="→"/></a></article></div></>}

      {section==="clients"&&<div className="clientWorkspace">
        <section><h2>Клиенты</h2><PanelTable label="Клиенты" rows={filteredClients} rowId={c=>c.id} rowLabel={c=>c.company||c.name} columns={[
          {key:"name",label:"Клиент",render:c=><span className="panelCellText"><a href={editorHref("client",c.id)}>{c.company||c.name}</a><small>{c.email||"email не указан"} · {c.phone||"телефон не указан"}</small></span>},
          {key:"status",label:"Статус",render:c=><em>{clientStatuses[c.status]||c.status}</em>},
          {key:"tasks",label:"Работы",render:c=>`${c.done_count} из ${c.task_count} завершено`},
          {key:"total",label:"По договорам",render:c=>`${Number(c.contract_total).toLocaleString("ru-RU")} ₽`},
        ]} actions={c=>[{label:"Редактировать",href:editorHref("client",c.id)},{label:"Добавить работу",href:editorHref("task",undefined,c.id)}]}/></section>
        <section><header className="panelSectionHeader"><h2>Работы по договорам</h2><a className="panelLinkButton" href={editorHref("task")}>Добавить работу</a></header><PanelTable label="Работы по договорам" rows={data?.tasks||[]} rowId={t=>t.id} rowLabel={t=>t.title} columns={[
          {key:"title",label:"Работа",render:t=><span className="panelCellText"><a href={editorHref("task",t.id)}>{t.title}</a><small>{t.client_name} · {t.contract_ref||"без договора"}</small><small>{t.description}</small></span>},
          {key:"service",label:"Услуга",render:t=>t.service_name||"Индивидуальная работа"},
          {key:"assignee",label:"Ответственный",render:t=>t.assignee||"Не назначен"},
          {key:"status",label:"Состояние",render:t=><span className="panelCellText"><em>{taskStatuses[t.status]||t.status}</em><small>{t.progress}% · {t.due_at?new Date(t.due_at).toLocaleDateString("ru-RU"):"без срока"}</small></span>},
          {key:"price",label:"Стоимость",render:t=>`${Number(t.price).toLocaleString("ru-RU")} ₽`},
        ]} actions={t=>[{label:"Редактировать",href:editorHref("task",t.id)}]}/></section>
      </div>}

      {section==="licenses"&&<PanelTable label="Лицензии" rows={data?.licenses||[]} rowId={l=>l.id} rowLabel={l=>l.client_name} columns={[
        {key:"client",label:"Клиент / домен",render:l=><span className="panelCellText"><a href={editorHref("license",l.id)}>{l.client_name}</a><small>{l.domain||"домен не привязан"}</small></span>},
        {key:"key",label:"Лицензия",render:l=><code>{l.license_hint}</code>},
        {key:"edition",label:"Редакция и модули",render:l=><span className="panelCellText"><b>BYPCMS {l.edition}</b><small>{safeJson(l.entitlements).join(" · ")||"базовая комплектация"}</small></span>},
        {key:"version",label:"Версия",render:l=><span className="panelCellText">{l.installed_version||"не сообщалась"}<small>последняя {l.core_version}</small></span>},
        {key:"term",label:"Срок и цена",render:l=><span className="panelCellText">{l.license_term==="lifetime"?"Пожизненно":l.valid_until?new Date(l.valid_until).toLocaleDateString("ru-RU"):"1 год"}<small>{Number(l.purchase_price).toLocaleString("ru-RU")} ₽</small></span>},
        {key:"status",label:"Статус",render:l=><em>{licenseStatuses[l.status]||l.status}</em>},
      ]} actions={l=>[{label:"Редактировать",href:editorHref("license",l.id)}]}/>}

      {section==="builder"&&<div className="buildLayout"><section className="buildSteps"><div className="buildBlock"><span>01</span><div><small>ПРОЕКТ</small><h2>Редакция определяет базовую комплектацию</h2><label>Название сборки<input value={buildName} onChange={e=>setBuildName(e.target.value)}/></label><div className="editionSelect">{Object.entries(editions).map(([key,value])=><button className={edition===key?"active":""} onClick={()=>setEdition(key)} key={key}><b>{key}</b><small>{value.description}</small><strong>{value[licenseTerm].toLocaleString("ru-RU")} ₽</strong></button>)}</div></div></div>
        <div className="buildBlock"><span>02</span><div><small>УСЛОВИЯ ЛИЦЕНЗИИ</small><h2>Срок использования и обновлений</h2><div className="termSelect"><button className={licenseTerm==="annual"?"active":""} onClick={()=>setLicenseTerm("annual")}><b>1 год</b><span>Продлевается ежегодно</span><strong>{editions[edition].annual.toLocaleString("ru-RU")} ₽</strong></button><button className={licenseTerm==="lifetime"?"active":""} onClick={()=>setLicenseTerm("lifetime")}><b>Пожизненная</b><span>Без обязательного продления</span><strong>{editions[edition].lifetime.toLocaleString("ru-RU")} ₽</strong></button></div></div></div>
        <div className="buildBlock"><span>03</span><div><small>СОВМЕСТИМЫЕ МОДУЛИ</small><h2>Для {edition} показаны только подходящие расширения</h2><div className="buildModules">{availableModules.map(m=>{const mode=compatibility.get(m.module_key);return <label className={mode==="included"?"included":""} key={m.module_key}><input type="checkbox" disabled={mode==="included"} checked={selectedModules.includes(m.module_key)} onChange={()=>setSelectedModules(list=>list.includes(m.module_key)?list.filter(x=>x!==m.module_key):[...list,m.module_key])}/><span><b>{m.name}</b><small>{m.description}</small></span><strong>{mode==="included"?"В редакции":`+${Number(m.price).toLocaleString("ru-RU")} ₽`}</strong></label>})}</div></div></div></section>
        <aside className="buildSummary"><small>СОСТАВ СБОРКИ</small><h2>{buildName}</h2><p>BYPCMS {edition} · {licenseTerm==="annual"?"1 год":"пожизненно"} · Core 2.1.0</p><ul>{availableModules.filter(m=>selectedModules.includes(m.module_key)).map(m=><li key={m.module_key}><span>{m.name}<small>{compatibility.get(m.module_key)==="included"?"включён":"дополнительно"}</small></span><b>{compatibility.get(m.module_key)==="included"?"0 ₽":`${Number(m.price).toLocaleString("ru-RU")} ₽`}</b></li>)}</ul><div><span>Лицензия</span><b>{editionPrice.toLocaleString("ru-RU")} ₽</b></div><div><span>Доп. модули</span><b>{moduleTotal.toLocaleString("ru-RU")} ₽</b></div><strong><span>Итого</span>{(editionPrice+moduleTotal).toLocaleString("ru-RU")} ₽</strong><a className="panelLinkButton panelPrimaryLink" href={`/api/index.php?action=build.download&edition=${edition}&term=${licenseTerm}&modules=${selectedModules.join(",")}`}><WorkspaceIcon symbol="builder"/> Собрать ZIP-архив</a></aside></div>}

      {section==="modules"&&<PanelTable label="Модули" rows={data?.modules||[]} rowId={m=>m.id} rowLabel={m=>m.name} columns={[
        {key:"name",label:"Модуль",render:m=><span className="panelCellText"><a href={editorHref("module",m.id)}>{m.name}</a><small>{m.category} · v{m.current_version}</small><small>{m.description}</small></span>},
        {key:"price",label:"Цена",render:m=>`${Number(m.price).toLocaleString("ru-RU")} ₽`},
        {key:"compatibility",label:"Совместимость",render:m=>m.compatibility},
        {key:"editions",label:"Редакции",render:m=>(data?.edition_modules||[]).filter(x=>x.module_key===m.module_key&&x.availability!=="hidden").map(x=>x.edition).join(", ")},
        {key:"status",label:"Статус",render:m=><em>{m.status==="active"?"Активен":m.status==="inactive"?"Выключен":m.status}</em>},
      ]} actions={m=>[{label:"Редактировать",href:editorHref("module",m.id)}]}/>}

      {section==="services"&&<PanelTable label="Услуги" rows={data?.services||[]} rowId={s=>s.id} rowLabel={s=>s.name} columns={[
        {key:"name",label:"Услуга",render:s=><span className="panelCellText"><a href={editorHref("service",s.id)}>{s.name}</a><small>{s.description}</small></span>},
        {key:"price",label:"Стоимость",render:s=>`${Number(s.price_from).toLocaleString("ru-RU")} ₽ / ${s.billing_unit}`},
        {key:"status",label:"Статус",render:s=><em>{s.status==="active"?"Активна":"Скрыта"}</em>},
      ]} actions={s=>[{label:"Редактировать",href:editorHref("service",s.id)}]}/>}

      {section==="portfolio"&&<PanelTable label="Портфолио" rows={data?.portfolio||[]} rowId={p=>p.id} rowLabel={p=>p.title} columns={[
        {key:"title",label:"Проект",render:p=><span className="panelCellText"><a href={editorHref("portfolio",p.id)}>{p.title}</a><small>{p.category} · {p.project_year}</small><small>{p.lead}</small></span>},
        {key:"edition",label:"Редакция",render:p=>p.edition},
        {key:"status",label:"Статус",render:p=><em>{p.status==="published"?"Опубликован":p.status==="archived"?"В архиве":"Черновик"}</em>},
      ]} actions={p=>[{label:"Редактировать",href:editorHref("portfolio",p.id)},...(p.status==="published"?[{label:"Просмотр",href:`/portfolio/${encodeURIComponent(p.slug)}/`,newTab:true}]:[])]} empty="Добавьте первый проект. Он появится в публичном портфолио после публикации."/>}

      {section==="notifications"&&<article className="notificationCenter"><header><div><small>ЦЕНТР СОБЫТИЙ</small><h2>Оповещения</h2></div><button onClick={async()=>{await save("owner.notification.read",{id:0})}}>Отметить все прочитанными</button></header>{(data?.notifications||[]).map(n=><button className={Number(n.is_read)?"read":""} key={n.id} onClick={async()=>{await request("owner.notification.read",{method:"POST",body:JSON.stringify({id:n.id})});await load()}}><i className={n.severity}/><span><b>{n.title}</b><small>{n.message}</small></span><time>{new Date(n.created_at).toLocaleString("ru-RU")}</time></button>)}{!data?.notifications.length&&<div className="emptyState">Новых событий нет. Они создаются сервером из сроков лицензий, задач и системных операций.</div>}</article>}

      {section==="settings"&&<Settings data={data!} onSave={payload=>save("owner.settings.save",{settings:payload})} onPassword={payload=>save("auth.password",payload)}/>}
    </div>
    {editor&&<Editor key={`${editor.type}-${editor.record?.id||"new"}`} editor={editor} data={data!} closeHref={sectionHref(editorSection[editor.type])} save={save} error={error}/>}
    </section>
  </main>;
}

function safeJson(value:string|string[]){if(Array.isArray(value))return value;try{const parsed=JSON.parse(value||"[]");return Array.isArray(parsed)?parsed:[]}catch{return[]}}

function field(record:Record<string,unknown>|undefined,key:string,fallback=""){const value=record?.[key];return value===null||value===undefined?fallback:String(value)}

function Editor({editor,data,closeHref,save,error}:{editor:NonNullable<EditorRoute>;data:OwnerData;closeHref:string;save:(action:string,payload:Record<string,unknown>)=>Promise<void>;error:string}){
  const r=editor.record;
  const[licenseEdition,setLicenseEdition]=useState(field(r,"edition","Business"));
  const[licenseTermValue,setLicenseTermValue]=useState(field(r,"license_term","annual"));
  const editionAccess=new Map(data.edition_modules.filter(x=>x.edition===licenseEdition).map(x=>[x.module_key,x.availability]));
  const licenseModules=data.modules.filter(m=>(editionAccess.get(m.module_key)||"hidden")!=="hidden");
  const existingEntitlements=Array.isArray(r?.entitlements)?r.entitlements.map(String):[];
  const submit=(event:FormEvent<HTMLFormElement>)=>{event.preventDefault();const formData=new FormData(event.currentTarget);const values=Object.fromEntries(formData);const payload:Record<string,unknown>={...r,...values};if(editor.type==="module")payload.availability=Object.fromEntries(["Business","Commerce","Content"].map(e=>[e,values[`availability_${e}`]||"hidden"]));if(editor.type==="license")payload.entitlements=formData.getAll("entitlements").map(String);void save(`owner.${editor.type}.save`,payload)};
  return <div className="ownerEditorPage"><form className="ownerEditorForm workspaceEditorForm" onSubmit={submit}><header><a className="editorBack" href={closeHref}><WorkspaceIcon symbol="←"/> К списку</a><div><small>РЕДАКТОР</small><h2>{({client:"Клиент",task:"Договорная работа",service:"Услуга",license:"Лицензия",module:"Модуль",portfolio:"Проект портфолио"} as Record<string,string>)[editor.type]}</h2></div></header><div className="editorFormSurface">{error&&<p className="ownerError" role="alert">{error}</p>}
    {editor.type==="client"&&<><label>Имя контактного лица<input name="name" required defaultValue={field(r,"name")}/></label><label>Компания<input name="company" defaultValue={field(r,"company")}/></label><div className="formGrid"><label>Email<input name="email" type="email" defaultValue={field(r,"email")}/></label><label>Телефон<input name="phone" defaultValue={field(r,"phone")}/></label></div><label>Статус<select name="status" defaultValue={field(r,"status","active")}>{Object.entries(clientStatuses).map(([k,v])=><option value={k} key={k}>{v}</option>)}</select></label><label>Заметки<textarea name="notes" rows={5} defaultValue={field(r,"notes")}/></label></>}
    {editor.type==="task"&&<><label>Клиент<select name="client_id" required defaultValue={field(r,"client_id")}><option value="">Выберите</option>{data.clients.map(c=><option value={c.id} key={c.id}>{c.company||c.name}</option>)}</select></label><label>Название работы<input name="title" required defaultValue={field(r,"title")}/></label><label>Описание<textarea name="description" rows={4} defaultValue={field(r,"description")}/></label><div className="formGrid"><label>Договор / приложение<input name="contract_ref" defaultValue={field(r,"contract_ref")}/></label><label>Услуга<select name="service_id" defaultValue={field(r,"service_id")}><option value="">Индивидуальная</option>{data.services.map(s=><option value={s.id} key={s.id}>{s.name}</option>)}</select></label><label>Ответственный<input name="assignee" defaultValue={field(r,"assignee",data.user.name)}/></label><label>Статус<select name="status" defaultValue={field(r,"status","planned")}>{Object.entries(taskStatuses).map(([k,v])=><option value={k} key={k}>{v}</option>)}</select></label><label>Готовность, %<input name="progress" type="number" min="0" max="100" defaultValue={field(r,"progress","0")}/></label><label>Стоимость, ₽<input name="price" type="number" min="0" defaultValue={field(r,"price","0")}/></label><label>Срок<input name="due_at" type="datetime-local" defaultValue={field(r,"due_at").replace(" ","T").slice(0,16)}/></label></div></>}
    {editor.type==="service"&&<><label>Название<input name="name" required defaultValue={field(r,"name")}/></label><label>Системный ключ<input name="service_key" defaultValue={field(r,"service_key")}/></label><label>Описание<textarea name="description" rows={4} defaultValue={field(r,"description")}/></label><div className="formGrid"><label>Цена от, ₽<input name="price_from" type="number" min="0" defaultValue={field(r,"price_from","0")}/></label><label>Единица оплаты<input name="billing_unit" defaultValue={field(r,"billing_unit","проект")}/></label><label>Статус<select name="status" defaultValue={field(r,"status","active")}><option value="active">Активна</option><option value="inactive">Скрыта</option></select></label></div></>}
    {editor.type==="license"&&<><label>Клиент<select name="client_id" required defaultValue={field(r,"client_id")}><option value="">Выберите</option>{data.clients.map(c=><option value={c.id} key={c.id}>{c.company||c.name}</option>)}</select></label><div className="formGrid"><label>Домен без https:// и пути<input name="domain" placeholder="example.ru" pattern="^(?!https?://)(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\\.)+[a-zA-Z]{2,63}$" defaultValue={field(r,"domain")}/><small>Правильно: example.ru или shop.example.ru</small></label><label>Редакция<select name="edition" value={licenseEdition} onChange={e=>setLicenseEdition(e.target.value)}>{Object.keys(editions).map(e=><option key={e}>{e}</option>)}</select></label><label>Условия лицензии<select name="license_term" value={licenseTermValue} onChange={e=>setLicenseTermValue(e.target.value)}><option value="annual">1 год — с продлением</option><option value="lifetime">Пожизненная</option></select></label><label>Цена<input readOnly value={(licenseTermValue==="lifetime"?editions[licenseEdition].lifetime:editions[licenseEdition].annual).toLocaleString("ru-RU")+" ₽"}/></label><label>Последняя версия<input name="core_version" defaultValue={field(r,"core_version","2.1.0")}/></label><label>Установлено у клиента<input name="installed_version" defaultValue={field(r,"installed_version")}/></label><label>Статус<select name="status" defaultValue={field(r,"status","active")}>{Object.entries(licenseStatuses).map(([k,v])=><option value={k} key={k}>{v}</option>)}</select></label>{licenseTermValue==="annual"&&<label>Действует до<input name="valid_until" type="date" defaultValue={field(r,"valid_until").slice(0,10)}/></label>}</div><fieldset className="licenseModulePicker"><legend>Модули лицензии</legend>{licenseModules.map(m=>{const included=editionAccess.get(m.module_key)==="included";return <label key={m.module_key}><input type="checkbox" name="entitlements" value={m.module_key} disabled={included} defaultChecked={included||existingEntitlements.includes(m.module_key)}/><span><b>{m.name}</b><small>{included?"Входит в редакцию":`${Number(m.price).toLocaleString("ru-RU")} ₽`}</small></span></label>})}</fieldset></>}
    {editor.type==="portfolio"&&<><div className="formGrid"><label>Название проекта<input name="title" required defaultValue={field(r,"title")}/></label><label>Адрес страницы (slug)<input name="slug" placeholder="my-project" defaultValue={field(r,"slug")}/></label><label>Категория<input name="category" placeholder="Интернет-магазин" defaultValue={field(r,"category")}/></label><label>Редакция<select name="edition" defaultValue={field(r,"edition","Business")}><option>Business</option><option>Commerce</option><option>Content</option></select></label><label>Год<input name="project_year" defaultValue={field(r,"project_year",String(new Date().getFullYear()))}/></label><label>Порядок<input name="sort_order" type="number" defaultValue={field(r,"sort_order","100")}/></label><label>Обложка / URL изображения<input name="cover_image" placeholder="/uploads/project.webp" defaultValue={field(r,"cover_image")}/></label><label>Ссылка на сайт<input name="project_url" type="url" placeholder="https://example.ru" defaultValue={field(r,"project_url")}/></label></div><label>Краткое описание<textarea name="lead" rows={3} defaultValue={field(r,"lead")}/></label><label>Задача и решение<textarea name="description" rows={5} defaultValue={field(r,"description")}/></label><label>Результат<textarea name="result_text" rows={4} defaultValue={field(r,"result_text")}/></label><div className="formGrid"><label>Возможности — по одной в строке<textarea name="features" rows={6} defaultValue={safeJson(field(r,"features")).join("\n")}/></label><label>Модули — по одному в строке<textarea name="modules" rows={6} defaultValue={safeJson(field(r,"modules")).join("\n")}/></label><label>Выполненные услуги — по одной в строке<textarea name="services" rows={6} defaultValue={safeJson(field(r,"services")).join("\n")}/></label><label>Галерея — URL по одному в строке<textarea name="gallery" rows={6} defaultValue={safeJson(field(r,"gallery")).join("\n")}/></label></div><label>Статус<select name="status" defaultValue={field(r,"status","draft")}><option value="draft">Черновик</option><option value="published">Опубликован</option><option value="archived">Архив</option></select></label></>}
    {editor.type==="module"&&<><div className="formGrid"><label>Ключ<input name="module_key" required defaultValue={field(r,"module_key")}/></label><label>Название<input name="name" required defaultValue={field(r,"name")}/></label><label>Категория<input name="category" defaultValue={field(r,"category","Расширение")}/></label><label>Версия<input name="current_version" defaultValue={field(r,"current_version","1.0.0")}/></label><label>Цена, ₽<input name="price" type="number" min="0" defaultValue={field(r,"price","0")}/></label><label>Совместимость<input name="compatibility" defaultValue={field(r,"compatibility","Core >= 2.0")}/></label></div><label>Описание<textarea name="description" rows={4} defaultValue={field(r,"description")}/></label><div className="compatibilityEditor">{Object.keys(editions).map(e=><label key={e}>{e}<select name={`availability_${e}`} defaultValue={String((r?.availability as Record<string,string>|undefined)?.[e]||"hidden")}><option value="included">Включён в редакцию</option><option value="optional">Можно докупить</option><option value="hidden">Не показывать</option></select></label>)}</div></>}
    {editor.type==="portfolio"&&<PortfolioUploader csrf={data.csrf}/>}
    <footer><a className="panelLinkButton" href={closeHref}>Отмена</a><button type="submit">Сохранить</button></footer></div></form></div>
}

function PortfolioUploader({csrf}:{csrf:string}){
  const[uploading,setUploading]=useState(false);
  const[message,setMessage]=useState("");
  const upload=async(files:FileList|null,target:"cover_image"|"gallery")=>{
    if(!files?.length)return;setUploading(true);setMessage("");
    try{
      const urls:string[]=[];
      for(const file of Array.from(files)){
        const body=new FormData();body.append("image",file);
        const response=await fetch("/api/index.php?action=owner.portfolio.upload",{method:"POST",credentials:"same-origin",headers:{"X-CSRF-Token":csrf},body});
        const payload=await response.json();if(!response.ok||!payload.ok)throw new Error(payload.error||"Ошибка загрузки");
        urls.push(String(payload.url));
      }
      const field=document.querySelector<HTMLInputElement|HTMLTextAreaElement>(`[name="${target}"]`);
      if(field){field.value=target==="gallery"?[field.value,...urls].filter(Boolean).join("\n"):urls[0];field.dispatchEvent(new Event("input",{bubbles:true}))}
      setMessage(target==="gallery"?`Загружено изображений: ${urls.length}`:"Обложка загружена");
    }catch(error){setMessage(error instanceof Error?error.message:"Ошибка загрузки")}finally{setUploading(false)}
  };
  return <section className="portfolioUpload"><small>ИЗОБРАЖЕНИЯ ПРОЕКТА</small><h3>Загрузка с компьютера</h3><p>Обложка: рекомендуется 1600×1000 px или больше. Галерея: от 1400 px по ширине, желательно одинаковая пропорция. JPG, PNG, WEBP или GIF, до 8 МБ на файл.</p><div><label>Загрузить обложку<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" disabled={uploading} onChange={e=>void upload(e.target.files,"cover_image")}/></label><label>Добавить в галерею<input type="file" multiple accept="image/jpeg,image/png,image/webp,image/gif" disabled={uploading} onChange={e=>void upload(e.target.files,"gallery")}/></label></div>{message&&<b>{message}</b>}</section>;
}

function Settings({data,onSave,onPassword}:{data:OwnerData;onSave:(payload:Record<string,string>)=>Promise<void>;onPassword:(payload:Record<string,unknown>)=>Promise<void>}){
  const submit=(event:FormEvent<HTMLFormElement>)=>{event.preventDefault();void onSave(Object.fromEntries(new FormData(event.currentTarget)) as Record<string,string>)};
  const password=(event:FormEvent<HTMLFormElement>)=>{event.preventDefault();void onPassword(Object.fromEntries(new FormData(event.currentTarget)))};
  return <div className="settingsStack"><form className="ownerSettings" onSubmit={submit}><section><small>ПРОФИЛЬ ВЛАДЕЛЬЦА</small><h2>{data.user.name}</h2><p>{data.user.email} · {data.user.role_name}</p><div className="profileExplanation"><span className="ownerAvatar">{data.user.name.split(/\s+/).map(x=>x[0]).join("").slice(0,2).toUpperCase()}</span><p><b>Инициалы формируются из имени учётной записи</b><small>Это не отдельный логотип и не фиктивная надпись.</small></p></div></section><section><small>НАСТРОЙКИ OWNER CENTER</small><h2>Компания и уведомления</h2><label>Название платформы<input name="company_name" defaultValue={data.settings.company_name||"BYPCMS"}/></label><label>Email для уведомлений<input name="notification_email" type="email" defaultValue={data.settings.notification_email||data.user.email}/></label><label>Предупреждать о лицензии за, дней<input name="license_warning_days" type="number" min="1" defaultValue={data.settings.license_warning_days||"30"}/></label><label>Валюта<select name="currency" defaultValue={data.settings.currency||"RUB"}><option value="RUB">RUB — рубль</option><option value="USD">USD — доллар</option><option value="EUR">EUR — евро</option></select></label><button>Сохранить настройки</button></section></form><form className="passwordPanel" onSubmit={password}><small>БЕЗОПАСНОСТЬ</small><h2>Сменить пароль</h2><p>Одинаковая учётная запись используется в `/admin` и `/owner`, поэтому пароль изменится для обоих разделов.</p><div className="formGrid"><label>Текущий пароль<input name="current_password" type="password" autoComplete="current-password" required/></label><label>Новый пароль<input name="new_password" type="password" minLength={12} autoComplete="new-password" required/></label><label>Повторите новый пароль<input name="new_password_confirmation" type="password" minLength={12} autoComplete="new-password" required/></label></div><button>Изменить пароль</button></form></div>
}
