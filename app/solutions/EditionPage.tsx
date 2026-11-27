"use client";

import {useEffect, useState} from "react";
import {LocaleLink as Link, useLocale} from "../components/PublicLocale";
import {BackToTop, Breadcrumbs, PublicFooter, PublicHeader} from "../components/PublicChrome";
import {publicEditions, publicModules} from "../modules/data";
import "./commerce/commerce.css";
import {editorialContent, type EditionName} from "./edition-content";
import {commerceContent} from "./commerce-content";
import {parseComparisonTag, trackComparison, withComparisonSource} from "../../lib/comparison-tracking";

export default function EditionPage({editionName}:{editionName:EditionName}) {
  const locale = useLocale();
  const tx = (ru:string, en:string) => locale === "en" ? en : ru;
  const edition=publicEditions.find(item=>item.name===editionName)!;
  const content=editionName==="Commerce"?commerceContent(tx):editorialContent(editionName,tx);
  const {features,delivery,faq,demo}=content;
  const [term, setTerm] = useState<"annual"|"lifetime">("annual");
  const [ready, setReady] = useState(false);
  const [comparisonSource,setComparisonSource]=useState<string|null>(null);
  useEffect(() => {
    const initial = new URLSearchParams(window.location.search).get("term");
    void Promise.resolve().then(() => {setTerm(initial === "lifetime" ? "lifetime" : "annual"); setComparisonSource(parseComparisonTag(new URLSearchParams(window.location.search).get("cmp")) ? new URLSearchParams(window.location.search).get("cmp") : null); setReady(true);});
  }, []);
  useEffect(() => {
    if (!ready) return;
    const url = new URL(window.location.href);
    url.searchParams.set("term", term);
    window.history.replaceState(null, "", url.pathname + url.search + url.hash);
    window.dispatchEvent(new Event("bypcms:configuration"));
  }, [term, ready]);
  const order = withComparisonSource(`/order/?edition=${edition.name}&term=${term}&modules=&services=`,comparisonSource,"details");
  const trackOrder=()=>{const source=parseComparisonTag(comparisonSource);if(source)trackComparison("product_order_click",source);};
  return <main className="commerceProduct">
    <PublicHeader/>
    <Breadcrumbs items={[{label:tx("Главная", "Home"),href:"/"},{label:tx("Решения", "Editions"),href:"/#products"},{label:edition.name}]}/>
    <section className="commerceHero publicContainer" aria-labelledby="commerce-title">
      <div><p className="commerceEyebrow">BYPCMS {edition.name.toUpperCase()} / {tx("ГОТОВАЯ СБОРКА", "WEBSITE BUILD")}</p><h1 id="commerce-title">{content.title[0]}<br/>{content.title[1]}</h1></div>
      <div className="commerceHeroCopy"><p>{content.lead}</p><div className="commerceActions"><Link className="commerceButton" href="#license">{tx("Выбрать лицензию", "Choose your license")} →</Link><a className="commerceButton secondary" href={demo} target="_blank" rel="noopener noreferrer">{tx("Посмотреть демо", "Explore demo")} ↗</a></div><p className="commerceSmall">{content.tagline}</p></div>
    </section>
    <figure className="commerceCover publicContainer"><a href={content.cover} target="_blank" rel="noopener noreferrer" aria-label={`${tx("Открыть большой скриншот", "Open the full-size screenshot")} ${content.theme}`}><img src={content.cover} width="1409" height="990" alt={content.coverAlt} fetchPriority="high"/></a><figcaption><span>{content.theme.toUpperCase()} / {tx("ТЕМА В СОСТАВЕ", "INCLUDED WITH")} {edition.name.toUpperCase()}</span><span>{content.coverNote}</span></figcaption></figure>
    <nav className="commerceSections publicContainer" aria-label={`${tx("На странице", "On this page")}: ${edition.name}`}><Link href="#experience">{tx("Как выглядит", "The experience")}</Link><Link href="#features">{tx("Возможности", "Capabilities")}</Link><Link href="#delivery">{tx("Состав поставки", "What you receive")}</Link><Link href="#license">{tx("Стоимость", "Pricing")}</Link><Link href="#questions">{tx("Вопросы", "Questions")}</Link></nav>
    <section id="experience" className="commerceExperience publicContainer" aria-labelledby="experience-title"><div className="commerceSectionHeading"><div><p className="commerceEyebrow">{tx("ПОСМОТРИТЕ В ДЕТАЛЯХ", "EXPLORE THE DETAILS")}</p><h2 id="experience-title">{content.experienceTitle}</h2></div><p>{content.experienceLead}</p></div><div className="commerceScreens"><figure><a href={content.desktop} target="_blank" rel="noopener noreferrer"><img src={content.desktop} width="1251" height="712" alt={content.desktopAlt} loading="lazy"/></a><figcaption>{content.desktopCaption}</figcaption></figure><figure className="commerceMobileScreen"><a href={content.mobile} target="_blank" rel="noopener noreferrer"><img src={content.mobile} width="365" height="813" alt={content.mobileAlt} loading="lazy"/></a><figcaption>{content.mobileCaption}</figcaption></figure></div><div className="commerceDemoNote"><p>{content.demoPrompt}</p><a href={demo} target="_blank" rel="noopener noreferrer">{tx("Открыть", "Open")} {content.theme} ↗</a></div></section>
    <section id="features" className="commerceFeatures publicContainer" aria-labelledby="features-title"><div><p className="commerceEyebrow">{tx("ДЛЯ ЕЖЕДНЕВНОЙ РАБОТЫ", "FOR YOUR EVERYDAY WORK")}</p><h2 id="features-title">{content.featuresTitle}</h2><p>{content.featuresLead}</p></div><div className="commerceFeatureList">{features.map(([title,description],index)=><article key={title}><span>{String(index+1).padStart(2,"0")}</span><div><h3>{title}</h3><p>{description}</p></div></article>)}</div></section>
    <section id="delivery" className="commerceDelivery publicContainer" aria-labelledby="delivery-title"><p className="commerceEyebrow">{tx("ПОНЯТНЫЙ СОСТАВ ПОКУПКИ", "A CLEAR SCOPE OF PURCHASE")}</p><h2 id="delivery-title">{tx("Что вы получите", "What you receive")}</h2><div className="commerceDeliveryGrid">{delivery.map(([title,description])=><article key={title}><h3>{title}</h3><p>{description}</p></article>)}</div><div className="commerceModuleLinks"><span>{tx("Подробнее о включённых модулях:", "Explore the included modules:")}</span>{edition.modules.map(key=><Link key={key} href={`/modules/${key}/`}>{key==="forms"?tx("Формы и CRM", "Forms & CRM"):key==="content"?tx("Контент", "Content"):key==="payments"?tx("Платежи", "Payments"):publicModules.find(item=>item.slug===key)?.name} ↗</Link>)}</div><details className="commerceLimits"><summary>{tx("Что согласуется отдельно и какие есть ограничения", "Separate services and current limitations")}</summary>{content.limitations.map(text=><p key={text}>{text}</p>)}</details></section>
    <section id="license" className="commercePricing publicContainer" aria-labelledby="license-title"><div><p className="commerceEyebrow">{content.pricingEyebrow}</p><h2 id="license-title">{tx("Выберите срок.\nСостав уже включён.", "Choose your term.\nThe essentials are included.")}</h2><p>{content.pricingLead}</p><Link href="/legal/offer/">{tx("Условия лицензии и покупки", "License and purchase terms")} ↗</Link></div><div className="commercePricePanel"><fieldset><legend>{tx("Срок лицензии", "License term")}</legend><div className="commerceTerm">{(["annual","lifetime"] as const).map(value=><label key={value}><input type="radio" name="commerce-term" value={value} checked={term===value} onChange={()=>setTerm(value)}/><span>{value==="annual"?tx("На 1 год", "One year"):tx("Пожизненно", "Lifetime")}</span></label>)}</div></fieldset><div className="commercePrice" role="status" aria-live="polite" aria-atomic="true"><strong>{edition[term].toLocaleString(locale==="en"?"en-US":"ru-RU")} ₽</strong><span>{term==="annual"?tx("за год", "per year"):tx("один раз", "one time")}</span></div><p className="commerceTermDescription">{term==="annual"?tx("Совместимые обновления в течение года. Продление оплачивается отдельно; истечение срока само по себе не отключает публичный сайт.", "Compatible updates for one year. Renewal is separate; expiry by itself does not disable your public website."):tx("Без обязательного ежегодного платежа за лицензию. Обновления приобретённой редакции и модулей — без установленной даты окончания.", "No mandatory annual license payment. Updates for the purchased edition and modules have no set expiry date.")}</p><Link className="commerceButton" href={order} onClick={trackOrder}>{`${tx("Оформить", "Order")} ${edition.name}`} →</Link><p className="commerceSmall">{tx("На следующем шаге проверите состав и укажете домен. Оплата — после проверки счёта. Услуги можно добавить отдельно.", "Review the configuration and enter your domain next. Pay after reviewing the invoice. Add services separately if needed.")}</p></div></section>
    <section className="commerceGettingStarted publicContainer" aria-labelledby="start-title"><h2 id="start-title">{content.startTitle}</h2><ol>{[
      [tx("Оформите заказ", "Place your order"),tx("Выберите срок, укажите домен и войдите в кабинет.", "Choose your license term, enter the domain and sign in.")],
      [tx("Проверьте и оплатите счёт", "Review and pay the invoice"),tx("Сверьте состав, стоимость и реквизиты в заказе.", "Check the items, price and payment details in your order.")],
      [tx("Получите сборку", "Receive your build"),tx("После подтверждения оплаты скачайте архив, ключ и инструкцию.", "After payment verification, download your archive, key and instructions.")],
      [tx("Установите и наполните", "Install and make it yours"),content.installStep],
    ].map(([title,description])=><li key={title}><h3>{title}</h3><p>{description}</p></li>)}</ol></section>
    <section id="questions" className="commerceFaq publicContainer" aria-labelledby="questions-title"><div><p className="commerceEyebrow">{tx("ПЕРЕД ПОКУПКОЙ", "BEFORE YOU BUY")}</p><h2 id="questions-title">{tx("Важные детали", "The useful details")}</h2><Link href="/contacts/">{tx("Задать свой вопрос", "Ask a question")} →</Link></div><div>{faq.map(([title,body])=><details key={title}><summary>{title}</summary><p>{body}</p></details>)}</div></section>
    <section className="commerceFinal publicContainer"><div><h2>{tx("Начните с готовой основы.", "Start with a ready-made foundation.")}</h2><p>{content.finalLead}</p></div><Link className="commerceButton" href={order} onClick={trackOrder}>{tx("Перейти к заказу", "Continue to order")} →</Link></section>
    <PublicFooter orderHref={order} onOrderClick={trackOrder}/><BackToTop/>
  </main>;
}
