"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import "./admin.css";
import "./readable.css";

type User = { id: number; email: string; name: string; role: string; role_name: string };
type PageItem = { id: number; title: string; slug: string; excerpt?: string; content?: string; template?: string; status: string; updated_at: string };
type ModuleItem = { module_key: string; name: string; version: string; status: string; settings?: string | null; updated_at: string };
type SettingItem = { setting_group: string; setting_key: string; setting_value: string; value_type: string; is_public: number };
type DashboardData = {
  counts: { pages: number; published: number; users: number; modules: number; submissions: number };
  recent_pages: PageItem[];
  modules: ModuleItem[];
  license: { edition: string; domain: string; status: string; valid_until: string | null } | null;
  health: { score: number; core: string; environment: string };
};

const navigation = [
  ["overview", "⌂", "Обзор"],
  ["content", "▤", "Контент"],
  ["modules", "◇", "Модули"],
  ["settings", "⚙", "Настройки"],
];

async function api<T>(
  action: string,
  options: RequestInit = {},
  csrf = "",
): Promise<T> {
  const response = await fetch(`/api/index.php?action=${encodeURIComponent(action)}`, {
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      ...(csrf ? { "X-CSRF-Token": csrf } : {}),
      ...(options.headers ?? {}),
    },
    ...options,
  });
  const payload = await response.json().catch(() => ({ ok: false, error: "Некорректный ответ сервера" }));
  if (!response.ok || !payload.ok) {
    throw new Error(payload.error || "Ошибка запроса");
  }
  return payload as T;
}

