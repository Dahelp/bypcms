"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { publicModules } from "../modules/data";
import "./demo.css";

type EditionKey = "content" | "business" | "commerce";
type SectionKey = "overview" | "content" | "modules" | "design" | "settings";
type PageItem = { id: number; title: string; slug: string; status: "Опубликовано" | "Черновик"; template: string; updated: string };
type Product = { id: number; name: string; sku: string; price: number; stock: number; active: boolean };
type Lead = { id: number; name: string; source: string; status: string; value: number };
type Order = { id: string; customer: string; total: number; status: string; payment: string };
type DemoSettings = { siteName: string; domain: string; email: string; timezone: string; notifications: boolean; maintenance: boolean };
type ThemeState = { theme: string; accent: string; radius: number; density: "comfortable" | "compact" };
type Dialog = null | { type: "page"; item?: PageItem } | { type: "product"; item?: Product } | { type: "lead"; item?: Lead } | { type: "module"; key: string };

const editions: Record<EditionKey, { name: string; project: string; note: string; modules: string[]; accent: string }> = {
  content: { name: "Content", project: "Media Atlas", note: "Блог, медиа и база знаний", modules: ["content", "seo", "analytics"], accent: "#7057e8" },
  business: { name: "Business", project: "Northline Studio", note: "Компания, услуги и CRM", modules: ["content", "seo", "forms", "analytics"], accent: "#557a25" },
  commerce: { name: "Commerce", project: "Forma Store", note: "Каталог, заказы и платежи", modules: ["content", "seo", "forms", "commerce", "payments", "analytics"], accent: "#c65b2d" },
};

const initialPages: Record<EditionKey, PageItem[]> = {
  content: [
    { id: 1, title: "Главная", slug: "/", status: "Опубликовано", template: "Главная медиа", updated: "Сегодня, 10:24" },
    { id: 2, title: "Журнал", slug: "/journal", status: "Опубликовано", template: "Лента публикаций", updated: "Сегодня, 09:40" },
    { id: 3, title: "База знаний", slug: "/knowledge", status: "Опубликовано", template: "Документация", updated: "Вчера, 18:10" },
    { id: 4, title: "Большой материал", slug: "/journal/new-platform", status: "Черновик", template: "Статья", updated: "Вчера, 14:42" },
  ],
  business: [
    { id: 11, title: "Главная", slug: "/", status: "Опубликовано", template: "Корпоративная", updated: "Сегодня, 10:24" },
    { id: 12, title: "Услуги", slug: "/services", status: "Опубликовано", template: "Каталог услуг", updated: "Сегодня, 09:12" },
    { id: 13, title: "Кейсы", slug: "/projects", status: "Опубликовано", template: "Портфолио", updated: "Вчера, 18:10" },
    { id: 14, title: "Новая услуга", slug: "/services/audit", status: "Черновик", template: "Лендинг", updated: "Вчера, 14:42" },
  ],
  commerce: [
    { id: 21, title: "Главная", slug: "/", status: "Опубликовано", template: "Витрина", updated: "Сегодня, 10:24" },
    { id: 22, title: "Каталог", slug: "/catalog", status: "Опубликовано", template: "Каталог", updated: "Сегодня, 09:12" },
    { id: 23, title: "Доставка и оплата", slug: "/delivery", status: "Опубликовано", template: "Информация", updated: "Вчера, 18:10" },
    { id: 24, title: "Новая коллекция", slug: "/collection/new", status: "Черновик", template: "Коллекция", updated: "Вчера, 14:42" },
  ],
};

const initialProducts: Product[] = [
  { id: 1, name: "Кресло Forma 01", sku: "FRM-001", price: 42900, stock: 12, active: true },
  { id: 2, name: "Стол Line 140", sku: "LIN-140", price: 36500, stock: 7, active: true },
  { id: 3, name: "Светильник Arc", sku: "ARC-220", price: 12900, stock: 0, active: false },
];
const initialLeads: Lead[] = [
  { id: 1, name: "Анна Смирнова", source: "Расчёт проекта", status: "Новая", value: 149000 },
  { id: 2, name: "ООО «Вектор»", source: "Форма услуг", status: "В работе", value: 280000 },
  { id: 3, name: "Илья Орлов", source: "Обратный звонок", status: "Согласовано", value: 65000 },
];
const initialOrders: Order[] = [
  { id: "#1051", customer: "Мария К.", total: 55800, status: "Новый", payment: "Ожидает" },
  { id: "#1050", customer: "Studio 17", total: 92400, status: "Комплектуется", payment: "Оплачен" },
  { id: "#1049", customer: "Дмитрий П.", total: 42900, status: "Передан в доставку", payment: "Оплачен" },
];

