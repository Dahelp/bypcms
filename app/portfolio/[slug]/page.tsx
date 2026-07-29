import Link from "next/link";
import { BackToTop, Breadcrumbs, PublicFooter, PublicHeader } from "../../components/PublicChrome";
import { portfolioProjects } from "../data";
import "../portfolio.css";

export function generateStaticParams(){return portfolioProjects.map(project=>({slug:project.slug}));}

export default async function PortfolioDetail({params}:{params:Promise<{slug:string}>}) {
  const {slug}=await params;
  const project=portfolioProjects.find(item=>item.slug===slug);
  if(!project)return <main><PublicHeader active="portfolio"/><section className="portfolioMissing publicContainer"><h1>Проект не найден</h1><Link href="/portfolio">Вернуться в портфолио</Link></section><PublicFooter/></main>;
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
    <section className="caseScope">
      <div className="publicContainer">
        <CaseList number="01" title="Возможности" items={project.features}/>
        <CaseList number="02" title="Модули BYPCMS" items={project.modules}/>
        <CaseList number="03" title="Выполненные услуги" items={project.services}/>
      </div>
    </section>
    <section className="caseNext publicContainer"><p>СЛЕДУЮЩИЙ ШАГ</p><h2>Обсудим ваш будущий сайт?</h2><Link href="/order">Оставить заявку →</Link></section>
    <PublicFooter/><BackToTop/>
  </main>;
}

function CaseList({number,title,items}:{number:string;title:string;items:string[]}) {
  return <article><span>{number}</span><h3>{title}</h3><ul>{items.map(item=><li key={item}>{item}</li>)}</ul></article>;
}
