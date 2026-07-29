"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BackToTop, Breadcrumbs, PublicFooter, PublicHeader } from "../components/PublicChrome";
import { portfolioProjects } from "./data";
import "./portfolio.css";

export default function PortfolioPage() {
  const [projects,setProjects]=useState(portfolioProjects);
  const [selectedSlug,setSelectedSlug]=useState("");
  useEffect(()=>{
    const querySlug=new URLSearchParams(window.location.search).get("project")||"";
    const pathParts=window.location.pathname.split("/").filter(Boolean);
    setSelectedSlug(querySlug||(pathParts[0]==="portfolio"&&pathParts[1]?decodeURIComponent(pathParts[1]):""));
  },[]);
  useEffect(()=>{fetch("/api/index.php?action=portfolio.public").then(response=>response.ok?response.json():null).then(payload=>{
    if(!payload?.projects?.length)return;
    setProjects(payload.projects.map((item:Record<string,unknown>)=>({
      slug:String(item.slug),title:String(item.title),category:String(item.category||""),edition:String(item.edition||"Business"),
      year:String(item.project_year||""),lead:String(item.lead||""),description:String(item.description||""),result:String(item.result_text||""),
      image:String(item.cover_image||"/og.png"),accent:"#caff3d",features:Array.isArray(item.features)?item.features.map(String):[],
      modules:Array.isArray(item.modules)?item.modules.map(String):[],services:Array.isArray(item.services)?item.services.map(String):[],
    })));
  }).catch(()=>undefined)},[]);
  const selected=projects.find(project=>project.slug===selectedSlug);
  if(selectedSlug&&selected)return <PortfolioCase project={selected}/>;
  return <main className="portfolioPage">
    <PublicHeader active="portfolio" />
    <Breadcrumbs items={[{label:"Главная",href:"/"},{label:"Портфолио"}]}/>
    <section className="portfolioHero publicContainer">
      <p>ПРОЕКТЫ НА BYPCMS</p>
      <h1>Портфолио</h1>
      <div><span>Сайты, интерфейсы и платформенные решения — от исследования и дизайна до запуска и развития.</span><b>{projects.length}<small>проекта в подборке</small></b></div>
    </section>
    <section className="portfolioGrid publicContainer">
      {projects.map((project, index) => <Link href={`/portfolio/${encodeURIComponent(project.slug)}/`} className="portfolioCard" key={project.slug}>
        <div className="portfolioVisual" style={{"--project-accent":project.accent} as React.CSSProperties}>
          <span>{String(index + 1).padStart(2, "0")}</span><img src={project.image} alt={`Макет проекта ${project.title}`} />
        </div>
        <div className="portfolioCardCopy"><small>{project.category} · {project.year}</small><h2>{project.title}</h2><p>{project.lead}</p><footer><span>{project.edition}</span><b>Смотреть кейс →</b></footer></div>
      </Link>)}
    </section>
    <section className="portfolioCta"><div className="publicContainer"><p>НУЖЕН ИНДИВИДУАЛЬНЫЙ ПРОЕКТ?</p><h2>Создадим сайт, который работает на задачи вашего бизнеса.</h2><Link href="/order">Обсудить проект →</Link></div></section>
    <PublicFooter /><BackToTop />
  </main>;
}

function PortfolioCase({project}:{project:(typeof portfolioProjects)[number]}) {
  return <main className="portfolioPage">
    <PublicHeader active="portfolio"/>
    <Breadcrumbs items={[{label:"Главная",href:"/"},{label:"Портфолио",href:"/portfolio/"},{label:project.title}]}/>
    <section className="caseHero publicContainer">
      <div><p>{project.category} · {project.year}</p><h1>{project.title}</h1><span>{project.lead}</span></div>
      <aside><small>РЕДАКЦИЯ</small><b>BYPCMS {project.edition}</b><Link href="/order">Хочу похожий проект →</Link></aside>
    </section>
    <section className="caseCover publicContainer" style={{"--project-accent":project.accent} as React.CSSProperties}><img src={project.image} alt={`Интерфейс проекта ${project.title}`}/></section>
    <section className="caseStory publicContainer">
      <article><small>О ПРОЕКТЕ</small><h2>Задача и решение</h2><p>{project.description}</p></article>
      <article><small>РЕЗУЛЬТАТ</small><h2>Что получил проект</h2><p>{project.result}</p></article>
    </section>
    <section className="caseScope"><div className="publicContainer">
      <CaseList number="01" title="Возможности" items={project.features}/>
      <CaseList number="02" title="Модули BYPCMS" items={project.modules}/>
      <CaseList number="03" title="Выполненные услуги" items={project.services}/>
    </div></section>
    <section className="caseNext publicContainer"><p>СЛЕДУЮЩИЙ ШАГ</p><h2>Обсудим ваш будущий сайт?</h2><Link href="/order">Оставить заявку →</Link></section>
    <PublicFooter/><BackToTop/>
  </main>;
}

function CaseList({number,title,items}:{number:string;title:string;items:string[]}) {
  return <article><span>{number}</span><h3>{title}</h3><ul>{items.map(item=><li key={item}>{item}</li>)}</ul></article>;
}
