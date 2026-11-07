/** Query-only links preserve /demo/ locally and / on the standalone demo domain.
 * Navigation is handled by the browser, with one document per history entry. */
export function panelHref(values: Record<string, string | number | undefined | null>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && value !== null) query.set(key, String(value));
  }
  return `?${query.toString()}`;
}

export type CommerceView = "orders" | "mail" | "payment-settings" | "mail-settings";
export function panelSection(query:URLSearchParams|null):string {
  return query?(query.get("section")||"overview"):"";
}
export function ownerSectionRoute(query: URLSearchParams): {section:string;settingsTab:"general"|"payments"|"mail"} {
  const section=panelSection(query);
  // Old bookmarks still open their destination without adding a redirect to history.
  if(section==="payments"&&query.get("panel")==="connection")return {section:"settings",settingsTab:"payments"};
  if(section==="payments"&&query.get("panel")==="mail")return {section:"mail",settingsTab:"general"};
  const tab=query.get("tab");
  return {section,settingsTab:section==="settings"&&(tab==="payments"||tab==="mail")?tab:"general"};
}

export function commerceSettingsPayload(view:CommerceView,settings:Record<string,string|number|boolean>,secrets:{shop_secret:string;smtp_password:string}) {
  const keys=view==="payment-settings"?["payments_enabled","mode","shop_id","receipt_mode","npd_manual_confirmed","vat_code","tax_system_code","payment_subject","payment_mode","clear_shop_secret"]:["smtp_enabled","smtp_host","smtp_port","smtp_security","smtp_user","from_email","from_name","owner_email","clear_smtp_password"];
  const payload:Record<string,string|number|boolean>={};
  for(const key of keys)if(Object.hasOwn(settings,key))payload[key]=settings[key];
  if(view==="payment-settings")payload.shop_secret=secrets.shop_secret;
  else if(view==="mail-settings")payload.smtp_password=secrets.smtp_password;
  else throw new Error("Откройте настройки оплаты или почты.");
  return payload;
}
