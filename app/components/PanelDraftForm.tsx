"use client";
import { Children, cloneElement, createContext, isValidElement, type FormHTMLAttributes, type ReactNode, useContext, useEffect, useRef, useState } from "react";

export const PanelDraftUser = createContext<number | null>(null);
const prefix = "bypcms-panel-form-v1:";
type Draft = { fields: Record<string, string[]>; extra?: unknown; scroll: number; savedAt: number };
function routeKey(user: number | null) { return `${prefix}${user}:${location.pathname}${location.search}:`; }
export function clearPanelDrafts(all = false) {
  try {
    for (const key of Object.keys(sessionStorage)) if (key.startsWith(all ? prefix : `${prefix}${document.querySelector('[data-panel-user]')?.getAttribute('data-panel-user')}:${location.pathname}${location.search}:`)) sessionStorage.removeItem(key);
    for (const form of document.querySelectorAll<HTMLFormElement>("form[data-panel-draft]")) form.dataset.draftComplete = "true";
  } catch { /* A failed cleanup must not turn a successful server save into an error. */ }
}
export function restoreDraftFields(children: ReactNode, fields: Draft["fields"]): ReactNode {
  return Children.map(children, child => {
    if (!isValidElement<Record<string, any>>(child)) return child;
    const props = child.props; const values = props.name ? fields[props.name] : undefined;
    const update: Record<string, unknown> = {};
    if (typeof child.type === "string" && ["input", "textarea", "select"].includes(child.type) && values && !["password", "file", "hidden", "submit"].includes(props.type)) {
      if (["checkbox", "radio"].includes(props.type)) { if (!("checked" in props)) update.defaultChecked = values.includes(String(props.value ?? "on")); }
      else if (!("value" in props)) update.defaultValue = props.multiple ? values : values[0] ?? "";
    }
    if (props.children) update.children = restoreDraftFields(props.children, fields);
    return cloneElement(child, update);
  });
}

export default function PanelDraftForm({ draftId, extra, onRestore, children, onInput, onChange, ...props }: FormHTMLAttributes<HTMLFormElement> & { draftId: string; extra?: unknown; onRestore?: (draft: Draft) => void }) {
  const user = useContext(PanelDraftUser); const ref = useRef<HTMLFormElement>(null); const complete = useRef(false); const latestExtra = useRef(extra); latestExtra.current = extra;
  const [warning, setWarning] = useState("");
  const [initial] = useState<Draft | null>(() => {
    if (typeof window === "undefined" || !user) return null;
    const navigation = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    if (!["reload", "back_forward"].includes(navigation?.type || "")) return null;
    try {
      const draft = JSON.parse(sessionStorage.getItem(routeKey(user) + draftId) || "null");
      return draft && draft.fields && typeof draft.fields === "object" && !Array.isArray(draft.fields)
        && Object.values(draft.fields).every(values => Array.isArray(values) && values.every(value => typeof value === "string"))
        && Number.isFinite(draft.savedAt) && draft.savedAt > Date.now() - 86400000 && draft.savedAt <= Date.now()
        && Number.isFinite(draft.scroll) ? draft : null;
    } catch { return null; }
  });
  useEffect(() => {
    if (initial) { onRestore?.(initial); requestAnimationFrame(() => window.scrollTo(0, initial.scroll || 0)); }
    function persist() {
      const form = ref.current;
      if (!form || !user || complete.current || form.dataset.draftComplete === "true") return;
      const fields: Draft["fields"] = {};
      for (const element of Array.from(form.elements)) {
        if (!(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) || !element.name || ["password", "file", "hidden", "submit", "button"].includes(element.type)) continue;
        fields[element.name] ??= [];
        if (element instanceof HTMLInputElement && ["checkbox", "radio"].includes(element.type) && !element.checked) continue;
        fields[element.name].push(...(element instanceof HTMLSelectElement && element.multiple ? Array.from(element.selectedOptions, option => option.value) : [element.value]));
      }
      try { sessionStorage.setItem(routeKey(user) + draftId, JSON.stringify({ fields, extra: latestExtra.current, scroll: window.scrollY, savedAt: Date.now() })); setWarning(""); }
      catch { setWarning("Не удалось сохранить рабочую копию в браузере. Оставьте вкладку открытой до сохранения на сервере."); }
    }
    const form = ref.current!;
    const change = () => { form.dataset.draftComplete = "false"; complete.current = false; queueMicrotask(persist); };
    form.addEventListener("input", change); form.addEventListener("change", change); window.addEventListener("pagehide", persist);
    return () => { form.removeEventListener("input", change); form.removeEventListener("change", change); window.removeEventListener("pagehide", persist); };
    // A draft is restored once, before subsequent server refreshes can replace defaults.
  }, [user, draftId]);
  return <form {...props} ref={ref} data-panel-draft={draftId} onInput={onInput} onChange={onChange}>{warning && <p role="alert">{warning}</p>}{initial ? restoreDraftFields(children, initial.fields) : children}</form>;
}
