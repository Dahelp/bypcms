"use client";
import {useState} from "react";
import {LocaleLink as Link,usePublicText,useLocale} from "../components/PublicLocale";
import {BackToTop,Breadcrumbs,PublicHeader,PublicFooter} from "../components/PublicChrome";
import {portfolioProjects,type PortfolioProject} from "./data";
import type {CaseScreen,CaseText} from "./case-studies";
import "./portfolio.css";
export default function PortfolioCase({project:source}:{project:PortfolioProject}) {
 const t=usePublicText(),locale=useLocale(),copy=(value:CaseText)=>value[locale];
 const project=locale==="en"?{...source,...source.en}:source,study=source.study;
 const tx=(ru:string,en:string)=>locale==="en"?en:ru;
 const demo=source.kind==="demo";
 const configure=project.edition?`/?edition=${project.edition}#builder`:"/order/?services_only=1&services=ux-ui,frontend,launch";
 const nextProject=portfolioProjects[(portfolioProjects.findIndex(item=>item.slug===source.slug)+1)%portfolioProjects.length];
 return <main className="portfolioPage">
  <PublicHeader active="portfolio"/>
  <Breadcrumbs items={[{label:t("Главная"),href:"/"},{label:t("Портфолио"),href:"/portfolio/"},{label:project.title}]}/>
  <section className="caseHero publicContainer">
   <div><p className="caseCategory">{project.category}{project.year&&` · ${project.year}`}</p><h1>{project.title}</h1><p className="caseLead">{project.lead}</p>
    <div className="caseActions"><Link className="portfolioButton" href={configure}>{project.edition?tx("Подобрать сборку","Configure your build"):tx("Обсудить похожий проект","Discuss a similar project")}</Link>{project.demoUrl&&<Link className="portfolioTextLink" href={project.demoUrl} target={project.demoUrl.startsWith("https:")?"_blank":undefined} rel={project.demoUrl.startsWith("https:")?"noopener noreferrer":undefined}>{demo?tx("Открыть демо","Open demo"):tx("Открыть сайт","Open website")} ↗</Link>}</div>
   </div>
   <dl className="caseFacts">
    <div><dt>{tx("Тип проекта","Project type")}</dt><dd>{demo?tx("Демонстрационная тема","Demo theme"):source.kind==="platform"?tx("Собственный продукт","Our product"):source.kind==="client"?tx("Реализованный проект","Delivered project"):tx("Веб-проект","Website project")}</dd></div>
    {project.edition&&<div><dt>{tx("Основа","Built on")}</dt><dd>BYPCMS {project.edition}</dd></div>}
    {!!project.languages?.length&&<div><dt>{tx("Языки сайта","Website languages")}</dt><dd>{project.languages.join(" / ")}</dd></div>}
    {source.kind==="client"&&<div><dt>{tx("Наше участие","Our role")}</dt><dd>{tx("Полная разработка сайта","Full website development")}</dd></div>}
   </dl>
  </section>
  <figure className="caseCover publicContainer">
   <a href={project.image} target="_blank" rel="noopener noreferrer" aria-label={tx(`Открыть большой экран ${project.title}`,`Open the full-size ${project.title} screenshot`)}><img src={project.image} alt={tx(`Экран сайта ${project.title}`,`${project.title} website screenshot`)} width={1251} height={712} fetchPriority="high"/></a>
   <figcaption><span>{source.kind==="client"?tx("Снимок действующего сайта","Live website screenshot"):tx("Первый экран сайта","Website opening screen")}</span><a href={project.image} target="_blank" rel="noopener noreferrer">{tx("Смотреть в полном размере","View full size")} ↗</a></figcaption>
  </figure>
  <section className="caseBrief publicContainer" id="brief">
   <h2>{tx("Задача проекта","The brief")}</h2><div><p>{study?copy(study.task):project.description}</p>{study&&<p className="caseContext">{project.description}</p>}</div>
  </section>
  {!!study?.decisions.length&&<section className="caseDecisions publicContainer"><h2>{tx("Что сделали","Our approach")}</h2><div>{study.decisions.map(item=><article key={item.title.ru}><h3>{copy(item.title)}</h3><p>{copy(item.body)}</p></article>)}</div></section>}
  {study?.screens.filter(screen=>!screen.mobile).map(screen=><section className="caseScreenSection publicContainer" key={screen.src}><Screenshot screen={screen}/></section>)}
  {study?.screens.filter(screen=>screen.mobile).map(screen=><section className="caseMobile publicContainer" key={screen.src}><div><h2>{tx("На мобильном экране","On a mobile screen")}</h2><p>{copy(screen.description)}</p><p className="caseContext">{tx("Реальный снимок сайта на телефоне. Изображение можно открыть в полном размере.","An actual capture of the website at phone width. Open the image to view it in full size.")}</p></div><Screenshot screen={screen}/></section>)}
  {study?.versions&&<LanguageDemo versions={study.versions} intro={study.versionsIntro} facts={study.versionFacts}/>}
  {!study&&project.gallery?.map((src,index)=><section className="caseScreenSection publicContainer" key={src}><Screenshot screen={{src,width:1251,height:712,title:{ru:`Экран проекта ${index+1}`,en:`Project screen ${index+1}`},description:{ru:"",en:""}}}/></section>)}
  <section className="caseOutcome publicContainer"><h2>{tx("Что получилось","The result")}</h2><div><p>{study?copy(study.outcome):project.result}</p>{demo&&<p className="caseContext">{tx("Это демонстрация возможностей BYPCMS. Материалы и сценарии не являются результатами работы с реальным клиентом.","This demonstrates BYPCMS capabilities. Its content and journeys are not presented as customer project results.")}</p>}</div></section>
  <section className="caseScope publicContainer" aria-label={tx("Состав проекта","Project scope")}>
   <CaseList title={tx("Возможности сайта","Website features")} items={project.features}/>
   {!!project.modules.length&&<CaseList title={tx("Модули BYPCMS","BYPCMS modules")} items={project.modules.map(t)}/>}
   {!!project.services.length&&<CaseList title={tx("Наша работа","Our work")} items={project.services}/>}
  </section>
  <section className="caseNext publicContainer"><div><h2>{tx("Создадим ваш следующий проект?","Shall we build your next project?")}</h2><p>{tx("Выберите готовую основу или расскажите о задаче — согласуем состав и стоимость работ.","Choose a ready-made foundation or tell us your brief. We will agree the scope and price of the work.")}</p><Link className="portfolioButton" href={configure}>{project.edition?tx("Подобрать сборку","Configure your build"):tx("Обсудить разработку","Discuss development")} →</Link></div><nav aria-label={tx("Другие кейсы","More case studies")}><Link href="/portfolio/">{tx("Все проекты","All projects")} →</Link>{nextProject&&nextProject.slug!==source.slug&&<Link href={`/portfolio/${nextProject.slug}/`}>{tx("Следующий кейс","Next case")}: {locale==="en"?(nextProject.en?.title||nextProject.title):nextProject.title} →</Link>}</nav></section>
  <PublicFooter/><BackToTop/>
 </main>;
}
function CaseList({title,items}:{title:string;items:string[]}){return <article><h3>{title}</h3><ul>{items.map(item=><li key={item}>{item}</li>)}</ul></article>}
function Screenshot({screen}:{screen:CaseScreen}){
 const locale=useLocale(),tx=(ru:string,en:string)=>locale==="en"?en:ru;
 return <figure className={screen.mobile?"caseScreenshot caseScreenshot--mobile":"caseScreenshot"}><a href={screen.src} target="_blank" rel="noopener noreferrer" aria-label={tx(`Открыть: ${screen.title.ru}`,`Open: ${screen.title.en}`)}><img src={screen.src} width={screen.width} height={screen.height} loading="lazy" alt={screen.title[locale]}/></a><figcaption><div><h3>{screen.title[locale]}</h3>{!screen.mobile&&screen.description[locale]&&<p>{screen.description[locale]}</p>}</div><a href={screen.src} target="_blank" rel="noopener noreferrer">{tx("Полный размер","Full size")} ↗</a></figcaption></figure>;
}
function LanguageDemo({versions,intro,facts}:{versions:CaseStudyVersions;intro?:CaseText;facts?:CaseText[]}){
 const locale=useLocale(),[active,setActive]=useState<"ru"|"en">(locale),tx=(ru:string,en:string)=>locale==="en"?en:ru;
 const screen=versions[active];
 return <section className="caseLanguages publicContainer" id="languages" aria-labelledby="case-language-title"><div className="caseLanguageIntro"><h2 id="case-language-title">{tx("Один проект. Два языка.","One project. Two languages.")}</h2><p>{intro?intro[locale]:tx("Сравните реальные русскую и английскую версии. Откройте любую: Commerce и пожизненная лицензия уже выбраны.","Compare actual Russian and English versions. Open either one with Commerce and a lifetime license already selected.")}</p></div><div className="caseLanguageControls"><div role="tablist" aria-label={tx("Язык демонстрации","Preview language")}>{(["ru","en"] as const).map(language=><button key={language} data-language={language} id={`case-tab-${language}`} role="tab" type="button" aria-selected={active===language} aria-controls="case-language-panel" tabIndex={active===language?0:-1} onClick={()=>setActive(language)} onKeyDown={event=>{if(!["ArrowLeft","ArrowRight","Home","End"].includes(event.key))return;event.preventDefault();const next=event.key==="Home"?"ru":event.key==="End"?"en":active==="ru"?"en":"ru";setActive(next);(event.currentTarget.parentElement?.querySelector(`[data-language="${next}"]`) as HTMLButtonElement)?.focus();}}>{language==="ru"?tx("Русская версия","Russian version"):tx("Английская версия","English version")}</button>)}</div><a className="portfolioTextLink" href={screen.url||`${active==="en"?"/en/":"/"}?edition=Commerce&term=lifetime#builder`}>{tx("Открыть выбранную версию","Open selected version")} ↗</a></div><div id="case-language-panel" role="tabpanel" aria-labelledby={`case-tab-${active}`} tabIndex={0}><Screenshot screen={screen}/></div><ul className="caseLanguageFacts">{facts?facts.map(fact=><li key={fact.ru}>{fact[locale]}</li>):<><li>{tx("Сохраняется страница","Same page")}</li><li>{tx("Сохраняется конфигурация","Same configuration")}</li><li>{tx("Переведён путь до заказа","Localized ordering journey")}</li></>}</ul></section>;
}
type CaseStudyVersions={ru:CaseScreen;en:CaseScreen};
