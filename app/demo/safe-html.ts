const tags = new Set("a article aside b blockquote br caption code col colgroup div em figcaption figure footer h1 h2 h3 h4 h5 h6 header hr i img li main nav ol p pre section small span strong table tbody td th thead tr ul".split(" "));
const discard = new Set("script style iframe object embed form input textarea select button meta link base svg math template noscript".split(" "));
const attributes = new Set(["href", "src", "alt", "title", "class", "colspan", "rowspan", "scope"]);
export function safeHtmlUrl(value: string, image = false): boolean {
  try {
    const url = new URL(value, "https://demo.invalid/");
    return image ? ["http:", "https:"].includes(url.protocol) || /^data:image\/(?:png|jpeg|gif|webp|avif);base64,[a-z0-9+/=]+$/i.test(value) : ["http:", "https:", "mailto:", "tel:"].includes(url.protocol);
  } catch { return false; }
}
/** The same limited rich-text markup is rendered in the editor and site preview. */
export function sanitizeDemoHtml(source: string): string {
  if (typeof DOMParser === "undefined") return source.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  const document = new DOMParser().parseFromString(source, "text/html");
  for (const element of Array.from(document.body.querySelectorAll("*"))) {
    const tag = element.tagName.toLowerCase();
    if (discard.has(tag)) { element.remove(); continue; }
    if (!tags.has(tag)) { element.replaceWith(...Array.from(element.childNodes)); continue; }
    for (const attribute of Array.from(element.attributes)) {
      const name = attribute.name.toLowerCase();
      if (!attributes.has(name) || ((name === "href" || name === "src") && !safeHtmlUrl(attribute.value, name === "src"))) element.removeAttribute(attribute.name);
    }
  }
  return document.body.innerHTML;
}
