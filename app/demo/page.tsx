"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { defaultInstalledModules, DemoEntity, DemoModule, EditionKey, EntityKind, editions, entityTitles, mediaItems, moduleRegistry, seedEntities } from "./demo-data";
import "./demo.css";

type ThemeState = { template: string; accent: string; background: string; font: string; radius: number; header: string; container: number };
type SettingsState = { siteName: string; domain: string; email: string; phone: string; address: string; language: string; timezone: string; notifications: boolean; maintenance: boolean };
type EditorTab = "content" | "seo" | "settings" | `module:${string}`;

const initialTheme: ThemeState = { template: "Editorial", accent: "#557a25", background: "#f3f3ef", font: "Inter", radius: 12, header: "Светлая", container: 1280 };
const initialSettings: SettingsState = { siteName: "Northline Studio", domain: "demo.bypcms.ru", email: "hello@northline.demo", phone: "+7 495 100-20-30", address: "Москва, ул. Тверская, 12", language: "Русский", timezone: "Europe/Moscow", notifications: true, maintenance: false };

export default function DemoPage() {
  const [logged, setLogged] = useState(false);
  const [edition, setEdition] = useState<EditionKey>("business");
  const [view, setView] = useState("overview");
  const [entities, setEntities] = useState<DemoEntity[]>(seedEntities);
  const [editing, setEditing] = useState<DemoEntity | null>(null);
  const [editorTab, setEditorTab] = useState<EditorTab>("content");
  const [preview, setPreview] = useState<DemoEntity | null>(null);
  const [theme, setTheme] = useState(initialTheme);
  const [settings, setSettings] = useState(initialSettings);
  const [installedModules, setInstalledModules] = useState<Record<EditionKey, string[]>>(defaultInstalledModules);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const raw = sessionStorage.getItem("bypcms-real-demo-v1");
    if (!raw) return;
    try {
      const saved = JSON.parse(raw);
      if (saved.entities) setEntities(saved.entities);
      if (saved.theme) setTheme(saved.theme);
      if (saved.settings) setSettings(saved.settings);
      if (saved.installedModules) setInstalledModules(saved.installedModules);
    } catch { sessionStorage.removeItem("bypcms-real-demo-v1"); }
  }, []);
  useEffect(() => {
    sessionStorage.setItem("bypcms-real-demo-v1", JSON.stringify({ entities, theme, settings, installedModules }));
  }, [entities, theme, settings, installedModules]);

  const current = editions[edition];
  const activeModules = installedModules[edition];
  const currentMenu = useMemo(() => {
    const base = current.menu.filter(item => !item.moduleKey || activeModules.includes(item.moduleKey));
    const injected = moduleRegistry.filter(module => activeModules.includes(module.key) && module.menu && !base.some(item => item.id === module.menu?.id)).map(module => module.menu!);
    const systemIndex = base.findIndex(item => item.id === "media");
    return systemIndex < 0 ? [...base, ...injected] : [...base.slice(0, systemIndex), ...injected, ...base.slice(systemIndex)];
  }, [current, activeModules]);
  const menuItem = currentMenu.find(item => item.id === view);
  const currentKind = menuItem?.kind;

  function flash(message: string) {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 3500);
  }
  function switchEdition(next: EditionKey) {
    setEdition(next);
    setView("overview");
    setEditing(null);
    setSettings(value => ({ ...value, siteName: editions[next].project }));
    setTheme(value => ({ ...value, accent: editions[next].accent, template: next === "commerce" ? "Commerce" : next === "content" ? "Editorial" : "Studio" }));
    flash(`Открыта полноценная редакция BYPCMS ${editions[next].name}`);
  }
  function startCreate(kind: EntityKind) {
    const meta = entityTitles[kind];
    setEditing({
      id: Date.now(), kind, title: "", slug: "/", status: kind === "leads" || kind === "orders" ? "Новый" : "Черновик",
      updated: "Только что", image: kind === "products" ? 2 : 0, excerpt: "", body: "", seoTitle: "", seoDescription: "",
      price: kind === "products" || kind === "services" ? 0 : undefined, stock: kind === "products" ? 0 : undefined,
      sku: kind === "products" ? "" : undefined, value: ["leads", "orders", "payments"].includes(kind) ? 0 : undefined,
      extra: `Новый ${meta.singular}`,
    });
    setEditorTab("content");
  }
  function saveEntity(item: DemoEntity) {
    setEntities(value => value.some(entry => entry.id === item.id) ? value.map(entry => entry.id === item.id ? { ...item, updated: "Только что" } : entry) : [{ ...item, updated: "Только что" }, ...value]);
    setEditing(null);
    flash("Изменения сохранены в демо-сессии");
  }
  function deleteEntity(item: DemoEntity) {
    setEntities(value => value.filter(entry => entry.id !== item.id));
    setEditing(null);
    flash(`«${item.title || "Новая запись"}» удалена`);
  }

  if (!logged) return <Login onLogin={() => setLogged(true)} notice={notice} flash={flash} />;

  return <main className="realDemo" style={{ "--demo-accent": theme.accent, "--demo-radius": `${theme.radius}px` } as React.CSSProperties}>
    <aside className="realSidebar">
      <Link href="/" className="demoBrand"><b>B</b><span>BYPCMS</span><i>{current.name}</i></Link>
      <ProjectBadge edition={edition} project={settings.siteName} />
      <nav>{currentMenu.map((item, index) => {
        const showGroup = item.group && currentMenu[index - 1]?.group !== item.group;
        return <div key={item.id}>{showGroup && <small>{item.group}</small>}<button className={view === item.id ? "active" : ""} onClick={() => { setView(item.id); setEditing(null); }}><i>{item.icon}</i><span>{item.label}</span>{item.badge && <em>{item.badge}</em>}</button></div>;
      })}</nav>
      <div className="demoSafety"><b>● Демо-сессия</b><span>Данные изолированы и не отправляются наружу</span></div>
      <button className="demoLogout" onClick={() => setLogged(false)}>Выйти из демо</button>
    </aside>
    <section className="realWorkspace">
      <header className="realTopbar">
        <div className="editionTabs">{(Object.keys(editions) as EditionKey[]).map(key => <button className={edition === key ? "active" : ""} onClick={() => switchEdition(key)} key={key}>{editions[key].name}<small>{editions[key].note}</small></button>)}</div>
        <button className="topSearch">⌕ <span>Поиск по панели</span><kbd>⌘ K</kbd></button>
        <button className="topIcon" onClick={() => flash("Новых уведомлений нет")}>♢</button>
        <Link href="/" className="openSite">Открыть сайт ↗</Link>
      </header>
      <div className="realContent">
        {notice && <div className="demoNotice">{notice}<button onClick={() => setNotice("")}>×</button></div>}
        {view === "overview" && <Dashboard edition={edition} entities={entities} modules={moduleRegistry.filter(module => activeModules.includes(module.key))} onNavigate={setView} />}
        {currentKind && !editing && <EntityList kind={currentKind} entities={entities.filter(item => item.kind === currentKind)} onEdit={item => { setEditing(item); setEditorTab("content"); }} onCreate={() => startCreate(currentKind)} onPreview={setPreview} />}
        {currentKind && editing && <EntityEditor key={editing.id} entity={editing} tab={editorTab} setTab={setEditorTab} entities={entities} installed={moduleRegistry.filter(module => activeModules.includes(module.key))} onSave={saveEntity} onDelete={deleteEntity} onCancel={() => setEditing(null)} onPreview={setPreview} flash={flash} />}
        {view === "media" && <MediaLibrary flash={flash} />}
        {view === "seo" && <SeoCenter entities={entities} onEdit={item => { setView(current.menu.some(menu => menu.kind === item.kind) ? item.kind : "pages"); setEditing(item); setEditorTab("seo"); }} flash={flash} />}
        {view === "analytics" && <Analytics edition={edition} flash={flash} />}
        {view === "design" && <DesignStudio edition={edition} theme={theme} setTheme={setTheme} settings={settings} flash={flash} />}
        {view === "extensions" && <ExtensionCenter edition={edition} installed={activeModules} setInstalled={keys => setInstalledModules(value => ({ ...value, [edition]: keys }))} flash={flash} />}
        {moduleRegistry.some(module => module.key === view && module.menu) && <InjectedModulePage module={moduleRegistry.find(module => module.key === view)!} flash={flash} />}
        {view === "settings" && <SettingsPanel settings={settings} setSettings={setSettings} modules={moduleRegistry.filter(module => activeModules.includes(module.key) && module.slots.includes("settings.section"))} flash={flash} />}
      </div>
    </section>
    {preview && <PublicPreview entity={preview} edition={edition} theme={theme} settings={settings} onClose={() => setPreview(null)} />}
  </main>;
}

