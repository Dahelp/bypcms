"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

const products = [
  { name: "Business", price: 24900, note: "Компания, услуги и корпоративный сайт", modules: ["Контент", "Формы", "SEO"] },
  { name: "Commerce", price: 49900, note: "Каталог, заказы, оплата и доставка", modules: ["Каталог", "Корзина", "Заказы", "Платежи"] },
  { name: "Content", price: 19900, note: "Блог, медиа и база знаний", modules: ["Публикации", "Рубрики", "Редакция"] },
];

const extras = [
  ["Интернет-магазин", 14900],
  ["Мультиязычность", 7900],
  ["CRM и обращения", 9900],
  ["Аналитика", 5900],
];

export default function Home() {
  const [selected, setSelected] = useState(1);
  const [extrasSelected, setExtrasSelected] = useState<string[]>(["Аналитика"]);
  const total = useMemo(() => products[selected].price + extras.filter(([name]) => extrasSelected.includes(String(name))).reduce((sum, item) => sum + Number(item[1]), 0), [selected, extrasSelected]);

  return (
    <main>
      <nav className="nav shell" aria-label="Основная навигация">
        <Link className="brand" href="/"><span className="brandMark">B</span><span>BYPCMS</span><small>platform</small></Link>
        <div className="navLinks">
          <a href="#products">Редакции</a><a href="#builder">Калькулятор</a><a href="#services">Услуги</a><a href="#platform">Платформа</a>
        </div>
        <Link className="navAction" href="/demo">Открыть демо <span>↗</span></Link>
      </nav>

      <section className="hero shell" id="platform">
        <div className="heroCopy">
          <div className="statusPill"><i /> Платформа для сильных веб-проектов</div>
          <h1>Управляйте сайтом.<span>Развивайте бизнес.</span></h1>
          <p>BYPCMS объединяет удобное управление контентом, мощные модули и индивидуальный дизайн. Вы получаете готовую систему, которую можно расширять вместе с вашим проектом.</p>
          <div className="heroActions">
            <a className="primaryButton" href="#builder">Рассчитать сборку <span>→</span></a>
            <Link className="textButton" href="/demo">Посмотреть демо <span>↗</span></Link>
          </div>
          <div className="heroProof">
            <div><strong>15+</strong><span>лет веб-разработки</span></div>
            <div><strong>6</strong><span>готовых модулей</span></div>
            <div><strong>24/7</strong><span>контроль лицензий</span></div>
          </div>
        </div>
        <div className="productStage" aria-label="Интерфейс BYPCMS">
          <div className="stageGlow" />
          <div className="browserCard">
            <div className="browserTop"><div className="traffic"><i /><i /><i /></div><span>bypcms / workspace</span><b>•••</b></div>
            <div className="miniApp">
              <aside><div className="miniLogo">B</div>{["⌂","▤","◇","◎","⚙"].map((item,index)=><span className={index===0?"active":""} key={item}>{item}</span>)}</aside>
              <div className="miniContent">
                <header><div><small>Рабочее пространство</small><strong>Обзор проекта</strong></div><div className="avatar">ДА</div></header>
                <div className="metricGrid"><div><span>Посетители</span><strong>24 892</strong><em>+18.4%</em></div><div><span>Заявки</span><strong>1 248</strong><em>+7.2%</em></div><div><span>Конверсия</span><strong>5.01%</strong><em>+1.6%</em></div></div>
                <div className="chartCard"><div className="chartHeading"><span>Активность</span><small>30 дней</small></div><div className="chartBars">{[36,53,46,72,58,80,68,91,73,88,62,96].map((height,index)=><i key={index} style={{height:`${height}%`}} />)}</div></div>
                <div className="updateToast"><span>✓</span><div><strong>Система актуальна</strong><small>Все компоненты готовы</small></div><b>2.1</b></div>
              </div>
            </div>
          </div>
          <div className="floatingTag tagOne"><b>∞</b><span>возможностей</span></div><div className="floatingTag tagTwo"><i>✓</i><span>Лицензия активна</span></div>
        </div>
      </section>

      <section className="editions shell" id="products">
        <div className="sectionIntro"><p className="sectionLabel">01 / РЕДАКЦИИ</p><h2>Готовая основа.<br />Ваши возможности.</h2><p>Выберите редакцию и дополните её модулями, дизайном и услугами разработки.</p></div>
        <div className="editionCards">
          {products.map((product,index)=><article className={`editionCard ${["violet","lime","blue"][index]} ${selected===index?"selected":""}`} key={product.name} onClick={()=>setSelected(index)}>
            <span className="cardIndex">0{index+1}</span><p>BYPCMS</p><h3>{product.name}</h3><div className="editionVisual"><i/><i/><i/><strong>{product.name[0]}</strong></div>
            <p className="editionText">{product.note}</p><ul>{product.modules.map(item=><li key={item}>✓ {item}</li>)}</ul>
            <div className="editionPrice"><span>{product.price.toLocaleString("ru-RU")} ₽</span><small> / лицензия</small></div>
          </article>)}
        </div>
      </section>

      <section className="modules" id="builder"><div className="shell">
        <div className="sectionIntro light"><p className="sectionLabel">02 / КОНСТРУКТОР</p><h2>Соберите свою BYPCMS.</h2><p>Итоговая стоимость прозрачна: редакция, выбранные модули и услуги.</p></div>
        <div className="priceBuilder">
          <div className="builderOptions">{extras.map(([name,price])=><label key={name}><input type="checkbox" checked={extrasSelected.includes(String(name))} onChange={()=>setExtrasSelected(list=>list.includes(String(name))?list.filter(x=>x!==name):[...list,String(name)])}/><span><strong>{name}</strong><small>+{Number(price).toLocaleString("ru-RU")} ₽</small></span></label>)}</div>
          <aside><small>ВАША СБОРКА</small><h3>BYPCMS {products[selected].name}</h3><p>{products[selected].modules.concat(extrasSelected).join(" · ")}</p><strong>{total.toLocaleString("ru-RU")} ₽</strong><a href="mailto:hello@bypcms.ru">Заказать сборку →</a></aside>
        </div>
      </div></section>

      <section className="architecture shell" id="services">
        <div className="architectureCopy"><p className="sectionLabel">03 / УСЛУГИ</p><h2>Проект под ключ<br />на одной платформе.</h2><p>Помимо лицензии можно заказать прототипирование, уникальный UX/UI, адаптивный frontend, интеграции, перенос данных, запуск и сопровождение.</p><a className="primaryButton dark" href="mailto:hello@bypcms.ru">Обсудить проект <span>→</span></a></div>
        <div className="layerStack">
          <div className="layer projectLayer"><span>04</span><div><strong>Разработка и запуск</strong><small>Frontend · интеграции · перенос · обучение</small></div><b>Под ключ</b></div>
          <div className="layer moduleLayer"><span>03</span><div><strong>Индивидуальный дизайн</strong><small>UX-исследование · UI-kit · адаптивный шаблон</small></div><b>Уникально</b></div>
          <div className="layer moduleLayer"><span>02</span><div><strong>Модули</strong><small>Каталог · продажи · CRM · аналитика</small></div><b>На выбор</b></div>
          <div className="layer coreLayer"><span>01</span><div><strong>BYPCMS Core</strong><small>Управление · API · обновления · лицензия</small></div><b>Основа</b></div>
        </div>
      </section>

      <section className="cta"><div className="shell ctaInner"><div><span className="ctaMark">B</span><p className="sectionLabel">ВАШ НОВЫЙ ВЕБ-ПРОЕКТ</p><h2>Соберём систему,<br />которая подходит именно вам.</h2></div><Link className="ctaButton" href="/demo">Открыть демо <span>↗</span></Link></div></section>
      <footer className="footer shell"><Link className="brand" href="/"><span className="brandMark">B</span><span>BYPCMS</span></Link><p>CMS, модули и веб-разработка.</p><div><a href="#products">Редакции</a><a href="#services">Услуги</a><Link href="/demo">Демо</Link></div><span>© {new Date().getFullYear()} BYPCMS</span></footer>
    </main>
  );
}