const moduleVersions: Record<string, string> = { content: "2.1.0", seo: "1.8.2", forms: "1.4.0", commerce: "2.0.1", payments: "1.3.0", analytics: "1.2.4" };
const navItems: [SectionKey, string, string][] = [["overview", "⌂", "Обзор"], ["content", "▤", "Контент"], ["modules", "◇", "Модули"], ["design", "◫", "Дизайн"], ["settings", "⚙", "Настройки"]];

export default function Demo() {
  const [logged, setLogged] = useState(false);
  const [edition, setEdition] = useState<EditionKey>("business");
  const [section, setSection] = useState<SectionKey>("overview");
  const [selectedModule, setSelectedModule] = useState("forms");
  const [pages, setPages] = useState(initialPages);
  const [products, setProducts] = useState(initialProducts);
  const [leads, setLeads] = useState(initialLeads);
  const [orders, setOrders] = useState(initialOrders);
  const [settings, setSettings] = useState<DemoSettings>({ siteName: "Northline Studio", domain: "demo.bypcms.ru", email: "manager@example.ru", timezone: "Europe/Moscow", notifications: true, maintenance: false });
  const [theme, setTheme] = useState<ThemeState>({ theme: "Studio", accent: "#725ee0", radius: 12, density: "comfortable" });
  const [dialog, setDialog] = useState<Dialog>(null);
  const [notice, setNotice] = useState("");
  const [seoScore, setSeoScore] = useState(94);
  const [goalEnabled, setGoalEnabled] = useState(true);

  useEffect(() => {
    const raw = sessionStorage.getItem("bypcms_demo_state_v3");
    if (!raw) return;
    try {
      const saved = JSON.parse(raw);
      if (saved.pages) setPages(saved.pages);
      if (saved.products) setProducts(saved.products);
      if (saved.leads) setLeads(saved.leads);
      if (saved.orders) setOrders(saved.orders);
      if (saved.settings) setSettings(saved.settings);
      if (saved.theme) setTheme(saved.theme);
    } catch { sessionStorage.removeItem("bypcms_demo_state_v3"); }
  }, []);

  useEffect(() => {
    sessionStorage.setItem("bypcms_demo_state_v3", JSON.stringify({ pages, products, leads, orders, settings, theme }));
  }, [pages, products, leads, orders, settings, theme]);

  const current = editions[edition];
  const currentPages = pages[edition];
  const installedModules = current.modules;
  const availableModules = publicModules.filter(module => installedModules.includes(module.slug));
  const selectedModuleSafe = installedModules.includes(selectedModule) ? selectedModule : installedModules[0];
  const publishedCount = currentPages.filter(page => page.status === "Опубликовано").length;
  const metrics = useMemo(() => {
    if (edition === "content") return [["32", "Материалы", "+4 за неделю"], ["184 600", "Просмотры", "+18,4%"], ["7:42", "Время чтения", "+12%"], [String(publishedCount), "Страницы", "1 черновик"]];
    if (edition === "commerce") return [["148", "Заказы", "+12,8%"], ["684 200 ₽", "Выручка", "+18,4%"], ["3,82%", "Конверсия", "+0,7%"], [String(products.length), "Товары", "1 без остатка"]];
    return [["87", "Обращения", "+7,2%"], ["494 000 ₽", "В работе", "+14,1%"], ["18", "Услуги", "3 направления"], [String(publishedCount), "Страницы", "1 черновик"]];
  }, [edition, products.length, publishedCount]);

  function changeEdition(next: EditionKey) {
    setEdition(next);
    setSelectedModule(editions[next].modules[0]);
    setSettings(value => ({ ...value, siteName: editions[next].project }));
    setTheme(value => ({ ...value, accent: editions[next].accent }));
    setNotice(`Открыта редакция BYPCMS ${editions[next].name}`);
  }
  function showNotice(message: string) {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 4200);
  }
  function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    if (data.get("login") === "demo" && data.get("password") === "demo") setLogged(true);
    else setNotice("Используйте логин demo и пароль demo");
  }
  function savePage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const existing = dialog?.type === "page" ? dialog.item : undefined;
    const item: PageItem = {
      id: existing?.id || Date.now(),
      title: String(data.get("title")),
      slug: String(data.get("slug")),
      template: String(data.get("template")),
      status: String(data.get("status")) as PageItem["status"],
      updated: "Только что",
    };
    setPages(value => ({ ...value, [edition]: existing ? value[edition].map(page => page.id === item.id ? item : page) : [item, ...value[edition]] }));
    setDialog(null);
    showNotice(existing ? "Изменения страницы сохранены в демо-сессии" : "Новая страница создана");
  }
  function saveProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const existing = dialog?.type === "product" ? dialog.item : undefined;
    const item: Product = { id: existing?.id || Date.now(), name: String(data.get("name")), sku: String(data.get("sku")), price: Number(data.get("price")), stock: Number(data.get("stock")), active: true };
    setProducts(value => existing ? value.map(product => product.id === item.id ? item : product) : [item, ...value]);
    setDialog(null); showNotice("Карточка товара сохранена");
  }
  function saveLead(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const existing = dialog?.type === "lead" ? dialog.item : undefined;
    const item: Lead = { id: existing?.id || Date.now(), name: String(data.get("name")), source: String(data.get("source")), status: String(data.get("status")), value: Number(data.get("value")) };
    setLeads(value => existing ? value.map(lead => lead.id === item.id ? item : lead) : [item, ...value]);
    setDialog(null); showNotice("Обращение сохранено");
  }
  function saveGeneral(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setSettings(value => ({ ...value, siteName: String(data.get("siteName")), domain: String(data.get("domain")), email: String(data.get("email")), timezone: String(data.get("timezone")) }));
    showNotice("Настройки проекта сохранены в демо-сессии");
  }

  if (!logged) return <main className="demoLogin">
    <section><Link href="/" className="demoBrand"><b>B</b> BYPCMS <span>DEMO</span></Link><div><small>ПОЛНОФУНКЦИОНАЛЬНАЯ ДЕМОНСТРАЦИЯ</small><h1>Три редакции.<br />Одна система.</h1><p>Переключайтесь между Content, Business и Commerce. Создавайте страницы и товары, обрабатывайте заявки, меняйте дизайн и настройки — всё хранится только в вашей сессии.</p><div className="loginEditions">{Object.entries(editions).map(([key, item]) => <span key={key}><b>{item.name}</b>{item.note}</span>)}</div></div></section>
    <form onSubmit={login}><small>ДОБРО ПОЖАЛОВАТЬ</small><h2>Войти в демо</h2><p>Внешние отправки и реальные платежи отключены. Остальные действия доступны для проверки продукта.</p><label>Логин<input name="login" defaultValue="demo" /></label><label>Пароль<input name="password" type="password" defaultValue="demo" /></label>{notice && <em>{notice}</em>}<button>Открыть все возможности →</button><Link href="/">← Вернуться на сайт</Link></form>
  </main>;

  const titles: Record<SectionKey, string> = { overview: "Обзор", content: "Контент", modules: "Рабочие модули", design: "Дизайн сайта", settings: "Настройки проекта" };
  return <main className={`demoApp density-${theme.density}`} style={{ "--demo-accent": theme.accent, "--demo-radius": `${theme.radius}px` } as React.CSSProperties}>
    <aside className="demoSidebar"><Link href="/" className="demoBrand"><b>B</b><span>BYPCMS</span><i>DEMO</i></Link><nav>{navItems.map(([id, icon, name]) => <button className={section === id ? "active" : ""} onClick={() => setSection(id)} key={id}><i>{icon}</i><span>{name}</span></button>)}</nav><div className="demoSafe"><b>✓ Безопасное демо</b><span>Все изменения — только в сессии</span></div><button className="demoExit" onClick={() => setLogged(false)}>Выйти из демо</button></aside>
    <section className="demoWorkspace"><header><div><span className="projectIcon">{current.project[0]}</span><p><b>{settings.siteName}</b><small>BYPCMS {current.name} · demo</small></p></div><div className="editionSwitcher">{(Object.keys(editions) as EditionKey[]).map(key => <button className={edition === key ? "active" : ""} onClick={() => changeEdition(key)} key={key}>{editions[key].name}</button>)}</div><span className="sessionBadge">● Изолированная сессия</span><Link href="/">BYPCMS.RU ↗</Link></header>
      <div className="demoContent"><div className="demoHeading"><div><small>ПАНЕЛЬ УПРАВЛЕНИЯ / {current.name.toUpperCase()}</small><h1>{titles[section]}</h1><p>{section === "modules" ? `Состав редакции: ${availableModules.map(module => module.name).join(" · ")}` : current.note}</p></div>{section === "content" && <button onClick={() => setDialog({ type: "page" })}>＋ Создать страницу</button>}{section === "modules" && edition === "commerce" && selectedModuleSafe === "commerce" && <button onClick={() => setDialog({ type: "product" })}>＋ Добавить товар</button>}{section === "modules" && selectedModuleSafe === "forms" && <button onClick={() => setDialog({ type: "lead" })}>＋ Добавить обращение</button>}</div>
      {notice && <div className="demoNotice">{notice}<button onClick={() => setNotice("")}>×</button></div>}
      {section === "overview" && <Overview edition={edition} metrics={metrics} modules={availableModules.map(module => module.name)} pages={publishedCount} orders={orders} leads={leads} onOpen={(target) => setSection(target)} />}
      {section === "content" && <ContentManager pages={currentPages} onEdit={(item) => setDialog({ type: "page", item })} onDuplicate={(item) => { setPages(value => ({ ...value, [edition]: [{ ...item, id: Date.now(), title: `${item.title} — копия`, status: "Черновик", updated: "Только что" }, ...value[edition]] })); showNotice("Создана копия страницы"); }} />}
      {section === "modules" && <div className="demoModuleWorkspace"><div className="demoModuleTabs">{availableModules.map(module => <button className={selectedModuleSafe === module.slug ? "active" : ""} onClick={() => setSelectedModule(module.slug)} key={module.slug}><span>{module.name}<i>В редакции</i></span><small>v{moduleVersions[module.slug]}</small></button>)}</div><ModuleWorkspace moduleKey={selectedModuleSafe} pages={currentPages} products={products} setProducts={setProducts} leads={leads} setLeads={setLeads} orders={orders} setOrders={setOrders} seoScore={seoScore} setSeoScore={setSeoScore} goalEnabled={goalEnabled} setGoalEnabled={setGoalEnabled} onAction={showNotice} onEditProduct={(item) => setDialog({ type: "product", item })} onEditLead={(item) => setDialog({ type: "lead", item })} onSettings={(key) => setDialog({ type: "module", key })} /></div>}
      {section === "design" && <DesignWorkspace theme={theme} setTheme={setTheme} edition={edition} onAction={showNotice} />}
      {section === "settings" && <SettingsWorkspace settings={settings} setSettings={setSettings} onSubmit={saveGeneral} onAction={showNotice} />}
      </div>
    </section>
    {dialog?.type === "page" && <PageDialog item={dialog.item} onSubmit={savePage} onClose={() => setDialog(null)} />}
    {dialog?.type === "product" && <ProductDialog item={dialog.item} onSubmit={saveProduct} onClose={() => setDialog(null)} />}
    {dialog?.type === "lead" && <LeadDialog item={dialog.item} onSubmit={saveLead} onClose={() => setDialog(null)} />}
    {dialog?.type === "module" && <ModuleInfoDialog moduleKey={dialog.key} onClose={() => setDialog(null)} onSave={() => { setDialog(null); showNotice("Настройки модуля сохранены"); }} />}
  </main>;
}

