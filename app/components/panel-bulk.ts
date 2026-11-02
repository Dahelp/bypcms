import { isValidElement, type ReactNode } from "react";
import type { PanelBulkAction, PanelBulkResult, PanelColumn } from "./PanelTable";

function cellText(value: ReactNode): string {
  if (value === null || value === undefined || typeof value === "boolean") return "";
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.map(cellText).join("");
  if (isValidElement<{ children?: ReactNode; "aria-hidden"?: boolean }>(value)) {
    if (value.props["aria-hidden"]) return "";
    const text = cellText(value.props.children);
    return typeof value.type === "string" && ["small", "p", "div"].includes(value.type) ? ` ${text} ` : text;
  }
  return "";
}

export function selectionCsv<T>(rows: T[], columns: PanelColumn<T>[]): string {
  const quote = (value: string) => `"${(/^[\s]*[=+@-]|^[\t\r\n]/.test(value) ? "'" : "") + value.replaceAll('"', '""')}"`;
  return "\uFEFF" + [columns.map(column => quote(column.label)).join(";"), ...rows.map(row => columns.map(column => quote(column.exportValue ? column.exportValue(row) : cellText(column.render(row)).trim())).join(";"))].join("\r\n");
}

export function downloadSelection<T>(label: string, rows: T[], columns: PanelColumn<T>[]) {
  const url = URL.createObjectURL(new Blob([selectionCsv(rows, columns)], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url; link.download = `${label.replace(/[^\p{L}\p{N}_-]+/gu, "-")}-selected.csv`;
  document.body.appendChild(link); link.click(); link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function requestPanelBulk(collection: string, operation: string, ids: (number | string)[], csrf: string, status?: string): Promise<PanelBulkResult> {
  const combined: PanelBulkResult = { succeeded: [], failed: [] };
  for (let offset = 0; offset < ids.length; offset += 200) {
    try {
      const response = await fetch("/api/index.php?action=panel.bulk", { method: "POST", credentials: "same-origin",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf }, body: JSON.stringify({ collection, operation, ids: ids.slice(offset, offset + 200), status }) });
      const result = await response.json().catch(() => ({ error: "Некорректный ответ сервера" }));
      if (!response.ok || !result.ok) throw new Error(result.error || "Не удалось получить результат массового действия");
      combined.succeeded.push(...result.succeeded); combined.failed.push(...result.failed);
    } catch (error) {
      if (!offset) throw error;
      const message = error instanceof Error ? error.message : "Не удалось получить результат";
      combined.failed.push(...ids.slice(offset).map(id => ({ id, error: `${message}. Проверьте запись перед повтором.` })));
      break;
    }
  }
  return combined;
}

export function statusBulkActions<T>(choices: [string, string][], execute: (rows: T[], status: string) => Promise<PanelBulkResult | void> | PanelBulkResult | void): PanelBulkAction<T>[] {
  return choices.map(([status, label]) => ({ id: `status:${status}`, label, confirmation: `Применить действие «${label}» к выбранным записям?`, run: rows => execute(rows, status) }));
}

export function deleteBulkAction<T>(execute: (rows: T[]) => Promise<PanelBulkResult | void> | PanelBulkResult | void): PanelBulkAction<T> {
  return { id: "delete", label: "Удалить", danger: true, confirmation: "Удалить выбранные записи? Это действие нельзя отменить.", run: execute };
}

export async function refreshAfterBulk(result: PanelBulkResult, refresh: () => Promise<unknown>): Promise<PanelBulkResult> {
  try { await refresh(); return result; }
  catch { return { ...result, notice: "Действие выполнено, но список не удалось обновить. Обновите страницу." }; }
}
