"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import "./owner.css";
import "./gate.css";

const modules = [
  { id:"content", name:"Контент", version:"2.1.0", price:0, group:"Базовый", description:"Страницы, блоки, меню, медиа и версии" },
  { id:"seo", name:"SEO Pro", version:"1.8.2", price:5900, group:"Маркетинг", description:"Метаданные, sitemap, редиректы и аудит" },
  { id:"forms", name:"Формы и CRM", version:"1.4.0", price:9900, group:"Продажи", description:"Формы, обращения, статусы и уведомления" },
  { id:"commerce", name:"Commerce", version:"2.0.1", price:14900, group:"Продажи", description:"Каталог, корзина, заказы и промокоды" },
  { id:"payments", name:"Платежи", version:"1.3.0", price:7900, group:"Продажи", description:"ЮKassa, СБП, чеки и возвраты" },
  { id:"analytics", name:"Аналитика", version:"1.2.4", price:5900, group:"Маркетинг", description:"События, цели, воронки и отчёты" },
];
const licenses = [
  { key:"BYP-BUS-4K8F", client:"ООО «Север»", domain:"northline.ru", plan:"Business", version:"2.1.0", status:"Активна", expires:"18.12.2026", amount:24900 },
  { key:"BYP-COM-8P2A", client:"TechTires", domain:"techtires.ru", plan:"Commerce", version:"2.0.4", status:"Продление", expires:"04.08.2026", amount:49900 },
  { key:"BYP-CON-3N7M", client:"Деловой журнал", domain:"media.example", plan:"Content", version:"2.1.0", status:"Активна", expires:"11.03.2027", amount:19900 },
  { key:"BYP-BUS-9W1D", client:"Альфа Строй", domain:"alfa-stroy.ru", plan:"Business", version:"1.9.8", status:"Истекла", expires:"02.07.2026", amount:24900 },
];
const services = [
  {name:"UX/UI-дизайн", price:65000, unit:"от", active:true},
  {name:"Frontend-разработка", price:85000, unit:"от", active:true},
  {name:"Запуск и настройка", price:25000, unit:"от", active:true},
  {name:"Перенос данных", price:18000, unit:"от", active:true},
  {name:"Сопровождение", price:12000, unit:"/ месяц", active:true},
];

