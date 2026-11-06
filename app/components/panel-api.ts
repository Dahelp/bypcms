export class PanelRequestError extends Error {
  constructor(message: string, public status: number) { super(message); this.name = "PanelRequestError"; }
}

export async function panelRequest<T = Record<string, unknown>>(action: string, options: RequestInit = {}, csrf = "", notify = true): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api/index.php?action=${encodeURIComponent(action)}`, {
      ...options, credentials: "same-origin", cache: "no-store",
      headers: { ...(options.body instanceof FormData ? {} : { "Content-Type": "application/json" }), ...(csrf ? { "X-CSRF-Token": csrf } : {}), ...options.headers },
      signal: options.signal ?? AbortSignal.timeout(20000),
    });
  } catch {
    throw new PanelRequestError("Не удалось связаться с сервером. Проверьте соединение и повторите запрос.", 0);
  }
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.ok) {
    const csrfExpired = response.status === 419 || (response.status === 403 && payload?.details?.code === "csrf_expired");
    if (notify && typeof window !== "undefined" && (response.status === 401 || csrfExpired)) {
      window.dispatchEvent(new CustomEvent("bypcms-panel-session", { detail: csrfExpired ? 419 : 401 }));
    }
    throw new PanelRequestError(csrfExpired ? "Проверка безопасности сессии обновляется. Повторите действие; данные формы сохранены." : payload?.error || "Сервер вернул некорректный ответ. Повторите запрос.", response.status);
  }
  return payload as T;
}
