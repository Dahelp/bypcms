"use client";
import { LocaleLink as Link, usePublicText } from "../components/PublicLocale";
import { publicModules } from "./data";
import { BackToTop, Breadcrumbs, PublicFooter, PublicHeader } from "../components/PublicChrome";
import "./modules.css";

export default function ModulesPage() {
 const t=usePublicText();
  return (
    <main className="modulesCatalog">
      <PublicHeader active="modules" />
      <Breadcrumbs items={[{label:t("Главная"),href:"/"},{label:t("Модули")}]}/>

      <section className="catalogHero">
        <p>{t("ЭКОСИСТЕМА BYPCMS")}</p>
        <h1>{t("Модули")}</h1>
        <span>{t("Возможности поставляются в составе совместимых редакций и обновляются вместе с CMS. Модули в разработке не продаются.")}</span>
      </section>

      <section className="catalogGrid">
        {publicModules.map((module, index) => (
          <Link href={`/modules/${module.slug}`} key={module.slug}>
            <span>{String(index + 1).padStart(2, "0")} / {t(module.category)}</span>
            <h2>{t(module.name)}</h2>
            <p>{t(module.lead)}</p>
            <div>
              <strong>{module.readiness==="planned"?t("В разработке · не продаётся"):t("В составе редакции")}</strong>
              <b>{t("Подробнее →")}</b>
            </div>
          </Link>
        ))}
      </section>

      <section className="catalogCta">
        <div>
          <p>{t("СОБЕРИТЕ СВОЮ КОНФИГУРАЦИЮ")}</p>
          <h2>{t("CMS, модули и услуги — в одном расчёте")}</h2>
        </div>
        <Link href="/#builder">{t("Открыть калькулятор →")}</Link>
      </section>

      <PublicFooter /><BackToTop />
    </main>
  );
}