function Overview({ edition, metrics, modules, pages, orders, leads, onOpen }: { edition: EditionKey; metrics: string[][]; modules: string[]; pages: number; orders: Order[]; leads: Lead[]; onOpen: (section: SectionKey) => void }) {
  const activity = edition === "commerce" ? orders.map(item => `${item.id} · ${item.status}`) : edition === "business" ? leads.map(item => `${item.name} · ${item.status}`) : ["Опубликована статья «Новая платформа»", "Обновлена база знаний", "SEO-оценка выросла до 94"];
  return <><div className="editionSummary"><div><small>ТЕКУЩАЯ РЕДАКЦИЯ</small><h2>BYPCMS {editions[edition].name}</h2><p>{editions[edition].note}</p></div><div><small>В СОСТАВЕ</small><p>{modules.map(name => <span key={name}>✓ {name}</span>)}</p></div><button onClick={() => onOpen("modules")}>Посмотреть модули →</button></div><div className="demoMetrics">{metrics.map(item => <article key={item[1]}><small>{item[1]}</small><strong>{item[0]}</strong><span>{item[2]}</span></article>)}</div><div className="demoGrid"><article className="demoChart"><header><div><small>ДИНАМИКА</small><h2>{edition === "commerce" ? "Продажи" : edition === "business" ? "Обращения" : "Аудитория"}</h2></div><b>Последние 30 дней</b></header><div>{[42, 55, 47, 63, 58, 78, 66, 83, 76, 93, 71, 88, 80, 98].map((value, index) => <i key={index} style={{ height: `${value}%` }} />)}</div></article><article className="demoActivity"><small>ПОСЛЕДНИЕ ДЕЙСТВИЯ</small><h2>История проекта</h2>{activity.slice(0, 4).map((item, index) => <p key={item}><i>{index + 1}</i><span>{item}<small>{index + 1} ч назад</small></span></p>)}<button className="textAction" onClick={() => onOpen(edition === "content" ? "content" : "modules")}>Открыть рабочий раздел →</button></article></div><div className="overviewHealth"><span>100</span><div><b>Система работает штатно</b><small>{pages} страниц опубликовано · резервная копия создана сегодня</small></div><strong>Core 2.1.0</strong></div></>;
}

