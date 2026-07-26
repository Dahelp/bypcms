"use client";

import { useState } from "react";
import Link from "next/link";
import "./admin.css";

const navItems = [
  ["⌂", "Обзор"],
  ["▤", "Контент"],
  ["◇", "Модули"],
  ["⌁", "Автоматизация"],
  ["◎", "Аналитика"],
];

const projects = [
  { name: "Мануфактура", type: "Business", status: "production", health: 98 },
  { name: "Nord Market", type: "Commerce", status: "staging", health: 91 },
  { name: "Insight Journal", type: "Content", status: "development", health: 100 },
];

export default function AdminPage() {
  const [active, setActive] = useState("Обзор");
  const [project, setProject] = useState(projects[0]);
  const [commandOpen, setCommandOpen] = useState(false);
  const [notice, setNotice] = useState("Все системы работают штатно");

  function runUpdate() {
    setNotice("Проверка совместимости завершена — обновление безопасно");
  }

  return (
    <main className="adminApp">
      <aside className="adminSidebar">
        <Link className="adminBrand" href="/">
          <span>B</span><strong>BYPCMS</strong>
        </Link>
        <nav aria-label="Разделы панели">
          {navItems.map(([icon, label]) => (
            <button
              type="button"
              key={label}
              className={active === label ? "active" : ""}
              onClick={() => setActive(label)}
              title={label}
            >
              <i>{icon}</i><span>{label}</span>
            </button>
          ))}
        </nav>
        <div className="sideBottom">
          <button type="button"><i>?</i><span>Поддержка</span></button>
          <button type="button"><i>⚙</i><span>Настройки</span></button>
          <div className="sideUser">
            <span>ДА</span>
            <div><strong>Дмитрий</strong><small>Владелец</small></div>
            <b>•••</b>
          </div>
        </div>
      </aside>

      <section className="adminMain">
        <header className="adminTopbar">
          <div className="projectSwitcher">
            <span className="projectIcon">{project.name.charAt(0)}</span>
            <button type="button" onClick={() => {
              const index = (projects.indexOf(project) + 1) % projects.length;
              setProject(projects[index]);
            }}>
              <strong>{project.name}</strong>
              <small>{project.type} · нажмите для смены</small>
            </button>
          </div>
          <div className="topActions">
            <button className="commandButton" type="button" onClick={() => setCommandOpen(true)}>
              Быстрый поиск <kbd>⌘ K</kbd>
            </button>
            <button type="button" aria-label="Уведомления" className="iconButton">♢<i /></button>
            <a href="/" target="_blank" className="siteButton">Открыть сайт ↗</a>
          </div>
        </header>

        <div className="adminContent">
          <div className="welcomeRow">
            <div>
              <p>ПОНЕДЕЛЬ, 27 ИЮЛЯ</p>
              <h1>{active === "Обзор" ? "Доброе утро, Дмитрий." : active}</h1>
              <span>{notice}</span>
            </div>
            <button type="button" className="createButton" onClick={() => setNotice("Черновик новой страницы создан")}>＋ Создать</button>
          </div>

          <div className="healthStrip">
            <div className="healthScore">
              <div style={{ "--score": `${project.health * 3.6}deg` } as React.CSSProperties}>
                <span>{project.health}</span>
              </div>
              <p><strong>Здоровье проекта</strong><small>Отличное состояние</small></p>
            </div>
            <div><small>Версия ядра</small><strong>2.0.0</strong><span className="successDot">актуальна</span></div>
            <div><small>Окружение</small><strong>{project.status}</strong><span>EU · 42 ms</span></div>
            <div><small>Последний бэкап</small><strong>Сегодня, 04:10</strong><span>1.2 GB · успешно</span></div>
            <button type="button" onClick={runUpdate}>Проверить систему →</button>
          </div>

          <div className="dashboardGrid">
            <article className="analyticsPanel">
              <div className="panelHeading">
                <div><p>ПОКАЗАТЕЛИ</p><h2>Активность сайта</h2></div>
                <select aria-label="Период">
                  <option>30 дней</option><option>7 дней</option><option>Год</option>
                </select>
              </div>
              <div className="bigMetrics">
                <div><small>Посетители</small><strong>24 892</strong><span>↑ 18.4%</span></div>
                <div><small>Целевые действия</small><strong>1 248</strong><span>↑ 7.2%</span></div>
                <div><small>Конверсия</small><strong>5.01%</strong><span>↑ 1.6%</span></div>
              </div>
              <div className="adminChart">
                <div className="chartScale"><span>3K</span><span>2K</span><span>1K</span><span>0</span></div>
                <div className="chartPlot">
                  <i className="gridLine one" /><i className="gridLine two" /><i className="gridLine three" />
                  <div className="areaShape" />
                  {[22, 38, 31, 50, 44, 61, 58, 75, 67, 83, 72, 90].map((value, index) => (
                    <b key={index} style={{ left: `${index * 9}%`, bottom: `${value}%` }} />
                  ))}
                </div>
              </div>
              <div className="chartDates"><span>1 июл</span><span>8 июл</span><span>15 июл</span><span>22 июл</span><span>27 июл</span></div>
            </article>

            <article className="licensePanel">
              <div className="panelHeading">
                <div><p>ЛИЦЕНЗИЯ</p><h2>BYPCMS Business</h2></div>
                <span className="activeBadge">Активна</span>
              </div>
              <div className="licenseVisual">
                <div className="licenseOrb"><span>B</span></div>
                <i /><i /><i />
              </div>
              <div className="licenseMeta">
                <div><small>Домен</small><strong>manufactura.ru</strong></div>
                <div><small>Действует до</small><strong>14 июня 2027</strong></div>
              </div>
              <button type="button" onClick={() => setNotice("Раздел управления лицензией открыт")}>Управление лицензией →</button>
            </article>

            <article className="contentPanel">
              <div className="panelHeading">
                <div><p>КОНТЕНТ</p><h2>Требует внимания</h2></div>
                <button type="button">Все материалы ↗</button>
              </div>
              <div className="contentRows">
                <div><span className="fileType violet">A</span><div><strong>Новая коллекция осень—зима</strong><small>Черновик · обновлено 12 мин назад</small></div><b>Продолжить →</b></div>
                <div><span className="fileType green">P</span><div><strong>О компании</strong><small>Изменения ожидают публикации</small></div><b>Проверить →</b></div>
                <div><span className="fileType blue">M</span><div><strong>12 изображений без alt</strong><small>Рекомендация SEO-модуля</small></div><b>Исправить →</b></div>
              </div>
            </article>

            <article className="modulePanel">
              <div className="panelHeading">
                <div><p>МОДУЛИ</p><h2>Состояние системы</h2></div>
                <button type="button">Каталог ↗</button>
              </div>
              <div className="moduleStatus">
                <div className="moduleCount"><strong>12</strong><span>активных<br />модулей</span></div>
                <div className="moduleDots">
                  {Array.from({ length: 12 }).map((_, index) => <i key={index} className={index === 10 ? "update" : ""} />)}
                </div>
              </div>
              <div className="updateRow"><span>↻</span><div><strong>Доступно 1 обновление</strong><small>SEO Toolkit 3.4.1 · совместимо</small></div><button type="button" onClick={runUpdate}>Обновить</button></div>
            </article>
          </div>

          <footer className="adminFooter">
            <span>BYPCMS Core 2.0.0</span>
            <i />
            <span>API: работает</span>
            <span>Последняя синхронизация: только что</span>
          </footer>
        </div>
      </section>

      {commandOpen && (
        <div className="commandOverlay" role="dialog" aria-modal="true" aria-label="Быстрый поиск" onMouseDown={() => setCommandOpen(false)}>
          <div className="commandPalette" onMouseDown={(event) => event.stopPropagation()}>
            <div className="commandInput"><span>⌕</span><input autoFocus placeholder="Найдите страницу, модуль или действие…" /><kbd>ESC</kbd></div>
            <p>БЫСТРЫЕ ДЕЙСТВИЯ</p>
            {["Создать страницу", "Открыть каталог модулей", "Проверить обновления", "Настроить лицензию"].map((item, index) => (
              <button type="button" key={item} onClick={() => { setNotice(`${item}: готово`); setCommandOpen(false); }}>
                <span>{["＋", "◇", "↻", "⌘"][index]}</span>{item}<kbd>↵</kbd>
              </button>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
