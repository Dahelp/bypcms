"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { publicEditions, publicModules, publicServices } from "./modules/data";
import { BackToTop, DEMO_URL, PublicFooter, PublicHeader } from "./components/PublicChrome";

export default function Home() {
  const [selected, setSelected] = useState(1);
  const [term, setTerm] = useState<"annual"|"lifetime">("annual");
  const [extrasSelected, setExtrasSelected] = useState<string[]>(["analytics"]);
  const [servicesSelected, setServicesSelected] = useState<string[]>([]);
  const selectedEdition=publicEditions[selected];
  const compatibleExtras=publicModules.filter(module=>!selectedEdition.modules.includes(module.slug as never)&&(
    selectedEdition.name==="Commerce"||!["commerce","payments"].includes(module.slug)
  ));
  const total = useMemo(() => selectedEdition[term] + compatibleExtras.filter(module=>extrasSelected.includes(module.slug)).reduce((sum,module)=>sum+module.price,0) + publicServices.filter(service=>servicesSelected.includes(service.slug)).reduce((sum,service)=>sum+service.price,0), [selectedEdition,term,compatibleExtras,extrasSelected,servicesSelected]);

  return (
    <main>
      <PublicHeader />

      <section className="hero shell" id="platform">
        <div className="heroCopy">
          <div className="statusPill"><i /> Платформа для сильных веб-проектов</div>
          <h1>Управляйте сайтом.<span>Развивайте бизнес.</span></h1>
          <p>BYPCMS объединяет удобное управление контентом, мощные модули и индивидуальный дизайн. Вы получаете готовую систему, которую можно расширять вместе с вашим проектом.</p>
          <div className="heroActions">
            <a className="primaryButton" href="#builder">Рассчитать сборку <span>→</span></a>
            <a className="textButton" href={DEMO_URL}>Посмотреть демо <span>↗</span></a>
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
          {publicEditions.map((product,index)=><article className={`editionCard ${["violet","lime","blue"][index]} ${selected===index?"selected":""}`} key={product.name} onClick={()=>setSelected(index)}>
            <span className="cardIndex">0{index+1}</span><p>BYPCMS</p><h3>{product.name}</h3><div className="editionVisual"><i/><i/><i/><strong>{product.name[0]}</strong></div>
            <p className="editionText">{product.note}</p><ul>{product.modules.map(item=><li key={item}>✓ {publicModules.find(module=>module.slug===item)?.name}</li>)}</ul>
            <div className="editionPrice"><span>{product[term].toLocaleString("ru-RU")} ₽</span><small> / {term==="annual"?"год":"пожизненно"}</small></div>
          </article>)}
        </div>
      </section>

      <section className="modules" id="builder"><div className="shell">
        <div className="sectionIntro light"><p className="sectionLabel">02 / КОНСТРУКТОР</p><h2>Соберите свою BYPCMS.</h2><p>Итоговая стоимость прозрачна: редакция, выбранные модули и услуги.</p></div>
        <div className="publicTermSelect"><button className={term==="annual"?"active":""} onClick={()=>setTerm("annual")}><b>Лицензия на 1 год</b><span>Доступная цена и ежегодное продление</span></button><button className={term==="lifetime"?"active":""} onClick={()=>setTerm("lifetime")}><b>Пожизненная лицензия</b><span>Без обязательного ежегодного платежа</span></button></div>
        <div className="priceBuilder">
          <div><div className="builderOptions">{compatibleExtras.map(module=><label key={module.slug}><input type="checkbox" checked={extrasSelected.includes(module.slug)} onChange={()=>setExtrasSelected(list=>list.includes(module.slug)?list.filter(x=>x!==module.slug):[...list,module.slug])}/><span><strong>{module.name}</strong><small>+{module.price.toLocaleString("ru-RU")} ₽ · <Link href={`/modules/${module.slug}`}>подробнее</Link></small></span></label>)}</div><div className="optionalServices"><header><span>ДОПОЛНИТЕЛЬНЫЕ УСЛУГИ</span><Link href="/services">Все услуги →</Link></header>{publicServices.map(service=><label key={service.slug}><input type="checkbox" checked={servicesSelected.includes(service.slug)} onChange={()=>setServicesSelected(list=>list.includes(service.slug)?list.filter(x=>x!==service.slug):[...list,service.slug])}/><span><strong>{service.name}</strong><small>+{service.price.toLocaleString("ru-RU")} ₽ / {service.unit}</small></span></label>)}</div></div>
          <aside><small>ВАША СБОРКА</small><h3>BYPCMS {selectedEdition.name}</h3><p>{selectedEdition.modules.map(key=>publicModules.find(module=>module.slug===key)?.name).concat(extrasSelected.map(key=>publicModules.find(module=>module.slug===key)?.name)).filter(Boolean).join(" · ")}</p>{servicesSelected.length>0&&<p>Услуги: {servicesSelected.map(key=>publicServices.find(service=>service.slug===key)?.name).join(" · ")}</p>}<strong>{total.toLocaleString("ru-RU")} ₽</strong><Link href={`/order?edition=${selectedEdition.name}&term=${term}&modules=${extrasSelected.join(",")}&services=${servicesSelected.join(",")}`}>Оформить заказ →</Link></aside>
        </div>
      </div></section>

      <section className="publicModuleCatalog shell"><div className="sectionIntro"><p className="sectionLabel">03 / МОДУЛИ</p><h2>Каждая возможность<br/>описана подробно.</h2></div><div>{publicModules.map(module=><Link href={`/modules/${module.slug}`} key={module.slug}><small>{module.category}</small><h3>{module.name}</h3><p>{module.lead}</p><span>{module.price?`${module.price.toLocaleString("ru-RU")} ₽`:"Включён"} →</span></Link>)}</div></section>

      <section className="architecture shell" id="services">
        <div className="architectureCopy"><p className="sectionLabel">04 / УСЛУГИ</p><h2>Проект под ключ<br />на одной платформе.</h2><p>Помимо лицензии можно заказать прототипирование, уникальный UX/UI, адаптивный frontend, интеграции, перенос данных, запуск и сопровождение.</p><Link className="primaryButton dark" href="/services">Смотреть все услуги <span>→</span></Link></div>
        <div className="layerStack">
          <div className="layer projectLayer"><span>04</span><div><strong>Разработка и запуск</strong><small>Frontend · интеграции · перенос · обучение</small></div><b>Под ключ</b></div>
          <div className="layer moduleLayer"><span>03</span><div><strong>Индивидуальный дизайн</strong><small>UX-исследование · UI-kit · адаптивный шаблон</small></div><b>Уникально</b></div>
          <div className="layer moduleLayer"><span>02</span><div><strong>Модули</strong><small>Каталог · продажи · CRM · аналитика</small></div><b>На выбор</b></div>
          <div className="layer coreLayer"><span>01</span><div><strong>BYPCMS Core</strong><small>Управление · API · обновления · лицензия</small></div><b>Основа</b></div>
        </div>
      </section>

      <section className="cta"><div className="shell ctaInner"><div><span className="ctaMark">B</span><p className="sectionLabel">ВАШ НОВЫЙ ВЕБ-ПРОЕКТ</p><h2>Соберём систему,<br />которая подходит именно вам.</h2></div><a className="ctaButton" href={DEMO_URL}>Открыть демо <span>↗</span></a></div></section>
      <PublicFooter /><BackToTop />
    </main>
  );
}