function ContentManager({ pages, onEdit, onDuplicate }: { pages: PageItem[]; onEdit: (item: PageItem) => void; onDuplicate: (item: PageItem) => void }) {
  return <article className="demoTable contentManager"><header><div><small>СТРУКТУРА САЙТА</small><h2>Страницы и материалы</h2></div><span>{pages.length} записей</span></header><div className="tableHeader"><span>Название</span><span>Адрес и шаблон</span><span>Статус</span><span>Действия</span></div>{pages.map(page => <div className="tableRow" key={page.id}><div><b>{page.title}</b><small>{page.updated}</small></div><div><code>{page.slug}</code><small>{page.template}</small></div><em className={page.status === "Опубликовано" ? "published" : ""}>{page.status}</em><div className="rowActions"><button onClick={() => onEdit(page)}>Редактировать</button><button onClick={() => onDuplicate(page)}>Копия</button></div></div>)}</article>;
}

function ModuleWorkspace(props: { moduleKey: string; pages: PageItem[]; products: Product[]; setProducts: React.Dispatch<React.SetStateAction<Product[]>>; leads: Lead[]; setLeads: React.Dispatch<React.SetStateAction<Lead[]>>; orders: Order[]; setOrders: React.Dispatch<React.SetStateAction<Order[]>>; seoScore: number; setSeoScore: React.Dispatch<React.SetStateAction<number>>; goalEnabled: boolean; setGoalEnabled: React.Dispatch<React.SetStateAction<boolean>>; onAction: (message: string) => void; onEditProduct: (item: Product) => void; onEditLead: (item: Lead) => void; onSettings: (key: string) => void }) {
  const module = publicModules.find(item => item.slug === props.moduleKey) || publicModules[0];
  return <section className="workingModule"><header className="workingModuleHeader"><div><small>{module.category} / РАБОЧИЙ МОДУЛЬ</small><h2>{module.name}</h2><p>{module.lead}</p></div><button onClick={() => props.onSettings(module.slug)}>Настройки модуля</button></header><div className="moduleFeatureStrip">{module.features.map(([name]) => <span key={name}>✓ {name}</span>)}</div>
    {module.slug === "content" && <div className="moduleList"><header><b>Последние материалы</b><span>{props.pages.length} всего</span></header>{props.pages.slice(0, 4).map(page => <button onClick={() => props.onAction(`Открыт редактор «${page.title}»`)} key={page.id}><span>▤</span><div><b>{page.title}</b><small>{page.template} · {page.slug}</small></div><em>{page.status}</em></button>)}</div>}
    {module.slug === "seo" && <div className="seoWorkspace"><article><small>SEO-ОЦЕНКА</small><strong>{props.seoScore}<i>/100</i></strong><p>{props.seoScore >= 98 ? "Все критические рекомендации выполнены" : "Осталось улучшить несколько страниц"}</p><button onClick={() => { props.setSeoScore(100); props.onAction("SEO-аудит завершён: оценка 100/100"); }}>Запустить аудит</button></article><div className="checkList">{[["Метаданные страниц", "32 из 32 заполнено"], ["Sitemap.xml", "Обновлён 12 минут назад"], ["Редиректы", "3 правила активны"], ["Open Graph", "2 изображения требуют внимания"]].map(([name, result], index) => <button onClick={() => props.onAction(`Открыта настройка «${name}»`)} key={name}><i className={index === 3 ? "warn" : ""}>{index === 3 ? "!" : "✓"}</i><span><b>{name}</b><small>{result}</small></span><em>Настроить →</em></button>)}</div></div>}
    {module.slug === "forms" && <div className="crmBoard">{["Новая", "В работе", "Согласовано"].map(status => <section key={status}><header><b>{status}</b><span>{props.leads.filter(lead => lead.status === status).length}</span></header>{props.leads.filter(lead => lead.status === status).map(lead => <article key={lead.id}><small>{lead.source}</small><b>{lead.name}</b><strong>{lead.value.toLocaleString("ru-RU")} ₽</strong><div><button onClick={() => props.onEditLead(lead)}>Открыть</button>{status !== "Согласовано" && <button onClick={() => { const next = status === "Новая" ? "В работе" : "Согласовано"; props.setLeads(value => value.map(item => item.id === lead.id ? { ...item, status: next } : item)); props.onAction(`Заявка переведена в статус «${next}»`); }}>Далее →</button>}</div></article>)}</section>)}</div>}
    {module.slug === "commerce" && <div className="commerceWorkspace"><div className="stockSummary"><span><b>{props.products.length}</b> товаров</span><span><b>{props.products.reduce((sum, item) => sum + item.stock, 0)}</b> единиц на складе</span><span><b>{props.products.filter(item => item.stock === 0).length}</b> без остатка</span></div><div className="productTable">{props.products.map(product => <article key={product.id}><span className="productThumb">{product.name[0]}</span><div><b>{product.name}</b><small>{product.sku}</small></div><strong>{product.price.toLocaleString("ru-RU")} ₽</strong><em className={product.stock === 0 ? "empty" : ""}>{product.stock} шт.</em><button onClick={() => props.onEditProduct(product)}>Редактировать</button><label><input type="checkbox" checked={product.active} onChange={() => props.setProducts(value => value.map(item => item.id === product.id ? { ...item, active: !item.active } : item))} />Активен</label></article>)}</div></div>}
    {module.slug === "payments" && <div className="paymentsWorkspace"><div className="paymentMetrics"><span><small>УСПЕШНО</small><b>684 200 ₽</b></span><span><small>КОМИССИЯ</small><b>8 214 ₽</b></span><span><small>ВОЗВРАТЫ</small><b>5 900 ₽</b></span></div><div className="moduleList">{props.orders.map(order => <button key={order.id} onClick={() => props.onAction(`Открыта операция заказа ${order.id}`)}><span>₽</span><div><b>{order.id} · {order.customer}</b><small>{order.payment} · {order.status}</small></div><strong>{order.total.toLocaleString("ru-RU")} ₽</strong>{order.payment === "Оплачен" && <em onClick={(event) => { event.stopPropagation(); props.setOrders(value => value.map(item => item.id === order.id ? { ...item, payment: "Возврат" } : item)); props.onAction(`Оформлен демо-возврат по ${order.id}`); }}>Возврат</em>}</button>)}</div></div>}
    {module.slug === "analytics" && <div className="analyticsWorkspace"><div className="analyticsCards"><article><small>СОБЫТИЯ</small><b>24 892</b><span>+18,4%</span></article><article><small>ЦЕЛИ</small><b>1 248</b><span>+7,2%</span></article><article><small>КОНВЕРСИЯ</small><b>5,01%</b><span>+1,6%</span></article></div><div className="analyticsMain"><article><header><b>Воронка</b><button onClick={() => props.onAction("Отчёт экспортирован в демо-режиме")}>Экспорт CSV</button></header>{[["Посетители", 100, "24 892"], ["Просмотр предложения", 68, "16 926"], ["Отправка формы", 34, "8 463"], ["Целевое действие", 18, "4 481"]].map(([name, width, value]) => <p key={name}><span>{name}<b>{value}</b></span><i style={{ width: `${width}%` }} /></p>)}</article><aside><b>Цель «Отправка формы»</b><p>Событие фиксируется после успешной отправки.</p><label><input type="checkbox" checked={props.goalEnabled} onChange={() => props.setGoalEnabled(value => !value)} />Цель активна</label><button onClick={() => props.onAction("Тестовое событие зарегистрировано")}>Отправить тестовое событие</button></aside></div></div>}
  </section>;
}

