"use client";

import {useEffect,useState} from "react";
import {panelRequest} from "../components/panel-api";
import PanelPending from "../components/PanelPending";
import "./sales-funnel.css";

type Row={event:string;edition:string;term:string;locale:string;hits:number};
type Report={days:number;timezone:string;updated_at:string;rows:Row[]};
const labels:Record<string,string>={comparison_view:"Показы сравнения",details_click:"Открытия описаний",demo_click:"Переходы в демо",order_click:"Заказ из сравнения",product_order_click:"Заказ из описания",checkout_open:"Оформление загружено"};

export default function SalesFunnel() {
  const [days,setDays]=useState(30),[locale,setLocale]=useState("all"),[term,setTerm]=useState("all"),[revision,setRevision]=useState(0);
  const [report,setReport]=useState<Report|null>(null),[busy,setBusy]=useState(true),[error,setError]=useState("");
  useEffect(()=>{
    const controller=new AbortController();
    void panelRequest<{report:Report}>("owner.public-funnel",{signal:AbortSignal.any([controller.signal,AbortSignal.timeout(20000)])},"",true,{days})
      .then(data=>{if(!controller.signal.aborted)setReport(data.report);})
      .catch(e=>{if(!controller.signal.aborted)setError(e instanceof Error?e.message:"Не удалось загрузить отчёт.");})
      .finally(()=>{if(!controller.signal.aborted)setBusy(false);});
    return()=>controller.abort();
  },[days,revision]);
  const reload=()=>{setBusy(true);setError("");setRevision(value=>value+1);};
  const rows=(report?.rows||[]).filter(row=>(locale==="all"||row.locale===locale)&&(term==="all"||row.term===term));
  const count=(event:string,edition?:string)=>rows.filter(row=>row.event===event&&(!edition||row.edition===edition)).reduce((sum,row)=>sum+row.hits,0);
  const total=rows.reduce((sum,row)=>sum+row.hits,0);
  return <section className="ownerTable salesFunnelReport" aria-labelledby="sales-funnel-title" aria-busy={busy}>
    <header><div><small>ПУТЬ К ЗАКАЗУ</small><h2 id="sales-funnel-title">Сравнение сборок</h2><p>Переходы со сравнения на главной до работающей формы заказа.</p></div><button type="button" className="panelLinkButton" disabled={busy} onClick={reload}>Обновить</button></header>
    <div className="funnelFilters"><label>Период<select value={days} onChange={e=>{setBusy(true);setError("");setDays(Number(e.target.value));}}><option value={7}>7 дней</option><option value={30}>30 дней</option><option value={90}>90 дней</option></select></label><label>Язык сравнения<select value={locale} onChange={e=>setLocale(e.target.value)}><option value="all">Все языки</option><option value="ru">Русский</option><option value="en">Английский</option></select></label><label>Выбранная лицензия<select value={term} onChange={e=>setTerm(e.target.value)}><option value="all">Все сроки</option><option value="annual">На 1 год</option><option value="lifetime">Пожизненно</option></select></label></div>
    <div className="funnelBody" aria-live="polite">
      {busy?<PanelPending label="Загружаем переходы…"/>:error?<div className="funnelError" role="alert"><p>{error}</p><button type="button" className="panelLinkButton" onClick={reload}>Повторить загрузку</button></div>:<>
        {!total&&<p className="funnelEmpty">За выбранный период событий пока нет. Они появятся после просмотра сравнения и переходов покупателей. Попробуйте другой язык, срок или период.</p>}
        <dl className="funnelTotals">{Object.entries(labels).map(([event,label])=><div key={event}><dt>{label}</dt><dd>{count(event).toLocaleString("ru-RU")}</dd></div>)}</dl>
        <div className="funnelEditions">{["business","commerce","content"].map(edition=><article key={edition}><h3>{edition[0].toUpperCase()+edition.slice(1)}</h3><dl>{Object.entries(labels).filter(([event])=>event!=="comparison_view").map(([event,label])=><div key={event}><dt>{label}</dt><dd>{count(event,edition).toLocaleString("ru-RU")}</dd></div>)}</dl></article>)}</div>
        {report&&<p className="funnelUpdated">Обновлено: {new Intl.DateTimeFormat("ru-RU",{dateStyle:"short",timeStyle:"short",timeZone:"Europe/Moscow"}).format(new Date(report.updated_at))} МСК. Дни отчёта — UTC.</p>}
      </>}
    </div>
    <p className="funnelExplanation">Это количество событий, а не уникальных людей, заказов или оплат. Прямой заказ и заказ после описания — разные пути. Оформление учитывается после успешной загрузки расчёта; источник сохраняется при смене языка и входе. Повторная загрузка страницы может добавить событие. Блокировщики и настройки приватности могут уменьшать показатели.</p>
    <p className="funnelExplanation">Сохраняются только дневные суммы по событию, сборке, сроку и языку за последние 90 дней. Имена, контакты, домены, содержимое формы и идентификаторы посетителей в отчёт не передаются.</p>
  </section>;
}