function Login({ onLogin, notice, flash }: { onLogin: () => void; notice: string; flash: (message: string) => void }) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    if (data.get("login") === "demo" && data.get("password") === "demo") onLogin();
    else flash("Используйте логин demo и пароль demo");
  }
  return <main className="demoLogin realLogin"><section><Link href="/" className="demoBrand"><b>B</b> BYPCMS <span>DEMO</span></Link><div><small>ТРИ ПОЛНОЦЕННЫЕ АДМИН-ПАНЕЛИ</small><h1>Посмотрите,<br />как работает сайт.</h1><p>Не презентация функций, а настоящая панель покупателя. Управляйте материалами, услугами, заявками, товарами, заказами, SEO и дизайном.</p><div className="loginEditions">{Object.entries(editions).map(([key, item]) => <span key={key}><b>{item.name}</b>{item.note}<small>{item.menu.length} рабочих разделов</small></span>)}</div></div></section><form onSubmit={submit}><small>БЕЗОПАСНАЯ ДЕМО-СЕССИЯ</small><h2>Войти в панель</h2><p>Создавайте, изменяйте, удаляйте и просматривайте записи. Изменения останутся только в этом браузере.</p><label>Логин<input name="login" defaultValue="demo" /></label><label>Пароль<input name="password" type="password" defaultValue="demo" /></label>{notice && <em>{notice}</em>}<button>Открыть админ-панель →</button><Link href="/">← Вернуться на BYPCMS</Link></form></main>;
}

function ProjectBadge({ edition, project }: { edition: EditionKey; project: string }) {
  return <div className="projectBadge"><span>{project[0]}</span><div><b>{project}</b><small>BYPCMS {editions[edition].name}</small></div><i>⌄</i></div>;
}

function Dashboard({ edition, entities, modules, onNavigate }: { edition: EditionKey; entities: DemoEntity[]; modules: DemoModule[]; onNavigate: (id: string) => void }) {
  const data = edition === "commerce"
    ? { title: "Магазин сегодня", stats: [["684 200 ₽", "Выручка", "+18,4%"], ["148", "Заказы", "+12,8%"], ["3,82%", "Конверсия", "+0,7%"], ["7", "Требуют внимания", "2 без остатка"]], primary: "orders", recent: entities.filter(i => i.kind === "orders") }
    : edition === "business"
      ? { title: "Работа с клиентами", stats: [["494 000 ₽", "Сделки в работе", "+14,1%"], ["87", "Обращения", "+7,2%"], ["18", "Активные услуги", "3 направления"], ["3", "Новые заявки", "ответьте сегодня"]], primary: "leads", recent: entities.filter(i => i.kind === "leads") }
      : { title: "Работа редакции", stats: [["184 600", "Просмотры", "+18,4%"], ["32", "Материалы", "+4 за неделю"], ["7:42", "Время чтения", "+12%"], ["3", "Черновики", "готовы к выпуску"]], primary: "articles", recent: entities.filter(i => i.kind === "articles") };
  const moduleWidgets = modules.filter(module => module.slots.includes("dashboard.widget"));
  return <><PageHeading eyebrow={`BYPCMS ${editions[edition].name}`} title={data.title} description={editions[edition].note} actions={<button onClick={() => onNavigate(data.primary)}>Открыть рабочий раздел →</button>} /><section className="dashboardWidgets">{data.stats.map(([value, label, delta]) => <article key={label}><small>{label}</small><strong>{value}</strong><span>{delta}</span></article>)}</section><section className="dashboardGrid"><article className="performanceWidget"><header><div><small>ДИНАМИКА ЗА 30 ДНЕЙ</small><h2>{edition === "commerce" ? "Продажи" : edition === "business" ? "Новые обращения" : "Аудитория"}</h2></div><select><option>30 дней</option><option>7 дней</option><option>Год</option></select></header><div className="realChart">{[42, 54, 48, 69, 63, 78, 72, 88, 76, 96, 82, 100].map((height, i) => <i key={i} style={{ height: `${height}%` }} />)}</div><footer><b>+18,4%</b><span>по сравнению с прошлым периодом</span></footer></article><article className="attentionWidget"><small>ТРЕБУЕТ ВНИМАНИЯ</small><h2>Задачи</h2>{["Заполнить SEO у 2 страниц", "Ответить на новые обращения", "Проверить неопубликованный материал", "Обновить резервную копию"].map((item, index) => <button key={item}><i>{index + 1}</i><span>{item}<small>{index < 2 ? "Сегодня" : "На этой неделе"}</small></span>→</button>)}</article></section><section className="moduleWidgetRow">{moduleWidgets.map((module, index) => <button onClick={() => onNavigate(module.menu?.id || (module.key === "seo" ? "seo" : module.key === "analytics" ? "analytics" : "extensions"))} style={{ "--module-color": module.color } as React.CSSProperties} key={module.key}><i>{module.name[0]}</i><span><small>ВИДЖЕТ МОДУЛЯ</small><b>{module.name}</b><em>{module.key === "faq" ? "3 вопроса без ответа" : module.key === "reviews" ? "4 отзыва на модерации" : index % 2 ? "Все события передаются" : "Работает штатно"}</em></span>→</button>)}</section><section className="recentWidget"><header><div><small>ПОСЛЕДНИЕ ИЗМЕНЕНИЯ</small><h2>{entityTitles[data.recent[0]?.kind || "pages"].title}</h2></div><button onClick={() => onNavigate(data.primary)}>Все записи →</button></header>{data.recent.slice(0, 3).map(item => <button onClick={() => onNavigate(data.primary)} key={item.id}><MediaThumb index={item.image} /><span><b>{item.title}</b><small>{item.extra || item.excerpt}</small></span><em>{item.status}</em><time>{item.updated}</time></button>)}</section></>;
}

