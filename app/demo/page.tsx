"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import "./demo.css";

type DemoPage = { id: number; title: string; slug: string; status: string; created: string };
const initialPages: DemoPage[] = [
  { id: 1, title: "Главная", slug: "/", status: "Опубликовано", created: "Сегодня, 10:24" },
  { id: 2, title: "О компании", slug: "/about", status: "Опубликовано", created: "Вчера, 18:10" },
  { id: 3, title: "Новая коллекция", slug: "/collection", status: "Черновик", created: "Вчера, 14:42" },
];

export default function Demo() {
  const [logged, setLogged] = useState(false);
  const [section, setSection] = useState("overview");
  const [pages, setPages] = useState(initialPages);
  const [modal, setModal] = useState(false);
  const [notice, setNotice] = useState("");
  const [selectedModule, setSelectedModule] = useState("analytics");

  useEffect(() => {
    const raw = sessionStorage.getItem("bypcms_demo_pages");
    if (raw) setPages(JSON.parse(raw));
  }, []);
  const savePages = (next: DemoPage[]) => {
    setPages(next);
    sessionStorage.setItem("bypcms_demo_pages", JSON.stringify(next));
  };
  const login = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    if (data.get("login") === "demo" && data.get("password") === "demo") setLogged(true);
    else setNotice("Используйте логин demo и пароль demo");
  };
  const addPage = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const title = String(data.get("title") || "Новая страница");
    const slug = String(data.get("slug") || "/new-page");
    savePages([{ id: Date.now(), title, slug, status: "Черновик", created: "Только что" }, ...pages]);
    setModal(false); setNotice("Страница создана в вашей временной сессии");
  };
  if (!logged) return <main className="demoLogin">
    <section><Link href="/" className="demoBrand"><b>B</b> BYPCMS <span>DEMO</span></Link><div><small>ИНТЕРАКТИВНАЯ ДЕМОНСТРАЦИЯ</small><h1>Попробуйте панель<br />в безопасном режиме.</h1><p>Демонстрация изолирована от рабочих сайтов. Данные доступны только в вашей сессии и удаляются после её завершения.</p></div></section>
    <form onSubmit={login}><small>ДОБРО ПОЖАЛОВАТЬ</small><h2>Войти в демо</h2><p>Можно создавать страницы и изучать интерфейс. Системные операции и внешние отправки отключены.</p><label>Логин<input name="login" defaultValue="demo" /></label><label>Пароль<input name="password" type="password" defaultValue="demo" /></label>{notice&&<em>{notice}</em>}<button>Открыть демо →</button><Link href="/">← Вернуться на сайт</Link></form>
  </main>;

  const titles: Record<string,string> = { overview:"Обзор", content:"Контент", modules:"Модули", design:"Дизайн", settings:"Настройки" };
  return <main className="demoApp">
    <aside className="demoSidebar"><Link href="/" className="demoBrand"><b>B</b><span>BYPCMS</span><i>DEMO</i></Link><nav>
      {[["overview","⌂","Обзор"],["content","▤","Контент"],["modules","◇","Модули"],["design","◫","Дизайн"],["settings","⚙","Настройки"]].map(([id,icon,name])=><button className={section===id?"active":""} onClick={()=>setSection(id)} key={id}><i>{icon}</i><span>{name}</span></button>)}
    </nav><div className="demoSafe"><b>✓ Безопасное демо</b><span>Изолированная сессия</span></div><button className="demoExit" onClick={()=>setLogged(false)}>Выйти из демо</button></aside>
    <section className="demoWorkspace"><header><div><span className="projectIcon">N</span><p><b>Northline Studio</b><small>Демонстрационный проект</small></p></div><span className="sessionBadge">● Данные удалятся после сессии</span><Link href="/">BYPCMS.RU ↗</Link></header>
      <div className="demoContent"><div className="demoHeading"><div><small>ПАНЕЛЬ УПРАВЛЕНИЯ / DEMO</small><h1>{titles[section]}</h1><p>Изучайте возможности BYPCMS без риска для рабочего проекта.</p></div>{section==="content"&&<button onClick={()=>setModal(true)}>＋ Создать страницу</button>}</div>
      {notice&&<div className="demoNotice">{notice}<button onClick={()=>setNotice("")}>×</button></div>}
      {section==="overview"&&<><div className="demoMetrics">{[["24 892","Посетители","+18,4%"],["1 248","Заявки","+7,2%"],["5,01%","Конверсия","+1,6%"],["18","Страницы","3 черновика"]].map(item=><article key={item[1]}><small>{item[1]}</small><strong>{item[0]}</strong><span>{item[2]}</span></article>)}</div><div className="demoGrid"><article className="demoChart"><header><div><small>АНАЛИТИКА</small><h2>Активность сайта</h2></div><b>Последние 30 дней</b></header><div>{[42,55,47,63,58,78,66,83,76,93,71,88,80,98].map((v,i)=><i key={i} style={{height:`${v}%`}} />)}</div></article><article className="demoActivity"><small>ПОСЛЕДНИЕ ДЕЙСТВИЯ</small><h2>История проекта</h2>{["Опубликована страница «Главная»","Обновлён SEO-заголовок","Добавлено изображение","Создан черновик коллекции"].map((x,i)=><p key={x}><i>{i+1}</i><span>{x}<small>{i+1} ч назад</small></span></p>)}</article></div></>}
      {section==="content"&&<article className="demoTable"><header><div><small>СТРУКТУРА САЙТА</small><h2>Страницы</h2></div><span>{pages.length} записей</span></header><div className="tableHeader"><span>Название</span><span>Адрес</span><span>Статус</span><span>Изменено</span></div>{pages.map(page=><div className="tableRow" key={page.id}><b>{page.title}</b><code>{page.slug}</code><em className={page.status==="Опубликовано"?"published":""}>{page.status}</em><time>{page.created}</time></div>)}</article>}
      {section==="modules"&&<div className="demoModuleWorkspace"><div className="demoModuleTabs">{[["content","Контент","2.1.0"],["seo","SEO Pro","1.8.2"],["forms","Формы и CRM","1.4.0"],["commerce","Commerce","2.0.1"],["analytics","Аналитика","1.2.4"],["payments","Платежи","1.3.0"]].map(([key,name,version])=><button className={selectedModule===key?"active":""} onClick={()=>setSelectedModule(key)} key={key}><span>{name}</span><small>v{version}</small></button>)}</div><DemoModulePanel moduleKey={selectedModule} onAction={setNotice}/></div>}
      {section==="design"&&<div className="demoSettings"><article><small>ШАБЛОН</small><h2>Northline / Corporate</h2><p>Адаптивный шаблон с библиотекой из 24 блоков.</p><button onClick={()=>setNotice("Предпросмотр темы открыт в демонстрационном режиме")}>Предпросмотр</button></article><article><small>ФИРМЕННЫЙ СТИЛЬ</small><h2>Цвета и типографика</h2><div className="swatches"><i/><i/><i/><i/></div><button>Изменить</button></article></div>}
      {section==="settings"&&<div className="demoSettings">{[["Основные данные","Название, домен и часовой пояс"],["Пользователи","Роли и права доступа"],["Уведомления","Email и системные события"],["Интеграции","API-ключи и вебхуки"]].map(s=><article key={s[0]}><small>НАСТРОЙКИ</small><h2>{s[0]}</h2><p>{s[1]}</p><button onClick={()=>setNotice("Изменения настроек отключены в публичном демо")}>Открыть →</button></article>)}</div>}
      </div>
    </section>
    {modal&&<div className="demoModal"><form onSubmit={addPage}><header><div><small>НОВАЯ ЗАПИСЬ</small><h2>Создать страницу</h2></div><button type="button" onClick={()=>setModal(false)}>×</button></header><label>Название<input name="title" required placeholder="Например, Наши услуги" /></label><label>Адрес страницы<input name="slug" required placeholder="/services" pattern="[/a-z0-9-]+" /></label><label>Статус<select name="status"><option>Черновик</option></select></label><p>Запись хранится только в этом браузере и исчезнет после завершения сессии.</p><button>Создать временную страницу</button></form></div>}
  </main>;
}

