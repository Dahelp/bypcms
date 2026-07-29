import Link from "next/link";
import { publicServices } from "../modules/data";
import { BackToTop, Breadcrumbs, PublicFooter, PublicHeader } from "../components/PublicChrome";
import "./services.css";

export default function ServicesPage(){
  return <main className="servicesPage">
    <PublicHeader active="services" />
    <Breadcrumbs items={[{label:"Главная",href:"/"},{label:"Услуги"}]}/>
    <section className="servicesHero"><p>РАЗРАБОТКА И СОПРОВОЖДЕНИЕ</p><h1>Услуги</h1><span>Дополните лицензию только теми работами, которые нужны вашему проекту. Услуги не являются обязательными и выбираются отдельно в калькуляторе.</span><Link href="/#builder">Добавить в расчёт →</Link></section>
    <section className="servicesGrid">{publicServices.map((service,index)=><article key={service.slug}><span>{String(index+1).padStart(2,"0")}</span><h2>{service.name}</h2><p>{service.lead}</p><div><strong>от {service.price.toLocaleString("ru-RU")} ₽</strong><small>за {service.unit}</small></div><Link href={`/order?services=${service.slug}`}>Заказать услугу →</Link></article>)}</section>
    <section className="servicesProcess"><p>КАК МЫ РАБОТАЕМ</p><h2>От задачи до результата</h2><div><article><b>01</b><strong>Диагностика</strong><span>Фиксируем цели, ограничения и ожидаемый результат.</span></article><article><b>02</b><strong>План и договор</strong><span>Определяем этапы, сроки, стоимость и критерии приёмки.</span></article><article><b>03</b><strong>Реализация</strong><span>Выполняем работу с промежуточными демонстрациями.</span></article><article><b>04</b><strong>Запуск</strong><span>Проверяем, передаём результат и сопровождаем проект.</span></article></div></section>
    <PublicFooter /><BackToTop />
  </main>
}