function DesignWorkspace({ theme, setTheme, edition, onAction }: { theme: ThemeState; setTheme: React.Dispatch<React.SetStateAction<ThemeState>>; edition: EditionKey; onAction: (message: string) => void }) {
  const themes = ["Studio", "Editorial", "Commerce"];
  return <div className="designWorkspace"><section><small>01 / ШАБЛОН</small><h2>Выберите основу сайта</h2><div className="themeCards">{themes.map(name => <button className={theme.theme === name ? "active" : ""} onClick={() => { setTheme(value => ({ ...value, theme: name })); onAction(`Выбран шаблон ${name}`); }} key={name}><i className={`themePreview theme-${name.toLowerCase()}`}><span /><span /><span /></i><b>{name}</b><small>{name === "Commerce" ? "Витрина и каталог" : name === "Editorial" ? "Медиа и публикации" : "Компания и услуги"}</small></button>)}</div></section><section><small>02 / ДИЗАЙН-СИСТЕМА</small><h2>Цвет, форма и плотность</h2><div className="designControls"><label>Акцент<input type="color" value={theme.accent} onChange={event => setTheme(value => ({ ...value, accent: event.target.value }))} /></label><label>Скругление <b>{theme.radius}px</b><input type="range" min="0" max="24" value={theme.radius} onChange={event => setTheme(value => ({ ...value, radius: Number(event.target.value) }))} /></label><label>Плотность<select value={theme.density} onChange={event => setTheme(value => ({ ...value, density: event.target.value as ThemeState["density"] }))}><option value="comfortable">Комфортная</option><option value="compact">Компактная</option></select></label></div></section><aside className="sitePreview"><header><i>{editions[edition].project[0]}</i><b>{editions[edition].project}</b><span>Меню　Каталог　Контакты</span></header><main><small>{theme.theme.toUpperCase()} TEMPLATE</small><h2>{edition === "commerce" ? "Вещи для пространства." : edition === "content" ? "Истории, которые остаются." : "Создаём понятные продукты."}</h2><p>Живой предпросмотр фирменного стиля проекта.</p><button>Основное действие</button></main><footer><span>© {new Date().getFullYear()}</span><span>BYPCMS {editions[edition].name}</span></footer></aside></div>;
}