function PageHeading({ eyebrow, title, description, actions }: { eyebrow: string; title: string; description: string; actions?: React.ReactNode }) {
  return <header className="realPageHeading"><div><small>{eyebrow}</small><h1>{title}</h1><p>{description}</p></div>{actions && <div>{actions}</div>}</header>;
}

function EntityList({ kind, entities, onEdit, onCreate, onPreview }: { kind: EntityKind; entities: DemoEntity[]; onEdit: (item: DemoEntity) => void; onCreate: () => void; onPreview: (item: DemoEntity) => void }) {
  const meta = entityTitles[kind];
  const visual = ["articles", "projects", "products", "brands", "services", "team", "authors", "categories"].includes(kind);
  return <><PageHeading eyebrow="УПРАВЛЕНИЕ САЙТОМ" title={meta.title} description={meta.description} actions={<button onClick={onCreate}>＋ Добавить {meta.singular}</button>} /><div className="listToolbar"><label>⌕ <input placeholder={`Поиск: ${meta.title.toLowerCase()}`} /></label><select><option>Все статусы</option><option>Опубликовано</option><option>Черновик</option></select><select><option>Сначала новые</option><option>По названию</option></select><button>Фильтры</button></div>{visual ? <section className="entityCards">{entities.map(item => <article key={item.id}><MediaThumb index={item.image} large /><div><small>{item.category || item.brand || item.extra || meta.title}</small><h3>{item.title}</h3><p>{item.excerpt}</p>{item.price !== undefined && <strong>{item.price.toLocaleString("ru-RU")} ₽</strong>}<footer><em className={item.status === "Опубликовано" ? "published" : ""}>{item.status}</em><button onClick={() => onPreview(item)}>Просмотр ↗</button><button onClick={() => onEdit(item)}>Редактировать</button></footer></div></article>)}</section> : <section className="entityTable"><header><span>Название</span><span>Информация</span><span>Статус</span><span>Обновлено</span><span /></header>{entities.map(item => <button onClick={() => onEdit(item)} key={item.id}><MediaThumb index={item.image} /><span><b>{item.title}</b><small>{item.slug}</small></span><span>{item.extra || item.email || (item.value !== undefined ? `${item.value.toLocaleString("ru-RU")} ₽` : "—")}</span><em>{item.status}</em><time>{item.date || item.updated}</time><i>•••</i></button>)}</section>}<footer className="listFooter"><span>Показано {entities.length} записей</span><div><button disabled>←</button><button className="active">1</button><button disabled>→</button></div></footer></>;
}

