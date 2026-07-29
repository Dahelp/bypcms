"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BackToTop, PublicFooter, PublicHeader } from "../components/PublicChrome";
import { portfolioProjects } from "./data";
import "./portfolio.css";

export default function PortfolioPage() {
  const [projects,setProjects]=useState(portfolioProjects);
  useEffect(()=>{fetch("/api/index.php?action=portfolio.public").then(response=>response.ok?response.json():null).then(payload=>{
    if(!payload?.projects?.length)return;
    setProjects(payload.projects.map((item:Record<string,unknown>)=>({
      slug:String(item.slug),title:String(item.title),category:String(item.category||""),edition:String(item.edition||"Business"),
      year:String(item.project_year||""),lead:String(item.lead||""),description:String(item.description||""),result:String(item.result_text||""),
      image:String(item.cover_image||"/og.png"),accent:"#caff3d",features:Array.isArray(item.features)?item.features.map(String):[],
      modules:Array.isArray(item.modules)?item.modules.map(String):[],services:Array.isArray(item.services)?item.services.map(String):[],
    })));
  }).catch(()=>undefined)},[]);
  return <main className="portfolioPage">
    <PublicHeader active="portfolio" />
    <section className="portfolioHero publicContainer">
      <p>ПРОЕКТЫ НА BYPCMS</p>
      <h1>Портфолио</h1>
      <div><span>Сайты, интерфейсы и платформенные решения — от исследования и дизайна до запуска и развития.</span><b>{projects.length}<small>проекта в подборке</small></b></div>
    </section>
    <section className="portfolioGrid publicContainer">
      {projects.map((project, index) => <Link href={`/portfolio/${project.slug}`} className="portfolioCard" key={project.slug}>
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