function SettingsWorkspace({ settings, setSettings, onSubmit, onAction }: { settings: DemoSettings; setSettings: React.Dispatch<React.SetStateAction<DemoSettings>>; onSubmit: (event: FormEvent<HTMLFormElement>) => void; onAction: (message: string) => void }) {
  return <div className="settingsWorkspace"><form onSubmit={onSubmit}><header><div><small>ОСНОВНЫЕ ДАННЫЕ</small><h2>Проект и домен</h2></div><button>Сохранить настройки</button></header><div className="settingsFields"><label>Название сайта<input name="siteName" defaultValue={settings.siteName} /></label><label>Домен<input name="domain" defaultValue={settings.domain} /></label><label>Email администратора<input name="email" type="email" defaultValue={settings.email} /></label><label>Часовой пояс<select name="timezone" defaultValue={settings.timezone}><option>Europe/Moscow</option><option>Europe/Minsk</option><option>Asia/Almaty</option></select></label></div></form><section className="settingsCards"><article><div><small>УВЕДОМЛЕНИЯ</small><h3>Email и события</h3><p>Заявки, заказы, системные сообщения.</p></div><label className="switch"><input type="checkbox" checked={settings.notifications} onChange={() => setSettings(value => ({ ...value, notifications: !value.notifications }))} /><span /></label><button onClick={() => onAction("Тестовое уведомление создано в демо-сессии")}>Проверить уведомление</button></article><article><div><small>РЕЖИМ САЙТА</small><h3>Технические работы</h3><p>Временно закрывает публичную часть сайта.</p></div><label className="switch"><input type="checkbox" checked={settings.maintenance} onChange={() => setSettings(value => ({ ...value, maintenance: !value.maintenance }))} /><span /></label><button onClick={() => onAction(settings.maintenance ? "Предпросмотр страницы обслуживания открыт" : "Включите режим технических работ")}>Предпросмотр</button></article><article><div><small>ПОЛЬЗОВАТЕЛИ</small><h3>3 активных аккаунта</h3><p>Владелец, редактор и менеджер продаж.</p></div><button onClick={() => onAction("Приглашение пользователя создано в демо-режиме")}>＋ Пригласить пользователя</button></article><article><div><small>ИНТЕГРАЦИИ</small><h3>API и вебхуки</h3><p>ЮKassa, Telegram, CRM и внешний API.</p></div><button onClick={() => onAction("Открыт безопасный просмотр интеграций")}>Управлять интеграциями</button></article></section><section className="securityPanel"><span>✓</span><div><b>Демо защищено</b><p>Внешние запросы, реальные письма, платежи и изменение системных файлов отключены.</p></div><button onClick={() => { sessionStorage.removeItem("bypcms_demo_state_v3"); window.location.reload(); }}>Сбросить демо-данные</button></section></div>;
}