function EntityEditor({ entity, tab, setTab, entities, installed, onSave, onDelete, onCancel, onPreview, flash }: { entity: DemoEntity; tab: EditorTab; setTab: (tab: EditorTab) => void; entities: DemoEntity[]; installed: DemoModule[]; onSave: (item: DemoEntity) => void; onDelete: (item: DemoEntity) => void; onCancel: () => void; onPreview: (item: DemoEntity) => void; flash: (message: string) => void }) {
  const [draft, setDraft] = useState(entity);
  const [mediaOpen, setMediaOpen] = useState(false);
  const meta = entityTitles[entity.kind];
  const commerce = entity.kind === "products";
  const contact = ["leads", "customers", "team", "authors"].includes(entity.kind);
  const transactional = ["orders", "payments"].includes(entity.kind);
  const editorModules = installed.filter(module => module.editorKinds?.includes(entity.kind) && module.key !== "seo");
  const hasSeo = installed.some(module => module.key === "seo" && module.editorKinds?.includes(entity.kind));
  const update = <K extends keyof DemoEntity>(key: K, value: DemoEntity[K]) => setDraft(old => ({ ...old, [key]: value }));
  return <><header className="editorHeader"><button onClick={onCancel}>← {meta.title}</button><div><small>{entity.id > 100000 ? "НОВАЯ ЗАПИСЬ" : `ID ${entity.id}`}</small><h1>{draft.title || `Новый ${meta.singular}`}</h1></div><span className={`statusDot ${draft.status === "Опубликовано" ? "live" : ""}`}>{draft.status}</span><button onClick={() => onPreview(draft)}>Предпросмотр ↗</button><button className="primary" onClick={() => onSave(draft)}>Сохранить</button></header><nav className="editorTabs"><button className={tab === "content" ? "active" : ""} onClick={() => setTab("content")}>Содержание</button>{hasSeo && <button className={tab === "seo" ? "active" : ""} onClick={() => setTab("seo")}>SEO и соцсети <em>Pro</em></button>}{editorModules.map(module => <button className={tab === `module:${module.key}` ? "active" : ""} onClick={() => setTab(`module:${module.key}`)} key={module.key}>{module.name}<em>Модуль</em></button>)}<button className={tab === "settings" ? "active" : ""} onClick={() => setTab("settings")}>Публикация</button></nav>
    {tab === "content" && <div className="editorLayout"><section className="editorMain"><div className="fieldCard"><label>Название<input value={draft.title} onChange={event => update("title", event.target.value)} placeholder={`Название: ${meta.singular}`} /></label><label>Адрес страницы<div className="slugField"><span>demo.bypcms.ru</span><input value={draft.slug} onChange={event => update("slug", event.target.value)} /></div></label></div>{commerce && <div className="fieldCard fieldGrid"><label>Артикул<input value={draft.sku || ""} onChange={event => update("sku", event.target.value)} /></label><label>Производитель<select value={draft.brand || ""} onChange={event => update("brand", event.target.value)}><option>Forma</option><option>Nord</option><option>Lumo</option></select></label><label>Цена, ₽<input type="number" value={draft.price || 0} onChange={event => update("price", Number(event.target.value))} /></label><label>Старая цена, ₽<input type="number" value={draft.oldPrice || 0} onChange={event => update("oldPrice", Number(event.target.value))} /></label><label>Остаток<input type="number" value={draft.stock || 0} onChange={event => update("stock", Number(event.target.value))} /></label><label>Категория<select value={draft.category || ""} onChange={event => update("category", event.target.value)}><option>Мебель</option><option>Освещение</option></select></label></div>}{contact && <div className="fieldCard fieldGrid"><label>Email<input type="email" value={draft.email || ""} onChange={event => update("email", event.target.value)} /></label><label>Телефон<input value={draft.phone || ""} onChange={event => update("phone", event.target.value)} /></label>{draft.value !== undefined && <label>Сумма, ₽<input type="number" value={draft.value} onChange={event => update("value", Number(event.target.value))} /></label>}<label>Дополнительная информация<input value={draft.extra || ""} onChange={event => update("extra", event.target.value)} /></label></div>}{transactional && <OrderFields draft={draft} update={update} />}
      <div className="fieldCard contentBlocks"><header><div><small>КОНТЕНТ СТРАНИЦЫ</small><h2>Блочный редактор</h2></div><button onClick={() => flash("Добавлен новый текстовый блок")}>＋ Добавить блок</button></header><article className="contentBlock"><i>⋮⋮</i><div><small>КРАТКОЕ ОПИСАНИЕ</small><textarea value={draft.excerpt} onChange={event => update("excerpt", event.target.value)} rows={3} placeholder="Описание для карточки и анонса" /></div><button>•••</button></article><article className="contentBlock richBlock"><i>⋮⋮</i><div><small>ТЕКСТ</small><div className="richToolbar"><button><b>B</b></button><button><i>I</i></button><button>H2</button><button>≡</button><button>☷</button><button>↗</button><button>“”</button></div><textarea value={draft.body} onChange={event => update("body", event.target.value)} rows={8} /></div><button>•••</button></article><article className="contentBlock imageBlock"><i>⋮⋮</i><div><small>ИЗОБРАЖЕНИЕ</small><MediaThumb index={draft.image} large /><span>{mediaItems[draft.image]?.name}<button onClick={() => setMediaOpen(true)}>Заменить</button></span></div><button>•••</button></article><div className="blockPicker"><button onClick={() => flash("Добавлен заголовок")}>T Заголовок</button><button onClick={() => flash("Добавлена галерея")}>▧ Галерея</button><button onClick={() => flash("Добавлена кнопка")}>↗ Кнопка</button><button onClick={() => flash("Добавлена форма")}>☷ Форма</button></div></div></section><aside className="editorAside"><div className="sideCard"><small>ОБЛОЖКА</small><MediaThumb index={draft.image} large /><button onClick={() => setMediaOpen(true)}>Выбрать изображение</button><label>Alt-текст<input value={mediaItems[draft.image]?.alt || ""} readOnly /></label></div><div className="sideCard"><small>ПАРАМЕТРЫ</small>{!commerce && !contact && !transactional && <label>Категория<input value={draft.category || ""} onChange={event => update("category", event.target.value)} placeholder="Без категории" /></label>}<label>Статус<select value={draft.status} onChange={event => update("status", event.target.value)}><option>Черновик</option><option>Опубликовано</option><option>Скрыт</option><option>Новый</option><option>В работе</option><option>Согласовано</option><option>Оплачен</option><option>Доставляется</option></select></label><label className="checkLine"><input type="checkbox" checked={!!draft.featured} onChange={event => update("featured", event.target.checked)} />Показывать на главной</label></div><div className="sideCard dangerCard"><button onClick={() => onDelete(draft)}>Удалить запись</button></div></aside></div>}
    {tab === "seo" && <SeoEditor draft={draft} update={update} />}
    {tab.startsWith("module:") && <EditorModuleSlot module={installed.find(item => item.key === tab.replace("module:", ""))!} entity={draft} flash={flash} />}
    {tab === "settings" && <PublishEditor draft={draft} update={update} onSave={() => onSave(draft)} onPreview={() => onPreview(draft)} />}
    {mediaOpen && <MediaPicker selected={draft.image} onSelect={index => { update("image", index); setMediaOpen(false); }} onClose={() => setMediaOpen(false)} />}
  </>;
}

function OrderFields({ draft, update }: { draft: DemoEntity; update: <K extends keyof DemoEntity>(key: K, value: DemoEntity[K]) => void }) {
  return <div className="fieldCard orderEditor"><div><small>КЛИЕНТ И ДОСТАВКА</small><h3>{draft.extra}</h3><p>Москва, ул. Тверская, 12 · Курьерская доставка</p><button>Изменить данные</button></div><div><small>СУММА ОПЕРАЦИИ</small><label>Сумма, ₽<input type="number" value={draft.value || 0} onChange={event => update("value", Number(event.target.value))} /></label><label>Статус<select value={draft.status} onChange={event => update("status", event.target.value)}><option>Новый</option><option>Оплачен</option><option>Комплектуется</option><option>Доставляется</option><option>Завершён</option><option>Возврат</option></select></label></div><section><MediaThumb index={2} /><span><b>Кресло Forma 01</b><small>FRM-001 · 1 шт.</small></span><strong>{(draft.value || 0).toLocaleString("ru-RU")} ₽</strong></section></div>;
}

