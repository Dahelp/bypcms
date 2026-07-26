"use client";

import { useState } from "react";
import Link from "next/link";

const editions = [
  {
    id: "business",
    eyebrow: "Для компаний",
    title: "Business",
    text: "Сайт услуг, кейсы, команда, формы и мультиязычность.",
    price: "от 2 490 ₽",
    tone: "violet",
    features: ["Страницы и блоки", "CRM-формы", "SEO и аналитика"],
  },
  {
    id: "commerce",
    eyebrow: "Для продаж",
    title: "Commerce",
    text: "Каталог, заказы, промокоды, оплаты и интеграции.",
    price: "от 4 990 ₽",
    tone: "lime",
    features: ["Каталог и склад", "Заказы и клиенты", "Платежные шлюзы"],
  },
  {
    id: "content",
    eyebrow: "Для медиа",
    title: "Content",
    text: "Блог, журнал, база знаний и редакционные процессы.",
    price: "от 1 990 ₽",
    tone: "blue",
    features: ["Роли редакции", "Версии материалов", "Расписание публикаций"],
  },
];

const modules = [
  ["01", "Контент", "Страницы, коллекции и гибкие поля"],
  ["02", "Commerce", "Каталог, корзина, заказы и оплаты"],
  ["03", "SEO", "Метаданные, sitemap и контроль индексации"],
  ["04", "Automation", "События, вебхуки и фоновые задачи"],
  ["05", "Analytics", "Понятные показатели без лишнего шума"],
  ["06", "Integrations", "CRM, доставка, телефония и API"],
];

