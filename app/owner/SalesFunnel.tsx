"use client";

import {useEffect,useState} from "react";
import {panelRequest} from "../components/panel-api";
import PanelPending from "../components/PanelPending";
import "./sales-funnel.css";

type Row={event:string;edition:string;term:string;locale:string;hits:number;path?:"direct"|"details"|"unknown"};
type Report={days:number;timezone:string;updated_at:string;rows:Row[]};
const labels = {
  comparison_view:"Показы сравнения",
  details_click:"Открытия описаний",
  demo_click:"Переходы в демо",
  order_click:"Клики «Заказать» из сравнения",
  product_order_click:"Клики «Заказать» из описания",
  checkout_open:"Оформление загружено",
  order_saved:"Заказ сохранён",
  payment_confirmed:"Оплата подтверждена",
};

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
  const count = (event:string, edition?:string, path?:Row["path"]) => rows
    .filter(row => row.event===event && (!edition || row.edition===edition) && (!path || row.path===path))
    .reduce((sum,row)=>sum+row.hits,0);
  const total=rows.reduce((sum,row)=>sum+row.hits,0);
  return <section className="ownerTable salesFunnelReport" aria-labelledby="sales-funnel-title" aria-busy={busy}>
    <header><div><h2 id="sales-funnel-title">Сравнение сборок</h2><p>От сравнения на главной до подтверждённой оплаты.</p></div><button type="button" className="panelLinkButton" disabled={busy} onClick={reload}>Обновить</button></header>
    <div className="funnelFilters"><label>Период<select value={days} onChange={e=>{setBusy(true);setError("");setDays(Number(e.target.value));}}><option value={7}>7 дней</option><option value={30}>30 дней</option><option value={90}>90 дней</option></select></label><label>Язык сравнения<select value={locale} onChange={e=>setLocale(e.target.value)}><option value="all">Все языки</option><option value="ru">Русский</option><option value="en">Английский</option></select></label><label>Лицензия в сравнении<select value={term} onChange={e=>setTerm(e.target.value)}><option value="all">Все сроки</option><option value="annual">На 1 год</option><option value="lifetime">Пожизненно</option></select></label></div>
    <div className="funnelBody" aria-live="polite">
      {busy?<PanelPending label="Загружаем переходы…"/>:error?<div className="funnelError" role="alert"><p>{error}</p><button type="button" className="panelLinkButton" onClick={reload}>Повторить загрузку</button></div>:<>
        {!total&&<p className="funnelEmpty">За выбранный период событий пока нет. Они появятся после просмотра сравнения и переходов покупателей. Попробуйте другой язык, срок или период.</p>}
        <dl className="funnelTotals">{Object.entries(labels).map(([event,label])=>{
          const hits = count(event);
          const isOrderMilestone = event === "order_saved" || event === "payment_confirmed";
          const unknownPath = isOrderMilestone ? count(event,undefined,"unknown") : 0;
          return <div key={event}>
            <dt>{label}</dt>
            <dd>{hits.toLocaleString("ru-RU")}{isOrderMilestone && hits>0 && <small>
              Напрямую {count(event,undefined,"direct").toLocaleString("ru-RU")} · Через описание {count(event,undefined,"details").toLocaleString("ru-RU")}
              {unknownPath>0 && ` · Путь не указан ${unknownPath.toLocaleString("ru-RU")}`}
            </small>}</dd>
          </div>;
        })}</dl>
        <div className="funnelEditions">{["business","commerce","content"].map(edition=><article key={edition}><h3>{edition[0].toUpperCase()+edition.slice(1)}</h3><dl>{Object.entries(labels).filter(([event])=>event!=="comparison_view").map(([event,label])=><div key={event}><dt>{label}</dt><dd>{count(event,edition).toLocaleString("ru-RU")}</dd></div>)}</dl></article>)}</div>
        {report&&<p className="funnelUpdated">Обновлено: {new Intl.DateTimeFormat("ru-RU",{dateStyle:"short",timeStyle:"short",timeZone:"Europe/Moscow"}).format(new Date(report.updated_at))} МСК. Дни отчёта — UTC.</p>}
      </>}
    </div>
    <p className="funnelExplanation">Сборка, срок и язык соответствуют выбору в сравнении. Открытия оформления учитываются после расчёта, в том числе при повторной загрузке страницы. Настройки приватности и блокировщики могут уменьшать показатели.</p>
    <p className="funnelExplanation">Сохранение и подтверждение оплаты учитываются по одному разу на заказ, каждое по своей дате. Оплата должна быть подтверждена в системе. Тестовые платежи исключены. Если заказ полностью или частично возвращён, факт подтверждения оплаты остаётся в отчёте.</p>
  </section>;
}