function SeoEditor({ draft, update }: { draft: DemoEntity; update: <K extends keyof DemoEntity>(key: K, value: DemoEntity[K]) => void }) {
  const score = Math.min(100, 58 + (draft.seoTitle.length > 20 ? 16 : 0) + (draft.seoDescription.length > 80 ? 16 : 0) + (draft.image >= 0 ? 10 : 0));
  return <div className="seoEditorLayout"><section><div className="seoScore"><strong>{score}</strong><div><b>SEO-оценка страницы</b><span>{score === 100 ? "Страница полностью оптимизирована" : "Заполните рекомендации ниже"}</span></div></div><div className="fieldCard"><small>ПОИСКОВАЯ ВЫДАЧА</small><h2>Метаданные</h2><label>Title <span>{draft.seoTitle.length}/60</span><input value={draft.seoTitle} onChange={event => update("seoTitle", event.target.value)} /></label><label>Description <span>{draft.seoDescription.length}/160</span><textarea rows={4} value={draft.seoDescription} onChange={event => update("seoDescription", event.target.value)} /></label><label>Канонический URL<input value={`https://demo.bypcms.ru${draft.slug}`} readOnly /></label><label className="checkLine"><input type="checkbox" defaultChecked />Разрешить индексацию страницы</label></div><div className="fieldCard"><small>СОЦИАЛЬНЫЕ СЕТИ</small><h2>Open Graph</h2><div className="ogEditor"><MediaThumb index={draft.image} large /><div><label>Заголовок<input value={draft.seoTitle} onChange={event => update("seoTitle", event.target.value)} /></label><label>Описание<textarea rows={3} value={draft.seoDescription} onChange={event => update("seoDescription", event.target.value)} /></label></div></div></div></section><aside><div className="searchPreview"><small>ПРЕДПРОСМОТР GOOGLE</small><span>demo.bypcms.ru › {draft.slug.split("/").filter(Boolean).join(" › ")}</span><h3>{draft.seoTitle || draft.title}</h3><p>{draft.seoDescription || "Добавьте описание страницы для поисковой выдачи."}</p></div><div className="seoChecklist"><b>Рекомендации</b>{[["Заголовок страницы", draft.seoTitle.length > 20], ["Описание 80–160 символов", draft.seoDescription.length > 80], ["Читаемый URL", draft.slug.length > 1], ["Изображение для соцсетей", draft.image >= 0], ["Ключевая фраза в тексте", draft.body.length > 40]].map(([name, done]) => <p key={String(name)}><i className={done ? "done" : ""}>{done ? "✓" : "!"}</i>{String(name)}</p>)}</div></aside></div>;
}

function PublishEditor({ draft, update, onSave, onPreview }: { draft: DemoEntity; update: <K extends keyof DemoEntity>(key: K, value: DemoEntity[K]) => void; onSave: () => void; onPreview: () => void }) {
  return <div className="publishLayout"><section className="fieldCard"><small>ПУБЛИКАЦИЯ</small><h2>Статус и расписание</h2><label>Статус<select value={draft.status} onChange={event => update("status", event.target.value)}><option>Черновик</option><option>Опубликовано</option><option>Скрыт</option></select></label><label>Дата публикации<input type="datetime-local" defaultValue="2026-07-28T12:00" /></label><label>Автор<select defaultValue={draft.author || "Администратор BYPCMS"}><option>Администратор BYPCMS</option><option>Анна Левина</option><option>Илья Морозов</option></select></label><label className="checkLine"><input type="checkbox" defaultChecked />Добавить в sitemap.xml</label><label className="checkLine"><input type="checkbox" />Защитить паролем</label></section><aside><div className="revisionCard"><small>ИСТОРИЯ ИЗМЕНЕНИЙ</small><h3>Версии записи</h3>{["Текущая версия · только что", "Автосохранение · 12 минут назад", "Опубликовано · вчера, 18:40"].map((text, i) => <button key={text}><i>{i + 1}</i>{text}<span>{i ? "Восстановить" : "Активна"}</span></button>)}</div><button className="previewWide" onClick={onPreview}>Предпросмотр на сайте ↗</button><button className="saveWide" onClick={onSave}>Сохранить и опубликовать</button></aside></div>;
}

function MediaLibrary({ flash }: { flash: (message: string) => void }) {
  const [selected, setSelected] = useState<number | null>(null);
  return <><PageHeading eyebrow="СИСТЕМА" title="Медиатека" description="Изображения, документы и варианты размеров" actions={<button onClick={() => flash("В демо добавлен новый файл")}>＋ Загрузить файлы</button>} /><div className="mediaToolbar"><label>⌕ <input placeholder="Поиск по файлам" /></label><button>Все файлы</button><button>Изображения</button><button>Документы</button><select><option>Июль 2026</option><option>Июнь 2026</option></select></div><section className="mediaLibrary">{mediaItems.map(item => <button className={selected === item.id ? "selected" : ""} onClick={() => setSelected(item.id)} key={item.id}><MediaThumb index={item.id} large /><span><b>{item.name}</b><small>1536 × 1024 · JPG</small></span><i>✓</i></button>)}</section>{selected !== null && <aside className="mediaInspector"><MediaThumb index={selected} large /><div><small>ВЫБРАННЫЙ ФАЙЛ</small><h2>{mediaItems[selected].name}</h2><label>Alt-текст<input defaultValue={mediaItems[selected].alt} /></label><label>Подпись<textarea defaultValue="Изображение из медиатеки BYPCMS" /></label><p><b>Оригинал</b> 1536 × 1024 · 1,4 МБ</p><p><b>WebP</b> 1200 × 800 · 186 КБ</p><button onClick={() => flash("Метаданные изображения сохранены")}>Сохранить</button><button className="danger">Удалить файл</button></div></aside>}</>;
}

function MediaPicker({ selected, onSelect, onClose }: { selected: number; onSelect: (index: number) => void; onClose: () => void }) {
  return <div className="demoModal mediaPicker" onMouseDown={onClose}><section onMouseDown={event => event.stopPropagation()}><header><div><small>МЕДИАТЕКА</small><h2>Выберите изображение</h2></div><button onClick={onClose}>×</button></header><div>{mediaItems.map(item => <button className={selected === item.id ? "selected" : ""} onClick={() => onSelect(item.id)} key={item.id}><MediaThumb index={item.id} large /><span>{item.name}</span></button>)}</div></section></div>;
}

