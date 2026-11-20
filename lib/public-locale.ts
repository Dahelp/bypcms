export type Locale = "ru" | "en";
export const locales = ["ru", "en"] as const;

/** Public routes are exported on disk; PHP account routes keep their own URL. */
export function localeHref(href: string, locale: Locale): string {
  if (!href.startsWith("/") || href.startsWith("//")) return href;
  const url = new URL(href, "https://bypcms.ru");
  const path = url.pathname.replace(/^\/en(?=\/|$)/, "") || "/";
  if (/^\/(account)(\/|$)/.test(path)) {
    url.searchParams.set("lang", locale);
    const next=url.searchParams.get("next");
    if(next&&/^\/(?:en\/)?order\/?(?:\?|$)/.test(next))url.searchParams.set("next",localeHref(next,locale));
    return path + url.search + url.hash;
  }
  if (/^\/(api|commerce|admin|owner|demo|themes|showcase)(\/|$)/.test(path) || /\.[a-z0-9]+$/i.test(path)) return href;
  return (locale === "en" ? "/en" : "") + path + url.search + url.hash;
}

export function publicMetadata(path: string, title: string, description: string, locale: Locale) {
  return {
    title, description,
    alternates: { canonical: localeHref(path, locale), languages: { ru: localeHref(path, "ru"), en: localeHref(path, "en"), "x-default": localeHref(path, "ru") } },
    openGraph: { title, description, locale: locale === "en" ? "en_US" : "ru_RU", alternateLocale: locale === "en" ? "ru_RU" : "en_US", url: localeHref(path, locale) },
  };
}
