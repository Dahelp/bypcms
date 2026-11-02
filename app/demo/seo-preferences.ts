export type SearchEngine = "google" | "yandex";
export type ResultDevice = "desktop" | "mobile";
export type SeoPreferences = { engines: SearchEngine[]; preferred: SearchEngine };
export const SEO_PREFERENCES_KEY = "bypcms-demo-seo-preferences-v1";
export const defaultSeoPreferences: SeoPreferences = { engines: ["google","yandex"], preferred: "google" };
export const searchEngineNames: Record<SearchEngine,string> = { google:"Google",yandex:"Яндекс" };
export const searchEngineDocs: Record<SearchEngine,string> = {
  google:"https://developers.google.com/search/docs/appearance/snippet?hl=ru",
  yandex:"https://yandex.ru/support/webmaster/ru/search-results/title-and-description.html",
};
export function normalizeSeoPreferences(value: unknown): SeoPreferences {
  const input=value as Partial<SeoPreferences> | null;
  const engines=Array.isArray(input?.engines)?[...new Set(input.engines.filter(engine=>engine==="google" || engine==="yandex"))]:[];
  if(!engines.length)return {engines:[...defaultSeoPreferences.engines],preferred:defaultSeoPreferences.preferred};
  return {engines,preferred:input?.preferred && engines.includes(input.preferred)?input.preferred:engines[0]};
}
export function validateSeoPreferences(value: SeoPreferences): string | null {
  if(!value.engines.length)return "Выберите хотя бы одну поисковую систему.";
  if(value.engines.some(engine=>engine!=="google" && engine!=="yandex") || !value.engines.includes(value.preferred))return "Выберите основную систему из отмеченных вариантов.";
  return null;
}
export function readSeoPreferences(storage: Pick<Storage,"getItem">): SeoPreferences {
  try{return normalizeSeoPreferences(JSON.parse(storage.getItem(SEO_PREFERENCES_KEY) || "null"));}catch{return normalizeSeoPreferences(null);}
}
export function saveSeoPreferences(storage: Pick<Storage,"setItem">,value: SeoPreferences): SeoPreferences {
  const error=validateSeoPreferences(value);if(error)throw new Error(error);
  const preferences=normalizeSeoPreferences(value);
  storage.setItem(SEO_PREFERENCES_KEY,JSON.stringify(preferences));return preferences;
}
export function resultViewKey(id:number,kind:string) {return `bypcms-demo-serp-view-v1:${kind}:${id}`;}
export function resultViewSignature(preferences: SeoPreferences) {return `${preferences.engines.join(",")}:${preferences.preferred}`;}
export function normalizeResultView(value: unknown,preferences: SeoPreferences): {engine:SearchEngine;device:ResultDevice} {
  const view=value as {engine?:SearchEngine;device?:ResultDevice;signature?:string} | null;
  return {engine:view?.signature===resultViewSignature(preferences) && view.engine && preferences.engines.includes(view.engine)?view.engine:preferences.preferred,device:view?.device==="mobile"?"mobile":"desktop"};
}
export function resultAddress(domain: string,slug: string) {
  try {
    const site=new URL(domain.includes("://")?domain:`https://${domain}`);
    if(!["http:","https:"].includes(site.protocol))throw new Error("Invalid protocol");
    const path=slug.startsWith("/")?slug:`/${slug}`;
    const url=new URL(path,site.origin);
    // A slug is a site path, not an external host or script URL.
    if(url.origin!==site.origin)throw new Error("Invalid path");
    return {host:site.host,url:url.href,breadcrumb:[site.host,...url.pathname.split("/").filter(Boolean)].join(" › ")};
  }catch{return {host:"demo.bypcms.ru",url:"https://demo.bypcms.ru/",breadcrumb:"demo.bypcms.ru"};}
}
