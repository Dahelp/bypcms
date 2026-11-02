"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";

export type PanelAction = { label: string; href?: string; onClick?: () => void; danger?: boolean; newTab?: boolean };
export type PanelColumn<T> = { key: string; label: string; render: (row: T) => ReactNode };

function SelectionCheckbox({ checked, mixed = false, label, onChange, disabled = false }: {
  checked: boolean; mixed?: boolean; label: string; onChange: () => void; disabled?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { if (input.current) input.current.indeterminate = mixed; }, [mixed]);
  return <input ref={input} className="panelCheckbox" type="checkbox" checked={checked} disabled={disabled}
    aria-label={label} aria-checked={mixed ? "mixed" : checked} onChange={onChange} />;
}

export function PanelRowActions({ label, actions }: { label: string; actions: PanelAction[] }) {
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
    <button ref={trigger} type="button" className="panelActionTrigger" aria-label={`Действия: ${label}`} title="Действия"
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

export default function PanelTable<T>({ label, rows, columns, rowId, rowLabel, actions, empty = "Записей пока нет" }: {
  label: string; rows: T[]; columns: PanelColumn<T>[]; rowId: (row: T) => string | number;
  rowLabel: (row: T) => string; actions?: (row: T) => PanelAction[]; empty?: string;
}) {
  const [selection, setSelection] = useState<Set<string | number>>(new Set());
  const ids = rows.map(rowId);
  const selected = ids.filter(id => selection.has(id));
  const all = ids.length > 0 && selected.length === ids.length;
  // A new visible set (filter, pagination, deletion) starts a fresh selection.
  const scope = JSON.stringify(ids);
  useEffect(() => setSelection(new Set()), [scope]);
  return <section className="panelTable" aria-label={label}>
    <div className="panelSelectionBar"><span aria-live="polite">{selected.length ? `Выбрано: ${selected.length} из ${rows.length}` : `Записей: ${rows.length}`}</span>
      {selected.length > 0 ? <button type="button" onClick={() => setSelection(new Set())}>Снять выбор</button> : <span>Выбор всех — на текущей странице</span>}
    </div>
    <div className="panelTableScroll"><table><caption className="panelVisuallyHidden">{label}</caption><thead><tr>
      <th scope="col" className="panelSelectCell"><SelectionCheckbox checked={all} mixed={selected.length > 0 && !all} disabled={!rows.length}
        label={`Выбрать все строки: ${label}`} onChange={() => setSelection(new Set(all ? [] : ids))} /></th>
      {columns.map(column => <th scope="col" key={column.key}>{column.label}</th>)}
      {actions && <th scope="col" className="panelActionsCell"><span className="panelVisuallyHidden">Действия</span></th>}
    </tr></thead><tbody>{rows.map(row => {
      const id = rowId(row);
      return <tr key={id} data-selected={selection.has(id) || undefined}>
        <td className="panelSelectCell"><SelectionCheckbox checked={selection.has(id)} label={`Выбрать: ${rowLabel(row)}`} onChange={() => setSelection(previous => { const next = new Set(previous); if (next.has(id)) next.delete(id); else next.add(id); return next; })} /></td>
        {columns.map(column => <td key={column.key}>{column.render(row)}</td>)}
        {actions && <td className="panelActionsCell"><PanelRowActions label={rowLabel(row)} actions={actions(row)} /></td>}
      </tr>;
    })}{!rows.length && <tr><td className="panelTableEmpty" colSpan={columns.length + (actions ? 2 : 1)}>{empty}</td></tr>}</tbody></table></div>
  </section>;
}