function SeoCenter({ entities, onEdit, flash }: { entities: DemoEntity[]; onEdit: (item: DemoEntity) => void; flash: (message: string) => void }) {
  const pages = entities.filter(item => ["pages", "articles", "products", "services", "projects", "categories"].includes(item.kind));
  return <><PageHeading eyebrow="SEO PRO" title="Поисковая оптимизация" description="SEO встроено во все страницы, материалы и карточки каталога" actions={<button onClick={() => flash("Повторный SEO-аудит завершён")}>Запустить аудит</button>} /><section className="seoSummary"><article><strong>94</strong><span><b>Общая оценка</b><small>Отличный результат</small></span></article><article><strong>{pages.length}</strong><span><b>Страниц проверено</b><small>2 требуют внимания</small></span></article><article><strong>100%</strong><span><b>Доступность</b><small>Ошибок сервера нет</small></span></article><article><strong>3</strong><span><b>Редиректа</b><small>Все работают</small></span></article></section><section className="seoPages"><header><span>Страница</span><span>Title</span><span>Description</span><span>Оценка</span><span /></header>{pages.slice(0, 8).map((item, index) => <button onClick={() => onEdit(item)} key={item.id}><MediaThumb index={item.image} /><span><b>{item.title}</b><small>{item.slug}</small></span><i className={item.seoTitle.length > 20 ? "ok" : ""}>{item.seoTitle.length > 20 ? "✓" : "!"}</i><i className={item.seoDescription.length > 80 ? "ok" : ""}>{item.seoDescription.length > 80 ? "✓" : "!"}</i><strong>{index % 4 === 0 ? 82 : 100}</strong><em>Редактировать →</em></button>)}</section><section className="seoTools"><article><small>ТЕХНИЧЕСКОЕ SEO</small><h3>Sitemap.xml</h3><p>Обновлён 12 минут назад · {pages.length} URL</p><button onClick={() => flash("Sitemap.xml обновлён")}>Обновить карту сайта</button></article><article><small>ПЕРЕНАПРАВЛЕНИЯ</small><h3>Редиректы</h3><p>3 активных правила · ошибок нет</p><button>Управлять редиректами</button></article><article><small>ИНДЕКСАЦИЯ</small><h3>Robots.txt</h3><p>Правила настроены корректно</p><button>Открыть редактор</button></article></section></>;
}

function Analytics({ edition, flash }: { edition: EditionKey; flash: (message: string) => void }) {
  return <><PageHeading eyebrow="АНАЛИТИКА" title={edition === "commerce" ? "Продажи и конверсия" : edition === "business" ? "Заявки и источники" : "Аудитория и материалы"} description="События, цели и отчёты внутри панели BYPCMS" actions={<button onClick={() => flash("Отчёт экспортирован в CSV")}>Экспорт отчёта</button>} /><section className="analyticsKpi">{[["24 892", "Посетители", "+18,4%"], ["1 248", "Целевые действия", "+7,2%"], ["5,01%", "Конверсия", "+1,6%"], ["84 200 ₽", "Ценность цели", "+12,1%"]].map(item => <article key={item[1]}><small>{item[1]}</small><strong>{item[0]}</strong><span>{item[2]}</span></article>)}</section><section className="analyticsLayout"><article><header><h2>Воронка</h2><select><option>Все источники</option></select></header>{[["Посетители", 100, "24 892"], ["Просмотр предложения", 72, "17 922"], ["Начало формы", 46, "11 450"], ["Отправка формы", 21, "5 227"]].map(([name, width, value]) => <p key={name}><span>{name}<b>{value}</b></span><i style={{ width: `${width}%` }} /></p>)}</article><article><h2>Источники</h2>{[["Поиск", "42%"], ["Прямые переходы", "28%"], ["Реклама", "18%"], ["Социальные сети", "12%"]].map(([name, value]) => <p key={name}><span>{name}</span><b>{value}</b></p>)}</article></section></>;
}

function DesignStudio({ edition, theme, setTheme, settings, flash }: { edition: EditionKey; theme: ThemeState; setTheme: React.Dispatch<React.SetStateAction<ThemeState>>; settings: SettingsState; flash: (message: string) => void }) {
  return <><PageHeading eyebrow="ДИЗАЙН САЙТА" title="Визуальные настройки" description="Изменения сразу видны в живом предпросмотре" actions={<button onClick={() => flash("Настройки дизайна опубликованы")}>Опубликовать дизайн</button>} /><div className="designEditor"><aside><section><small>ШАБЛОН</small>{["Studio", "Editorial", "Commerce"].map(name => <button className={theme.template === name ? "active" : ""} onClick={() => setTheme(value => ({ ...value, template: name }))} key={name}><i className={`miniTemplate ${name.toLowerCase()}`} /><span><b>{name}</b><small>{name === "Commerce" ? "Каталог и магазин" : name === "Editorial" ? "Журнал и медиа" : "Компания и услуги"}</small></span>✓</button>)}</section><section><small>ФИРМЕННЫЙ СТИЛЬ</small><label>Акцентный цвет<input type="color" value={theme.accent} onChange={event => setTheme(value => ({ ...value, accent: event.target.value }))} /></label><label>Фон сайта<input type="color" value={theme.background} onChange={event => setTheme(value => ({ ...value, background: event.target.value }))} /></label><label>Шрифт<select value={theme.font} onChange={event => setTheme(value => ({ ...value, font: event.target.value }))}><option>Inter</option><option>Manrope</option><option>Georgia</option></select></label><label>Скругление <b>{theme.radius}px</b><input type="range" min="0" max="28" value={theme.radius} onChange={event => setTheme(value => ({ ...value, radius: Number(event.target.value) }))} /></label><label>Ширина контента <b>{theme.container}px</b><input type="range" min="1040" max="1440" step="40" value={theme.container} onChange={event => setTheme(value => ({ ...value, container: Number(event.target.value) }))} /></label><label>Шапка<select value={theme.header} onChange={event => setTheme(value => ({ ...value, header: event.target.value }))}><option>Светлая</option><option>Тёмная</option><option>Прозрачная</option></select></label></section></aside><LiveSite edition={edition} entity={null} theme={theme} settings={settings} /></div></>;
}