function PageDialog({ item, onSubmit, onClose }: { item?: PageItem; onSubmit: (event: FormEvent<HTMLFormElement>) => void; onClose: () => void }) {
  return <div className="demoModal" onMouseDown={onClose}><form onSubmit={onSubmit} onMouseDown={event => event.stopPropagation()}><header><div><small>РЕДАКТОР КОНТЕНТА</small><h2>{item ? "Редактировать страницу" : "Создать страницу"}</h2></div><button type="button" onClick={onClose}>×</button></header><label>Название<input name="title" required defaultValue={item?.title} placeholder="Например, Наши услуги" /></label><label>Адрес страницы<input name="slug" required defaultValue={item?.slug} placeholder="/services" pattern="[/a-z0-9-]+" /></label><label>Шаблон<select name="template" defaultValue={item?.template || "Стандартная"}><option>Стандартная</option><option>Лендинг</option><option>Каталог</option><option>Статья</option><option>База знаний</option></select></label><label>Статус<select name="status" defaultValue={item?.status || "Черновик"}><option>Черновик</option><option>Опубликовано</option></select></label><p>Изменение сохраняется только в текущей демо-сессии.</p><button>{item ? "Сохранить изменения" : "Создать страницу"}</button></form></div>;
}
function ProductDialog({ item, onSubmit, onClose }: { item?: Product; onSubmit: (event: FormEvent<HTMLFormElement>) => void; onClose: () => void }) {
  return <div className="demoModal" onMouseDown={onClose}><form onSubmit={onSubmit} onMouseDown={event => event.stopPropagation()}><header><div><small>COMMERCE</small><h2>{item ? "Карточка товара" : "Новый товар"}</h2></div><button type="button" onClick={onClose}>×</button></header><label>Название<input name="name" required defaultValue={item?.name} /></label><label>Артикул<input name="sku" required defaultValue={item?.sku} /></label><label>Цена<input name="price" required type="number" defaultValue={item?.price} /></label><label>Остаток<input name="stock" required type="number" defaultValue={item?.stock} /></label><button>Сохранить товар</button></form></div>;
}
function LeadDialog({ item, onSubmit, onClose }: { item?: Lead; onSubmit: (event: FormEvent<HTMLFormElement>) => void; onClose: () => void }) {
  return <div className="demoModal" onMouseDown={onClose}><form onSubmit={onSubmit} onMouseDown={event => event.stopPropagation()}><header><div><small>ФОРМЫ И CRM</small><h2>{item ? "Карточка обращения" : "Новое обращение"}</h2></div><button type="button" onClick={onClose}>×</button></header><label>Клиент<input name="name" required defaultValue={item?.name} /></label><label>Источник<input name="source" required defaultValue={item?.source || "Ручное добавление"} /></label><label>Статус<select name="status" defaultValue={item?.status || "Новая"}><option>Новая</option><option>В работе</option><option>Согласовано</option></select></label><label>Сумма сделки<input name="value" type="number" defaultValue={item?.value || 0} /></label><button>Сохранить обращение</button></form></div>;
}
function ModuleInfoDialog({ moduleKey, onClose, onSave }: { moduleKey: string; onClose: () => void; onSave: () => void }) {
  const module = publicModules.find(item => item.slug === moduleKey) || publicModules[0];
  return <div className="demoModal" onMouseDown={onClose}><form onSubmit={event => { event.preventDefault(); onSave(); }} onMouseDown={event => event.stopPropagation()}><header><div><small>СОСТАВ ПЛАГИНА</small><h2>{module.name}</h2></div><button type="button" onClick={onClose}>×</button></header><p className="moduleDialogLead">{module.lead}</p><div className="moduleCapabilities">{module.features.map(([name, description]) => <article key={name}><b>✓ {name}</b><span>{description}</span></article>)}</div><label>Уведомления<select><option>Включены</option><option>Только критические</option><option>Отключены</option></select></label><label>Доступ менеджеров<select><option>Просмотр и изменение</option><option>Только просмотр</option></select></label><button>Сохранить настройки модуля</button></form></div>;
}
