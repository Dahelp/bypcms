"use client";

import {useEffect, useRef} from "react";
import {LocaleLink as Link, useLocale} from "./PublicLocale";
import {publicEditions} from "../modules/data";
import {comparisonTag, trackComparison, withComparisonSource, type ComparisonContext, type ComparisonTerm} from "../../lib/comparison-tracking";
import "./edition-comparison.css";

const themes = {Business:["Atelier", "Corporate", "Mono"], Commerce:["Gallery", "Market", "Luxe"], Content:["Journal", "Chronicle", "Focus"]};
const demos = {Business:"atelier", Commerce:"gallery", Content:"chronicle"};
type Edition=(typeof publicEditions)[number];

export default function EditionComparison({term, onTermChange,ready}:{term:ComparisonTerm;onTermChange:(term:ComparisonTerm)=>void;ready:boolean}) {
  const locale = useLocale();
  const tx = (ru:string,en:string) => locale === "en" ? en : ru;
  const intro = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ready || !intro.current || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) {
        trackComparison("comparison_view", {edition:"all",term,locale}, true);
        observer.disconnect();
      }
    }, {threshold:0.5});
    observer.observe(intro.current);
    return () => observer.disconnect();
  }, [term,locale,ready]);
  const rows = [
    {label:tx("Услуги и портфолио компании","Company services and portfolio"),values:[true,false,false]},
    {label:tx("Заявки с сайта и работа с обращениями","Website inquiries and inquiry management"),values:[true,false,false]},
    {label:tx("Товары, корзина и заказы","Products, cart and orders"),values:[false,true,false]},
    {label:tx("Приём платежей через ЮKassa","Accept payments with YooKassa"),values:[false,true,false]},
    {label:tx("Темы для блога и издания","Themes for a blog or publication"),values:[false,false,true]},
    {label:tx("Редактор страниц и медиатека","Page editor and media library"),values:[true,true,true]},
    {label:tx("SEO: метаданные и карта сайта","SEO metadata and sitemap"),values:[true,true,true]},
  ];
  const purpose=(index:number)=>index===0?tx("Представить компанию и получать заявки","Present your company and receive inquiries"):index===1?tx("Продавать товары и принимать оплату","Sell products and accept payments"):tx("Публиковать статьи и развивать издание","Publish stories and grow your publication");
  const actions=(edition:Edition)=>{
    const context:ComparisonContext={edition:edition.name.toLowerCase() as ComparisonContext["edition"],term,locale};
    const tag=comparisonTag(context);
    const details=withComparisonSource(`/solutions/${context.edition}/?term=${term}`,tag);
    const order=withComparisonSource(`/order/?edition=${edition.name}&term=${term}&modules=&services=`,tag);
    return <>
      <div className="comparisonPrice" role="status" aria-live="polite" aria-atomic="true"><strong>{edition[term].toLocaleString(locale==="en"?"en-US":"ru-RU")} ₽</strong><span>{term==="annual"?tx("за год","per year"):tx("один раз","one time")}</span></div>
      <p className="comparisonLicenseNote">{tx("Лицензия на один сайт. Включённые возможности уже в цене.","A license for one website. Included capabilities are covered by the price.")}</p>
      <Link className="salesButton comparisonOrder" href={order} onClick={()=>trackComparison("order_click",context)}>{`${tx("Заказать","Order")} ${edition.name}`}</Link>
      <div className="comparisonLinks"><Link href={details} aria-label={`${tx("Подробнее о","Explore")} ${edition.name}`} onClick={()=>trackComparison("details_click",context)}>{tx("Подробнее о сборке","Explore this edition")}</Link><a href={`https://demo.bypcms.ru/${demos[edition.name]}/`} target="_blank" rel="noopener noreferrer" aria-label={`${tx("Демо","Demo")} ${edition.name}`} onClick={()=>trackComparison("demo_click",context)}>{tx("Посмотреть демо","Try the demo")}</a></div>
    </>;
  };
  return <section className="salesEditions editionComparison publicContainer" id="products" aria-labelledby="comparison-title">
    <div ref={intro} className="comparisonIntro"><p className="salesEyebrow">{tx("СРАВНЕНИЕ СБОРОК","COMPARE THE EDITIONS")}</p><h2 id="comparison-title">{tx("Выберите основу под свою задачу","Choose the foundation for your project")}</h2><p>{tx("Сайт компании, интернет-магазин или издание — сравните возможности и выберите подходящую сборку.","A company website, an online store or a publication: compare the capabilities and choose your build.")}</p></div>
    <fieldset className="comparisonTerm"><legend>{tx("Срок лицензии","License term")}</legend>{(["annual","lifetime"] as const).map(value=><label key={value}><input type="radio" name="comparison-license-term" checked={term===value} onChange={()=>onTermChange(value)}/><span>{value==="annual"?tx("На 1 год","One year"):tx("Пожизненно","Lifetime")}</span></label>)}</fieldset>
    <p className="comparisonTermHelp">{term==="annual"?tx("Обновления в течение года. Продление оплачивается отдельно; истечение срока само по себе не отключает сайт.","Updates for one year. Renewal is separate; expiry by itself does not disable your website."):tx("Обновления приобретённой редакции и модулей без установленной даты окончания. Индивидуальная разработка и сопровождение согласуются отдельно.","Updates for the purchased edition and modules with no set expiry date. Custom development and ongoing support are agreed separately.")}</p>
    <nav className="comparisonJump" aria-label={tx("Перейти к сборке","Jump to an edition")}>{publicEditions.map(edition=><Link key={edition.name} href={`#comparison-card-${edition.name.toLowerCase()}`}>{edition.name}</Link>)}</nav>
    <table className="comparisonMatrix">
      <caption>{tx("Возможности, темы и стоимость сборок BYPCMS","BYPCMS edition capabilities, themes and pricing")}</caption>
      <colgroup><col className="comparisonLabelColumn"/><col span={3}/></colgroup>
      <thead><tr><th scope="col">{tx("Ваша задача","Your project")}</th>{publicEditions.map((edition,index)=><th scope="col" key={edition.name}><h3>{edition.name}</h3><p>{purpose(index)}</p></th>)}</tr></thead>
      <tbody>{rows.map(row=><tr key={row.label}><th scope="row">{row.label}</th>{row.values.map((included,index)=><td key={publicEditions[index].name} className={included?"included":"excluded"}>{included?tx("Включено","Included"):tx("Не входит","Not included")}</td>)}</tr>)}<tr><th scope="row">{tx("Три готовые темы","Three ready-made themes")}</th>{publicEditions.map(edition=><td key={edition.name}>{themes[edition.name].join(" · ")}</td>)}</tr></tbody>
      <tfoot><tr><th scope="row">{tx("Стоимость лицензии","License price")}</th>{publicEditions.map(edition=><td key={edition.name}>{actions(edition)}</td>)}</tr></tfoot>
    </table>
    <div className="comparisonGrid">
      {publicEditions.map((edition,index)=>{
        const context:ComparisonContext={edition:edition.name.toLowerCase() as ComparisonContext["edition"],term,locale};
        return <article className={`comparisonEdition comparisonEdition${index}`} id={`comparison-card-${context.edition}`} key={edition.name} aria-labelledby={`comparison-${context.edition}`}>
          <header><h3 id={`comparison-${context.edition}`}>{edition.name}</h3><p>{purpose(index)}</p></header>
          <dl className="comparisonFeatures">{rows.map(row=><div key={row.label} className={row.values[index]?"included":"excluded"}><dt>{row.label}</dt><dd>{row.values[index]?tx("Включено","Included"):tx("Не входит","Not included")}</dd></div>)}</dl>
          <div className="comparisonThemes"><h4>{tx("Три готовые темы","Three ready-made themes")}</h4><p>{themes[edition.name].join(" · ")}</p></div>
          {actions(edition)}
        </article>;
      })}
    </div>
    <div className="comparisonFootnote"><p>{tx("В каждой сборке: CMS, установщик, инструкция и ключ лицензии. Домен, хостинг, индивидуальный дизайн, наполнение и запуск согласуются отдельно. Дополнительные услуги можно выбрать при оформлении заказа.","Every build includes the CMS, installer, instructions and license key. Domain, hosting, custom design, content and launch services are agreed separately. Choose any additional services at checkout.")}</p><p>{tx("Демо представлены на русском. Дополнительные языки проекта требуют отдельного согласования. Для приёма платежей нужен собственный аккаунт ЮKassa и настройка подключения.","Demos are in Russian. Additional project languages require a separate agreement. Accepting payments requires your own YooKassa account and connection setup.")}</p></div>
  </section>;
}