function ExtensionCenter({ edition, installed, setInstalled, flash }: { edition: EditionKey; installed: string[]; setInstalled: (keys: string[]) => void; flash: (message: string) => void }) {
  const compatible = moduleRegistry.filter(module => module.editions.includes(edition));
  const [filter, setFilter] = useState<"installed" | "catalog">("installed");
  const list = filter === "installed" ? compatible.filter(module => installed.includes(module.key)) : compatible;
  function toggle(module: DemoModule) {
    const active = installed.includes(module.key);
    setInstalled(active ? installed.filter(key => key !== module.key) : [...installed, module.key]);
    flash(active ? `${module.name} отключён и удалён из точек встраивания` : `${module.name} установлен: интерфейс обновлён автоматически`);
  }
  const slotNames: Record<string, string> = { "menu.main": "Главное меню", "menu.marketing": "Маркетинг", "editor.tab": "Вкладка редактора", "editor.sidebar": "Боковая панель", "dashboard.widget": "Виджет обзора", "settings.section": "Настройки" };
  return <><PageHeading eyebrow="СИСТЕМА РАСШИРЕНИЙ" title="Модули" description="Установка без изменения ядра: каждый модуль объявляет свои точки встраивания" actions={<button onClick={() => setFilter("catalog")}>＋ Добавить модуль</button>} /><section className="extensionArchitecture"><div><span>ЯДРО</span><b>BYPCMS Core 2.1</b><small>Стабильный API и события</small></div><i>→</i>{["Меню", "Редакторы", "Обзор", "Настройки"].map(name => <div key={name}><span>СЛОТ</span><b>{name}</b><small>Автоматическое подключение</small></div>)}</section><nav className="extensionTabs"><button className={filter === "installed" ? "active" : ""} onClick={() => setFilter("installed")}>Установлено <em>{installed.length}</em></button><button className={filter === "catalog" ? "active" : ""} onClick={() => setFilter("catalog")}>Каталог модулей <em>{compatible.length}</em></button><button>Обновления <em>2</em></button></nav><section className="extensionGrid">{list.map(module => { const active = installed.includes(module.key); return <article key={module.key} style={{ "--module-color": module.color } as React.CSSProperties}><header><i>{module.name[0]}</i><div><small>{active ? "УСТАНОВЛЕН" : "ДОСТУПЕН"}</small><h3>{module.name}</h3></div><em>v{module.version}</em></header><p>{module.description}</p><div className="slotList">{module.slots.map(slot => <span key={slot}>↳ {slotNames[slot]}</span>)}</div>{module.editorKinds && <small>Встраивается в: {module.editorKinds.map(kind => entityTitles[kind].title).join(", ")}</small>}<footer><strong>{module.price ? `${module.price.toLocaleString("ru-RU")} ₽` : "В редакции"}</strong><button onClick={() => toggle(module)} className={active ? "installed" : ""}>{active ? "Отключить" : "Установить"}</button><button onClick={() => flash(`Открыты настройки модуля ${module.name}`)}>Настройки</button></footer></article>})}</section></>;
}

function EditorModuleSlot({ module, entity, flash }: { module: DemoModule; entity: DemoEntity; flash: (message: string) => void }) {
  if (!module) return null;
  if (module.key === "reviews") return <div className="moduleSlotPage"><PageHeading eyebrow="МОДУЛЬ В РЕДАКТОРЕ" title="Отзывы и рейтинг" description={`Отзывы для «${entity.title}»`} /><section className="reviewsEditor"><article><strong>4,8</strong><span>Средняя оценка<small>18 опубликованных отзывов</small></span></article>{[["Анна К.", "5", "Очень удобное кресло, качество отличное."], ["Игорь М.", "4", "Хороший дизайн и быстрая доставка."]].map(review => <div key={review[0]}><i>{review[0][0]}</i><span><b>{review[0]}</b><small>{"★".repeat(Number(review[1]))}</small><p>{review[2]}</p></span><select><option>Опубликован</option><option>На модерации</option><option>Скрыт</option></select></div>)}</section></div>;
  if (module.key === "delivery") return <div className="moduleSlotPage"><PageHeading eyebrow="МОДУЛЬ В РЕДАКТОРЕ" title="Доставка" description={`Условия доставки для «${entity.title}»`} /><section className="fieldCard fieldGrid"><label>Вес, кг<input type="number" defaultValue="12.4" /></label><label>Габариты, см<input defaultValue="82 × 76 × 84" /></label><label>Класс доставки<select><option>Крупногабаритный</option><option>Стандартный</option></select></label><label>Срок комплектации<input defaultValue="1–2 рабочих дня" /></label><label className="checkLine"><input type="checkbox" defaultChecked />Доступна курьерская доставка</label><label className="checkLine"><input type="checkbox" defaultChecked />Доступен самовывоз</label><button onClick={() => flash("Условия доставки сохранены")}>Сохранить условия</button></section></div>;
  if (module.key === "payments") return <div className="moduleSlotPage"><PageHeading eyebrow="МОДУЛЬ В РЕДАКТОРЕ" title="Оплата заказа" description="Транзакции, чеки и возвраты" /><section className="paymentDetail"><article><small>СТАТУС</small><strong>Оплачен</strong></article><article><small>СПОСОБ</small><strong>Банковская карта</strong></article><article><small>ID ОПЕРАЦИИ</small><strong>PAY-3018</strong></article><button onClick={() => flash("Демо-возврат оформлен")}>Оформить возврат</button></section></div>;
  return <div className="moduleSlotPage"><PageHeading eyebrow="ВСТРОЕННЫЙ МОДУЛЬ" title={module.name} description={module.description} /><section className="fieldCard"><p>Модуль встроен в редактор сущности «{entityTitles[entity.kind].title}» через API-слот <code>editor.sidebar</code>.</p><label className="checkLine"><input type="checkbox" defaultChecked />Использовать для этой записи</label><button onClick={() => flash(`Настройки ${module.name} сохранены`)}>Сохранить настройки</button></section></div>;
}

function InjectedModulePage({ module, flash }: { module: DemoModule; flash: (message: string) => void }) {
  return <><PageHeading eyebrow="РАЗДЕЛ ИЗ МОДУЛЯ" title={module.name} description={`${module.description} Этот пункт меню добавлен манифестом модуля.`} actions={<button onClick={() => flash(`Создана новая запись в ${module.name}`)}>＋ Добавить</button>} /><section className="injectedModuleBanner" style={{ "--module-color": module.color } as React.CSSProperties}><i>{module.name[0]}</i><div><small>РАСШИРЕНИЕ ПОДКЛЮЧЕНО</small><h2>{module.name}</h2><p>Раздел работает как родная часть BYPCMS, но обновляется независимо от ядра.</p></div><code>slot: menu.main</code></section><section className="entityTable"><header><span>Название</span><span>Информация</span><span>Статус</span><span>Обновлено</span><span /></header>{["Новая запись", "Основной сценарий", "Архивная запись"].map((name, index) => <button key={name}><span className="moduleRowIcon">{index + 1}</span><span><b>{name}</b><small>{module.key}-{100 + index}</small></span><span>{module.description.slice(0, 34)}…</span><em>{index === 2 ? "Черновик" : "Активен"}</em><time>Сегодня</time><i>•••</i></button>)}</section></>;
}

