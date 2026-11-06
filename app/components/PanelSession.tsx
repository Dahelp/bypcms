"use client";

import { type FormEvent, type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { panelRequest, PanelRequestError } from "./panel-api";
import { clearPanelDrafts, PanelDraftUser } from "./PanelDraftForm";
import "./panel-session.css";

export type PanelUser = { id: number; name: string; email: string; role: string; role_name: string };
type Session = { user: PanelUser; csrf: string };
type Phase = "loading" | "active" | "login" | "error";
const signalKey = "bypcms-panel-session-change";
function announce(action: "login" | "logout") { try { localStorage.setItem(signalKey, JSON.stringify({action, nonce: String(Date.now()) + Math.random()})); } catch { /* Cookie validation also runs on focus. */ } }

export function usePanelSession() {
  const [user, setUser] = useState<PanelUser | null>(null);
  const [csrf, setCsrf] = useState("");
  const [phase, setPhase] = useState<Phase>("loading");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const userRef = useRef<PanelUser | null>(null);
  const generation = useRef(0);
  const apply = useCallback((next: Session) => {
    // An account change must never reveal the previous account's forms or records.
    if (userRef.current && userRef.current.id !== next.user.id) { clearPanelDrafts(true); window.location.reload(); return; }
    userRef.current = next.user; setUser(next.user); setCsrf(next.csrf); setPhase("active"); setError("");
  }, []);
  const check = useCallback(async () => {
    const current = ++generation.current;
    try {
      const next = await panelRequest<Session>("auth.me", {}, "", false);
      if (current === generation.current) { apply(next); return true; }
    } catch (failure) {
      if (current !== generation.current) return false;
      if (failure instanceof PanelRequestError && failure.status === 401) {
        setPhase("login"); setError(userRef.current ? "Сессия завершена. Войдите снова: заполненная форма останется открыта." : "");
      } else {
        if (!userRef.current) setPhase("error");
        setError(failure instanceof Error ? failure.message : "Не удалось проверить сессию.");
      }
    }
    return false;
  }, [apply]);
  useEffect(() => {
    void check();
    const visible = () => { if (document.visibilityState === "visible") void check(); };
    const storage = (event: StorageEvent) => {
      if (event.key === signalKey) {
        try { if (JSON.parse(event.newValue || "{}").action === "logout") { ++generation.current; clearPanelDrafts(true); userRef.current = null; setUser(null); setCsrf(""); setPhase("login"); return; } } catch { /* Validate against the server. */ }
        void check();
      } else if (event.key === null) void check();
    };
    const expired = (event: Event) => {
      if ((event as CustomEvent<number>).detail === 401) { ++generation.current; setPhase("login"); setError("Сессия завершена. Войдите снова и повторите действие. Данные формы сохранены в открытой вкладке."); }
      else { void check(); }
    };
    window.addEventListener("focus", visible); window.addEventListener("pageshow", visible);
    document.addEventListener("visibilitychange", visible); window.addEventListener("storage", storage); window.addEventListener("bypcms-panel-session", expired);
    return () => { ++generation.current; window.removeEventListener("focus", visible); window.removeEventListener("pageshow", visible); document.removeEventListener("visibilitychange", visible); window.removeEventListener("storage", storage); window.removeEventListener("bypcms-panel-session", expired); };
  }, [check]);
  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy) return;
    const form = event.currentTarget;
    const values = new FormData(form); ++generation.current; setBusy(true); setError("");
    try { const next = await panelRequest<Session>("auth.login", { method: "POST", body: JSON.stringify({ email: values.get("email"), password: values.get("password") }) }, "", false); ++generation.current; apply(next); form.reset(); announce("login"); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "Не удалось войти."); }
    finally { setBusy(false); }
  }
  async function logout() {
    if (busy) return; ++generation.current; setBusy(true); setError("");
    try { await panelRequest("auth.logout", { method: "POST", body: "{}" }, csrf, false); ++generation.current; clearPanelDrafts(true); userRef.current = null; setUser(null); setCsrf(""); setPhase("login"); announce("logout"); }
    catch (failure) {
      if (failure instanceof PanelRequestError && failure.status === 401) { clearPanelDrafts(true); userRef.current = null; setUser(null); setCsrf(""); setPhase("login"); announce("logout"); }
      else if (failure instanceof PanelRequestError && [403,419].includes(failure.status)) { if (await check()) setError("Сессия обновлена. Повторите выход из учётной записи."); }
      else setError(failure instanceof Error ? failure.message : "Не удалось выйти. Повторите попытку.");
    } finally { setBusy(false); }
  }
  return { user, csrf, phase, error, busy, login, logout, retry: check };
}

export function PanelSessionGate({ session, owner = false, children }: { session: ReturnType<typeof usePanelSession>; owner?: boolean; children: ReactNode }) {
  const denied = owner && session.phase === "active" && session.user?.role !== "owner";
  const active = session.phase === "active" && !denied;
  return <>
    {!active && <main className="panelSessionGate"><section><a href="/" className="panelSessionBrand">B · BYPCMS {owner ? "Owner" : "Admin"}</a>
      {session.phase === "loading" ? <p role="status">Проверяем сессию…</p> : denied ? <><h1>Недостаточно прав</h1><p>Этот раздел доступен владельцу платформы.</p>{session.error && <p role="alert">{session.error}</p>}<a href="/admin/">В панель сайта</a><button disabled={session.busy} onClick={() => void session.logout()}>Выйти из учётной записи</button></> : session.phase === "error" ? <><h1>Панель временно недоступна</h1><p role="alert">{session.error}</p><button onClick={() => void session.retry()}>Повторить подключение</button></> : <form onSubmit={session.login}><h1>{session.user ? "Продолжить работу" : "Войти в BYPCMS"}</h1><p>После входа откроется запрошенная страница.</p>{session.error && <p role="alert">{session.error}</p>}<label>Email<input name="email" type="email" autoComplete="username" defaultValue={session.user?.email} required /></label><label>Пароль<input name="password" type="password" autoComplete="current-password" required /></label><button disabled={session.busy}>{session.busy ? "Входим…" : "Войти в панель"}</button></form>}
    </section></main>}
    {active && session.error && <div className="panelSessionWarning" role="alert">{session.error}<button onClick={() => void session.retry()}>Повторить подключение</button></div>}
    <PanelDraftUser value={session.user?.id ?? null}><div className="panelSessionContent" data-panel-user={session.user?.id} hidden={!active}>{children}</div></PanelDraftUser>
  </>;
}