function DemoModulePanel({moduleKey,onAction}:{moduleKey:string;onAction:(message:string)=>void}){
  const configs:Record<string,{name:string;metric:string;label:string;items:string[];action:string}>={
    analytics:{name:"Аналитика",metric:"24 892",label:"событий за 30 дней",items:["Просмотры страниц","Отправки форм","Оформления заказов"],action:"Создан новый аналитический отчёт"},
    commerce:{name:"Commerce",metric:"148",label:"заказов в этом месяце",items:["#1048 · Оплачен","#1047 · Новый","#1046 · Передан в доставку"],action:"Открыта демонстрационная карточка заказа"},
    payments:{name:"Платежи",metric:"684 200 ₽",label:"успешных операций",items:["ЮKassa · 24 900 ₽","СБП · 9 900 ₽","Возврат · 5 900 ₽"],action:"Платёжная операция открыта только для просмотра"},
    forms:{name:"Формы и CRM",metric:"87",label:"новых обращений",items:["Запрос расчёта","Обратный звонок","Консультация"],action:"Статус обращения изменён в демо-сессии"},
    seo:{name:"SEO Pro",metric:"94 / 100",label:"оценка оптимизации",items:["Метаданные заполнены","Sitemap актуален","3 редиректа требуют проверки"],action:"SEO-проверка запущена"},
    content:{name:"Контент",metric:"32",label:"опубликованные страницы",items:["Главная","Услуги","О компании"],action:"Открыт редактор демонстрационной страницы"},
  };
  const item=configs[moduleKey]||configs.analytics;
  return <section className="demoModulePanel"><header><div><small>РАБОЧИЙ МОДУЛЬ</small><h2>{item.name}</h2><p>{item.label}</p></div><strong>{item.metric}</strong></header><div className="moduleDemoChart">{[36,52,44,68,59,81,70,92,78,88,96].map((height,index)=><i style={{height:`${height}%`}} key={index}/>)}</div><div className="moduleDemoRows">{item.items.map((row,index)=><button onClick={()=>onAction(item.action)} key={row}><span>{String(index+1).padStart(2,"0")}</span><b>{row}</b><em>{index===0?"Сейчас":`${index+1} ч назад`}</em></button>)}</div><footer><button onClick={()=>onAction(item.action)}>Открыть выбранный элемент</button><button onClick={()=>onAction("Изменения сохранены только в этой демо-сессии")}>Настройки модуля</button></footer></section>
}