function SettingsPanel({ settings, setSettings, modules, flash }: { settings: SettingsState; setSettings: React.Dispatch<React.SetStateAction<SettingsState>>; modules: DemoModule[]; flash: (message: string) => void }) {
  const update = <K extends keyof SettingsState>(key: K, value: SettingsState[K]) => setSettings(old => ({ ...old, [key]: value }));
  return <><PageHeading eyebrow="СИСТЕМА" title="Настройки проекта" description="Домен, контакты, пользователи и интеграции" actions={<button onClick={() => flash("Настройки проекта сохранены")}>Сохранить изменения</button>} /><nav className="settingsNav"><button className="active">Основные</button><button>Пользователи</button><button>Уведомления</button><button>Интеграции</button>{modules.map(module => <button key={module.key}>{module.name}<em>Модуль</em></button>)}<button>Безопасность</button></nav><section className="settingsForm"><article><small>ОСНОВНЫЕ ДАННЫЕ</small><h2>Сайт и организация</h2><div className="fieldGrid"><label>Название сайта<input value={settings.siteName} onChange={event => update("siteName", event.target.value)} /></label><label>Домен<input value={settings.domain} onChange={event => update("domain", event.target.value)} /></label><label>Email<input type="email" value={settings.email} onChange={event => update("email", event.target.value)} /></label><label>Телефон<input value={settings.phone} onChange={event => update("phone", event.target.value)} /></label><label className="wide">Адрес<input value={settings.address} onChange={event => update("address", event.target.value)} /></label><label>Язык<select value={settings.language} onChange={event => update("language", event.target.value)}><option>Русский</option><option>English</option></select></label><label>Часовой пояс<select value={settings.timezone} onChange={event => update("timezone", event.target.value)}><option>Europe/Moscow</option><option>Europe/Minsk</option><option>Asia/Almaty</option></select></label></div></article><article><small>СОСТОЯНИЕ САЙТА</small><h2>Режим работы</h2><label className="settingSwitch"><span><b>Системные уведомления</b><small>Заявки, заказы и важные события</small></span><input type="checkbox" checked={settings.notifications} onChange={event => update("notifications", event.target.checked)} /></label><label className="settingSwitch"><span><b>Технические работы</b><small>Закрыть публичную часть сайта</small></span><input type="checkbox" checked={settings.maintenance} onChange={event => update("maintenance", event.target.checked)} /></label></article><article><small>ПОЛЬЗОВАТЕЛИ</small><h2>Команда проекта</h2>{[["АБ", "Администратор BYPCMS", "Владелец"], ["МБ", "Мария Белова", "Редактор"], ["АВ", "Алексей Ветров", "Менеджер"]].map(user => <div className="userRow" key={user[1]}><i>{user[0]}</i><span><b>{user[1]}</b><small>{user[2]}</small></span><button>Настроить</button></div>)}<button onClick={() => flash("Создано демо-приглашение")}>＋ Пригласить пользователя</button></article><article><small>ИНТЕГРАЦИИ</small><h2>Подключённые сервисы</h2>{[["ЮKassa", "Платежи", true], ["Telegram", "Уведомления", true], ["Внешняя CRM", "Заявки", false]].map(item => <div className="integrationRow" key={String(item[0])}><i>{String(item[0])[0]}</i><span><b>{item[0]}</b><small>{item[1]}</small></span><em className={item[2] ? "on" : ""}>{item[2] ? "Подключено" : "Настроить"}</em></div>)}</article>{modules.map(module => <article className="moduleSettingsCard" key={module.key} style={{ "--module-color": module.color } as React.CSSProperties}><small>НАСТРОЙКИ МОДУЛЯ</small><h2>{module.name}</h2><p>{module.description}</p><label className="settingSwitch"><span><b>Модуль активен</b><small>Версия {module.version}</small></span><input type="checkbox" defaultChecked /></label><button onClick={() => flash(`Настройки ${module.name} сохранены`)}>Настроить модуль</button></article>)}</section><button className="resetDemo" onClick={() => { sessionStorage.removeItem("bypcms-real-demo-v1"); window.location.reload(); }}>Сбросить все изменения демо</button></>;
}

function PublicPreview({ entity, edition, theme, settings, onClose }: { entity: DemoEntity; edition: EditionKey; theme: ThemeState; settings: SettingsState; onClose: () => void }) {
  return <div className="publicPreview"><header><span><b>Предпросмотр сайта</b><small>Изменения видны только вам</small></span><div><button>▱ 1440</button><button>▯ 768</button><button>▯ 390</button></div><button onClick={onClose}>Закрыть ×</button></header><LiveSite edition={edition} entity={entity} theme={theme} settings={settings} /></div>;
}

function LiveSite({ edition, entity, theme, settings }: { edition: EditionKey; entity: DemoEntity | null; theme: ThemeState; settings: SettingsState }) {
  const content = entity || seedEntities.find(item => item.kind === (edition === "commerce" ? "products" : edition === "content" ? "articles" : "projects"))!;
  return <div className={`liveSite template-${theme.template.toLowerCase()} header-${theme.header.toLowerCase()}`} style={{ "--site-accent": theme.accent, "--site-bg": theme.background, "--site-radius": `${theme.radius}px`, "--site-width": `${theme.container}px`, fontFamily: theme.font } as React.CSSProperties}><header><a><b>{settings.siteName[0]}</b>{settings.siteName}</a><nav><span>Главная</span><span>{edition === "commerce" ? "Каталог" : edition === "content" ? "Журнал" : "Услуги"}</span><span>О нас</span><span>Контакты</span></nav><button>{edition === "commerce" ? "Корзина · 0" : "Связаться"}</button></header><main><section className="siteHero"><div><small>{content.category || editions[edition].note}</small><h1>{content.title}</h1><p>{content.excerpt}</p>{content.price !== undefined ? <><strong>{content.price.toLocaleString("ru-RU")} ₽</strong><button>Добавить в корзину</button></> : <button>Подробнее →</button>}</div><MediaThumb index={content.image} large /></section><section className="siteBody"><aside><small>СОДЕРЖАНИЕ</small><a>Обзор</a><a>Подробности</a><a>Характеристики</a></aside><article><h2>{content.kind === "products" ? "Описание товара" : "О проекте"}</h2><p>{content.body}</p><MediaThumb index={(content.image + 1) % 6} large /><h2>Продумано до деталей</h2><p>Эта часть страницы собирается из управляемых блоков. Изображения, тексты, порядок секций и кнопки меняются в редакторе BYPCMS.</p></article></section></main><footer><b>{settings.siteName}</b><span>{settings.email} · {settings.phone}</span><span>© 2026</span></footer></div>;
}

function MediaThumb({ index, large = false }: { index: number; large?: boolean }) {
  const x = index % 3;
  const y = Math.floor(index / 3);
  return <span className={`mediaThumb ${large ? "large" : ""}`} style={{ backgroundPosition: `${x * 50}% ${y * 100}%` }} role="img" aria-label={mediaItems[index]?.alt || "Изображение"} />;
}
