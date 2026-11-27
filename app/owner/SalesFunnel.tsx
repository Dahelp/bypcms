"use client";

import { useEffect, useState } from "react";
import PanelPending from "../components/PanelPending";
import { panelRequest } from "../components/panel-api";
import "./sales-funnel.css";

const stages = [
  ["checkout_open", "Оформление загружено"],
  ["order_saved", "Заказ сохранён"],
  ["payment_confirmed", "Оплата подтверждена"],
] as const;
const comparisonActivity = [
  ["comparison_view", "Показы сравнения"],
  ["details_click", "Открытия описаний"],
  ["demo_click", "Переходы в демо"],
  ["order_click", "Клики «Заказать» из сравнения"],
  ["product_order_click", "Клики «Заказать» из описания"],
] as const;
const editions = [["business", "Business"], ["commerce", "Commerce"], ["content", "Content"]] as const;
const paths = [["direct", "Напрямую"], ["details", "Через описание"], ["unknown", "Путь не указан"]] as const;
const metrics = [...stages, ...comparisonActivity.slice(1)];
const number = new Intl.NumberFormat("ru-RU");
const updateTime = new Intl.DateTimeFormat("ru-RU", {
  dateStyle: "short", timeStyle: "short", timeZone: "Europe/Moscow",
});

type Row = {
  event: (typeof stages | typeof comparisonActivity)[number][0];
  edition: (typeof editions)[number][0] | "all";
  term: "annual" | "lifetime";
  locale: "ru" | "en";
  hits: number;
  path?: (typeof paths)[number][0];
};
type Report = { days: number; timezone: string; updated_at: string; rows: Row[] };

export default function SalesFunnel() {
  const [days, setDays] = useState(30);
  const [locale, setLocale] = useState("all");
  const [term, setTerm] = useState("all");
  const [revision, setRevision] = useState(0);
  const [report, setReport] = useState<Report | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    void panelRequest<{ report: Report }>(
      "owner.public-funnel",
      { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(20000)]) },
      "", true, { days },
    ).then(data => {
      if (!controller.signal.aborted) setReport(data.report);
    }).catch(error => {
      if (!controller.signal.aborted) setError(error instanceof Error ? error.message : "Не удалось загрузить отчёт.");
    }).finally(() => {
      if (!controller.signal.aborted) setBusy(false);
    });
    return () => controller.abort();
  }, [days, revision]);

  function reload() {
    setBusy(true);
    setError("");
    setRevision(value => value + 1);
  }

  const rows = (report?.rows || []).filter(row =>
    (locale === "all" || row.locale === locale) && (term === "all" || row.term === term));
  function count(event: Row["event"], edition?: Row["edition"], path?: Row["path"]) {
    return rows.reduce((sum, row) =>
      row.event === event && (!edition || row.edition === edition) && (!path || row.path === path)
        ? sum + row.hits : sum, 0);
  }

  return <section className="salesFunnelReport" aria-labelledby="sales-funnel-title">
    <header className="funnelHeader">
      <div>
        <h2 id="sales-funnel-title">Сравнение сборок</h2>
        <p>От сравнения на главной до подтверждения оплаты.</p>
      </div>
      <button type="button" className="panelLinkButton" disabled={busy} onClick={reload}>Обновить</button>
    </header>

    <div className="funnelFilters">
      <label>Период
        <select value={days} onChange={event => {
          setBusy(true);
          setError("");
          setDays(Number(event.target.value));
        }}>
          <option value={7}>7 дней</option><option value={30}>30 дней</option><option value={90}>90 дней</option>
        </select>
      </label>
      <label>Язык сравнения
        <select value={locale} onChange={event => setLocale(event.target.value)}>
          <option value="all">Все языки</option><option value="ru">Русский</option><option value="en">Английский</option>
        </select>
      </label>
      <label>Лицензия в сравнении
        <select value={term} onChange={event => setTerm(event.target.value)}>
          <option value="all">Все сроки</option><option value="annual">На 1 год</option><option value="lifetime">Пожизненно</option>
        </select>
      </label>
    </div>

    <div className="funnelBody" aria-busy={busy} aria-live="polite">
      {busy ? <PanelPending label="Загружаем отчёт…" /> : error ? <div className="funnelError">
        <p role="alert">{error}</p>
        <button type="button" className="panelLinkButton" onClick={reload}>Повторить загрузку</button>
      </div> : <>
        <section aria-labelledby="funnel-stages">
          <div className="funnelSectionHeading">
            <h3 id="funnel-stages">Заказы и оплаты</h3>
            <a href="?section=payments&source=comparison">Заказы из сравнения →</a>
          </div>
          <dl className="funnelStages">
            {stages.map(([event, label]) => {
              const total = count(event);
              return <div key={event} className={event === "payment_confirmed" ? "funnelPayment" : undefined}>
                <dt>{label}</dt>
                <dd className="funnelStageValue">{number.format(total)}</dd>
                {event !== "checkout_open" && total > 0 && <dd className="funnelPaths">
                  {paths.map(([path, name]) => {
                    const hits = count(event, undefined, path);
                    return hits > 0 && <span key={path}>{name} <b>{number.format(hits)}</b></span>;
                  })}
                </dd>}
              </div>;
            })}
          </dl>
          {count("order_saved") === 0 && count("payment_confirmed") === 0 &&
            <p className="funnelEmpty">По выбранным фильтрам пока нет сохранённых заказов и подтверждённых оплат из сравнения.</p>}
        </section>

        <section aria-labelledby="funnel-editions">
          <h3 id="funnel-editions">По сборкам</h3>
          <div className="funnelTableScroll" role="region" aria-labelledby="funnel-editions" tabIndex={0}>
            <table className="funnelMatrix" aria-labelledby="funnel-editions">
              <thead><tr><th scope="col">Показатель</th>{editions.map(([key, name]) => <th key={key} scope="col">{name}</th>)}</tr></thead>
              <tbody>
                {metrics.map(([event, label], index) => <tr key={event} className={index < stages.length ? "funnelMatrixStage" : undefined}>
                  <th scope="row">{label}</th>
                  {editions.map(([edition]) => <td key={edition}>{number.format(count(event, edition))}</td>)}
                </tr>)}
              </tbody>
            </table>
          </div>
        </section>

        <section aria-labelledby="funnel-activity">
          <h3 id="funnel-activity">Действия в сравнении</h3>
          <dl className="funnelActivity">
            {comparisonActivity.map(([event, label]) => <div key={event}>
              <dt>{label}</dt><dd>{number.format(count(event))}</dd>
            </div>)}
          </dl>
        </section>

        <footer className="funnelFooter">
          <details>
            <summary>Как считаются показатели</summary>
            <p>Сборка, срок и язык берутся из исходного сравнения. Успешная загрузка расчёта учитывается и при повторном открытии оформления. Настройки приватности и блокировщики могут уменьшать показатели.</p>
            <p>Сохранение и подтверждение оплаты учитываются по одному разу на заказ, каждое по своей дате. Факт подтверждения остаётся после возврата. В отчёте учитываются оплаты в рабочем режиме. Границы дней рассчитываются по UTC.</p>
          </details>
          {report && <p className="funnelUpdated">Обновлено <time dateTime={report.updated_at}>{updateTime.format(new Date(report.updated_at))} МСК</time></p>}
        </footer>
      </>}
    </div>
  </section>;
}
