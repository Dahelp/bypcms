"use client";

import PanelIcon from "./PanelIcon";

type Props = { placeholder?: string; value?: string; onChange?: (value: string) => void; onOpen?: () => void };

/** Shared search control for workspace headers and section toolbars. */
export default function PanelSearch({ placeholder = "Поиск по панели", value = "", onChange, onOpen }: Props) {
  const icon = <PanelIcon name="search" />;
  return onOpen
    ? <button type="button" className="panelSearchControl panelSearchTrigger" onClick={onOpen} aria-label={placeholder}>{icon}<span>{placeholder}</span></button>
    : <label className="panelSearchControl">{icon}<input type="search" aria-label={placeholder} placeholder={placeholder} value={value} onChange={event => onChange?.(event.target.value)}/></label>;
}
