"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { downloadSelection } from "./panel-bulk";

export type PanelAction = { label: string; href?: string; onClick?: () => void; danger?: boolean; newTab?: boolean };
export type PanelColumn<T> = { key: string; label: string; render: (row: T) => ReactNode; exportValue?: (row: T) => string };
export type PanelBulkResult = { succeeded: (string | number)[]; failed: { id: string | number; error: string }[]; notice?: string };
export type PanelBulkAction<T> = { id: string; label: string; danger?: boolean; confirmation?: string; run: (rows: T[]) => Promise<PanelBulkResult | void> | PanelBulkResult | void };

function SelectionCheckbox({ checked, mixed = false, label, onChange, disabled = false }: {
  checked: boolean; mixed?: boolean; label: string; onChange: () => void; disabled?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { if (input.current) input.current.indeterminate = mixed; }, [mixed]);
  return <input ref={input} className="panelCheckbox" type="checkbox" checked={checked} disabled={disabled}
    aria-label={label} aria-checked={mixed ? "mixed" : checked} onChange={onChange} />;
}

export function PanelRowActions({ label, actions, disabled = false }: { label: string; actions: PanelAction[]; disabled?: boolean }) {
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const id = useId();
  useEffect(() => {
    if (!position) return;
    menu.current?.querySelector<HTMLElement>("a,button")?.focus();
    const outside = (event: PointerEvent) => {
      if (!menu.current?.contains(event.target as Node) && !trigger.current?.contains(event.target as Node)) setPosition(null);
    };
    const close = () => setPosition(null);
    document.addEventListener("pointerdown", outside);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    return () => {
      document.removeEventListener("pointerdown", outside);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [position]);
  function close() { setPosition(null); trigger.current?.focus(); }
  function keydown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape" || event.key === "Tab") { if (event.key === "Escape") event.preventDefault(); close(); return; }
    const items = Array.from(menu.current?.querySelectorAll<HTMLElement>("a,button") ?? []);
    const index = items.indexOf(document.activeElement as HTMLElement);
    if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
      event.preventDefault();
      const next = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : (index + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
      items[next]?.focus();
    }
  }
  return <>
    <button ref={trigger} type="button" disabled={disabled} className="panelActionTrigger" aria-label={`Действия: ${label}`} title="Действия"
      aria-haspopup="menu" aria-expanded={Boolean(position)} aria-controls={position ? id : undefined}
      onClick={() => {
        if (position) { close(); return; }
        const rect = trigger.current!.getBoundingClientRect();
        const height = actions.length * 44 + 16;
        setPosition({ left: Math.max(8, Math.min(rect.right - 224, window.innerWidth - 232)),
          top: rect.bottom + height + 8 < window.innerHeight ? rect.bottom + 6 : Math.max(8, rect.top - height - 6) });
      }}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>
    </button>
    {position && createPortal(<div id={id} ref={menu} className="panelActionMenu" style={position} role="menu" aria-label={`Действия: ${label}`} onKeyDown={keydown}>
      {actions.map(action => action.href
        ? <a key={action.label} role="menuitem" className={action.danger ? "danger" : ""} href={action.href} target={action.newTab ? "_blank" : undefined} rel={action.newTab ? "noreferrer" : undefined}>{action.label}</a>
        : <button key={action.label} type="button" role="menuitem" className={action.danger ? "danger" : ""} onClick={() => { close(); action.onClick?.(); }}>{action.label}</button>)}
    </div>, document.body)}
  </>;
}

export default function PanelTable<T>({ label, rows, columns, rowId, rowLabel, actions, bulkActions = [], empty = "Записей пока нет" }: {
  label: string; rows: T[]; columns: PanelColumn<T>[]; rowId: (row: T) => string | number;
  rowLabel: (row: T) => string; actions?: (row: T) => PanelAction[]; bulkActions?: PanelBulkAction<T>[]; empty?: string;
}) {
  const [selection, setSelection] = useState<Set<string | number>>(new Set());
  const [actionId, setActionId] = useState("");
  const [busy, setBusy] = useState(false);
  const running = useRef(false);
  const [confirmation, setConfirmation] = useState<{ action: PanelBulkAction<T>; rows: T[] } | null>(null);
  const [outcome, setOutcome] = useState<{ message: string; failures: string[] } | null>(null);
  const confirmationPanel = useRef<HTMLDivElement>(null);
  const outcomePanel = useRef<HTMLDivElement>(null);
  const applyButton = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (confirmation) confirmationPanel.current?.focus(); }, [confirmation]);
  useEffect(() => { if (outcome) outcomePanel.current?.focus(); }, [outcome]);
  const controlsId = useId();
  const availableActions: PanelBulkAction<T>[] = [...bulkActions, { id: "export", label: "Экспорт CSV", run: records => downloadSelection(label, records, columns) }];
  const selectedRows = rows.filter(row => selection.has(rowId(row)));
  const locked = busy || Boolean(confirmation);
  const ids = rows.map(rowId);
  const selected = ids.filter(id => selection.has(id));
  const all = ids.length > 0 && selected.length === ids.length;
  // Only visible rows participate; keep failed rows selected after a refresh.
  const scope = JSON.stringify([...ids].map(String).sort());
  useEffect(() => { setSelection(previous => new Set(ids.filter(id => previous.has(id)))); setConfirmation(null); }, [scope]);
  async function execute(action: PanelBulkAction<T>, records: T[]) {
    if (running.current || !records.length) return;
    running.current = true; setBusy(true); setConfirmation(null); setOutcome(null);
    try {
      const result = await action.run(records);
      const succeeded = result?.succeeded ?? records.map(rowId);
      const failed = result?.failed ?? [];
      if (action.id !== "export") setSelection(new Set(failed.map(failure => { const row = records.find(row => String(rowId(row)) === String(failure.id)); return row ? rowId(row) : failure.id; })));
      setOutcome({ message: `${action.label}: выполнено ${succeeded.length} из ${records.length}.${failed.length ? ` Ошибок: ${failed.length}. Необработанные записи оставлены выбранными.` : ""}${result?.notice ? ` ${result.notice}` : ""}`,
        failures: failed.map(failure => { const row = records.find(row => String(rowId(row)) === String(failure.id)); return `${row ? rowLabel(row) : failure.id}: ${failure.error}`; }) });
    } catch (error) { setOutcome({ message: "Не удалось подтвердить результат. Выбор сохранён. Обновите список перед повторной попыткой.", failures: [error instanceof Error ? error.message : "Ошибка запроса"] }); }
    finally { running.current = false; setBusy(false); }
  }
  return <section className="panelTable" aria-label={label}>
    <div className="panelSelectionBar" aria-busy={busy}><span aria-live="polite">{selected.length ? `Выбрано: ${selected.length} из ${rows.length}` : `Записей: ${rows.length}`}</span>
      {selected.length > 0 ? <div className="panelBulkControls"><label className="panelVisuallyHidden" htmlFor={controlsId}>Действие для выбранных: {label}</label><select id={controlsId} value={actionId} disabled={locked} onChange={event => { setActionId(event.target.value); setOutcome(null); }}><option value="">Выберите действие</option>{availableActions.map(action => <option key={action.id} value={action.id}>{action.label}</option>)}</select>
        <button ref={applyButton} type="button" className="panelBulkApply" disabled={!actionId || locked} onClick={() => { const action = availableActions.find(action => action.id === actionId); if (!action || running.current) return; if (action.confirmation || action.danger) setConfirmation({ action, rows: selectedRows }); else void execute(action, selectedRows); }}>{busy ? "Выполняется…" : `Применить (${selected.length})`}</button>
        <button type="button" disabled={locked} onClick={() => setSelection(new Set())}>Снять выбор</button></div> : <span>Выбор всех — на текущей странице</span>}
    </div>
    {confirmation && <div ref={confirmationPanel} tabIndex={-1} className="panelBulkConfirm" role="group" aria-label="Подтверждение массового действия"><p>{confirmation.action.confirmation || "Применить действие к выбранным записям?"} <b>Записей: {confirmation.rows.length}.</b></p><p>{confirmation.rows.slice(0, 5).map(rowLabel).join(", ")}{confirmation.rows.length > 5 ? "…" : ""}</p><div><button type="button" className={confirmation.action.danger ? "danger" : ""} onClick={() => void execute(confirmation.action, confirmation.rows)}>Подтвердить</button><button type="button" onClick={() => { setConfirmation(null); window.requestAnimationFrame(() => applyButton.current?.focus()); }}>Отмена</button></div></div>}
    {outcome && <div ref={outcomePanel} tabIndex={-1} className={`panelBulkOutcome ${outcome.failures.length ? "hasErrors" : ""}`} role="status" aria-live="polite"><p>{outcome.message}</p>{outcome.failures.length > 0 && <ul>{outcome.failures.map((failure, index) => <li key={index}>{failure}</li>)}</ul>}</div>}
    <div className="panelTableScroll"><table><caption className="panelVisuallyHidden">{label}</caption><thead><tr>
      <th scope="col" className="panelSelectCell"><SelectionCheckbox checked={all} mixed={selected.length > 0 && !all} disabled={!rows.length || locked}
        label={`Выбрать все строки: ${label}`} onChange={() => setSelection(new Set(all ? [] : ids))} /></th>
      {columns.map(column => <th scope="col" key={column.key}>{column.label}</th>)}
      {actions && <th scope="col" className="panelActionsCell"><span className="panelVisuallyHidden">Действия</span></th>}
    </tr></thead><tbody>{rows.map(row => {
      const id = rowId(row);
      return <tr key={id} data-selected={selection.has(id) || undefined}>
        <td className="panelSelectCell"><SelectionCheckbox checked={selection.has(id)} disabled={locked} label={`Выбрать: ${rowLabel(row)}`} onChange={() => setSelection(previous => { const next = new Set(previous); if (next.has(id)) next.delete(id); else next.add(id); return next; })} /></td>
        {columns.map(column => <td key={column.key}>{column.render(row)}</td>)}
        {actions && <td className="panelActionsCell"><PanelRowActions label={rowLabel(row)} actions={actions(row)} disabled={locked} /></td>}
      </tr>;
    })}{!rows.length && <tr><td className="panelTableEmpty" colSpan={columns.length + (actions ? 2 : 1)}>{empty}</td></tr>}</tbody></table></div>
  </section>;
}
