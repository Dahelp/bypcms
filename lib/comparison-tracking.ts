export type ComparisonEdition = "business" | "commerce" | "content";
export type ComparisonTerm = "annual" | "lifetime";
export type ComparisonLocale = "ru" | "en";
export type ComparisonContext = {edition: ComparisonEdition; term: ComparisonTerm; locale: ComparisonLocale};
export type ComparisonEvent = "comparison_view" | "details_click" | "demo_click" | "order_click" | "product_order_click" | "checkout_open";
const observed = new Set<string>();

// The attribution contains only catalog choices, never a visitor identifier.
export function comparisonTag(context: ComparisonContext): string {
  return `${context.edition}.${context.term}.${context.locale}`;
}
export function parseComparisonTag(value: string | null): ComparisonContext | null {
  if (!value || !/^(business|commerce|content)\.(annual|lifetime)\.(ru|en)$/.test(value)) return null;
  const [edition, term, locale] = value.split(".");
  return {edition, term, locale} as ComparisonContext;
}
export function withComparisonSource(href: string, tag: string | null): string {
  if (!parseComparisonTag(tag)) return href;
  const url = new URL(href, "https://bypcms.ru");
  if (url.origin !== "https://bypcms.ru") return href;
  url.searchParams.set("cmp", tag!);
  return url.pathname + url.search + url.hash;
}
export function comparisonPayload(event: ComparisonEvent, context: ComparisonContext | {edition:"all";term:ComparisonTerm;locale:ComparisonLocale}) {
  return {event, edition:context.edition, term:context.term, locale:context.locale};
}
export function trackComparison(event: ComparisonEvent, context: ComparisonContext | {edition:"all";term:ComparisonTerm;locale:ComparisonLocale}, once = false): void {
  if (typeof window === "undefined" || typeof navigator === "undefined") return;
  if (navigator.doNotTrack === "1" || (navigator as Navigator & {globalPrivacyControl?:boolean}).globalPrivacyControl) return;
  const payload = comparisonPayload(event, context);
  const key = JSON.stringify(payload);
  if (once && observed.has(key)) return;
  if (once) observed.add(key);
  // Best effort: reporting must never hold up navigation or checkout.
  try {
    void fetch("/metrics/index.php", {
      method:"POST", credentials:"omit", cache:"no-store", keepalive:true,
      referrerPolicy:"no-referrer", headers:{"Content-Type":"application/json"},
      body:JSON.stringify(payload), signal:AbortSignal.timeout(5000),
    }).catch(() => {});
  } catch { /* Checkout also works with blocked or unavailable reporting. */ }
}
