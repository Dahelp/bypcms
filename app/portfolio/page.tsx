"use client";
import {LocaleLink as Link,usePublicText,useLocale} from "../components/PublicLocale";
import {useEffect,useState} from "react";
import {BackToTop,Breadcrumbs,PublicFooter,PublicHeader} from "../components/PublicChrome";
import {portfolioProjects,type PortfolioProject} from "./data";
import PortfolioCase from "./PortfolioCase";
import "./portfolio.css";
const publicUrl=(value:unknown)=>{const url=typeof value==="string"?value.trim():"";return /^(?:\/(?!\/)|https:\/\/)/i.test(url)?url:undefined;};
export default function PortfolioPage(){
 const t=usePublicText(),locale=useLocale(),tx=(ru:string,en:string)=>locale==="en"?en:ru;
 const[projects,setProjects]=useState<PortfolioProject[]>(portfolioProjects),[selectedSlug,setSelectedSlug]=useState(""),[loaded,setLoaded]=useState(false);
 useEffect(()=>{const querySlug=new URLSearchParams(window.location.search).get("project")||"";void Promise.resolve().then(()=>setSelectedSlug(querySlug));const controller=new AbortController();fetch("/api/index.php?action=portfolio.public",{signal:controller.signal}).then(response=>response.ok?response.json():null).then(payload=>{
  if(!Array.isArray(payload?.projects))return;
  const additional:PortfolioProject[]=payload.projects.filter((item:Record<string,unknown>)=>item.slug&&item.title&&!portfolioProjects.some(project=>project.slug===String(item.slug))).map((item:Record<string,unknown>)=>({
   slug:String(item.slug),title:String(item.title),category:String(item.category||""),edition:["Business","Commerce","Content"].includes(String(item.edition))?item.edition as PortfolioProject["edition"]:undefined,
   year:String(item.project_year||""),lead:String(item.lead||""),description:String(item.description||""),result:String(item.result_text||""),
   image:publicUrl(item.cover_image)||"/og.png",accent:"#caff3d",gallery:Array.isArray(item.gallery)?item.gallery.map(publicUrl).filter((url):url is string=>!!url):[],
   features:Array.isArray(item.features)?item.features.map(String):[],modules:Array.isArray(item.modules)?item.modules.map(String):[],services:Array.isArray(item.services)?item.services.map(String):[],demoUrl:publicUrl(item.project_url),
  }));setProjects([...portfolioProjects,...additional]);
 }).catch(()=>undefined).finally(()=>{if(!controller.signal.aborted)setLoaded(true)});return()=>controller.abort();},[]);
 const selected=projects.find(project=>project.slug===selectedSlug);
 if(selected)return <PortfolioCase project={selected}/>;
 if(selectedSlug)return <main className="portfolioPage"><PublicHeader active="portfolio"/><section className="portfolioMissing publicContainer"><h1>{loaded?tx("Кейс не найден","Case not found"):tx("Загружаем кейс…","Loading case…")}</h1>{loaded&&<Link className="portfolioButton" href="/portfolio/">{tx("Вернуться к проектам","Back to projects")}</Link>}</section><PublicFooter/></main>;
 const ordered=[...projects].sort((a,b)=>{const priority=(p:PortfolioProject)=>p.kind==="client"?0:p.kind==="platform"?1:2;return priority(a)-priority(b)});
 return <main className="portfolioPage"><PublicHeader active="portfolio"/><Breadcrumbs items={[{label:t("Главная"),href:"/"},{label:t("Портфолио")}]}/>
  <section className="portfolioHero publicContainer"><h1>{tx("Проекты в деталях.","Projects, in detail.")}</h1><div><p>{tx("Сайты производителей, магазины, сервисы и мультиязычные проекты. Изучите задачи, решения и реальные экраны.","Manufacturer websites, stores, services and multilingual projects. Explore the briefs, design decisions and actual website screens.")}</p><p className="portfolioDisclosure">{tx("Реализованные проекты, собственный продукт и демонстрационные темы отмечены отдельно.","Delivered projects, our own product and demo themes are clearly labeled.")}</p></div></section>
  <section className="portfolioGrid publicContainer" aria-label={tx("Кейсы проектов","Project case studies")}>{ordered.map((source,index)=>{
   const project=locale==="en"?{...source,...source.en}:source;
   const builtin=portfolioProjects.some(item=>item.slug===source.slug),href=builtin?`/portfolio/${encodeURIComponent(project.slug)}/`:`/portfolio/?project=${encodeURIComponent(project.slug)}`;
   const image=source.kind==="platform"&&locale==="en"?"/showcase/platform-en.jpg":project.image;
   return <Link href={href} className={`portfolioCard${source.kind==="client"&&index===0?" portfolioCard--featured":""}`} key={project.slug}><div className="portfolioVisual"><img src={image} width={1251} height={712} alt={tx(`Экран сайта ${project.title}`,`${project.title} website screenshot`)} loading={index===0?"eager":"lazy"}/></div><div className="portfolioCardCopy"><div className="portfolioCardMeta"><span>{source.kind==="client"?tx("Реализованный проект","Delivered project"):source.kind==="platform"?tx("Собственный продукт","Our product"):source.kind==="demo"?tx("Демонстрационная тема","Demo theme"):tx("Веб-проект","Website project")}</span>{!!project.languages?.length&&<span>{project.languages.join(" / ")}</span>}</div><h2>{project.title}</h2><p className="portfolioCategory">{project.category}</p><p>{project.lead}</p><footer><span>{project.edition?`BYPCMS ${project.edition}`:source.kind==="client"?tx("Полная разработка","Full website development"):tx("Веб-проект","Website project")}</span><b>{tx("Изучить кейс","Explore case")} →</b></footer></div></Link>;
  })}</section>
  <section className="portfolioLanguageFeature publicContainer"><div><h2>{tx("Посмотрите проект на двух языках.","See one project in two languages.")}</h2><p>{tx("В кейсе BYPCMS можно переключить русскую и английскую версии и открыть одинаковую конфигурацию сборки.","The BYPCMS case lets you switch between Russian and English previews and open the same build configuration in either language.")}</p></div><Link className="portfolioButton" href="/portfolio/bypcms-platform/#languages">{tx("Сравнить RU / EN","Compare RU / EN")} →</Link></section>
  <section className="portfolioCta"><div className="publicContainer"><h2>{tx("Какая задача у вашего проекта?","What does your project need?")}</h2><p>{tx("Подберём редакцию BYPCMS или обсудим индивидуальную разработку.","Choose a BYPCMS edition or discuss a custom website.")}</p><div className="caseActions"><Link className="portfolioButton" href="/#builder">{tx("Выбрать сборку","Choose a build")} →</Link><Link className="portfolioTextLink" href="/order/?services_only=1&services=ux-ui,frontend,launch">{tx("Обсудить разработку","Discuss development")} →</Link></div></div></section>
  <PublicFooter/><BackToTop/>
 </main>;
}
