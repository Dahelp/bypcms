"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { LocaleLink, useLocale, usePublicText } from "../components/PublicLocale";
import { checkoutComparisonSource } from "../../lib/comparison-tracking";

export type CheckoutCustomer = { id: number; name: string; email: string };
export type EmailPending = { email: string; resend_after: number; expires_in: number; locked: boolean; delivery_failed: boolean };
type Verified = { customer: CheckoutCustomer; csrf: string; legacy_password_revoked?: boolean };
type Props = {
  csrf: string;
  legalVersion: string;
  getOperation: () => string;
  pending: EmailPending | null;
  returnUrl: string;
  privacyAccepted: boolean;
  focusPrivacy: () => void;
  refresh: () => void;
  onVerified: (result: Verified) => void;
};

function withDeadline(pending: EmailPending | null) {
  const now = Date.now();
  return pending && { ...pending, resendAt: now + pending.resend_after * 1000, expiresAt: now + pending.expires_in * 1000 };
}

export default function CheckoutEmail(props: Props) {
  const t = usePublicText();
  const locale = useLocale();
  const [pending, setPending] = useState(() => withDeadline(props.pending));
  const [email, setEmail] = useState(props.pending?.email ?? "");
  const [code, setCode] = useState("");
  const [showCode, setShowCode] = useState(false);
  const [now, setNow] = useState(0);
  const [error, setError] = useState("");
  const [invalid, setInvalid] = useState(false);
  const [busy, setBusy] = useState<"request" | "verify" | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const inFlight = useRef(false);
  const focusInput = useRef(false);
  const remaining = pending ? Math.max(0, Math.ceil((pending.resendAt - (now || pending.resendAt - pending.resend_after * 1000)) / 1000)) : 0;
  const expired = !!pending && now >= pending.expiresAt;
  const locked = !!pending?.locked;

  useEffect(() => {
    if (!pending) return;
    const tick = () => setNow(Date.now());
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [pending]);

  useEffect(() => {
    if (focusInput.current) {
      focusInput.current = false;
      input.current?.focus();
    }
  }, [pending]);

  async function act(action: "request" | "verify", address?: string) {
    if (inFlight.current) return;
    setError("");
    setInvalid(false);
    if (!props.privacyAccepted) {
      setError(t("Подтвердите согласие на обработку данных, чтобы получить или проверить код."));
      props.focusPrivacy();
      return;
    }

    const value = (address ?? email).trim();
    if (action === "request" && (value.length > 190 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))) {
      setError(t("Укажите корректный email."));
      setInvalid(true);
      input.current?.focus();
      return;
    }
    if (action === "verify" && !/^[0-9]{6}$/.test(code)) {
      setError(t("Введите шесть цифр из письма."));
      setInvalid(true);
      input.current?.focus();
      return;
    }

    inFlight.current = true;
    setBusy(action);
    try {
      const response = await fetch("/commerce/index.php?action=checkout.email." + action, {
        method: "POST", credentials: "same-origin", cache: "no-store",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": props.csrf },
        body: JSON.stringify({
          operation_id: props.getOperation(), legal_version: props.legalVersion, accept_privacy: true,
          ...(action === "request"
            ? { email: value, locale, comparison_source: checkoutComparisonSource(new URLSearchParams(location.search)) }
            : { code }),
        }),
        signal: AbortSignal.timeout(22000),
      });
      if (!response.headers.get("content-type")?.includes("application/json")) throw new Error();
      const result = await response.json();
      if (!response.ok) {
        if (result.details?.code === "csrf_expired") props.refresh();
        setError(t(result.error || "Не удалось подтвердить email. Повторите попытку."));
        if (action === "verify" && response.status === 422) {
          setInvalid(true);
          if (result.error === "Код недействителен или истёк. Запросите новый код.") {
            setPending(current => current && { ...current, locked: true });
          } else {
            input.current?.select();
          }
        }
        return;
      }
      if (result.customer && result.csrf) {
        props.onVerified(result);
      } else if (result.pending) {
        focusInput.current = true;
        setCode("");
        setShowCode(false);
        setNow(Date.now());
        setPending(withDeadline(result.pending));
      } else {
        throw new Error();
      }
    } catch {
      if (action === "verify") props.refresh();
      setError(t("Не удалось подтвердить email. Повторите попытку."));
    } finally {
      inFlight.current = false;
      setBusy(null);
    }
  }

  function enter(event: KeyboardEvent<HTMLInputElement>, action: "request" | "verify") {
    if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
    event.preventDefault();
    if (action !== "verify" || (!expired && !locked)) void act(action);
  }

  function changeEmail() {
    if (!pending) return;
    focusInput.current = true;
    setEmail(pending.email);
    setPending(null);
    setCode("");
    setShowCode(false);
    setError("");
    setInvalid(false);
  }

  return <fieldset className="checkoutEmail" aria-busy={busy !== null}>
    <legend>{t("Подтвердите email")}</legend>
    {pending ? <>
      <p className="checkoutHelp" id="checkout-email-help" role="status">
        {t("Код запрошен для")} <strong>{pending.email}</strong>. {t("Проверьте входящие и папку «Спам». Код действует 10 минут.")}
      </p>
      {pending.delivery_failed && <p className="checkoutError" role="alert">{t("Не удалось доставить код. Запросите новый код или войдите по паролю.")}</p>}
      <label htmlFor="checkout-code">{t("Код из письма")}</label>
      <div className="checkoutCode">
        <input ref={input} id="checkout-code" type={showCode ? "text" : "password"} inputMode="numeric"
          autoComplete="one-time-code" maxLength={6} value={code} readOnly={busy !== null}
          aria-invalid={invalid || undefined} aria-describedby={error ? "checkout-email-help checkout-email-error" : "checkout-email-help"}
          onChange={event => { setCode(event.target.value.replace(/[^0-9]/g,"")); setError(""); setInvalid(false); }}
          onKeyDown={event => enter(event,"verify")} />
        <button className="checkoutRetry checkoutCodeVisibility" type="button" aria-controls="checkout-code"
          onClick={() => setShowCode(value => !value)}>{showCode ? t("Скрыть код") : t("Показать код")}</button>
      </div>
      <button className="checkoutRetry checkoutEmailAction" type="button" disabled={busy !== null || expired || locked}
        onClick={() => void act("verify")}>{busy === "verify" ? t("Проверяем код…") : t("Подтвердить код")}</button>
      {expired && <p className="checkoutHelp" role="status">{t("Срок действия кода истёк. Запросите новый код.")}</p>}
      <div className="checkoutEmailLinks">
        <button className="checkoutEmailLink" type="button" disabled={busy !== null || remaining > 0}
          onClick={() => void act("request",pending.email)}>
          {busy === "request" ? t("Запрашиваем код…") : remaining > 0
            ? t("Новый код через {seconds} с").replace("{seconds}",String(remaining)) : t("Запросить новый код")}
        </button>
        <button className="checkoutEmailLink" type="button" disabled={busy !== null} onClick={changeEmail}>{t("Изменить email")}</button>
      </div>
    </> : <>
      <label htmlFor="checkout-email">Email</label>
      <input ref={input} id="checkout-email" type="email" autoComplete="email" autoCapitalize="none" spellCheck={false}
        maxLength={190} value={email} readOnly={busy !== null} aria-invalid={invalid || undefined}
        aria-describedby={error ? "checkout-email-help checkout-email-error" : "checkout-email-help"}
        onChange={event => { setEmail(event.target.value); setError(""); setInvalid(false); }}
        onKeyDown={event => enter(event,"request")} />
      <p className="checkoutHelp" id="checkout-email-help">{t("Отправим одноразовый код. Состав заказа останется в форме.")}</p>
      <button className="checkoutRetry checkoutEmailAction" type="button" disabled={busy !== null}
        onClick={() => void act("request")}>{busy === "request" ? t("Запрашиваем код…") : t("Получить код")}</button>
    </>}
    {error && <p className="checkoutError" id="checkout-email-error" role="alert">{error}</p>}
    <LocaleLink className="checkoutEmailAccount" href={`/account/?next=${encodeURIComponent(props.returnUrl)}`}>
      {t("Войти по паролю")}
    </LocaleLink>
  </fieldset>;
}
