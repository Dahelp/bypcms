"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import "./admin.css";
import "./readable.css";

type User = { id: number; email: string; name: string; role: string; role_name: string };
type PageItem = { id: number; title: string; slug: string; status: string; updated_at: string };
type ModuleItem = { module_key: string; name: string; version: string; status: string; updated_at: string };
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
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

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

  useEffect(() => { void loadSession(); }, [loadSession]);
  useEffect(() => {
    if (user) {
      void loadDashboard();
      void loadPages();
    }
  }, [user, loadDashboard, loadPages]);

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
            <button type="button" onClick={() => setCreateOpen(true)}>＋ Создать страницу</button>
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
                <div className="tableHead"><span>Название</span><span>URL</span><span>Статус</span><span>Обновлено</span></div>
                {pages.map((page) => (
                  <div key={page.id}><strong>{page.title}</strong><code>/{page.slug}</code><em className={page.status}>{page.status}</em><time>{new Date(page.updated_at).toLocaleString("ru-RU")}</time></div>
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
                    <button type="button" className={module.status} onClick={() => void toggleModule(module)}>
                      {module.status === "active" ? "Включён" : "Выключен"}
                    </button>
                  </article>
                ))}
              </div>
            </section>
          )}

          {active === "settings" && (
            <section className="dataPanel settingsIntro">
              <p>СИСТЕМА</p><h2>Настройки BYPCMS</h2>
              <div className="settingsCards">
                <article><span>⌘</span><div><strong>Основные</strong><small>Название, адрес, язык и часовой пояс</small></div></article>
                <article><span>♙</span><div><strong>Пользователи и роли</strong><small>Доступы команды и журнал входов</small></div></article>
                <article><span>◇</span><div><strong>API и интеграции</strong><small>Токены, webhooks и внешние сервисы</small></div></article>
                <article><span>↻</span><div><strong>Обновления</strong><small>Ядро, модули и резервные копии</small></div></article>
              </div>
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
    </main>
  );
}
