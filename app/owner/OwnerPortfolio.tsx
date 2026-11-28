"use client";

import PanelTable, {type PanelBulkAction} from "../components/PanelTable";
import {portfolioProjects} from "../portfolio/data";

export type OwnerPortfolioRecord = {
  id:number; slug:string; title:string; category:string; edition:string; project_year:string;
  lead:string; description:string; result_text:string; cover_image:string; gallery:string;
  features:string; modules:string; services:string; project_url:string; status:string; sort_order:number;
};

const compiledCases = new Map(portfolioProjects.map(project => [project.slug, project]));
const casePath = (slug:string) => compiledCases.has(slug)
  ? `/portfolio/${encodeURIComponent(slug)}/`
  : `/portfolio/?project=${encodeURIComponent(slug)}`;

export default function OwnerPortfolio({records, editHref, bulkActions}:{
  records:OwnerPortfolioRecord[];
  editHref:(id:number)=>string;
  bulkActions:PanelBulkAction<OwnerPortfolioRecord>[];
}) {
  const databaseSlugs = new Set(records.map(record => record.slug));
  const compiledOnly = portfolioProjects.filter(project => !databaseSlugs.has(project.slug));
  const publishedCount = portfolioProjects.length + records.filter(record =>
    record.status === "published" && !compiledCases.has(record.slug)).length;

  return <div className="ownerPortfolioCatalog">
    <div className="ownerPortfolioOverview">
      <strong>Кейсов на сайте — {publishedCount}</strong>
      <a className="panelLinkButton" href="/portfolio/" target="_blank" rel="noopener">Открыть портфолио ↗</a>
    </div>
    <section aria-labelledby="owner-portfolio-records">
      <h2 id="owner-portfolio-records">Записи в базе</h2>
      <PanelTable bulkActions={bulkActions} label="Записи портфолио в базе" rows={records} rowId={record=>record.id}
        rowLabel={record=>compiledCases.get(record.slug)?.title||record.title} columns={[
          {key:"title",label:"Проект",render:record=>{
            const compiled=compiledCases.get(record.slug);
            const title=compiled?.title||record.title;
            const year=compiled?.year??record.project_year;
            return <span className="panelCellText">
              {compiled?<a href={casePath(record.slug)} target="_blank" rel="noopener">{title} ↗</a>:<a href={editHref(record.id)}>{title}</a>}
              <small>{compiled?.category??record.category}{year&&` · ${year}`}</small>
              {compiled?<small>Карточка на сайте загружается из файлов проекта</small>:<small>{record.lead}</small>}
            </span>;
          },exportValue:record=>compiledCases.get(record.slug)?.title||record.title},
          {key:"edition",label:"Редакция",render:record=>{
            const compiled=compiledCases.get(record.slug);
            return (compiled?compiled.edition:record.edition)||"—";
          }},
          {key:"status",label:"Статус записи",render:record=><em>{record.status==="published"?"Опубликована":record.status==="archived"?"В архиве":"Черновик"}</em>},
        ]} actions={record=>[
          {label:compiledCases.has(record.slug)?"Редактировать запись в базе":"Редактировать",href:editHref(record.id)},
          ...(compiledCases.has(record.slug)||record.status==="published"?[{label:"Открыть на сайте",href:casePath(record.slug),newTab:true}]:[]),
        ]} empty="Здесь появятся проекты, добавленные через кабинет."/>
    </section>
    {compiledOnly.length>0&&<section aria-labelledby="owner-portfolio-public">
      <h2 id="owner-portfolio-public">Кейсы из файлов проекта</h2>
      <p>Эти кейсы уже опубликованы. Их описания и снимки обновляются при сборке сайта.</p>
      <PanelTable label="Кейсы из файлов проекта" rows={compiledOnly} rowId={project=>project.slug} rowLabel={project=>project.title} columns={[
        {key:"title",label:"Проект",render:project=><span className="panelCellText">
          <a href={casePath(project.slug)} target="_blank" rel="noopener">{project.title} ↗</a><small>{project.category}</small>
        </span>,exportValue:project=>project.title},
        {key:"edition",label:"Редакция",render:project=>project.edition||"—"},
        {key:"status",label:"На сайте",render:()=><em>Опубликован</em>},
      ]}/>
    </section>}
  </div>;
}
