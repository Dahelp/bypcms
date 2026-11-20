"use client";

import { createContext, useContext, useEffect, useCallback, useState, type ComponentProps, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { type Locale, localeHref } from "../../lib/public-locale";
import english from "../../lib/public-en.json";

const LocaleContext = createContext<Locale>("ru");
export function LocaleProvider({locale, children}: {locale: Locale; children: ReactNode}) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}
export function useLocale() { return useContext(LocaleContext); }
export function translate(locale: Locale, text: string): string {
  return locale === "en" ? (english as Record<string,string>)[text] ?? text : text;
}
export function usePublicText() { const locale = useLocale(); return useCallback((text: string) => translate(locale, text), [locale]); }
export function LocaleLink({href, ...props}: ComponentProps<"a"> & {href:string}) {
  const locale = useLocale();
  const pathname=usePathname();
  let target=localeHref(href,locale);
  if(target.startsWith("/")){
    const url=new URL(target,"https://bypcms.ru");
    if(url.hash&&!url.search&&url.pathname.replace(/\/$/,"")===pathname.replace(/\/$/,""))target=url.hash;
  }
  // These pages share hosting with PHP endpoints; each destination serves its own document.
  return <a {...props} href={target}/>;
}
export function LanguageSwitch() {
  const locale = useLocale();
  const pathname=usePathname();
  const [suffix,setSuffix]=useState("");
  useEffect(()=>{const update=()=>setSuffix(window.location.search+window.location.hash);update();window.addEventListener("hashchange",update);window.addEventListener("popstate",update);window.addEventListener("bypcms:configuration",update);return()=>{window.removeEventListener("hashchange",update);window.removeEventListener("popstate",update);window.removeEventListener("bypcms:configuration",update);};},[pathname]);
  useEffect(() => { document.documentElement.lang = locale; document.cookie = `bypcms_lang=${locale}; Path=/; Max-Age=31536000; SameSite=Lax`; }, [locale]);
  return <nav className="languageSwitch" aria-label={locale === "ru" ? "Язык сайта" : "Website language"}>
    {(["ru", "en"] as const).map(language => <a key={language} href={localeHref(pathname+suffix,language)} lang={language} hrefLang={language} aria-current={locale === language ? "true" : undefined} aria-label={language === "ru" ? "Русский" : "English"} onClick={event => {
      if(event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
      event.preventDefault();
      document.cookie = `bypcms_lang=${language}; Path=/; Max-Age=31536000; SameSite=Lax`;
      window.location.assign(localeHref(window.location.pathname + window.location.search + window.location.hash, language));
    }}>{language.toUpperCase()}</a>)}
  </nav>;
}
