"use client";
import { LocaleLink as Link, usePublicText } from "../components/PublicLocale";
import { publicServices } from "../modules/data";
import { BackToTop, Breadcrumbs, PublicFooter, PublicHeader } from "../components/PublicChrome";
import "./services.css";

export default function ServicesPage(){
 const t=usePublicText();
  return <main className="servicesPage">
    <PublicHeader active="services" />
    <Breadcrumbs items={[{label:t("Главная"),href:"/"},{label:t("Услуги")}]}/>
    <section className="servicesHero"><p>{t("РАЗРАБОТКА И СОПРОВОЖДЕНИЕ")}</p><h1>{t("Услуги")}</h1><span>{t("Дополните лицензию только теми работами, которые нужны вашему проекту. Услуги не являются обязательными и выбираются отдельно в калькуляторе.")}</span><Link href="/#builder">{t("Добавить в расчёт →")}</Link></section>
    <section className="servicesGrid">{publicServices.map((service,index)=><article key={service.slug}><span>{String(index+1).padStart(2,"0")}</span><h2>{t(service.name)}</h2><p>{t(service.lead)}</p><div><strong>{t("от")}{" "}{service.price.toLocaleString()} ₽</strong><small>{t("за")}{" "}{t(service.unit)}</small></div><Link href={`/order?services_only=1&services=${service.slug}`}>{t("Заказать услугу →")}</Link></article>)}</section>
    <section className="servicesConcept"><p>{t("ПЕРВЫЙ ШАГ К ИНДИВИДУАЛЬНОМУ САЙТУ")}</p><h2>{t("Концепция до начала разработки")}</h2><span>{t("Разберём задачи, аудиторию и материалы, покажем структуру, визуальный подход и путь пользователя. Предложение с объёмом работ и условиями отправим персонально по закрытой ссылке. Это поможет оценить направление проекта до согласования разработки.")}</span><div><Link href="/concept-example/">{t("Посмотреть пример концепции ↗")}</Link><Link href="/order">{t("Обсудить свою задачу →")}</Link></div></section>
    <section className="servicesProcess"><p>{t("КАК МЫ РАБОТАЕМ")}</p><h2>{t("От задачи до результата")}</h2><div><article><b>01</b><strong>{t("Диагностика")}</strong><span>{t("Фиксируем цели, ограничения и ожидаемый результат.")}</span></article><article><b>02</b><strong>{t("План и договор")}</strong><span>{t("Определяем этапы, сроки, стоимость и критерии приёмки.")}</span></article><article><b>03</b><strong>{t("Реализация")}</strong><span>{t("Выполняем работу с промежуточными демонстрациями.")}</span></article><article><b>04</b><strong>{t("Запуск")}</strong><span>{t("Проверяем, передаём результат и сопровождаем проект.")}</span></article></div></section>
    <PublicFooter /><BackToTop />
  </main>
}