export default function Home() {
  const [activeEdition, setActiveEdition] = useState("commerce");
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <main>
      <nav className="nav shell" aria-label="Основная навигация">
        <Link className="brand" href="/" aria-label="BYPCMS — главная">
          <span className="brandMark">B</span>
          <span>BYPCMS</span>
          <small>platform</small>
        </Link>
        <button
          className="menuButton"
          type="button"
          aria-expanded={menuOpen}
          aria-label="Открыть меню"
          onClick={() => setMenuOpen((value) => !value)}
        >
          <span />
          <span />
        </button>
        <div className={`navLinks ${menuOpen ? "open" : ""}`}>
          <a href="#platform">Платформа</a>
          <a href="#editions">Решения</a>
          <a href="#modules">Модули</a>
          <a href="#architecture">Архитектура</a>
        </div>
        <Link className="navAction" href="/admin">
          Демо панели <span>↗</span>
        </Link>
      </nav>

      <section className="hero shell" id="platform">
        <div className="heroCopy">
          <div className="statusPill"><i /> Новая глава BYPCMS</div>
          <h1>
            Сайты, которые
            <span>не боятся изменений.</span>
          </h1>
          <p>
            Платформа для индивидуальной веб-разработки: стабильное ядро,
            независимые модули и свобода создавать интерфейсы без ограничений
            шаблонной CMS.
          </p>
          <div className="heroActions">
            <a className="primaryButton" href="#editions">
              Выбрать решение <span>→</span>
            </a>
            <Link className="textButton" href="/admin">
              Посмотреть админку <span>↗</span>
            </Link>
          </div>
          <div className="heroProof">
            <div>
              <strong>15+</strong>
              <span>лет практики</span>
            </div>
            <div>
              <strong>∞</strong>
              <span>вариантов развития</span>
            </div>
            <div>
              <strong>0</strong>
              <span>правок в ядре</span>
            </div>
          </div>
        </div>

        <div className="productStage" aria-label="Предпросмотр панели BYPCMS">
          <div className="stageGlow" />
          <div className="browserCard">
            <div className="browserTop">
              <div className="traffic"><i /><i /><i /></div>
              <span>bypcms / workspace</span>
              <b>•••</b>
            </div>
            <div className="miniApp">
              <aside>
                <div className="miniLogo">B</div>
                {["⌂", "◫", "◇", "⌁", "⚙"].map((item, index) => (
                  <span className={index === 0 ? "active" : ""} key={item}>{item}</span>
                ))}
              </aside>
              <div className="miniContent">
                <header>
                  <div><small>Доброе утро</small><strong>Обзор проекта</strong></div>
                  <div className="avatar">ДА</div>
                </header>
                <div className="metricGrid">
                  <div><span>Посетители</span><strong>24 892</strong><em>+18.4%</em></div>
                  <div><span>Заявки</span><strong>1 248</strong><em>+7.2%</em></div>
                  <div><span>Конверсия</span><strong>5.01%</strong><em>+1.6%</em></div>
                </div>
                <div className="chartCard">
                  <div className="chartHeading"><span>Активность</span><small>Последние 30 дней</small></div>
                  <div className="chartBars">
                    {[36, 53, 46, 72, 58, 80, 68, 91, 73, 88, 62, 96].map((height, index) => (
                      <i key={index} style={{ height: `${height}%` }} />
                    ))}
                  </div>
                </div>
                <div className="updateToast">
                  <span>✓</span>
                  <div><strong>Ядро защищено</strong><small>Все модули совместимы</small></div>
                  <b>2.0.0</b>
                </div>
              </div>
            </div>
          </div>
          <div className="floatingTag tagOne"><b>24/7</b><span>мониторинг</span></div>
          <div className="floatingTag tagTwo"><i>✓</i><span>Лицензия активна</span></div>
        </div>
      </section>

      <section className="manifesto">
        <div className="shell manifestoGrid">
          <p className="sectionLabel">01 / ПРИНЦИП</p>
          <div>
            <h2>Индивидуальность проекта.<br /><span>Надёжность продукта.</span></h2>
            <p>
              Раньше доработка заказчика меняла саму CMS. Теперь проект
              расширяет платформу через публичные контракты — обновления ядра
              остаются предсказуемыми.
            </p>
          </div>
          <div className="orbitDiagram" aria-label="Слои архитектуры">
            <div className="orbit orbitOuter"><span>ПРОЕКТ</span></div>
            <div className="orbit orbitMiddle"><span>МОДУЛИ</span></div>
            <div className="orbit orbitInner"><b>B</b><span>CORE</span></div>
          </div>
        </div>
      </section>

      <section className="editions shell" id="editions">
        <div className="sectionIntro">
          <p className="sectionLabel">02 / РЕШЕНИЯ</p>
          <h2>Одна платформа.<br />Разные задачи.</h2>
          <p>Начните с готовой редакции и подключайте возможности по мере роста.</p>
        </div>
        <div className="editionTabs" role="tablist" aria-label="Редакции BYPCMS">
          {editions.map((edition) => (
            <button
              key={edition.id}
              role="tab"
              aria-selected={activeEdition === edition.id}
              onClick={() => setActiveEdition(edition.id)}
            >
              {edition.title}
            </button>
          ))}
        </div>
        <div className="editionCards">
          {editions.map((edition) => (
            <article
              key={edition.id}
              className={`editionCard ${edition.tone} ${activeEdition === edition.id ? "selected" : ""}`}
              onMouseEnter={() => setActiveEdition(edition.id)}
            >
              <span className="cardIndex">0{editions.indexOf(edition) + 1}</span>
              <p>{edition.eyebrow}</p>
              <h3>{edition.title}</h3>
              <div className="editionVisual">
                <i /><i /><i />
                <strong>{edition.title.charAt(0)}</strong>
              </div>
              <p className="editionText">{edition.text}</p>
              <ul>
                {edition.features.map((feature) => <li key={feature}>✓ {feature}</li>)}
              </ul>
              <div className="editionPrice"><span>{edition.price}</span><small>/ год</small></div>
              <a href="#contact" aria-label={`Подробнее о ${edition.title}`}>Подробнее <span>↗</span></a>
            </article>
          ))}
        </div>
      </section>

      <section className="modules" id="modules">
        <div className="shell">
          <div className="sectionIntro light">
            <p className="sectionLabel">03 / ЭКОСИСТЕМА</p>
            <h2>Соберите свою CMS.</h2>
            <p>Каждый модуль устанавливается отдельно, объявляет зависимости и проходит проверку совместимости.</p>
          </div>
          <div className="moduleList">
            {modules.map(([number, title, text]) => (
              <article key={number}>
                <span>{number}</span>
                <h3>{title}</h3>
                <p>{text}</p>
                <button type="button" aria-label={`Открыть модуль ${title}`}>↗</button>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="architecture shell" id="architecture">
        <div className="architectureCopy">
          <p className="sectionLabel">04 / АРХИТЕКТУРА</p>
          <h2>Обновления без<br />эффекта домино.</h2>
          <p>
            Ядро знает только контракты. Модули общаются через события и API.
            Кастомный код проекта живёт в собственном слое и никогда не
            перезаписывается обновлением.
          </p>
          <Link className="primaryButton dark" href="/admin">
            Открыть панель <span>→</span>
          </Link>
        </div>
        <div className="layerStack">
          <div className="layer projectLayer"><span>03</span><div><strong>Project layer</strong><small>Дизайн · бизнес-логика · интеграции</small></div><b>Ваш код</b></div>
          <div className="layer moduleLayer"><span>02</span><div><strong>Module layer</strong><small>Изолированные пакеты с контрактами</small></div><b>Расширяемый</b></div>
          <div className="layer coreLayer"><span>01</span><div><strong>BYPCMS Core</strong><small>Auth · API · Events · Updates</small></div><b>Защищён</b></div>
          <div className="connectorLines"><i /><i /><i /></div>
        </div>
      </section>

      <section className="cta" id="contact">
        <div className="shell ctaInner">
          <div>
            <span className="ctaMark">B</span>
            <p className="sectionLabel">СОЗДАДИМ СЛЕДУЮЩИЙ ПРОЕКТ</p>
            <h2>Готовы к системе,<br />которая растёт вместе с вами?</h2>
          </div>
          <a className="ctaButton" href="mailto:hello@bypcms.ru">
            Обсудить проект <span>↗</span>
          </a>
        </div>
      </section>

      <footer className="footer shell">
        <Link className="brand" href="/"><span className="brandMark">B</span><span>BYPCMS</span></Link>
        <p>Платформа для сильных веб-проектов.</p>
        <div><a href="#platform">Платформа</a><a href="#editions">Решения</a><Link href="/admin">Админка</Link></div>
        <span>© {new Date().getFullYear()} BYPCMS</span>
      </footer>
    </main>
  );
}