export default function Owner() {
  const [access,setAccess]=useState<"loading"|"login"|"granted">("loading");
  const [loginError,setLoginError]=useState("");
  const [section,setSection]=useState("overview");
  const [selectedModules,setSelectedModules]=useState<string[]>(["content","seo","forms"]);
  const [edition,setEdition]=useState("Business");
  const [buildName,setBuildName]=useState("Новый корпоративный проект");
  const [toast,setToast]=useState("");
  const [licenseFilter,setLicenseFilter]=useState("Все");
  const moduleTotal=useMemo(()=>modules.filter(m=>selectedModules.includes(m.id)).reduce((s,m)=>s+m.price,0),[selectedModules]);
  const corePrice={Business:24900,Commerce:49900,Content:19900}[edition]||24900;
  const filteredLicenses=licenseFilter==="Все"?licenses:licenses.filter(l=>l.status===licenseFilter);
  const notify=(message:string)=>{setToast(message);setTimeout(()=>setToast(""),3500)};
  const title:Record<string,string>={overview:"Центр управления",licenses:"Лицензии",builder:"Конструктор сборок",modules:"Каталог модулей",sales:"Продажи и услуги",updates:"Обновления",clients:"Клиенты"};

  useEffect(()=>{fetch("/api/index.php?action=auth.me",{credentials:"same-origin"}).then(r=>r.ok?setAccess("granted"):setAccess("login")).catch(()=>setAccess("login"))},[]);
  const ownerLogin=async(event:FormEvent<HTMLFormElement>)=>{
    event.preventDefault(); setLoginError("");
    const data=new FormData(event.currentTarget);
    const response=await fetch("/api/index.php?action=auth.login",{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:data.get("email"),password:data.get("password")})});
    if(response.ok)setAccess("granted");else setLoginError("Неверный email или пароль владельца");
  };
  if(access==="loading")return <main className="ownerGate loading"><b>B</b><p>Загрузка центра управления…</p></main>;
  if(access==="login")return <main className="ownerGate"><section><Link href="/" className="ownerBrand"><b>B</b><span>BYPCMS<strong>OWNER</strong></span></Link><div><small>ЗАЩИЩЁННАЯ ЗОНА</small><h1>Центр управления платформой.</h1><p>Лицензии, продажи, сборки и обновления доступны только владельцу BYPCMS.</p></div></section><form onSubmit={ownerLogin}><small>АВТОРИЗАЦИЯ ВЛАДЕЛЬЦА</small><h2>Войти в Control Center</h2><label>Email<input name="email" type="email" required/></label><label>Пароль<input name="password" type="password" required/></label>{loginError&&<em>{loginError}</em>}<button>Войти →</button><Link href="/">← На главную</Link></form></main>;
  return <main className="ownerApp">
    <aside className="ownerSidebar"><Link href="/" className="ownerBrand"><b>B</b><span>BYPCMS<strong>OWNER</strong></span></Link><p>ПЛАТФОРМА</p><nav>
      {[["overview","⌂","Обзор"],["licenses","♢","Лицензии"],["builder","⬡","Конструктор"],["modules","◇","Модули"],["sales","₽","Продажи"],["updates","↻","Обновления"],["clients","♙","Клиенты"]].map(([id,icon,name])=><button className={section===id?"active":""} onClick={()=>setSection(id)} key={id}><i>{icon}</i><span>{name}</span>{id==="licenses"&&<em>4</em>}</button>)}
    </nav><div className="ownerStatus"><i/><span><b>Production</b><small>Все сервисы работают</small></span></div><Link className="ownerExit" href="/admin">Панель сайта ↗</Link></aside>
    <section className="ownerMain"><header><div className="ownerSearch">⌕ <input placeholder="Поиск лицензии, клиента, домена..." /></div><div><button title="Уведомления">♢<em>3</em></button><span className="ownerAvatar">ДА</span><p><b>Владелец BYPCMS</b><small>Полный доступ</small></p></div></header>
      <div className="ownerContent"><div className="ownerHeading"><div><small>BYPCMS CONTROL CENTER</small><h1>{title[section]}</h1><p>{section==="overview"?"Продажи, лицензии, сборки и обновления в одном пространстве.":"Управление коммерческой платформой BYPCMS."}</p></div>{section==="licenses"&&<button onClick={()=>notify("Форма новой лицензии подготовлена")}>＋ Выдать лицензию</button>}{section==="modules"&&<button onClick={()=>notify("Редактор нового модуля открыт")}>＋ Добавить модуль</button>}</div>
      {toast&&<div className="ownerToast">✓ {toast}<button onClick={()=>setToast("")}>×</button></div>}

      {section==="overview"&&<><div className="ownerKpis">{[["₽","284 700 ₽","Доход за июль","+18,6%"],["♢","42","Активные лицензии","+5 за месяц"],["↻","7","Скоро продление","168 300 ₽"],["⬡","12","Сборки в работе","4 готовы"]].map((k,i)=><article key={k[2]}><span className={`kpiIcon k${i}`}>{k[0]}</span><div><small>{k[2]}</small><strong>{k[1]}</strong><em>{k[3]}</em></div></article>)}</div>
        <div className="ownerDashboard"><article className="revenueChart"><header><div><small>МОНЕТИЗАЦИЯ</small><h2>Доход платформы</h2></div><div><button className="active">6 месяцев</button><button>Год</button></div></header><div className="chartTotal"><strong>1 486 200 ₽</strong><span>+24,8% к прошлому периоду</span></div><div className="chartArea">{[42,55,49,68,61,75,72,88,81,96,89,100].map((h,i)=><i key={i} style={{height:`${h}%`}}><span>{["Фев","","Мар","","Апр","","Май","","Июн","","Июл",""][i]}</span></i>)}</div></article>
        <article className="licensePulse"><header><small>ЛИЦЕНЗИИ</small><h2>Состояние базы</h2></header>{[["Активные",42,72],["Продление",7,25],["Истекшие",4,14],["Тестовые",11,38]].map((x,i)=><div key={String(x[0])}><p><span><i className={`dot d${i}`}/>{x[0]}</span><b>{x[1]}</b></p><em><i style={{width:`${x[2]}%`}}/></em></div>)}<button onClick={()=>setSection("licenses")}>Все лицензии →</button></article></div>
        <div className="ownerDashboard lower"><article className="ownerTable"><header><div><small>ТРЕБУЮТ ВНИМАНИЯ</small><h2>Ближайшие продления</h2></div><button onClick={()=>setSection("licenses")}>Все лицензии →</button></header>{licenses.slice(0,3).map(l=><div className="ownerTableRow" key={l.key}><span className="clientLogo">{l.client[0]}</span><p><b>{l.client}</b><small>{l.domain}</small></p><code>{l.key}</code><em className={l.status==="Продление"?"warning":""}>{l.status}</em><p><b>{l.expires}</b><small>{l.amount.toLocaleString("ru-RU")} ₽</small></p></div>)}</article>
        <article className="quickActions"><small>БЫСТРЫЕ ДЕЙСТВИЯ</small><h2>Создать</h2><button onClick={()=>setSection("builder")}><i>⬡</i><span><b>Новую сборку</b><small>CMS + модули + installer</small></span>→</button><button onClick={()=>setSection("licenses")}><i>♢</i><span><b>Лицензию</b><small>Ключ для клиента</small></span>→</button><button onClick={()=>setSection("modules")}><i>◇</i><span><b>Модуль</b><small>Пакет расширения</small></span>→</button></article></div></>}

      {section==="licenses"&&<article className="licenseManager"><div className="filterBar"><div>{["Все","Активна","Продление","Истекла"].map(f=><button className={licenseFilter===f?"active":""} onClick={()=>setLicenseFilter(f)} key={f}>{f}{f==="Все"&&<em>{licenses.length}</em>}</button>)}</div><button>⇩ Экспорт CSV</button></div><div className="licenseHead"><span>Клиент / домен</span><span>Лицензия</span><span>Состав</span><span>Версия</span><span>Срок</span><span>Статус</span></div>{filteredLicenses.map(l=><div className="licenseRow" key={l.key}><p><b>{l.client}</b><small>{l.domain}</small></p><code>{l.key}</code><p><b>BYPCMS {l.plan}</b><small>{l.plan==="Commerce"?"5 модулей":"3 модуля"} · обновления</small></p><span><b>{l.version}</b><small>{l.version==="2.1.0"?"Последняя":"Доступна 2.1.0"}</small></span><p><b>{l.expires}</b><small>{l.amount.toLocaleString("ru-RU")} ₽ / год</small></p><em className={l.status==="Активна"?"active":l.status==="Истекла"?"expired":"warning"}>{l.status}</em><button onClick={()=>notify(`Открыта карточка ${l.key}`)}>•••</button></div>)}</article>}

      {section==="builder"&&<div className="buildLayout"><section className="buildSteps"><div className="buildBlock"><span>01</span><div><small>ПРОЕКТ</small><h2>Основные параметры</h2><label>Название сборки<input value={buildName} onChange={e=>setBuildName(e.target.value)}/></label><label>Редакция<div className="editionSelect">{["Business","Commerce","Content"].map(e=><button className={edition===e?"active":""} onClick={()=>setEdition(e)} key={e}>{e}<small>{({Business:24900,Commerce:49900,Content:19900}[e]||0).toLocaleString("ru-RU")} ₽</small></button>)}</div></label></div></div>
        <div className="buildBlock"><span>02</span><div><small>КОМПЛЕКТАЦИЯ</small><h2>Модули</h2><div className="buildModules">{modules.map(m=><label key={m.id}><input type="checkbox" checked={selectedModules.includes(m.id)} onChange={()=>setSelectedModules(x=>x.includes(m.id)?x.filter(id=>id!==m.id):[...x,m.id])}/><span><b>{m.name}</b><small>{m.description}</small></span><strong>{m.price?`+${m.price.toLocaleString("ru-RU")} ₽`:"Включён"}</strong></label>)}</div></div></div>
        <div className="buildBlock"><span>03</span><div><small>УСТАНОВКА</small><h2>Параметры архива</h2><div className="archiveOptions"><label><input type="checkbox" defaultChecked/>Installer PHP 8.2</label><label><input type="checkbox" defaultChecked/>SQL-схема и миграции</label><label><input type="checkbox" defaultChecked/>Проверка совместимости</label><label><input type="checkbox" defaultChecked/>Лицензионный агент</label></div></div></div></section>
        <aside className="buildSummary"><small>СОСТАВ СБОРКИ</small><h2>{buildName}</h2><p>BYPCMS {edition} · Core 2.1.0</p><ul>{modules.filter(m=>selectedModules.includes(m.id)).map(m=><li key={m.id}><span>{m.name} <small>v{m.version}</small></span><b>{m.price?`${m.price.toLocaleString("ru-RU")} ₽`:"0 ₽"}</b></li>)}</ul><div><span>CMS</span><b>{corePrice.toLocaleString("ru-RU")} ₽</b></div><div><span>Модули</span><b>{moduleTotal.toLocaleString("ru-RU")} ₽</b></div><strong><span>Стоимость лицензии</span>{(corePrice+moduleTotal).toLocaleString("ru-RU")} ₽</strong><button onClick={()=>{notify("Архив формируется и будет загружен");window.location.href=`/api/index.php?action=build.download&edition=${encodeURIComponent(edition)}&modules=${selectedModules.join(",")}`}}>⬡ Собрать ZIP-архив</button><small>В архив войдут сайт, installer, SQL и manifest сборки.</small></aside></div>}

      {section==="modules"&&<div className="ownerModules">{modules.map((m,index)=><article key={m.id}><header><span>{m.name[0]}</span><div><small>{m.group} · v{m.version}</small><h2>{m.name}</h2></div><em>Опубликован</em></header><p>{m.description}</p><div><span><small>Цена</small><b>{m.price?`${m.price.toLocaleString("ru-RU")} ₽`:"Включён"}</b></span><span><small>Установки</small><b>{18+index*5}</b></span><span><small>Совместимость</small><b>Core ≥ 2.0</b></span></div><footer><button onClick={()=>notify(`Открыты настройки ${m.name}`)}>Настройки</button><button onClick={()=>notify(`Создана версия для ${m.name}`)}>＋ Версия</button></footer></article>)}</div>}

      {section==="sales"&&<><div className="salesTotals">{[["Лицензии","784 500 ₽","52,8%"],["Модули","326 700 ₽","22,0%"],["Разработка","295 000 ₽","19,8%"],["Поддержка","80 000 ₽","5,4%"]].map(x=><article key={x[0]}><small>{x[0]}</small><strong>{x[1]}</strong><span>{x[2]} дохода</span></article>)}</div><article className="servicesManager"><header><div><small>КАТАЛОГ УСЛУГ</small><h2>Разработка и сопровождение</h2></div><button onClick={()=>notify("Форма добавления услуги открыта")}>＋ Добавить услугу</button></header>{services.map(s=><div key={s.name}><p><b>{s.name}</b><small>Доступна для добавления к заказу</small></p><span>{s.unit} <b>{s.price.toLocaleString("ru-RU")} ₽</b></span><em>Активна</em><button onClick={()=>notify(`Редактирование: ${s.name}`)}>Изменить</button></div>)}</article></>}

      {section==="updates"&&<div className="updatesGrid"><article><small>ТЕКУЩИЙ РЕЛИЗ</small><h2>BYPCMS Core 2.1.0</h2><p>Опубликован 21 июля 2026 · установлен на 31 из 42 активных проектов.</p><div className="updateProgress"><i style={{width:"74%"}}/></div><span>74% установок обновлено</span><button onClick={()=>notify("Открыт мастер нового релиза")}>＋ Создать релиз</button></article><article><small>СОВМЕСТИМОСТЬ</small><h2>Модули готовы</h2>{modules.slice(0,4).map(m=><p key={m.id}><b>✓ {m.name}</b><span>v{m.version}</span></p>)}</article><article className="releaseHistory"><small>ИСТОРИЯ ВЕРСИЙ</small><h2>Релизы</h2>{[["2.1.0","Актуальная","21.07.2026"],["2.0.4","Поддерживается","12.05.2026"],["1.9.8","Завершение поддержки","18.01.2026"]].map(r=><div key={r[0]}><b>{r[0]}</b><span>{r[1]}</span><time>{r[2]}</time><button>Подробнее</button></div>)}</article></div>}

      {section==="clients"&&<article className="clientManager"><header><div><small>КЛИЕНТСКАЯ БАЗА</small><h2>Покупатели BYPCMS</h2></div><button>＋ Добавить клиента</button></header>{licenses.map((l,i)=><div key={l.client}><span className="clientLogo">{l.client[0]}</span><p><b>{l.client}</b><small>{l.domain}</small></p><p><b>{l.plan}</b><small>{l.key}</small></p><p><b>{l.amount.toLocaleString("ru-RU")} ₽</b><small>выручка</small></p><em>{i%2===0?"Новый":"Постоянный"}</em><button onClick={()=>notify(`Открыта карточка клиента ${l.client}`)}>Открыть →</button></div>)}</article>}
      </div>
    </section>
  </main>;
}
