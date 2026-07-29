import Link from "next/link";
import { notFound } from "next/navigation";
import { publicModules } from "../data";
import { BackToTop, DEMO_URL, PublicFooter, PublicHeader } from "../../components/PublicChrome";
import "./module.css";

export function generateStaticParams(){return publicModules.map(module=>({slug:module.slug}))}

export default async function ModulePage({params}:{params:Promise<{slug:string}>}){
  const {slug}=await params;
  const module=publicModules.find(item=>item.slug===slug);
  if(!module)notFound();
  return <main className="modulePage"><PublicHeader active="modules" /><section className="moduleHero"><div className="moduleHeroCopy"><p>{module.category} / МОДУЛЬ BYPCMS</p><h1>{module.name}</h1><span>{module.lead}</span><div className="modulePrice"><strong>{module.price?`${module.price.toLocaleString("ru-RU")} ₽`:"Входит в редакцию"}</strong><small>{module.price?"единоразово к выбранной лицензии":"базовая возможность BYPCMS"}</small></div></div><aside className="modulePreview"><ModulePreview slug={module.slug} name={module.name}/><div className="previewActions"><a href={DEMO_URL}>Открыть в демо ↗</a><Link href="/#builder">Добавить в сборку</Link></div></aside></section><section className="moduleFeatures"><div><p>ВОЗМОЖНОСТИ</p><h2>Что входит в модуль</h2><span>Каждый инструмент решает отдельную задачу и управляется из единой панели.</span></div><div>{module.features.map(([title,description],index)=><article key={title}><span>{String(index+1).padStart(2,"0")}</span><h3>{title}</h3><p>{description}</p></article>)}</div></section><section className="moduleCta"><h2>Добавить {module.name} в свою сборку?</h2><Link href="/#builder">Рассчитать стоимость →</Link></section><PublicFooter /><BackToTop /></main>
}

function ModulePreview({slug,name}:{slug:string;name:string}){
  const config:Record<string,{metric:string;label:string;rows:string[]}>={
    analytics:{metric:"24 892",label:"событий за 30 дней",rows:["Просмотр страницы","Отправка формы","Оформление заказа"]},
    commerce:{metric:"148",label:"заказов в этом месяце",rows:["Заказ #1048 · Оплачен","Заказ #1047 · Новый","Заказ #1046 · Доставка"]},
    payments:{metric:"684 200 ₽",label:"успешных платежей",rows:["ЮKassa · 24 900 ₽","СБП · 9 900 ₽","Возврат · 5 900 ₽"]},
    forms:{metric:"87",label:"новых обращений",rows:["Запрос расчёта","Заказ обратного звонка","Заявка на консультацию"]},
    seo:{metric:"94 / 100",label:"оценка оптимизации",rows:["Метаданные заполнены","Sitemap обновлён","Редиректы проверены"]},
    content:{metric:"32",label:"опубликованные страницы",rows:["Главная","Услуги","О компании"]},
  };
  const item=config[slug]||config.content;
  return <div className="adminMock"><header><div><i>B</i><span><b>BYPCMS</b><small>Панель сайта</small></span></div><em>DEMO</em></header><div className="mockBody"><nav>{["⌂","▤","◇","◎","⚙"].map((icon,index)=><i className={index===3?"active":""} key={icon}>{icon}</i>)}</nav><section><small>МОДУЛЬ / {name.toUpperCase()}</small><h3>{name}</h3><article className="mockMetric"><span>{item.label}</span><strong>{item.metric}</strong><em>+18,4%</em></article><div className="mockChart">{[35,52,43,69,61,82,74,94,78,88].map((height,index)=><i style={{height:`${height}%`}} key={index}/>)}</div><div className="mockRows">{item.rows.map((row,index)=><p key={row}><span>{String(index+1).padStart(2,"0")}</span><b>{row}</b><em>{index===0?"Сейчас":`${index+1} ч`}</em></p>)}</div></section></div></div>
}