export default function AdminPage() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [csrf, setCsrf] = useState("");
  const [active, setActive] = useState("overview");
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [pages, setPages] = useState<PageItem[]>([]);
  const [modules, setModules] = useState<ModuleItem[]>([]);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editingPage, setEditingPage] = useState<PageItem | null>(null);
  const [editingModule, setEditingModule] = useState<ModuleItem | null>(null);

  const loadSession = useCallback(async () => {
    setLoading(true);
    try {
      const session = await api<{ user: User; csrf: string; ok: true }>("auth.me");
      setUser(session.user);
      setCsrf(session.csrf);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadDashboard = useCallback(async () => {
    try {
      const result = await api<DashboardData & { ok: true }>("dashboard");
      setDashboard(result);
      setModules(result.modules);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Не удалось загрузить панель");
    }
  }, []);

  const loadPages = useCallback(async () => {
    try {
      const result = await api<{ pages: PageItem[]; ok: true }>("pages.list");
      setPages(result.pages);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Не удалось загрузить страницы");
    }
  }, []);

  const loadConfiguration = useCallback(async () => {
    try {
      const [moduleResult, settingResult] = await Promise.all([
        api<{ modules: ModuleItem[]; ok: true }>("modules.list"),
        api<{ settings: SettingItem[]; ok: true }>("settings.list"),
      ]);
      setModules(moduleResult.modules);
      setSettings(Object.fromEntries(settingResult.settings.map((item) => [`${item.setting_group}.${item.setting_key}`, item.setting_value ?? ""])));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Не удалось загрузить конфигурацию");
    }
  }, []);

  useEffect(() => { void loadSession(); }, [loadSession]);
  useEffect(() => {
    if (user) {
      void loadDashboard();
      void loadPages();
      void loadConfiguration();
    }
  }, [user, loadDashboard, loadPages, loadConfiguration]);

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const result = await api<{ user: User; csrf: string; ok: true }>("auth.login", {
        method: "POST",
        body: JSON.stringify({ email: form.get("email"), password: form.get("password") }),
      });
      setUser(result.user);
      setCsrf(result.csrf);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Ошибка входа");
    }
  }

  async function logout() {
    try {
      await api("auth.logout", { method: "POST", body: "{}" }, csrf);
    } finally {
      setUser(null);
      setDashboard(null);
    }
  }

  async function createPage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError("");
    try {
      await api("pages.create", {
        method: "POST",
        body: JSON.stringify({
          title: form.get("title"),
          slug: form.get("slug"),
          excerpt: form.get("excerpt"),
          status: form.get("status"),
        }),
      }, csrf);
      setCreateOpen(false);
      setNotice("Страница создана");
      await Promise.all([loadPages(), loadDashboard()]);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Не удалось создать страницу");
    }
  }

  async function toggleModule(module: ModuleItem) {
    const nextStatus = module.status === "active" ? "inactive" : "active";
    try {
      await api("modules.toggle", {
        method: "POST",
        body: JSON.stringify({ module_key: module.module_key, status: nextStatus }),
      }, csrf);
      setModules((items) => items.map((item) => item.module_key === module.module_key ? { ...item, status: nextStatus } : item));
      setNotice(`${module.name}: ${nextStatus === "active" ? "включён" : "выключен"}`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Не удалось изменить модуль");
    }
  }

  async function updatePage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingPage) return;
    const form = new FormData(event.currentTarget);
    try {
      await api("pages.update", {
        method: "POST",
        body: JSON.stringify({
          id: editingPage.id,
          title: form.get("title"),
          slug: form.get("slug"),
          excerpt: form.get("excerpt"),
          content: form.get("content"),
          template: form.get("template"),
          status: form.get("status"),
        }),
      }, csrf);
      setEditingPage(null);
      setNotice("Страница сохранена");
      await Promise.all([loadPages(), loadDashboard()]);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Не удалось сохранить страницу");
    }
  }

  async function saveModuleSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingModule) return;
    const form = new FormData(event.currentTarget);
    const moduleSettings = {
      notifications: form.get("notifications") === "on",
      public_access: form.get("public_access") === "on",
      records_per_page: Number(form.get("records_per_page") || 20),
    };
    try {
      await api("modules.settings", {
        method: "POST",
        body: JSON.stringify({ module_key: editingModule.module_key, settings: moduleSettings }),
      }, csrf);
      setEditingModule(null);
      setNotice(`${editingModule.name}: настройки сохранены`);
      await loadConfiguration();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Не удалось сохранить настройки модуля");
    }
  }

  async function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const values = [
      ["general", "site_name", form.get("site_name")],
      ["general", "site_url", form.get("site_url")],
      ["general", "locale", form.get("locale")],
      ["general", "timezone", form.get("timezone")],
      ["notifications", "admin_email", form.get("admin_email")],
    ] as const;
    try {
      await Promise.all(values.map(([group, key, value]) => api("settings.save", {
        method: "POST",
        body: JSON.stringify({ group, key, value, type: "string", is_public: group === "general" }),
      }, csrf)));
      setNotice("Настройки сайта сохранены");
      await loadConfiguration();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Не удалось сохранить настройки");
    }
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await api("auth.password", {
        method: "POST",
        body: JSON.stringify({
          current_password: form.get("current_password"),
          new_password: form.get("new_password"),
          new_password_confirmation: form.get("new_password_confirmation"),
        }),
      }, csrf);
      event.currentTarget.reset();
      setNotice("Пароль успешно изменён");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Не удалось изменить пароль");
    }
  }

  const pageTitle = useMemo(
    () => navigation.find(([key]) => key === active)?.[2] ?? "Обзор",
    [active],
  );

  if (loading) {
    return <main className="adminLoading"><span>B</span><p>Проверяем BYPCMS…</p></main>;
  }

  if (!user) {
    return (
      <main className="loginScreen">
        <section className="loginStory">
          <Link href="/" className="loginLogo"><span>B</span>BYPCMS</Link>
          <div>
            <p>ПАНЕЛЬ УПРАВЛЕНИЯ 2.0</p>
            <h1>Сайт под<br />полным контролем.</h1>
            <span>Контент, модули, лицензия и состояние системы — в одном пространстве.</span>
          </div>
          <small>Стабильное ядро · независимые модули · безопасные обновления</small>
        </section>
        <section className="loginFormWrap">
          <form onSubmit={login} className="loginForm">
            <p className="eyebrow">ДОБРО ПОЖАЛОВАТЬ</p>
            <h2>Войти в BYPCMS</h2>
            <span>Используйте данные владельца, созданные при установке.</span>
            {error && <div className="formError">{error}</div>}
            <label>Email<input type="email" name="email" autoComplete="username" required /></label>
            <label>Пароль<input type="password" name="password" autoComplete="current-password" required /></label>
            <button type="submit">Войти в панель <b>→</b></button>
            <a href="/install/">Установщик системы</a>
          </form>
        </section>
      </main>
    );
  }

  return (
    <main className="cms">
      <aside className="cmsSidebar">
        <Link href="/" className="cmsBrand"><span>B</span><strong>BYPCMS</strong></Link>
        <nav aria-label="Разделы CMS">
          {navigation.map(([key, icon, label]) => (
            <button type="button" key={key} className={active === key ? "active" : ""} onClick={() => setActive(key)}>
              <i>{icon}</i><span>{label}</span>
            </button>
          ))}
        </nav>
        <div className="cmsUser">
          <span>{user.name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase()}</span>
          <div><strong>{user.name}</strong><small>{user.role_name}</small></div>
          <button type="button" onClick={logout} aria-label="Выйти">↗</button>
        </div>
      </aside>

      <section className="cmsMain">
        <header className="cmsTopbar">
          <div><span className="projectBadge">B</span><p><strong>BYPCMS Platform</strong><small>production · core {dashboard?.health.core ?? "2.0.0"}</small></p></div>
          <div><a href="/" target="_blank">Открыть сайт ↗</a></div>
        </header>

        <div className="cmsContent">
          <div className="cmsHeading">
            <div><p>ПАНЕЛЬ УПРАВЛЕНИЯ</p><h1>{pageTitle}</h1><span>{notice || "Все системы работают штатно"}</span></div>
            {active === "content" && <button type="button" onClick={() => setCreateOpen(true)}>＋ Создать страницу</button>}
          </div>
          {error && <div className="systemError">{error}<button type="button" onClick={() => setError("")}>×</button></div>}

          {active === "overview" && (
            <>
              <div className="healthBar">
                <div className="healthRing"><span>{dashboard?.health.score ?? 0}</span></div>
                <div><small>Здоровье системы</small><strong>Отличное состояние</strong><span>API и база доступны</span></div>
                <div><small>Версия ядра</small><strong>{dashboard?.health.core ?? "—"}</strong><span>актуальна</span></div>
                <div><small>Лицензия</small><strong>{dashboard?.license?.edition ?? "—"}</strong><span>{dashboard?.license?.status ?? "не настроена"}</span></div>
                <div><small>Окружение</small><strong>{dashboard?.health.environment ?? "—"}</strong><span>PHP backend</span></div>
              </div>

              <div className="metrics">
                <article><span>▤</span><p>Всего страниц<strong>{dashboard?.counts.pages ?? 0}</strong><small>{dashboard?.counts.published ?? 0} опубликовано</small></p></article>
                <article><span>◇</span><p>Активные модули<strong>{dashboard?.counts.modules ?? 0}</strong><small>из {modules.length} установленных</small></p></article>
                <article><span>◎</span><p>Новые обращения<strong>{dashboard?.counts.submissions ?? 0}</strong><small>требуют обработки</small></p></article>
                <article><span>♙</span><p>Пользователи<strong>{dashboard?.counts.users ?? 0}</strong><small>активных аккаунтов</small></p></article>
              </div>

              <div className="dashboardPanels">
                <article className="recentPanel">
                  <header><div><p>КОНТЕНТ</p><h2>Последние страницы</h2></div><button type="button" onClick={() => setActive("content")}>Все страницы →</button></header>
                  <div className="tableRows">
                    {(dashboard?.recent_pages ?? []).length === 0 && <div className="emptyRow">Создайте первую страницу</div>}
                    {(dashboard?.recent_pages ?? []).map((page) => (
                      <div key={page.id}><span className="pageGlyph">{page.title[0]}</span><p><strong>{page.title}</strong><small>/{page.slug}</small></p><em className={page.status}>{page.status}</em><time>{new Date(page.updated_at).toLocaleDateString("ru-RU")}</time></div>
                    ))}
                  </div>
                </article>
                <article className="licenseCard">
                  <header><p>ЛИЦЕНЗИЯ</p><span className={dashboard?.license?.status ?? "trial"}>{dashboard?.license?.status ?? "trial"}</span></header>
                  <div className="licenseSymbol"><i>B</i></div>
                  <h2>BYPCMS {dashboard?.license?.edition ?? "Business"}</h2>
                  <p>{dashboard?.license?.domain || "Домен определяется при установке"}</p>
                  <small>Действует до: {dashboard?.license?.valid_until ? new Date(dashboard.license.valid_until).toLocaleDateString("ru-RU") : "не задано"}</small>
                </article>
              </div>
            </>
          )}

          {active === "content" && (
            <section className="dataPanel">
              <header><div><p>СТРУКТУРА САЙТА</p><h2>Страницы</h2></div><span>{pages.length} материалов</span></header>
              <div className="contentTable">
                <div className="tableHead"><span>Название</span><span>URL</span><span>Статус</span><span>Управление</span></div>
                {pages.map((page) => (
                  <div key={page.id}><p><strong>{page.title}</strong><small>{page.excerpt || page.template}</small></p><code>/{page.slug}</code><em className={page.status}>{page.status}</em><button type="button" className="rowAction" onClick={() => setEditingPage(page)}>Редактировать</button></div>
                ))}
              </div>
            </section>
          )}

          {active === "modules" && (
            <section className="dataPanel">
              <header><div><p>ЭКОСИСТЕМА</p><h2>Установленные модули</h2></div><span>{modules.length} пакетов</span></header>
              <div className="moduleGrid">
                {modules.map((module) => (
                  <article key={module.module_key}>
                    <span className="moduleIcon">{module.name[0]}</span>
                    <div><h3>{module.name}</h3><p>{module.module_key} · v{module.version}</p></div>
                    <div className="moduleActions"><button type="button" className={module.status} onClick={() => void toggleModule(module)}>{module.status === "active" ? "Включён" : "Выключен"}</button><button type="button" onClick={() => setEditingModule(module)}>Настроить</button></div>
                  </article>
                ))}
              </div>
            </section>
          )}

          {active === "settings" && (
            <section className="dataPanel settingsIntro">
              <p>СИСТЕМА</p><h2>Настройки BYPCMS</h2>
              <form className="siteSettingsForm" onSubmit={saveSettings}>
                <label>Название сайта<input name="site_name" defaultValue={settings["general.site_name"] || "BYPCMS Platform"} /></label>
                <label>Адрес сайта<input name="site_url" type="url" defaultValue={settings["general.site_url"] || "https://bypcms.ru"} /></label>
                <label>Язык<select name="locale" defaultValue={settings["general.locale"] || "ru"}><option value="ru">Русский</option><option value="en">English</option></select></label>
                <label>Часовой пояс<select name="timezone" defaultValue={settings["general.timezone"] || "Europe/Moscow"}><option>Europe/Moscow</option><option>Europe/Minsk</option><option>Asia/Almaty</option></select></label>
                <label>Email уведомлений<input name="admin_email" type="email" defaultValue={settings["notifications.admin_email"] || user.email} /></label>
                <button type="submit">Сохранить настройки</button>
              </form>
              <form className="adminPasswordForm" onSubmit={changePassword}>
                <div><p>БЕЗОПАСНОСТЬ</p><h2>Сменить пароль</h2><small>Минимум 12 символов. После изменения используйте новый пароль при следующем входе.</small></div>
                <label>Текущий пароль<input name="current_password" type="password" autoComplete="current-password" required /></label>
                <label>Новый пароль<input name="new_password" type="password" minLength={12} autoComplete="new-password" required /></label>
                <label>Повторите пароль<input name="new_password_confirmation" type="password" minLength={12} autoComplete="new-password" required /></label>
                <button type="submit">Изменить пароль</button>
              </form>
            </section>
          )}
        </div>
      </section>

      {createOpen && (
        <div className="modalShade" onMouseDown={() => setCreateOpen(false)}>
          <form className="createModal" onSubmit={createPage} onMouseDown={(event) => event.stopPropagation()}>
            <header><div><p>НОВЫЙ МАТЕРИАЛ</p><h2>Создать страницу</h2></div><button type="button" onClick={() => setCreateOpen(false)}>×</button></header>
            <label>Заголовок<input name="title" required placeholder="Например, О компании" /></label>
            <label>URL<input name="slug" required pattern="[a-z0-9][a-z0-9\-/]*" placeholder="about" /></label>
            <label>Краткое описание<textarea name="excerpt" rows={4} placeholder="Описание страницы для списка и SEO" /></label>
            <label>Статус<select name="status"><option value="draft">Черновик</option><option value="published">Опубликовать</option></select></label>
            <button type="submit" className="saveButton">Создать страницу →</button>
          </form>
        </div>
      )}

      {editingPage && (
        <div className="modalShade" onMouseDown={() => setEditingPage(null)}>
          <form className="createModal" onSubmit={updatePage} onMouseDown={(event) => event.stopPropagation()}>
            <header><div><p>РЕДАКТОР КОНТЕНТА</p><h2>{editingPage.title}</h2></div><button type="button" onClick={() => setEditingPage(null)}>×</button></header>
            <label>Заголовок<input name="title" required defaultValue={editingPage.title} /></label>
            <label>URL<input name="slug" required pattern="[a-z0-9][a-z0-9\-/]*" defaultValue={editingPage.slug} /></label>
            <label>Описание<textarea name="excerpt" rows={5} defaultValue={editingPage.excerpt || ""} /></label>
            <label>Содержимое страницы<textarea name="content" rows={10} defaultValue={editingPage.content || ""} placeholder="Основной текст страницы. Можно использовать HTML-разметку." /></label>
            <label>Шаблон<select name="template" defaultValue={editingPage.template || "default"}><option value="default">Стандартная</option><option value="landing">Лендинг</option><option value="catalog">Каталог</option><option value="services">Услуги</option><option value="order">Заказ</option><option value="demo">Демонстрация</option></select></label>
            <label>Статус<select name="status" defaultValue={editingPage.status}><option value="draft">Черновик</option><option value="published">Опубликована</option><option value="archived">Архив</option></select></label>
            <button type="submit" className="saveButton">Сохранить изменения →</button>
          </form>
        </div>
      )}

      {editingModule && (
        <div className="modalShade" onMouseDown={() => setEditingModule(null)}>
          <form className="createModal" onSubmit={saveModuleSettings} onMouseDown={(event) => event.stopPropagation()}>
            <header><div><p>НАСТРОЙКИ МОДУЛЯ</p><h2>{editingModule.name}</h2></div><button type="button" onClick={() => setEditingModule(null)}>×</button></header>
            <p className="moduleMeta">Ключ: <code>{editingModule.module_key}</code> · версия {editingModule.version}</p>
            <label className="checkSetting"><input name="notifications" type="checkbox" defaultChecked /> Системные уведомления модуля</label>
            <label className="checkSetting"><input name="public_access" type="checkbox" /> Разрешить публичные API-методы</label>
            <label>Записей на странице<input name="records_per_page" type="number" min="5" max="100" defaultValue="20" /></label>
            <button type="submit" className="saveButton">Сохранить настройки →</button>
          </form>
        </div>
      )}
    </main>
  );
}
