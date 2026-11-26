"use client";

import { LocaleLink as Link, LanguageSwitch, usePublicText } from "./PublicLocale";
import "./public-chrome.css";
import { useEffect, useState } from "react";

export const DEMO_URL = "https://demo.bypcms.ru/";

export function PublicHeader({ active = "" }: { active?: "services" | "modules" | "portfolio" | "order" | "" }) {
  const t = usePublicText();
  const [open,setOpen] = useState(false);
  return <header className="publicHeader">
    <div className="publicHeaderInner publicContainer">
      <Link className="brand" href="/"><span className="brandMark">B</span><span>BYPCMS</span><small>platform</small></Link>
      <nav id="public-navigation" className={open ? "publicNavigation isOpen" : "publicNavigation"} aria-label={t("Основная навигация")} onClick={()=>setOpen(false)}>
        <Link href="/#products">{t("Решения")}</Link>
        <Link className={active === "portfolio" ? "active" : ""} href="/portfolio">{t("Портфолио")}</Link>
        <Link href="/#process">{t("Как это работает")}</Link>
        <Link className={active === "services" ? "active" : ""} href="/services">{t("Услуги")}</Link>
        <Link className="mobileAccount" href="/account/">{t("Кабинет")}</Link>
      </nav>
      <div className="publicHeaderActions"><LanguageSwitch/><Link className="publicAccountLink" href="/account/">{t("Кабинет")}</Link><a className="publicDemoLink" href={DEMO_URL}>{t("Демо")}</a><Link className="action" href="/#products">{t("Выбрать сборку")}</Link><button className="publicMenuToggle" aria-expanded={open} aria-controls="public-navigation" aria-label={t(open ? t("Закрыть меню") : t("Открыть меню"))} onClick={()=>setOpen(!open)} onKeyDown={event=>{if(event.key==="Escape")setOpen(false)}}>{open ? t("Закрыть") : t("Меню")}</button></div>
    </div>
  </header>;
}

export function PublicFooter({orderHref="/order"}:{orderHref?:string}={}) {
  const t = usePublicText();
  return <footer className="publicFooter">
    <div className="publicFooterInner publicContainer">
      <div className="publicFooterBrand"><Link className="brand" href="/"><span className="brandMark">B</span><span>BYPCMS</span></Link><p>{t("Модульная CMS и разработка индивидуальных веб‑проектов.")}</p></div>
      <nav aria-label={t("Разделы сайта")}><Link href="/#products">{t("Редакции")}</Link><Link href="/#builder">{t("Калькулятор")}</Link><Link href="/portfolio">{t("Портфолио")}</Link><Link href="/modules">{t("Модули")}</Link><Link href="/services">{t("Услуги")}</Link><Link href="/contacts/">{t("Контакты и реквизиты")}</Link><Link href="/legal/offer/">{t("Условия покупки")}</Link><Link href="/legal/privacy/">{t("Персональные данные")}</Link><Link href="/legal/refunds/">{t("Оплата и возвраты")}</Link><a href={DEMO_URL}>{t("Демо")}</a></nav>
      <div className="publicFooterContact"><span>{t("ОБСУДИТЬ ПРОЕКТ")}</span><a href="mailto:hello@bypcms.ru">hello@bypcms.ru</a><Link href={orderHref}>{t("Оформить заказ")}{" "}<b>↗</b></Link></div>
      <div className="publicFooterBottom"><span>© {new Date().getFullYear()} BYPCMS</span><p>{t("Платформа развивается и обновляется независимо от проектов клиентов.")}</p><a href="mailto:hello@bypcms.ru">{t("Связаться с нами")}</a></div>
    </div>
  </footer>;
}

export function BackToTop() {
  const t = usePublicText();
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const update = () => setVisible(window.scrollY > 500);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);
  return <button className={`backToTop ${visible ? "visible" : ""}`} onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} aria-label={t("Подняться наверх")}>↑<span>{t("Наверх")}</span></button>;
}

export function Breadcrumbs({items}:{items:{label:string;href?:string}[]}) {
  const t = usePublicText();
  return <nav className="breadcrumbs publicContainer" aria-label={t("Хлебные крошки")}>
    {items.map((item,index)=><span key={`${item.label}-${index}`}>{item.href?<Link href={item.href}>{t(item.label)}</Link>:<b aria-current="page">{t(item.label)}</b>}{index<items.length-1&&<i>/</i>}</span>)}
  </nav>;
}
