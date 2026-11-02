/** Query-only links preserve /demo/ locally and / on the standalone demo domain.
 * Navigation is handled by the browser, with one document per history entry. */
export function panelHref(values: Record<string, string | number | undefined | null>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && value !== null) query.set(key, String(value));
  }
  return `?${query.toString()}`;
}
