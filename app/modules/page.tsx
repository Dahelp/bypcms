import Link from "next/link";
import { publicModules } from "./data";
import { BackToTop, Breadcrumbs, PublicFooter, PublicHeader } from "../components/PublicChrome";
import "./modules.css";

export default function ModulesPage() {
  return (
    <main className="modulesCatalog">
      <PublicHeader active="modules" />
      <Breadcrumbs items={[{label:"Главная",href:"/"},{label:"Модули"}]}/>

      <section className="catalogHero">
        <p>ЭКОСИСТЕМА BYPCMS</p>
        <h1>Модули</h1>
        <span>Выбирайте только нужные возможности. Каждый модуль работает независимо от ядра, обновляется безопасно и управляется из единой панели.</span>
      </section>

      <section className="catalogGrid">
        {publicModules.map((module, index) => (
          <Link href={`/modules/${module.slug}`} key={module.slug}>
            <span>{String(index + 1).padStart(2, "0")} / {module.category}</span>
            <h2>{module.name}</h2>
            <p>{module.lead}</p>
            <div>
              <strong>{module.price ? `${module.price.toLocaleString("ru-RU")} ₽` : "Входит в редакцию"}</strong>
              <b>Подробнее →</b>
            </div>
          </Link>
        ))}
      </section>

      <section className="catalogCta">
        <div>
          <p>СОБЕРИТЕ СВОЮ КОНФИГУРАЦИЮ</p>
          <h2>CMS, модули и услуги — в одном расчёте</h2>
        </div>
        <Link href="/#builder">Открыть калькулятор →</Link>
      </section>

      <PublicFooter /><BackToTop />
    </main>
  );
}
