"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export const DEMO_URL = "https://demo.bypcms.ru/";

export function PublicHeader({ active = "" }: { active?: "services" | "modules" | "order" | "" }) {
  return <header className="publicHeader shell">
    <Link className="brand" href="/"><span className="brandMark">B</span><span>BYPCMS</span><small>platform</small></Link>
    <nav aria-label="Основная навигация">
      <Link href="/#products">Редакции</Link>
      <Link href="/#builder">Калькулятор</Link>
      <Link className={active === "services" ? "active" : ""} href="/services">Услуги</Link>
      <Link className={active === "modules" ? "active" : ""} href="/modules">Модули</Link>
    </nav>
    <div><a href={DEMO_URL}>Демо <span>↗</span></a><Link className={active === "order" ? "active action" : "action"} href="/order">Оформить заказ</Link></div>
  </header>;
}

export function PublicFooter() {
  return <footer className="publicFooter shell">
    <div><Link className="brand" href="/"><span className="brandMark">B</span><span>BYPCMS</span></Link><p>CMS, модули и веб-разработка.</p></div>
    <nav><strong>Платформа</strong><Link href="/#products">Редакции</Link><Link href="/#builder">Калькулятор</Link><Link href="/modules">Модули</Link></nav>
    <nav><strong>Проект</strong><Link href="/services">Услуги</Link><a href={DEMO_URL}>Демо</a><Link href="/order">Заказать</Link></nav>
    <div className="publicFooterMeta"><a href="mailto:hello@bypcms.ru">hello@bypcms.ru</a><span>© {new Date().getFullYear()} BYPCMS</span></div>
  </footer>;
}

export function BackToTop() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const update = () => setVisible(window.scrollY > 500);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);
  return <button className={`backToTop ${visible ? "visible" : ""}`} onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} aria-label="Подняться наверх">↑<span>Наверх</span></button>;
}
