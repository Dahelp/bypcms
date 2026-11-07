"use client";

import { useEffect, useId, useRef, useState } from "react";
import PanelIcon, { type PanelIconName } from "./PanelIcon";
import { panelIconBySection } from "./panel-icons";

export type NotificationItem = {
  entity_id?: number;
  id: number;
  title: string;
  message: string;
  is_read: number;
  created_at: string;
  icon?: PanelIconName;
  entity_type?: string;
};

type Props = {
  items?: NotificationItem[];
  onRead?: (id: number) => Promise<void>;
  onSelect?: (id: number) => void;
  hrefForItem?: (item: NotificationItem) => string;
};

export default function NotificationDropdown({ items = [], onRead, onSelect, hrefForItem }: Props) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const popoverId = useId();
  const unread = items.filter(item => !Number(item.is_read)).length;

  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", key);
    };
  }, []);

  async function select(item: NotificationItem) {
    setError("");
    try {
      if (!Number(item.is_read)) await onRead?.(item.id);
      onSelect?.(item.id);
      setOpen(false);
      trigger.current?.focus();
    } catch {
      setError("Не удалось обновить оповещение. Попробуйте ещё раз.");
    }
  }

  return <div className="workspaceNotifications" ref={root}>
    <button ref={trigger} type="button" className="notificationTrigger" aria-label={`Оповещения: ${unread} непрочитанных`} aria-expanded={open} aria-controls={popoverId} onClick={() => setOpen(value => !value)}>
      <PanelIcon name="bell" />
      {unread > 0 && <span className="notificationCount">{unread}</span>}
    </button>
    {open && <section id={popoverId} className="notificationPopover" aria-label="Центр событий">
      <header><div><small>ЦЕНТР СОБЫТИЙ</small><h3>Важное сегодня</h3></div><button type="button" aria-label="Закрыть оповещения" onClick={() => { setOpen(false); trigger.current?.focus(); }}><PanelIcon name="close" /></button></header>
      <div className="notificationItems">
        {items.length ? items.slice(0, 20).map(item => hrefForItem ? <a className="notificationRow" key={item.id} href={hrefForItem(item)} onClick={() => {
          if (onRead && !Number(item.is_read)) void onRead(item.id).catch(() => setError("Не удалось обновить оповещение."));
        }}>
          <i><PanelIcon name={item.icon ?? panelIconBySection[item.entity_type ?? ""] ?? "bell"} /></i>
          <span><b>{item.title}</b><small>{item.message}</small></span><PanelIcon name="chevron" />
        </a> : <button type="button" className="notificationRow" key={item.id} onClick={() => void select(item)}>
          <i><PanelIcon name={item.icon ?? panelIconBySection[item.entity_type ?? ""] ?? "bell"} /></i>
          <span><b>{item.title}</b><small title={item.created_at ? new Date(item.created_at).toLocaleString("ru-RU") : undefined}>{item.message}</small></span>
          <PanelIcon name="chevron" />
        </button>) : <p className="notificationEmpty">Новых оповещений нет.</p>}
      </div>
      {error && <p className="notificationError" role="alert">{error}</p>}
    </section>}
  </div>;
}
