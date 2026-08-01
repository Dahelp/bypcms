"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { defaultInstalledModules, DemoContentBlock, DemoEntity, DemoModule, EditionKey, EntityKind, editions, entityTitles, mediaItems, moduleRegistry, seedEntities } from "./demo-data";
import "./demo.css";

type ThemeState = { template: string; editionTemplates?: Partial<Record<EditionKey, string>>; accent: string; background: string; font: string; headingFont?: string; customFont?: string; radius: number; header: string; container: number; menuPosition?: "left" | "center" | "right" | "drawer"; customTemplateName?: string; customTemplateSource?: string };
type SettingsState = { siteName: string; slogan?: string; logo?: string; domain: string; email: string; phone: string; address: string; language: string; timezone: string; notifications: boolean; maintenance: boolean };
type EditorTab = "content" | "seo" | "settings" | `module:${string}`;

const templateCatalog: Record<EditionKey, { id: string; name: string; note: string }[]> = {
  content: [{ id: "journal", name: "Journal", note: "Журнальная сетка и крупные истории" }, { id: "chronicle", name: "Chronicle", note: "Строгая редакционная колонка" }, { id: "focus", name: "Focus", note: "Современная медиа-витрина" }],
  business: [{ id: "atelier", name: "Atelier", note: "Имиджевый сайт студии" }, { id: "corporate", name: "Corporate", note: "Услуги, цифры и доверие" }, { id: "mono", name: "Mono", note: "Минималистичная презентация" }],
  commerce: [{ id: "gallery", name: "Gallery", note: "Каталог как дизайн-галерея" }, { id: "market", name: "Market", note: "Конверсионный интернет-магазин" }, { id: "luxe", name: "Luxe", note: "Премиальная товарная витрина" }],
};
const initialTheme: ThemeState = { template: "atelier", editionTemplates: { content: "journal", business: "atelier", commerce: "gallery" }, accent: "#557a25", background: "#f3f3ef", font: "Inter", headingFont: "Manrope", customFont: "", radius: 12, header: "Светлая", container: 1280, menuPosition: "center", customTemplateName: "", customTemplateSource: "" };
const initialSettings: SettingsState = { siteName: "Northline Studio", slogan: "Дизайн и цифровые продукты для бизнеса", logo: "", domain: "demo.bypcms.ru", email: "hello@northline.demo", phone: "+7 495 100-20-30", address: "Москва, ул. Тверская, 12", language: "Русский", timezone: "Europe/Moscow", notifications: true, maintenance: false };
const sanitizeDemoHtml = (source: string) => source.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/\son\w+\s*=\s*["'][^"']*["']/gi, "");

