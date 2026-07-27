import Link from "next/link";
import { publicModules } from "./data";
import "./modules.css";

export default function ModulesPage() {
  return (
    <main className="modulesCatalog">
      <header className="catalogHeader">
        <Link className="catalogBrand" href="/">
          <b>B</b>
          <span>BYPCMS<small>platform</small></span>
        </Link>
        <nav>
          <Link href="/#products">Редакции</Link>
          <Link href="/#builder">Калькулятор</Link>
          <Link href="/#services">Услуги</Link>
          <Link className="active" href="/modules">Модули</Link>
        </nav>
        <div>
          <Link href="/demo">Демо ↗</Link>
          <Link href="/order">Оформить заказ</Link>
        </div>
      </header>

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

      <footer className="catalogFooter">
        <Link className="catalogBrand" href="/">
          <b>B</b>
          <span>BYPCMS<small>CMS, модули и разработка</small></span>
        </Link>
        <p>Модульная платформа для индивидуальных веб-проектов.</p>
        <div><Link href="/#products">Редакции</Link><Link href="/#builder">Калькулятор</Link><Link href="/modules">Модули</Link><Link href="/services">Услуги</Link><Link href="/demo">Демо</Link><Link href="/order">Заказать</Link></div>
        <small>© {new Date().getFullYear()} BYPCMS</small>
      </footer>
    </main>
  );
}
