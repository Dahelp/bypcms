"use client";

type Props = { placeholder?: string; value?: string; onChange?: (value: string) => void; onOpen?: () => void };

/** Shared search control for workspace headers and section toolbars. */
export default function PanelSearch({ placeholder = "Поиск по панели", value = "", onChange, onOpen }: Props) {
  const icon = <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></svg>;
  return onOpen
    ? <button type="button" className="panelSearchControl panelSearchTrigger" onClick={onOpen} aria-label={placeholder}>{icon}<span>{placeholder}</span></button>
    : <label className="panelSearchControl">{icon}<input type="search" aria-label={placeholder} placeholder={placeholder} value={value} onChange={event => onChange?.(event.target.value)}/></label>;
}