export default function DemoPage() {
  const [logged, setLogged] = useState(false);
  const [edition, setEdition] = useState<EditionKey>("content");
  const [view, setView] = useState("overview");
  const [entities, setEntities] = useState<DemoEntity[]>(seedEntities);
  const [editing, setEditing] = useState<DemoEntity | null>(null);
  const [editorTab, setEditorTab] = useState<EditorTab>("content");
  const [preview, setPreview] = useState<DemoEntity | null>(null);
  const [theme, setTheme] = useState(initialTheme);
  const [settings, setSettings] = useState(initialSettings);
  const [installedModules, setInstalledModules] = useState<Record<EditionKey, string[]>>(defaultInstalledModules);
  const [notice, setNotice] = useState("");
  const noticeTimer = useRef<number | null>(null);

  useEffect(() => {
    const raw = sessionStorage.getItem("bypcms-real-demo-v1");
    if (!raw) return;
    try {
      const saved = JSON.parse(raw);
      if (saved.entities) setEntities(saved.entities);
      if (saved.theme) {
        const known = [...templateCatalog.content, ...templateCatalog.business, ...templateCatalog.commerce].some(item => item.id === saved.theme.template) || saved.theme.template === "custom";
        setTheme({ ...initialTheme, ...saved.theme, template: known ? saved.theme.template : initialTheme.template, editionTemplates: { ...initialTheme.editionTemplates, ...saved.theme.editionTemplates } });
      }
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
    if (noticeTimer.current !== null) window.clearTimeout(noticeTimer.current);
    setNotice(message);
    noticeTimer.current = window.setTimeout(() => {
      setNotice("");
      noticeTimer.current = null;
    }, 3500);
  }
  function switchEdition(next: EditionKey) {
    setEdition(next);
    setView("overview");
    setEditing(null);
    setSettings(value => ({ ...value, siteName: editions[next].project }));
    setTheme(value => ({ ...value, accent: editions[next].accent, template: value.editionTemplates?.[next] || templateCatalog[next][0].id }));
    flash(`Открыта полноценная редакция BYPCMS ${editions[next].name}`);
  }
  function startCreate(kind: EntityKind) {
    const meta = entityTitles[kind];
    setEditing({
      id: Date.now(), kind, title: "", slug: "/", status: kind === "leads" || kind === "orders" ? "Новый" : "Черновик",
      updated: "Только что", image: kind === "products" ? 2 : 0, excerpt: "", body: "", seoTitle: "", seoDescription: "",
      price: kind === "products" || kind === "services" ? 0 : undefined, stock: kind === "products" ? 0 : undefined,
      sku: kind === "products" ? "" : undefined, value: ["leads", "orders", "payments"].includes(kind) ? 0 : undefined,
      extra: "",
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
    const masculine = ["articles", "projects", "team", "orders", "products", "brands", "customers", "promos", "payments"].includes(item.kind);
    flash(`«${item.title || "Новая запись"}» ${masculine ? "удалён" : "удалена"}`);
  }

  if (!logged) return <Login onLogin={() => setLogged(true)} notice={notice} flash={flash} />;

  return <main className="realDemo" style={{ "--demo-accent": theme.accent, "--demo-radius": `${theme.radius}px` } as React.CSSProperties}>
    <aside className="realSidebar">
      <a href="https://bypcms.ru/" className="demoBrand"><b>B</b><span>BYPCMS</span><i>{current.name}</i></a>
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
        <button className="topSearch" onClick={() => flash("Поиск активирован: выберите нужный раздел в левом меню")}>⌕ <span>Поиск по панели</span><kbd>⌘ K</kbd></button>
        <button className="topIcon" onClick={() => flash("Новых уведомлений нет")}>♢</button>
        <button className="openSite" onClick={() => setPreview(entities.find(item => item.kind === (edition === "commerce" ? "products" : edition === "content" ? "articles" : "projects")) || entities[0])}>Открыть сайт ↗</button>
      </header>
      <div className="realContent">
        {notice && <div className="demoNotice">{notice}<button onClick={() => setNotice("")}>×</button></div>}
        {view === "overview" && <Dashboard edition={edition} entities={entities} modules={moduleRegistry.filter(module => activeModules.includes(module.key))} onNavigate={setView} />}
        {currentKind && !editing && <EntityList kind={currentKind} entities={entities.filter(item => item.kind === currentKind)} onEdit={item => { setEditing(item); setEditorTab("content"); }} onCreate={() => startCreate(currentKind)} onPreview={setPreview} />}
        {currentKind && editing && <EntityEditor key={editing.id} entity={editing} tab={editorTab} setTab={setEditorTab} entities={entities} installed={moduleRegistry.filter(module => activeModules.includes(module.key))} onSave={saveEntity} onDelete={deleteEntity} onCancel={() => setEditing(null)} onPreview={setPreview} flash={flash} />}
        {view === "media" && <MediaLibrary flash={flash} />}
        {view === "seo" && <SeoCenter entities={entities} onEdit={item => { setView(current.menu.some(menu => menu.kind === item.kind) ? item.kind : "pages"); setEditing(item); setEditorTab("seo"); }} flash={flash} />}
        {view === "analytics" && <Analytics edition={edition} flash={flash} />}
        {view === "design" && <DesignStudioV2 edition={edition} theme={theme} setTheme={setTheme} settings={settings} setSettings={setSettings} flash={flash} />}
        {view === "extensions" && <ExtensionCenterV2 edition={edition} installed={activeModules} setInstalled={keys => setInstalledModules(value => ({ ...value, [edition]: keys }))} flash={flash} />}
        {moduleRegistry.some(module => module.key === view && module.menu) && <InjectedModulePage module={moduleRegistry.find(module => module.key === view)!} flash={flash} />}
        {view === "settings" && <SettingsPanelV2 settings={settings} setSettings={setSettings} modules={moduleRegistry.filter(module => activeModules.includes(module.key) && module.slots.includes("settings.section"))} flash={flash} />}
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
  return <main className="demoLogin realLogin"><section><a href="https://bypcms.ru/" className="demoBrand"><b>B</b> BYPCMS <span>DEMO</span></a><div><small>ТРИ ПОЛНОЦЕННЫЕ АДМИН-ПАНЕЛИ</small><h1>Посмотрите,<br />как работает сайт.</h1><p>Не презентация функций, а настоящая панель покупателя. Управляйте материалами, услугами, заявками, товарами, заказами, SEO и дизайном.</p><div className="loginEditions">{Object.entries(editions).map(([key, item]) => <span key={key}><b>{item.name}</b>{item.note}<small>{item.menu.length} рабочих разделов</small></span>)}</div></div></section><form onSubmit={submit}><small>БЕЗОПАСНАЯ ДЕМО-СЕССИЯ</small><h2>Войти в панель</h2><p>Создавайте, изменяйте, удаляйте и просматривайте записи. Изменения останутся только в этом браузере.</p><label>Логин<input name="login" defaultValue="demo" /></label><label>Пароль<input name="password" type="password" defaultValue="demo" /></label>{notice && <em>{notice}</em>}<button>Открыть админ-панель →</button><a href="https://bypcms.ru/">← Вернуться на BYPCMS</a></form></main>;
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
  return <><PageHeading eyebrow={`BYPCMS ${editions[edition].name}`} title={data.title} description={editions[edition].note} actions={<button onClick={() => onNavigate(data.primary)}>Открыть рабочий раздел →</button>} /><section className="dashboardWidgets">{data.stats.map(([value, label, delta]) => <article key={label}><small>{label}</small><strong>{value}</strong><span>{delta}</span></article>)}</section><section className="dashboardGrid"><article className="performanceWidget"><header><div><small>ДИНАМИКА ЗА 30 ДНЕЙ</small><h2>{edition === "commerce" ? "Продажи" : edition === "business" ? "Новые обращения" : "Аудитория"}</h2></div><select><option>30 дней</option><option>7 дней</option><option>Год</option></select></header><div className="realChart">{[42, 54, 48, 69, 63, 78, 72, 88, 76, 96, 82, 100].map((height, i) => <i key={i} style={{ height: `${height}%` }} />)}</div><footer><b>+18,4%</b><span>по сравнению с прошлым периодом</span></footer></article><article className="attentionWidget"><small>ТРЕБУЕТ ВНИМАНИЯ</small><h2>Задачи</h2>{["Заполнить SEO у 2 страниц", "Ответить на новые обращения", "Проверить неопубликованный материал", "Обновить резервную копию"].map((item, index) => <button onClick={() => onNavigate(index === 0 ? "seo" : index === 1 ? data.primary : index === 2 ? (edition === "content" ? "articles" : data.primary) : "settings")} key={item}><i>{index + 1}</i><span>{item}<small>{index < 2 ? "Сегодня" : "На этой неделе"}</small></span>→</button>)}</article></section><section className="moduleWidgetRow">{moduleWidgets.map((module, index) => <button onClick={() => onNavigate(module.menu?.id || (module.key === "seo" ? "seo" : module.key === "analytics" ? "analytics" : "extensions"))} style={{ "--module-color": module.color } as React.CSSProperties} key={module.key}><i>{module.name[0]}</i><span><small>ВИДЖЕТ МОДУЛЯ</small><b>{module.name}</b><em>{module.key === "faq" ? "3 вопроса без ответа" : module.key === "reviews" ? "4 отзыва на модерации" : index % 2 ? "Все события передаются" : "Работает штатно"}</em></span>→</button>)}</section><section className="recentWidget"><header><div><small>ПОСЛЕДНИЕ ИЗМЕНЕНИЯ</small><h2>{entityTitles[data.recent[0]?.kind || "pages"].title}</h2></div><button onClick={() => onNavigate(data.primary)}>Все записи →</button></header>{data.recent.slice(0, 3).map(item => <button onClick={() => onNavigate(data.primary)} key={item.id}><MediaThumb index={item.image} /><span><b>{item.title}</b><small>{item.extra || item.excerpt}</small></span><em>{item.status}</em><time>{item.updated}</time></button>)}</section></>;
}

function PageHeading({ eyebrow, title, description, actions }: { eyebrow: string; title: string; description: string; actions?: React.ReactNode }) {
  return <header className="realPageHeading"><div><small>{eyebrow}</small><h1>{title}</h1><p>{description}</p></div>{actions && <div>{actions}</div>}</header>;
}

function RichTextField({ value, onChange, onOpenCode }: { value: string; onChange: (value: string) => void; onOpenCode: () => void }) {
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const [mode, setMode] = useState<"visual" | "html">("visual");
  const insert = (before: string, after: string, placeholder: string) => {
    const field = editorRef.current;
    const start = field?.selectionStart ?? value.length;
    const end = field?.selectionEnd ?? value.length;
    const selected = value.slice(start, end) || placeholder;
    const next = `${value.slice(0, start)}${before}${selected}${after}${value.slice(end)}`;
    onChange(next);
    window.requestAnimationFrame(() => { field?.focus(); field?.setSelectionRange(start + before.length, start + before.length + selected.length); });
  };
  return <div className="richTextEditor"><header><div className="richMode"><button className={mode === "visual" ? "active" : ""} onClick={() => setMode("visual")}>Редактор</button><button className={mode === "html" ? "active" : ""} onClick={() => setMode("html")}>HTML</button></div><span>{value.length} символов</span></header><div className="richToolbar"><button title="Полужирный" onClick={() => insert("<strong>", "</strong>", "Текст")}><b>B</b></button><button title="Курсив" onClick={() => insert("<em>", "</em>", "Текст")}><i>I</i></button><button title="Заголовок второго уровня" onClick={() => insert("<h2>", "</h2>", "Заголовок")}>H2</button><button title="Абзац" onClick={() => insert("<p>", "</p>", "Абзац")}>¶</button><button title="Маркированный список" onClick={() => insert("<ul><li>", "</li></ul>", "Пункт списка")}>☷</button><button title="Ссылка" onClick={() => insert('<a href="#">', "</a>", "Текст ссылки")}>↗</button><button title="Цитата" onClick={() => insert("<blockquote>", "</blockquote>", "Цитата")}>“”</button><button title="Отдельный HTML-блок" onClick={onOpenCode}>{"</>"}</button></div><textarea ref={editorRef} className={mode === "html" ? "htmlMode" : ""} value={value} onChange={event => onChange(event.target.value)} rows={10} aria-label="Основной текст" />{mode === "visual" && <div className="richPreview"><small>ПРЕДПРОСМОТР ТЕКСТА</small><div dangerouslySetInnerHTML={{ __html: sanitizeDemoHtml(value) }} /></div>}</div>;
}

function EntityList({ kind, entities, onEdit, onCreate, onPreview }: { kind: EntityKind; entities: DemoEntity[]; onEdit: (item: DemoEntity) => void; onCreate: () => void; onPreview: (item: DemoEntity) => void }) {
  const meta = entityTitles[kind];
  const visual = ["articles", "projects", "products", "brands", "services", "team", "authors", "categories"].includes(kind);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("Все статусы");
  const [sort, setSort] = useState("Сначала новые");
  const visible = entities.filter(item => (!query || `${item.title} ${item.excerpt} ${item.extra || ""}`.toLowerCase().includes(query.toLowerCase())) && (status === "Все статусы" || item.status === status)).sort((a, b) => sort === "По названию" ? a.title.localeCompare(b.title, "ru") : b.id - a.id);
  const countLabel = visible.length % 10 === 1 && visible.length % 100 !== 11 ? "запись" : visible.length % 10 >= 2 && visible.length % 10 <= 4 && (visible.length % 100 < 10 || visible.length % 100 >= 20) ? "записи" : "записей";
  return <><PageHeading eyebrow="УПРАВЛЕНИЕ САЙТОМ" title={meta.title} description={meta.description} actions={<button onClick={onCreate}>＋ Добавить {meta.singular}</button>} /><div className="listToolbar"><label>⌕ <input value={query} onChange={event => setQuery(event.target.value)} placeholder={`Поиск: ${meta.title.toLowerCase()}`} /></label><select value={status} onChange={event => setStatus(event.target.value)}><option>Все статусы</option><option>Опубликовано</option><option>Черновик</option></select><select value={sort} onChange={event => setSort(event.target.value)}><option>Сначала новые</option><option>По названию</option></select><button onClick={() => { setQuery(""); setStatus("Все статусы"); setSort("Сначала новые"); }}>Сбросить фильтры</button></div>{visual ? <section className="entityCards">{visible.map(item => <article key={item.id}><MediaThumb index={item.image} large /><div><small>{item.category || item.brand || item.extra || meta.title}</small><h3>{item.title}</h3><p>{item.excerpt}</p>{item.price !== undefined && <strong>{item.price.toLocaleString("ru-RU")} ₽</strong>}<footer><em className={item.status === "Опубликовано" ? "published" : ""}>{item.status}</em><button onClick={() => onPreview(item)}>Просмотр ↗</button><button onClick={() => onEdit(item)}>Редактировать</button></footer></div></article>)}</section> : <section className="entityTable"><header><span>Название</span><span>Информация</span><span>Статус</span><span>Обновлено</span><span /></header>{visible.map(item => <button onClick={() => onEdit(item)} key={item.id}><MediaThumb index={item.image} /><span><b>{item.title}</b><small>{item.slug}</small></span><span>{item.extra || item.email || (item.value !== undefined ? `${item.value.toLocaleString("ru-RU")} ₽` : "—")}</span><em>{item.status}</em><time>{item.date || item.updated}</time><i>•••</i></button>)}</section>}<footer className="listFooter"><span>Показано {visible.length} {countLabel}</span><div><button disabled>←</button><button className="active">1</button><button disabled>→</button></div></footer></>;
}

function EntityEditor({ entity, tab, setTab, entities, installed, onSave, onDelete, onCancel, onPreview, flash }: { entity: DemoEntity; tab: EditorTab; setTab: (tab: EditorTab) => void; entities: DemoEntity[]; installed: DemoModule[]; onSave: (item: DemoEntity) => void; onDelete: (item: DemoEntity) => void; onCancel: () => void; onPreview: (item: DemoEntity) => void; flash: (message: string) => void }) {
  const [draft, setDraft] = useState(entity);
  const [mediaOpen, setMediaOpen] = useState(false);
  const [blockOrder, setBlockOrder] = useState(["excerpt", "text", "image"]);
  const [draggedBlock, setDraggedBlock] = useState<string | null>(null);
  const [codeBlock, setCodeBlock] = useState(false);
  const [blockPickerOpen, setBlockPickerOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [customCode, setCustomCode] = useState('<section class="promo"><h2>Собственный HTML-блок</h2><p>Разметка шаблона или код виджета.</p></section>');
  const meta = entityTitles[entity.kind];
  const newEntityTitle: Record<EntityKind, string> = {
    pages: "Новая страница", articles: "Новый материал", categories: "Новая категория", authors: "Новый автор",
    services: "Новая услуга", projects: "Новый проект", team: "Новый сотрудник", leads: "Новая заявка",
    forms: "Новая форма", orders: "Новый заказ", products: "Новый товар", brands: "Новый производитель",
    customers: "Новый покупатель", promos: "Новый промокод", payments: "Новый платёж",
  };
  const commerce = entity.kind === "products";
  const contact = ["leads", "customers", "team", "authors"].includes(entity.kind);
  const transactional = ["orders", "payments"].includes(entity.kind);
  const editorModules = installed.filter(module => module.editorKinds?.includes(entity.kind) && module.key !== "seo");
  const hasSeo = installed.some(module => module.key === "seo" && module.editorKinds?.includes(entity.kind));
  const update = <K extends keyof DemoEntity>(key: K, value: DemoEntity[K]) => setDraft(old => ({ ...old, [key]: value }));
  const addBlock = (type: DemoContentBlock["type"]) => {
    const presets: Record<DemoContentBlock["type"], [string, string]> = {
      heading: ["Новый заголовок", "Подзаголовок раздела"], gallery: ["Галерея", "Изображения из медиатеки"],
      button: ["Подробнее", "/contacts"], form: ["Оставить заявку", "Имя, телефон и сообщение"],
      code: ["HTML-блок", "<section><h2>Собственный блок</h2></section>"],
    };
    const [title, content] = presets[type];
    update("blocks", [...(draft.blocks || []), { id: Date.now(), type, title, content }]);
    setBlockPickerOpen(false);
    flash(`Добавлен блок «${title}»`);
  };
  const updateBlock = (id: number, key: "title" | "content", value: string) => update("blocks", (draft.blocks || []).map(block => block.id === id ? { ...block, [key]: value } : block));
  const removeBlock = (id: number) => update("blocks", (draft.blocks || []).filter(block => block.id !== id));
  const saveDraft = () => {
    const title = draft.title.trim();
    const rawSlug = draft.slug.trim();
    if (!title) { setTab("content"); flash("Укажите название записи — пустой материал сохранить нельзя"); return; }
    if (!rawSlug || (rawSlug === "/" && entity.id > 100000)) { setTab("content"); flash("Укажите уникальный адрес страницы"); return; }
    const slug = rawSlug.startsWith("/") ? rawSlug : `/${rawSlug}`;
    onSave({ ...draft, title, slug });
  };
  const blockProps = (id: string) => ({
    draggable: true,
    style: { order: blockOrder.indexOf(id) + 1 },
    onDragStart: () => setDraggedBlock(id),
    onDragOver: (event: React.DragEvent) => event.preventDefault(),
    onDrop: () => {
      if (!draggedBlock || draggedBlock === id) return;
      setBlockOrder(order => {
        const next = order.filter(item => item !== draggedBlock);
        next.splice(next.indexOf(id), 0, draggedBlock);
        return next;
      });
      setDraggedBlock(null);
      flash("Порядок блоков изменён");
    },
  });
  return <><header className="editorHeader"><button onClick={onCancel}>← {meta.title}</button><div><small>{entity.id > 100000 ? "НОВАЯ ЗАПИСЬ" : `ID ${entity.id}`}</small><h1>{draft.title || newEntityTitle[entity.kind]}</h1></div><span className={`statusDot ${draft.status === "Опубликовано" ? "live" : ""}`}>{draft.status}</span><button onClick={() => onPreview(draft)}>Предпросмотр ↗</button><button className="primary" onClick={saveDraft}>Сохранить</button></header><nav className="editorTabs"><button className={tab === "content" ? "active" : ""} onClick={() => setTab("content")}>Содержание</button>{hasSeo && <button className={tab === "seo" ? "active" : ""} onClick={() => setTab("seo")}>SEO и соцсети <em>Pro</em></button>}{editorModules.map(module => <button className={tab === `module:${module.key}` ? "active" : ""} onClick={() => setTab(`module:${module.key}`)} key={module.key}>{module.name}<em>Модуль</em></button>)}<button className={tab === "settings" ? "active" : ""} onClick={() => setTab("settings")}>Публикация</button></nav>
    {tab === "content" && <div className="editorLayout"><section className="editorMain"><div className="fieldCard"><label>Название<input value={draft.title} onChange={event => update("title", event.target.value)} placeholder={`Название: ${meta.singular}`} /></label><label>Адрес страницы<div className="slugField"><span>demo.bypcms.ru</span><input value={draft.slug} onChange={event => update("slug", event.target.value)} /></div></label></div>{commerce && <div className="fieldCard fieldGrid"><label>Артикул<input value={draft.sku || ""} onChange={event => update("sku", event.target.value)} /></label><label>Производитель<select value={draft.brand || ""} onChange={event => update("brand", event.target.value)}><option>Forma</option><option>Nord</option><option>Lumo</option></select></label><label>Цена, ₽<input type="number" value={draft.price || 0} onChange={event => update("price", Number(event.target.value))} /></label><label>Старая цена, ₽<input type="number" value={draft.oldPrice || 0} onChange={event => update("oldPrice", Number(event.target.value))} /></label><label>Остаток<input type="number" value={draft.stock || 0} onChange={event => update("stock", Number(event.target.value))} /></label><label>Категория<select value={draft.category || ""} onChange={event => update("category", event.target.value)}><option>Мебель</option><option>Освещение</option></select></label></div>}{contact && <div className="fieldCard fieldGrid"><label>Email<input type="email" value={draft.email || ""} onChange={event => update("email", event.target.value)} /></label><label>Телефон<input value={draft.phone || ""} onChange={event => update("phone", event.target.value)} /></label>{draft.value !== undefined && <label>Сумма, ₽<input type="number" value={draft.value} onChange={event => update("value", Number(event.target.value))} /></label>}<label>{entity.kind === "authors" ? "Должность автора" : entity.kind === "team" ? "Должность сотрудника" : "Дополнительная информация"}<input value={draft.extra || ""} onChange={event => update("extra", event.target.value)} placeholder={entity.kind === "authors" ? "Редактор, эксперт, фотограф…" : ""} /></label></div>}{transactional && <OrderFields draft={draft} update={update} />}
      <div className="fieldCard contentBlocks">
        <header><div><small>КОНТЕНТ СТРАНИЦЫ</small><h2>Блочный редактор</h2></div><button onClick={() => setBlockPickerOpen(value => !value)}>＋ Добавить блок</button></header>
        <article className="contentBlock" {...blockProps("excerpt")}><i title="Перетащите блок">⋮⋮</i><div><small>КРАТКОЕ ОПИСАНИЕ</small><textarea value={draft.excerpt} onChange={event => update("excerpt", event.target.value)} rows={3} placeholder="Описание для карточки и анонса" /></div><button onClick={() => setBlockOrder(order => [...order.slice(1), order[0]])}>↓</button></article>
        <article className="contentBlock richBlock" {...blockProps("text")}><i title="Перетащите блок">⋮⋮</i><div><small>ОСНОВНОЙ ТЕКСТ</small><RichTextField value={draft.body} onChange={value => update("body", value)} onOpenCode={() => addBlock("code")} /></div><button onClick={() => setBlockOrder(order => [...order.slice(1), order[0]])}>↓</button></article>
        <article className="contentBlock imageBlock" {...blockProps("image")}><i title="Перетащите блок">⋮⋮</i><div><small>ИЗОБРАЖЕНИЕ</small><MediaThumb index={draft.image} large /><span>{mediaItems[draft.image]?.name}<button onClick={() => setMediaOpen(true)}>Заменить</button></span></div><button onClick={() => setBlockOrder(order => [...order.slice(1), order[0]])}>↓</button></article>
        {(draft.blocks || []).map((block, index) => <article className={`contentBlock customContentBlock type-${block.type}`} style={{ order: 10 + index }} key={block.id}><i title="Пользовательский блок">{block.type === "heading" ? "T" : block.type === "gallery" ? "▧" : block.type === "button" ? "↗" : block.type === "form" ? "☷" : "⌘"}</i><div><small>{block.type === "heading" ? "ЗАГОЛОВОК" : block.type === "gallery" ? "ГАЛЕРЕЯ" : block.type === "button" ? "КНОПКА" : block.type === "form" ? "ФОРМА" : "HTML / КОД"}</small><input value={block.title} onChange={event => updateBlock(block.id, "title", event.target.value)} aria-label="Название блока" />{block.type === "code" ? <textarea className="blockCodeEditor" spellCheck={false} rows={7} value={block.content} onChange={event => updateBlock(block.id, "content", event.target.value)} aria-label="HTML-код блока" /> : <textarea rows={3} value={block.content} onChange={event => updateBlock(block.id, "content", event.target.value)} aria-label="Содержимое блока" />}{block.type === "gallery" && <div className="blockGalleryPreview">{[0,1,2].map(item => <MediaThumb index={item} key={item} />)}</div>}{block.type === "form" && <div className="blockFormPreview"><input readOnly placeholder="Имя" /><input readOnly placeholder="Телефон" /><button type="button">Отправить</button></div>}</div><button aria-label="Удалить блок" onClick={() => removeBlock(block.id)}>×</button></article>)}
        {codeBlock && <article className="contentBlock codeBlock" style={{ order: 20 }}><i>⌘</i><div><small>HTML / CSS / КОД ВИДЖЕТА</small><textarea spellCheck={false} value={customCode} onChange={event => setCustomCode(event.target.value)} rows={9} /><p>Код хранится как отдельный безопасный блок. В рабочей CMS права на script и iframe задаются политикой проекта.</p></div><button onClick={() => setCodeBlock(false)}>×</button></article>}
        {blockPickerOpen && <div className="blockPicker"><button onClick={() => addBlock("heading")}>T Заголовок</button><button onClick={() => addBlock("gallery")}>▧ Галерея</button><button onClick={() => addBlock("button")}>↗ Кнопка</button><button onClick={() => addBlock("form")}>☷ Форма</button><button onClick={() => addBlock("code")}>{"</>"} HTML / код</button></div>}
      </div></section><aside className="editorAside"><div className="sideCard"><small>ОБЛОЖКА</small><MediaThumb index={draft.image} large /><button onClick={() => setMediaOpen(true)}>Выбрать изображение</button><label>Alt-текст<input value={mediaItems[draft.image]?.alt || ""} readOnly /></label></div><div className="sideCard"><small>ПАРАМЕТРЫ</small>{!commerce && !contact && !transactional && <label>Категория<input value={draft.category || ""} onChange={event => update("category", event.target.value)} placeholder="Без категории" /></label>}<label>Статус<select value={draft.status} onChange={event => update("status", event.target.value)}><option>Черновик</option><option>Опубликовано</option><option>Скрыт</option><option>Новый</option><option>В работе</option><option>Согласовано</option><option>Оплачен</option><option>Доставляется</option></select></label><label className="checkLine"><input type="checkbox" checked={!!draft.featured} onChange={event => update("featured", event.target.checked)} />Показывать на главной</label></div><div className="sideCard dangerCard"><button onClick={() => setConfirmDelete(true)}>Удалить запись</button></div></aside></div>}
    {tab === "seo" && <SeoEditorV2 draft={draft} update={update} />}
    {tab.startsWith("module:") && <EditorModuleSlot module={installed.find(item => item.key === tab.replace("module:", ""))!} entity={draft} flash={flash} />}
    {tab === "settings" && <PublishEditor draft={draft} update={update} onSave={saveDraft} onPreview={() => onPreview(draft)} />}
    {mediaOpen && <MediaPicker selected={draft.image} onSelect={index => { update("image", index); setMediaOpen(false); }} onClose={() => setMediaOpen(false)} />}
    {confirmDelete && <div className="demoModal"><section className="confirmDialog deleteConfirm"><small>УДАЛЕНИЕ ЗАПИСИ</small><h2>Удалить «{draft.title || newEntityTitle[draft.kind]}»?</h2><p>Запись исчезнет из списка и публичного предпросмотра. В демо данные можно восстановить общим сбросом сессии.</p><div><button onClick={() => setConfirmDelete(false)}>Отмена</button><button className="dangerAction" onClick={() => onDelete(draft)}>Удалить запись</button></div></section></div>}
  </>;
}

function OrderFields({ draft, update }: { draft: DemoEntity; update: <K extends keyof DemoEntity>(key: K, value: DemoEntity[K]) => void }) {
  const [deliveryOpen, setDeliveryOpen] = useState(false);
  return <div className="fieldCard orderEditor"><div><small>КЛИЕНТ И ДОСТАВКА</small><h3>{draft.extra}</h3>{deliveryOpen ? <><label>Клиент<input value={draft.extra || ""} onChange={event => update("extra", event.target.value)} /></label><label>Адрес<input defaultValue="Москва, ул. Тверская, 12" /></label><button onClick={() => setDeliveryOpen(false)}>Готово</button></> : <><p>Москва, ул. Тверская, 12 · Курьерская доставка</p><button onClick={() => setDeliveryOpen(true)}>Изменить данные</button></>}</div><div><small>СУММА ОПЕРАЦИИ</small><label>Сумма, ₽<input type="number" value={draft.value || 0} onChange={event => update("value", Number(event.target.value))} /></label><label>Статус<select value={draft.status} onChange={event => update("status", event.target.value)}><option>Новый</option><option>Оплачен</option><option>Комплектуется</option><option>Доставляется</option><option>Завершён</option><option>Возврат</option></select></label></div><section><MediaThumb index={2} /><span><b>Кресло Forma 01</b><small>FRM-001 · 1 шт.</small></span><strong>{(draft.value || 0).toLocaleString("ru-RU")} ₽</strong></section></div>;
}

function SeoEditor({ draft, update }: { draft: DemoEntity; update: <K extends keyof DemoEntity>(key: K, value: DemoEntity[K]) => void }) {
  const score = Math.min(100, 58 + (draft.seoTitle.length > 20 ? 16 : 0) + (draft.seoDescription.length > 80 ? 16 : 0) + (draft.image >= 0 ? 10 : 0));
  return <div className="seoEditorLayout"><section><div className="seoScore"><strong>{score}</strong><div><b>SEO-оценка страницы</b><span>{score === 100 ? "Страница полностью оптимизирована" : "Заполните рекомендации ниже"}</span></div></div><div className="fieldCard"><small>ПОИСКОВАЯ ВЫДАЧА</small><h2>Метаданные</h2><label>Title <span>{draft.seoTitle.length}/60</span><input value={draft.seoTitle} onChange={event => update("seoTitle", event.target.value)} /></label><label>Description <span>{draft.seoDescription.length}/160</span><textarea rows={4} value={draft.seoDescription} onChange={event => update("seoDescription", event.target.value)} /></label><label>Канонический URL<input value={`https://demo.bypcms.ru${draft.slug}`} readOnly /></label><label className="checkLine"><input type="checkbox" defaultChecked />Разрешить индексацию страницы</label></div><div className="fieldCard"><small>СОЦИАЛЬНЫЕ СЕТИ</small><h2>Open Graph</h2><div className="ogEditor"><MediaThumb index={draft.image} large /><div><label>Заголовок<input value={draft.seoTitle} onChange={event => update("seoTitle", event.target.value)} /></label><label>Описание<textarea rows={3} value={draft.seoDescription} onChange={event => update("seoDescription", event.target.value)} /></label></div></div></div></section><aside><div className="searchPreview"><small>ПРЕДПРОСМОТР GOOGLE</small><span>demo.bypcms.ru › {draft.slug.split("/").filter(Boolean).join(" › ")}</span><h3>{draft.seoTitle || draft.title}</h3><p>{draft.seoDescription || "Добавьте описание страницы для поисковой выдачи."}</p></div><div className="seoChecklist"><b>Рекомендации</b>{[["Заголовок страницы", draft.seoTitle.length > 20], ["Описание 80–160 символов", draft.seoDescription.length > 80], ["Читаемый URL", draft.slug.length > 1], ["Изображение для соцсетей", draft.image >= 0], ["Ключевая фраза в тексте", draft.body.length > 40]].map(([name, done]) => <p key={String(name)}><i className={done ? "done" : ""}>{done ? "✓" : "!"}</i>{String(name)}</p>)}</div></aside></div>;
}

function PublishEditor({ draft, update, onSave, onPreview }: { draft: DemoEntity; update: <K extends keyof DemoEntity>(key: K, value: DemoEntity[K]) => void; onSave: () => void; onPreview: () => void }) {
  const [revision, setRevision] = useState(0);
  return <div className="publishLayout"><section className="fieldCard"><small>ПУБЛИКАЦИЯ</small><h2>Статус и расписание</h2><label>Статус<select value={draft.status} onChange={event => update("status", event.target.value)}><option>Черновик</option><option>Опубликовано</option><option>Скрыт</option></select></label><label>Дата публикации<input type="datetime-local" defaultValue="2026-07-28T12:00" /></label><label>Автор<select defaultValue={draft.author || "Администратор BYPCMS"}><option>Администратор BYPCMS</option><option>Анна Левина</option><option>Илья Морозов</option></select></label><label className="checkLine"><input type="checkbox" defaultChecked />Добавить в sitemap.xml</label><label className="checkLine"><input type="checkbox" />Защитить паролем</label></section><aside><div className="revisionCard"><small>ИСТОРИЯ ИЗМЕНЕНИЙ</small><h3>Версии записи</h3>{["Текущая версия · только что", "Автосохранение · 12 минут назад", "Опубликовано · вчера, 18:40"].map((text, i) => <button className={revision === i ? "active" : ""} onClick={() => setRevision(i)} key={text}><i>{i + 1}</i>{text}<span>{revision === i ? "Выбрана" : "Восстановить"}</span></button>)}</div><button className="previewWide" onClick={onPreview}>Предпросмотр на сайте ↗</button><button className="saveWide" onClick={onSave}>Сохранить и опубликовать</button></aside></div>;
}

type MediaRecord = { id: number; name: string; alt: string; caption: string; type: "image" | "document"; details: string; preview?: string };

function MediaLibrary({ flash }: { flash: (message: string) => void }) {
  const initialMedia = useMemo<MediaRecord[]>(() => mediaItems.map(item => ({ ...item, caption: "Изображение из медиатеки BYPCMS", type: "image", details: "1536 × 1024 · JPG · 1,4 МБ" })), []);
  const [items, setItems] = useState(initialMedia);
  const [selected, setSelected] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "image" | "document">("all");
  const uploadRef = useRef<HTMLInputElement>(null);
  const selectedItem = items.find(item => item.id === selected) || null;
  const visibleItems = items.filter(item => (filter === "all" || item.type === filter) && `${item.name} ${item.alt}`.toLowerCase().includes(query.toLowerCase()));

  function updateSelected(key: "alt" | "caption", value: string) {
    if (selected === null) return;
    setItems(current => current.map(item => item.id === selected ? { ...item, [key]: value } : item));
  }

  function upload(files: FileList | null) {
    if (!files?.length) return;
    Array.from(files).forEach(file => {
      const id = Date.now() + Math.floor(Math.random() * 1000);
      const type: MediaRecord["type"] = file.type.startsWith("image/") ? "image" : "document";
      const record: MediaRecord = { id, name: file.name, alt: file.name.replace(/\.[^.]+$/, "").replace(/[-_]/g, " "), caption: "", type, details: `${type === "image" ? "Новое изображение" : "Документ"} · ${Math.max(1, Math.round(file.size / 1024))} КБ` };
      if (type === "image") {
        const reader = new FileReader();
        reader.onload = () => setItems(current => [{ ...record, preview: String(reader.result) }, ...current]);
        reader.readAsDataURL(file);
      } else setItems(current => [record, ...current]);
      setSelected(id);
    });
    flash(files.length === 1 ? "Файл добавлен в медиатеку" : `Добавлено файлов: ${files.length}`);
  }

  return <><PageHeading eyebrow="СИСТЕМА" title="Медиатека" description="Изображения, документы и варианты размеров" actions={<><input ref={uploadRef} className="mediaFileInput" type="file" accept="image/*,.pdf,.doc,.docx" multiple onChange={event => { upload(event.target.files); event.target.value = ""; }} /><button onClick={() => uploadRef.current?.click()}>＋ Загрузить файлы</button></>} /><div className="mediaToolbar"><label>⌕ <input aria-label="Поиск по файлам" value={query} onChange={event => setQuery(event.target.value)} placeholder="Поиск по файлам" /></label><button className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>Все файлы</button><button className={filter === "image" ? "active" : ""} onClick={() => setFilter("image")}>Изображения</button><button className={filter === "document" ? "active" : ""} onClick={() => setFilter("document")}>Документы</button><span>{visibleItems.length} из {items.length}</span></div>{visibleItems.length ? <section className="mediaLibrary">{visibleItems.map(item => <button className={selected === item.id ? "selected" : ""} onClick={() => setSelected(item.id)} key={item.id}>{item.preview ? <img className="uploadedMediaPreview" src={item.preview} alt={item.alt} /> : item.type === "image" ? <MediaThumb index={item.id} large /> : <span className="documentPreview">PDF</span>}<span><b>{item.name}</b><small>{item.details}</small></span><i>✓</i></button>)}</section> : <section className="mediaEmpty"><b>Файлы не найдены</b><span>Измените запрос или загрузите новый файл.</span></section>}{selectedItem && <aside className="mediaInspector">{selectedItem.preview ? <img className="uploadedMediaPreview" src={selectedItem.preview} alt={selectedItem.alt} /> : selectedItem.type === "image" ? <MediaThumb index={selectedItem.id} large /> : <span className="documentPreview">PDF</span>}<div><small>ВЫБРАННЫЙ ФАЙЛ</small><h2>{selectedItem.name}</h2><label>Alt-текст<input value={selectedItem.alt} onChange={event => updateSelected("alt", event.target.value)} /></label><label>Подпись<textarea value={selectedItem.caption} onChange={event => updateSelected("caption", event.target.value)} /></label><p><b>Оригинал</b> {selectedItem.details}</p>{selectedItem.type === "image" && <p><b>WebP</b> создаётся автоматически при публикации</p>}<button onClick={() => flash("Метаданные файла сохранены в демо-сессии")}>Сохранить</button><button className="danger" onClick={() => { setItems(current => current.filter(item => item.id !== selectedItem.id)); setSelected(null); flash("Файл удалён из демо-сессии"); }}>Удалить файл</button><button className="inspectorClose" onClick={() => setSelected(null)}>Закрыть</button></div></aside>}</>;
}

function MediaPicker({ selected, onSelect, onClose }: { selected: number; onSelect: (index: number) => void; onClose: () => void }) {
  return <div className="demoModal mediaPicker" onMouseDown={onClose}><section onMouseDown={event => event.stopPropagation()}><header><div><small>МЕДИАТЕКА</small><h2>Выберите изображение</h2></div><button onClick={onClose}>×</button></header><div>{mediaItems.map(item => <button className={selected === item.id ? "selected" : ""} onClick={() => onSelect(item.id)} key={item.id}><MediaThumb index={item.id} large /><span>{item.name}</span></button>)}</div></section></div>;
}

function SeoCenter({ entities, onEdit, flash }: { entities: DemoEntity[]; onEdit: (item: DemoEntity) => void; flash: (message: string) => void }) {
  const pages = entities.filter(item => ["pages", "articles", "products", "services", "projects", "categories"].includes(item.kind));
  return <><PageHeading eyebrow="SEO PRO" title="Поисковая оптимизация" description="SEO встроено во все страницы, материалы и карточки каталога" actions={<button onClick={() => flash("Повторный SEO-аудит завершён")}>Запустить аудит</button>} /><section className="seoSummary"><article><strong>94</strong><span><b>Общая оценка</b><small>Отличный результат</small></span></article><article><strong>{pages.length}</strong><span><b>Страниц проверено</b><small>2 требуют внимания</small></span></article><article><strong>100%</strong><span><b>Доступность</b><small>Ошибок сервера нет</small></span></article><article><strong>3</strong><span><b>Редиректа</b><small>Все работают</small></span></article></section><section className="seoPages"><header><span>Страница</span><span>SEO Title</span><span>Meta Description</span><span>Оценка</span><span /></header>{pages.slice(0, 8).map((item, index) => { const titleOk = item.seoTitle.length > 20; const descriptionOk = item.seoDescription.length > 80; return <button onClick={() => onEdit(item)} key={item.id}><MediaThumb index={item.image} /><span><b>{item.title}</b><small>{item.slug}</small></span><span className={`seoState ${titleOk ? "ok" : "issue"}`}><i>{titleOk ? "✓" : "!"}</i><small>{titleOk ? "Заполнен" : "Слишком короткий"}</small></span><span className={`seoState ${descriptionOk ? "ok" : "issue"}`}><i>{descriptionOk ? "✓" : "!"}</i><small>{descriptionOk ? "Заполнено" : "Добавьте описание"}</small></span><strong>{index % 4 === 0 ? 82 : 100}</strong><em>Редактировать →</em></button>; })}</section><section className="seoTools"><article><small>ТЕХНИЧЕСКОЕ SEO</small><h3>Sitemap.xml</h3><p>Обновлён 12 минут назад · {pages.length} URL</p><button onClick={() => flash("Sitemap.xml обновлён")}>Обновить карту сайта</button></article><article><small>ПЕРЕНАПРАВЛЕНИЯ</small><h3>Редиректы</h3><p>3 активных правила · ошибок нет</p><button onClick={() => flash("Редактор редиректов открыт: 3 активных правила")}>Управлять редиректами</button></article><article><small>ИНДЕКСАЦИЯ</small><h3>Robots.txt</h3><p>Правила настроены корректно</p><button onClick={() => flash("Редактор robots.txt открыт")}>Открыть редактор</button></article></section></>;
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

const fontChoices = ["Inter", "Manrope", "Roboto", "Montserrat", "Open Sans", "PT Sans", "PT Serif", "Playfair Display", "Lora", "Georgia", "Arial", "Verdana", "Trebuchet MS", "Times New Roman"];

function DesignStudioV2({ edition, theme, setTheme, settings, setSettings, flash }: { edition: EditionKey; theme: ThemeState; setTheme: React.Dispatch<React.SetStateAction<ThemeState>>; settings: SettingsState; setSettings: React.Dispatch<React.SetStateAction<SettingsState>>; flash: (message: string) => void }) {
  const [panel, setPanel] = useState<"templates" | "brand" | "layout" | "code">("templates");
  const updateTheme = <K extends keyof ThemeState>(key: K, value: ThemeState[K]) => setTheme(old => ({ ...old, [key]: value }));
  const chooseTemplate = (template: string) => setTheme(old => ({ ...old, template, editionTemplates: { ...old.editionTemplates, [edition]: template } }));
  const updateSettings = <K extends keyof SettingsState>(key: K, value: SettingsState[K]) => setSettings(old => ({ ...old, [key]: value }));
  function loadLogo(file?: File) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { updateSettings("logo", String(reader.result)); flash("Логотип загружен и показан в предпросмотре"); };
    reader.readAsDataURL(file);
  }
  function loadTemplate(file?: File) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setTheme(old => ({ ...old, template: "custom", editionTemplates: { ...old.editionTemplates, [edition]: "custom" }, customTemplateName: file.name, customTemplateSource: String(reader.result) }));
    reader.readAsText(file);
    flash("Шаблон загружен в безопасный редактор предпросмотра");
  }
  return <><PageHeading eyebrow="ДИЗАЙН САЙТА" title="Визуальные настройки" description="Шаблон, фирменный стиль и код с живым предпросмотром" actions={<button onClick={() => flash("Настройки дизайна опубликованы")}>Опубликовать дизайн</button>} /><nav className="designTabs" aria-label="Разделы дизайн-студии">{[["templates","Шаблоны"],["brand","Бренд и шрифты"],["layout","Шапка и макет"],["code","Код шаблона"]].map(([id,label]) => <button className={panel === id ? "active" : ""} onClick={() => setPanel(id as typeof panel)} key={id}>{label}</button>)}</nav><div className="designEditor designEditorV2"><aside>
    {panel === "templates" && <section className="templateChooser"><small>3 ШАБЛОНА ДЛЯ BYPCMS {editions[edition].name.toUpperCase()}</small>{templateCatalog[edition].map(item => <button className={theme.template === item.id ? "active" : ""} onClick={() => chooseTemplate(item.id)} key={item.id}><i className={`miniTemplate ${item.id}`} /><span><b>{item.name}</b><small>{item.note}</small></span>{theme.template === item.id ? "✓" : "→"}</button>)}</section>}
    {panel === "code" && <section className="templateDeveloper"><small>СВОЙ ШАБЛОН</small><h3>Редактор разработчика</h3><p className="fieldHelp">Загрузите HTML-шаблон или редактируйте разметку. Скрипты и опасные атрибуты удаляются, переменные заменяются данными проекта.</p><div className="templateVariables">{["{{site.name}}","{{site.slogan}}","{{page.title}}","{{page.excerpt}}","{{page.image}}","{{product.price}}"].map(variable => <code key={variable}>{variable}</code>)}</div><label className="uploadButton">Загрузить HTML-шаблон<input type="file" accept=".html,.htm,.txt" onChange={event => loadTemplate(event.target.files?.[0])} /></label><label>Название шаблона<input value={theme.customTemplateName || ""} onChange={event => updateTheme("customTemplateName", event.target.value)} placeholder="Мой шаблон" /></label><label>HTML-разметка<textarea rows={18} spellCheck={false} value={theme.customTemplateSource || ""} onChange={event => updateTheme("customTemplateSource", event.target.value)} placeholder="<section><h1>{{page.title}}</h1></section>" /></label><button className="primary" onClick={() => chooseTemplate("custom")}>Применить и показать справа</button></section>}
    {panel === "brand" && <><section><small>ЛОГОТИП И СЛОГАН</small><div className="logoControl">{settings.logo ? <img src={settings.logo} alt="Логотип сайта" /> : <b>{settings.siteName.slice(0, 1)}</b>}<span><strong>{settings.siteName}</strong><small>{settings.slogan}</small></span></div><label className="uploadButton">Загрузить логотип<input type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" onChange={event => loadLogo(event.target.files?.[0])} /></label>{settings.logo && <button onClick={() => updateSettings("logo", "")}>Удалить логотип</button>}<label>Слоган<input value={settings.slogan || ""} onChange={event => updateSettings("slogan", event.target.value)} placeholder="Короткая фраза о компании" /></label></section><section><small>ТИПОГРАФИКА</small><label>Основной текст<select value={theme.font} onChange={event => updateTheme("font", event.target.value)}>{fontChoices.map(font => <option key={font}>{font}</option>)}</select></label><label>Заголовки<select value={theme.headingFont || theme.font} onChange={event => updateTheme("headingFont", event.target.value)}>{fontChoices.map(font => <option key={font}>{font}</option>)}</select></label><label>Свой шрифт<input value={theme.customFont || ""} onChange={event => updateTheme("customFont", event.target.value)} placeholder="Название, например MyBrand Sans" /></label><p className="fieldHelp">В рабочей CMS сюда загружаются WOFF2/WOFF. В демо название применяется, если шрифт установлен в системе.</p></section></>}
    {panel === "layout" && <><section><small>ШАПКА И МЕНЮ</small><label>Расположение меню<select value={theme.menuPosition || "center"} onChange={event => updateTheme("menuPosition", event.target.value as ThemeState["menuPosition"])}><option value="left">Слева от логотипа</option><option value="center">По центру</option><option value="right">Справа</option><option value="drawer">Кнопка-меню</option></select></label><label>Оформление шапки<select value={theme.header} onChange={event => updateTheme("header", event.target.value)}><option>Светлая</option><option>Тёмная</option><option>Прозрачная</option></select></label></section><section><small>ФИРМЕННЫЙ СТИЛЬ</small><label>Акцентный цвет<input type="color" value={theme.accent} onChange={event => updateTheme("accent", event.target.value)} /></label><label>Фон сайта<input type="color" value={theme.background} onChange={event => updateTheme("background", event.target.value)} /></label><label>Скругление <b>{theme.radius}px</b><input type="range" min="0" max="28" value={theme.radius} onChange={event => updateTheme("radius", Number(event.target.value))} /></label><label>Ширина контента <b>{theme.container}px</b><input type="range" min="1040" max="1440" step="40" value={theme.container} onChange={event => updateTheme("container", Number(event.target.value))} /></label></section></>}
  </aside><LiveSite edition={edition} entity={null} theme={theme} settings={settings} /></div></>;
}

function SeoEditorV2({ draft, update }: { draft: DemoEntity; update: <K extends keyof DemoEntity>(key: K, value: DemoEntity[K]) => void }) {
  const recommendations = [
    { key: "title", title: "Заголовок короче 60 символов", detail: draft.seoTitle.length < 20 ? "Сейчас заголовок слишком короткий. Добавьте назначение страницы и бренд." : draft.seoTitle.length > 60 ? `Удалите ${draft.seoTitle.length - 60} символов.` : "Длина заголовка оптимальна.", done: draft.seoTitle.length >= 20 && draft.seoTitle.length <= 60, fix: () => update("seoTitle", `${draft.title} — ${draft.category || "Northline Studio"}`.slice(0, 60)) },
    { key: "description", title: "Описание от 80 до 160 символов", detail: draft.seoDescription.length < 80 ? `Добавьте ещё минимум ${80 - draft.seoDescription.length} символов: пользу, особенности и призыв.` : draft.seoDescription.length > 160 ? `Сократите описание на ${draft.seoDescription.length - 160} символов.` : "Описание соответствует рекомендуемой длине.", done: draft.seoDescription.length >= 80 && draft.seoDescription.length <= 160, fix: () => update("seoDescription", `${draft.excerpt} Узнайте подробности, стоимость и условия на официальной странице Northline Studio.`.slice(0, 155)) },
    { key: "url", title: "Понятный адрес страницы", detail: draft.slug.length > 1 && !draft.slug.includes(" ") ? "URL читаемый и не содержит пробелов." : "Укажите короткий адрес латиницей без пробелов.", done: draft.slug.length > 1 && !draft.slug.includes(" "), fix: () => update("slug", `/page-${draft.id}`) },
    { key: "image", title: "Изображение для соцсетей", detail: draft.image >= 0 ? "Изображение выбрано." : "Выберите обложку не меньше 1200×630 px.", done: draft.image >= 0, fix: () => update("image", 0) },
    { key: "body", title: "Содержательный основной текст", detail: draft.body.length > 80 ? "Объём текста достаточный." : "Добавьте описание, преимущества и ответы на частые вопросы.", done: draft.body.length > 80, fix: () => update("body", `${draft.body} Подробное описание предложения, его преимущества, условия использования и ответы на основные вопросы клиентов.`) },
  ];
  const doneCount = recommendations.filter(item => item.done).length;
  const score = 45 + doneCount * 11;
  return <div className="seoEditorLayout"><section><div className="seoScore"><strong>{score}</strong><div><b>SEO-оценка страницы</b><span>{doneCount === recommendations.length ? "Все основные рекомендации выполнены" : `Осталось исправить: ${recommendations.length - doneCount}`}</span></div></div><div className="fieldCard"><small>ПОИСКОВАЯ ВЫДАЧА</small><h2>Метаданные</h2><label>Title <span className={draft.seoTitle.length > 60 ? "limitBad" : ""}>{draft.seoTitle.length}/60</span><input value={draft.seoTitle} onChange={event => update("seoTitle", event.target.value)} /></label><label>Description <span className={draft.seoDescription.length > 160 ? "limitBad" : ""}>{draft.seoDescription.length}/160</span><textarea rows={4} value={draft.seoDescription} onChange={event => update("seoDescription", event.target.value)} /></label><label>Канонический URL<input value={`https://demo.bypcms.ru${draft.slug}`} readOnly /></label><label className="checkLine"><input type="checkbox" defaultChecked />Разрешить индексацию страницы</label></div><div className="fieldCard"><small>СОЦИАЛЬНЫЕ СЕТИ</small><h2>Open Graph</h2><div className="ogEditor"><MediaThumb index={draft.image} large /><div><label>Заголовок<input value={draft.seoTitle} onChange={event => update("seoTitle", event.target.value)} /></label><label>Описание<textarea rows={3} value={draft.seoDescription} onChange={event => update("seoDescription", event.target.value)} /></label></div></div></div></section><aside><div className="searchPreview"><small>ПРЕДПРОСМОТР GOOGLE</small><span>demo.bypcms.ru › {draft.slug.split("/").filter(Boolean).join(" › ")}</span><h3>{draft.seoTitle || draft.title}</h3><p>{draft.seoDescription || "Добавьте описание страницы для поисковой выдачи."}</p></div><div className="seoChecklist seoChecklistV2"><b>Что исправить</b>{recommendations.map(item => <article className={item.done ? "done" : ""} key={item.key}><i>{item.done ? "✓" : "!"}</i><span><strong>{item.title}</strong><small>{item.detail}</small></span>{!item.done && <button onClick={item.fix}>Исправить</button>}</article>)}</div></aside></div>;
}

function ExtensionCenterV2({ edition, installed, setInstalled, flash }: { edition: EditionKey; installed: string[]; setInstalled: (keys: string[]) => void; flash: (message: string) => void }) {
  const [filter, setFilter] = useState<"installed" | "catalog" | "updates">("installed");
  const [settingsModule, setSettingsModule] = useState<DemoModule | null>(null);
  const [installing, setInstalling] = useState<DemoModule | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const compatible = moduleRegistry.filter(module => module.editions.includes(edition));
  const list = filter === "installed" ? compatible.filter(module => installed.includes(module.key)) : filter === "updates" ? compatible.filter(module => installed.includes(module.key)).slice(0, 2) : compatible;
  function confirmToggle() {
    if (!installing) return;
    const active = installed.includes(installing.key);
    setInstalled(active ? installed.filter(key => key !== installing.key) : [...installed, installing.key]);
    flash(`${installing.name}: ${active ? "модуль отключён" : "установка завершена, точки встраивания зарегистрированы"}`);
    setInstalling(null);
  }
  return <><PageHeading eyebrow="СИСТЕМА РАСШИРЕНИЙ" title="Модули" description="Установка, настройки и обновления без изменения ядра" actions={<button onClick={() => setAddOpen(true)}>＋ Добавить модуль</button>} /><nav className="extensionTabs"><button className={filter === "installed" ? "active" : ""} onClick={() => setFilter("installed")}>Установлено <em>{installed.length}</em></button><button className={filter === "catalog" ? "active" : ""} onClick={() => setFilter("catalog")}>Каталог модулей <em>{compatible.length}</em></button><button className={filter === "updates" ? "active" : ""} onClick={() => setFilter("updates")}>Обновления <em>2</em></button></nav>{filter === "updates" && <div className="updatesNotice"><div><b>Доступно 2 обновления</b><span>Перед обновлением создаётся резервная точка восстановления.</span></div><button onClick={() => flash("Все модули обновлены до последних версий")}>Обновить все</button></div>}<section className="extensionGrid">{list.map(module => { const active = installed.includes(module.key); return <article key={module.key} style={{ "--module-color": module.color } as React.CSSProperties}><header><i>{module.name[0]}</i><div><small>{filter === "updates" ? "ЕСТЬ ОБНОВЛЕНИЕ" : active ? "УСТАНОВЛЕН" : "ДОСТУПЕН"}</small><h3>{module.name}</h3></div><em>v{module.version}</em></header><p>{module.description}</p><div className="slotList">{module.slots.map(slot => <span key={slot}>↳ {slot}</span>)}</div><footer><strong>{module.price ? `${module.price.toLocaleString("ru-RU")} ₽` : "В редакции"}</strong>{filter === "updates" ? <button onClick={() => flash(`${module.name} обновлён до версии ${module.version}`)}>Обновить</button> : <button onClick={() => setInstalling(module)} className={active ? "installed" : ""}>{active ? "Отключить" : "Установить"}</button>}<button onClick={() => setSettingsModule(module)}>Настройки</button></footer></article>})}</section>
  {installing && <div className="demoModal"><section className="confirmDialog"><small>{installed.includes(installing.key) ? "ОТКЛЮЧЕНИЕ" : "УСТАНОВКА МОДУЛЯ"}</small><h2>{installing.name}</h2><p>{installed.includes(installing.key) ? "Все пункты меню и вкладки модуля будут скрыты. Демо-данные сохранятся." : `Ядро зарегистрирует ${installing.slots.length} точек встраивания. Файлы ядра не изменяются.`}</p><div><button onClick={() => setInstalling(null)}>Отмена</button><button className="primary" onClick={confirmToggle}>{installed.includes(installing.key) ? "Отключить" : "Установить"}</button></div></section></div>}
  {settingsModule && <ModuleSettingsDialog module={settingsModule} onClose={() => setSettingsModule(null)} flash={flash} />}
  {addOpen && <div className="demoModal"><section className="confirmDialog moduleUploadDialog"><small>РУЧНАЯ УСТАНОВКА</small><h2>Добавить модуль</h2><p>Загрузите ZIP-пакет с файлом <code>bypcms.module.json</code>. Перед установкой ядро проверит подпись, версию и заявленные точки встраивания.</p><label className="uploadButton">Выбрать ZIP-пакет<input type="file" accept=".zip" onChange={event => event.target.files?.[0] && flash(`Пакет ${event.target.files[0].name} прошёл предварительную проверку`)} /></label><textarea defaultValue={'{\n  "schema": "bypcms.module/v1",\n  "placements": ["menu.main", "editor.tab"]\n}'} rows={6} /><div><button onClick={() => setAddOpen(false)}>Отмена</button><button className="primary" onClick={() => { setAddOpen(false); flash("Демо-модуль добавлен в каталог"); }}>Проверить и добавить</button></div></section></div>}</>;
}

function ModuleSettingsDialog({ module, onClose, flash }: { module: DemoModule; onClose: () => void; flash: (message: string) => void }) {
  return <div className="demoModal"><section className="moduleSettingsDialog" style={{ "--module-color": module.color } as React.CSSProperties}><header><div><small>НАСТРОЙКИ МОДУЛЯ</small><h2>{module.name}</h2></div><button onClick={onClose}>×</button></header><p>{module.description}</p><label className="settingSwitch"><span><b>Модуль активен</b><small>Версия {module.version}</small></span><input type="checkbox" defaultChecked /></label><label>Режим работы<select defaultValue="Автоматически"><option>Автоматически</option><option>Ручное управление</option></select></label><label>Роли с доступом<select defaultValue="Администратор и редактор"><option>Только администратор</option><option>Администратор и редактор</option><option>Все сотрудники</option></select></label><label className="settingSwitch"><span><b>Показывать уведомления</b><small>Ошибки и важные события модуля</small></span><input type="checkbox" defaultChecked /></label><div className="slotList">{module.slots.map(slot => <span key={slot}>{slot}</span>)}</div><footer><button onClick={onClose}>Отмена</button><button className="primary" onClick={() => { flash(`Настройки ${module.name} сохранены`); onClose(); }}>Сохранить настройки</button></footer></section></div>;
}

function SettingsPanelV2({ settings, setSettings, modules, flash }: { settings: SettingsState; setSettings: React.Dispatch<React.SetStateAction<SettingsState>>; modules: DemoModule[]; flash: (message: string) => void }) {
  const [tab, setTab] = useState("general");
  const update = <K extends keyof SettingsState>(key: K, value: SettingsState[K]) => setSettings(old => ({ ...old, [key]: value }));
  const tabs = [{ id: "general", label: "Основные" }, { id: "users", label: "Пользователи" }, { id: "notifications", label: "Уведомления" }, { id: "integrations", label: "Интеграции" }, ...modules.map(module => ({ id: `module:${module.key}`, label: module.name })), { id: "security", label: "Безопасность" }];
  const module = modules.find(item => tab === `module:${item.key}`);
  return <><PageHeading eyebrow="СИСТЕМА" title="Настройки проекта" description="Каждый раздел имеет собственные рабочие параметры" actions={<button onClick={() => flash("Настройки проекта сохранены")}>Сохранить изменения</button>} /><nav className="settingsNav">{tabs.map(item => <button className={tab === item.id ? "active" : ""} onClick={() => setTab(item.id)} key={item.id}>{item.label}{item.id.startsWith("module:") && <em>Модуль</em>}</button>)}</nav>
  {tab === "general" && <section className="settingsForm"><article><small>ОСНОВНЫЕ ДАННЫЕ</small><h2>Сайт и организация</h2><div className="fieldGrid"><label>Название сайта<input value={settings.siteName} onChange={event => update("siteName", event.target.value)} /></label><label>Слоган<input value={settings.slogan || ""} onChange={event => update("slogan", event.target.value)} /></label><label>Домен<input value={settings.domain} onChange={event => update("domain", event.target.value)} /></label><label>Email<input type="email" value={settings.email} onChange={event => update("email", event.target.value)} /></label><label>Телефон<input value={settings.phone} onChange={event => update("phone", event.target.value)} /></label><label>Адрес<input value={settings.address} onChange={event => update("address", event.target.value)} /></label><label>Язык<select value={settings.language} onChange={event => update("language", event.target.value)}><option>Русский</option><option>English</option></select></label><label>Часовой пояс<select value={settings.timezone} onChange={event => update("timezone", event.target.value)}><option>Europe/Moscow</option><option>Europe/Minsk</option><option>Asia/Almaty</option></select></label></div></article><article><small>СОСТОЯНИЕ</small><h2>Режим работы</h2><label className="settingSwitch"><span><b>Технические работы</b><small>Закрыть публичный сайт</small></span><input type="checkbox" checked={settings.maintenance} onChange={event => update("maintenance", event.target.checked)} /></label></article></section>}
  {tab === "users" && <section className="settingsForm single"><article><small>ДОСТУП К ПРОЕКТУ</small><h2>Пользователи и роли</h2>{[["АБ", "Администратор BYPCMS", "Владелец"], ["МБ", "Мария Белова", "Редактор"], ["АВ", "Алексей Ветров", "Менеджер"]].map(user => <div className="userRow" key={user[1]}><i>{user[0]}</i><span><b>{user[1]}</b><small>{user[2]}</small></span><select defaultValue={user[2]}><option>Владелец</option><option>Администратор</option><option>Редактор</option><option>Менеджер</option></select></div>)}<button onClick={() => flash("Приглашение создано")}>＋ Пригласить пользователя</button></article></section>}
  {tab === "notifications" && <section className="settingsForm"><article><small>КАНАЛЫ</small><h2>Уведомления</h2>{["Новые заявки и заказы", "Ошибки сайта", "Обновления модулей", "Еженедельный отчёт"].map((name, index) => <label className="settingSwitch" key={name}><span><b>{name}</b><small>{index < 2 ? "Email и Telegram" : "Только Email"}</small></span><input type="checkbox" defaultChecked={index < 3} /></label>)}</article><article><small>ПОЛУЧАТЕЛЬ</small><h2>Куда отправлять</h2><label>Email<input value={settings.email} onChange={event => update("email", event.target.value)} /></label><label>Telegram chat ID<input defaultValue="@northline_team" /></label><button onClick={() => flash("Тестовое уведомление отправлено")}>Отправить тест</button></article></section>}
  {tab === "integrations" && <section className="settingsForm single"><article><small>ВНЕШНИЕ СЕРВИСЫ</small><h2>Интеграции</h2>{[["ЮKassa", "Платежи", true], ["Telegram", "Уведомления", true], ["amoCRM", "Заявки и сделки", false], ["1С", "Товары и остатки", false]].map(item => <div className="integrationRow" key={String(item[0])}><i>{String(item[0])[0]}</i><span><b>{item[0]}</b><small>{item[1]}</small></span><button onClick={() => flash(`${item[0]}: открыта настройка подключения`)}>{item[2] ? "Настроить" : "Подключить"}</button></div>)}</article></section>}
  {module && <section className="settingsForm single"><article className="moduleSettingsCard" style={{ "--module-color": module.color } as React.CSSProperties}><small>НАСТРОЙКИ МОДУЛЯ</small><h2>{module.name}</h2><p>{module.description}</p><label className="settingSwitch"><span><b>Модуль активен</b><small>Версия {module.version}</small></span><input type="checkbox" defaultChecked /></label><label>Режим<select><option>Автоматически</option><option>Ручной</option></select></label><label className="settingSwitch"><span><b>Уведомлять об ошибках</b><small>Показывать события в центре уведомлений</small></span><input type="checkbox" defaultChecked /></label><button onClick={() => flash(`Настройки ${module.name} сохранены`)}>Сохранить настройки модуля</button></article></section>}
  {tab === "security" && <section className="settingsForm"><article><small>АВТОРИЗАЦИЯ</small><h2>Безопасность</h2><label className="settingSwitch"><span><b>Двухфакторная авторизация</b><small>Код из приложения при входе</small></span><input type="checkbox" /></label><label>Время сессии<select><option>8 часов</option><option>24 часа</option><option>7 дней</option></select></label><button onClick={() => flash("Все другие сессии завершены")}>Завершить другие сессии</button></article><article><small>РЕЗЕРВНЫЕ КОПИИ</small><h2>Восстановление</h2><p>Последняя копия: сегодня, 04:00</p><button onClick={() => flash("Резервная копия создана")}>Создать копию сейчас</button></article></section>}
  <button className="resetDemo" onClick={() => { sessionStorage.removeItem("bypcms-real-demo-v1"); window.location.reload(); }}>Сбросить все изменения демо</button></>;
}

function PublicPreview({ entity, edition, theme, settings, onClose }: { entity: DemoEntity; edition: EditionKey; theme: ThemeState; settings: SettingsState; onClose: () => void }) {
  const [viewport, setViewport] = useState("desktop");
  return <div className={`publicPreview viewport-${viewport}`}><header><span><b>Предпросмотр сайта</b><small>Изменения видны только вам</small></span><div><button className={viewport === "desktop" ? "active" : ""} onClick={() => setViewport("desktop")}>▱ 1440</button><button className={viewport === "tablet" ? "active" : ""} onClick={() => setViewport("tablet")}>▯ 768</button><button className={viewport === "mobile" ? "active" : ""} onClick={() => setViewport("mobile")}>▯ 390</button></div><button onClick={onClose}>Закрыть ×</button></header><LiveSite edition={edition} entity={entity} theme={theme} settings={settings} /></div>;
}

function LiveSite({ edition, entity, theme, settings }: { edition: EditionKey; entity: DemoEntity | null; theme: ThemeState; settings: SettingsState }) {
  const content = entity || seedEntities.find(item => item.kind === (edition === "commerce" ? "products" : edition === "content" ? "articles" : "projects"))!;
  const bodyFont = theme.customFont?.trim() || theme.font;
  const [menuOpen, setMenuOpen] = useState(false);
  const [message, setMessage] = useState("");
  const act = (text: string) => { setMessage(text); window.setTimeout(() => setMessage(""), 2600); };
  const customMarkup = (theme.customTemplateSource || "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/\son\w+\s*=\s*["'][^"']*["']/gi, "")
    .replaceAll("{{site.name}}", settings.siteName)
    .replaceAll("{{site.slogan}}", settings.slogan || "")
    .replaceAll("{{page.title}}", content.title)
    .replaceAll("{{page.excerpt}}", content.excerpt)
    .replaceAll("{{page.image}}", "https://bypcms.ru/demo/cms-media-board.png")
    .replaceAll("{{product.price}}", content.price ? `${content.price.toLocaleString("ru-RU")} ₽` : "");
  const cards = seedEntities.filter(item => item.kind === (edition === "commerce" ? "products" : edition === "content" ? "articles" : "services")).slice(0, 3);
  return <div className={`liveSite edition-${edition} template-${theme.template.toLowerCase()} header-${theme.header.toLowerCase()} menu-${theme.menuPosition || "center"} ${menuOpen ? "menu-open" : ""}`} style={{ "--site-accent": theme.accent, "--site-bg": theme.background, "--site-radius": `${theme.radius}px`, "--site-width": `${theme.container}px`, "--site-font": bodyFont, "--site-heading-font": theme.headingFont || bodyFont } as React.CSSProperties}>
    {message && <div className="siteDemoMessage">{message}</div>}
    <header><button className="siteLogo" onClick={() => act("Открыта главная страница")}>{settings.logo ? <img src={settings.logo} alt={settings.siteName} /> : <b>{settings.siteName[0]}</b>}<span><strong>{settings.siteName}</strong>{settings.slogan && <small>{settings.slogan}</small>}</span></button><nav><button onClick={() => act("Открыта главная страница")}>Главная</button><button onClick={() => act(`Открыт раздел «${edition === "commerce" ? "Каталог" : edition === "content" ? "Журнал" : "Услуги"}»`)}>{edition === "commerce" ? "Каталог" : edition === "content" ? "Журнал" : "Услуги"}</button><button onClick={() => act("Открыта страница «О нас»")}>О нас</button><button onClick={() => act("Открыта страница контактов")}>Контакты</button></nav><button className="siteMenuToggle" onClick={() => setMenuOpen(value => !value)}>☰</button><button className="siteAction" onClick={() => act(edition === "commerce" ? "Корзина открыта" : "Форма связи открыта")}>{edition === "commerce" ? "Корзина · 0" : "Связаться"}</button></header>
    {theme.template === "custom" && customMarkup ? <main className="customTemplatePreview" dangerouslySetInnerHTML={{ __html: customMarkup }} /> : <main>
      <section className="siteHero" id="overview"><div><small>{content.category || editions[edition].note}</small><h1>{content.title}</h1><p>{content.excerpt}</p>{content.price !== undefined ? <><strong>{content.price.toLocaleString("ru-RU")} ₽</strong><button onClick={() => act("Товар добавлен в демо-корзину")}>Добавить в корзину</button></> : <button onClick={() => act(edition === "business" ? "Открыта форма обсуждения проекта" : "Открыт полный материал")}>{edition === "business" ? "Обсудить проект" : "Подробнее →"}</button>}</div><MediaThumb index={content.image} large /></section>
      {edition === "content" && <section className="contentShowcase"><header><small>СВЕЖИЕ ИСТОРИИ</small><h2>Читайте новое</h2></header><div>{cards.map(item => <article key={item.id}><MediaThumb index={item.image} large /><small>{item.category}</small><h3>{item.title}</h3><p>{item.excerpt}</p><button onClick={() => act(`Открыт материал «${item.title}»`)}>Читать →</button></article>)}</div></section>}
      {edition === "business" && <><section className="businessStats">{[["12 лет","экспертизы"],["86","проектов"],["24","специалиста"],["4,9","рейтинг"]].map(item => <article key={item[1]}><strong>{item[0]}</strong><span>{item[1]}</span></article>)}</section><section className="businessServices"><header><small>КОМПЕТЕНЦИИ</small><h2>От идеи до результата</h2></header><div>{cards.map((item,index) => <article key={item.id}><i>0{index+1}</i><h3>{item.title}</h3><p>{item.excerpt}</p><button onClick={() => act(`Открыта услуга «${item.title}»`)}>Подробнее →</button></article>)}</div></section></>}
      {edition === "commerce" && <section className="commerceCatalog"><header><div><small>КОЛЛЕКЦИЯ</small><h2>Избранные товары</h2></div><button onClick={() => act("Открыт весь каталог")}>Весь каталог →</button></header><div>{cards.map(item => <article key={item.id}><MediaThumb index={item.image} large /><small>{item.brand || item.category}</small><h3>{item.title}</h3><footer><strong>{(item.price || 0).toLocaleString("ru-RU")} ₽</strong><button onClick={() => act(`${item.title} добавлен в корзину`)}>＋</button></footer></article>)}</div></section>}
      {!!content.blocks?.length && <section className="siteManagedBlocks"><header><small>УПРАВЛЯЕМЫЕ БЛОКИ</small><h2>Собрано в редакторе</h2></header>{content.blocks.map(block => <article className={`siteManagedBlock type-${block.type}`} key={block.id}>{block.type === "heading" && <><h2>{block.title}</h2><p>{block.content}</p></>}{block.type === "gallery" && <><h3>{block.title}</h3><div>{[0,1,2].map(item => <MediaThumb index={item} large key={item} />)}</div></>}{block.type === "button" && <><h3>{block.title}</h3><button onClick={() => act(`Открыта ссылка ${block.content}`)}>{block.title} →</button></>}{block.type === "form" && <><h3>{block.title}</h3><p>{block.content}</p><div><input placeholder="Ваше имя" /><input placeholder="Телефон" /><button onClick={() => act("Демо-форма отправлена")}>Отправить</button></div></>}{block.type === "code" && <div dangerouslySetInnerHTML={{ __html: sanitizeDemoHtml(block.content) }} />}</article>)}</section>}
      <section className="siteBody" id="details"><aside><small>СОДЕРЖАНИЕ</small><a href="#overview">Обзор</a><a href="#details">Подробности</a><a href="#features">Характеристики</a></aside><article><h2>{edition === "commerce" ? "Описание товара" : edition === "business" ? "Подход к работе" : "О материале"}</h2><p>{content.body}</p><MediaThumb index={(content.image + 1) % 6} large /><h2 id="features">Продумано до деталей</h2><p>Страница собирается из управляемых блоков. Изображения, тексты, порядок секций и кнопки меняются в редакторе BYPCMS.</p></article></section>
    </main>}
    <footer><b>{settings.siteName}</b><span>{settings.email} · {settings.phone}</span><span>© 2026</span></footer>
  </div>;
}

function MediaThumb({ index, large = false }: { index: number; large?: boolean }) {
  const x = index % 3;
  const y = Math.floor(index / 3);
  return <span className={`mediaThumb ${large ? "large" : ""}`} style={{ backgroundPosition: `${x * 50}% ${y * 100}%` }} role="img" aria-label={mediaItems[index]?.alt || "Изображение"} />;
}
