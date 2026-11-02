import type { DemoEntity, EditionKey, EntityKind } from "./demo-data";

export type EditorTab = "content" | "seo" | "settings" | `module:${string}`;
export type EditorContext = { edition: EditionKey; kind: EntityKind; id: number };
export type EditorSnapshot = { draft: DemoEntity; tab: EditorTab; scrollY: number; blockOrder: string[]; codeBlock: boolean; customCode: string };
type EditorStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;
type NewEditorContext = Pick<EditorContext,"edition" | "kind">;
const newEditorKey=(context:NewEditorContext)=>`bypcms-demo-new-editor-v1:${context.edition}:${context.kind}`;
const SITE_SNAPSHOT_PREFIX="bypcms-demo-site-preview-v1:";

export function readNewEditorSession(storage:EditorStorage,context:NewEditorContext,requestedId:string | null,navigationType:string):EditorSnapshot | null {
  if(!requestedId && !["reload","back_forward"].includes(navigationType))return null;
  try {
    const id=Number(storage.getItem(newEditorKey(context)));
    if(!Number.isSafeInteger(id) || id<=0 || (requestedId && String(id)!==requestedId))return null;
    return readEditorSession(storage,{...context,id});
  }catch{return null;}
}
export function writeNewEditorSession(storage:EditorStorage,context:EditorContext,snapshot:EditorSnapshot):void {
  writeEditorSession(storage,context,snapshot);storage.setItem(newEditorKey(context),String(context.id));
}
export function clearNewEditorSession(storage:EditorStorage,context:EditorContext):void {
  try{if(storage.getItem(newEditorKey(context))===String(context.id))storage.removeItem(newEditorKey(context));}catch{/* Keep the saved record usable if storage is unavailable. */}
}
export function writeSiteSnapshot(storage:Storage,token:string,payload:{entities:DemoEntity[]} & Record<string,unknown>):void {
  if(!/^[a-z0-9-]{8,80}$/i.test(token))throw new Error("Некорректный адрес предпросмотра");
  const key=SITE_SNAPSHOT_PREFIX+token;
  const keys=Array.from({length:storage.length},(_,index)=>storage.key(index)).filter((item):item is string=>Boolean(item?.startsWith(SITE_SNAPSHOT_PREFIX)) && item!==key);
  // Only bounded, disposable preview snapshots are removed, never material or media storage.
  while(keys.length>=8){const expired=keys.shift();if(expired)storage.removeItem(expired);}
  storage.setItem(key,JSON.stringify({createdAt:Date.now(),payload}));
}
export function readSiteSnapshot(storage:Pick<Storage,"getItem">,token:string):string | null {
  try{
    if(!/^[a-z0-9-]{8,80}$/i.test(token))return null;
    const value=JSON.parse(storage.getItem(SITE_SNAPSHOT_PREFIX+token) || "null");
    if(!value || !Array.isArray(value.payload?.entities) || typeof value.createdAt!=="number" || Date.now()-value.createdAt>86400000)return null;
    return JSON.stringify(value.payload);
  }catch{return null;}
}

export function editorSessionKey(context: EditorContext): string {
  return `bypcms-demo-editor-v1:${context.edition}:${context.kind}:${context.id}`;
}

export function isPersistedEntity(records: DemoEntity[], entity: DemoEntity): boolean {
  return records.some(record => record.id === entity.id && record.kind === entity.kind);
}

export function createEntity(kind: EntityKind): DemoEntity {
  return { id: Date.now(), kind, title: "", slug: "/", status: ["leads", "orders"].includes(kind) ? "Новый" : "Черновик", updated: "", image: -1, publishAt: "", excerpt: "", body: "", seoTitle: "", seoDescription: "", price: ["products", "services"].includes(kind) ? 0 : undefined, stock: kind === "products" ? 0 : undefined, sku: kind === "products" ? "" : undefined, value: ["leads", "orders", "payments"].includes(kind) ? 0 : undefined, extra: "" };
}

export function prepareEntitySave(entity: DemoEntity, publish = entity.status === "Опубликовано", now = new Date()): DemoEntity {
  if (!publish) return entity;
  const localTime = new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0,16);
  return { ...entity, status: "Опубликовано", publishAt: entity.publishAt || localTime };
}

export function isEditorTab(value: unknown): value is EditorTab {
  return typeof value === "string" && (["content", "seo", "settings"].includes(value) || /^module:[a-z0-9_-]+$/.test(value));
}

/** Working copies are separate from bypcms-real-demo-v1 and never create records. */
export function readEditorSession(storage: EditorStorage, context: EditorContext): EditorSnapshot | null {
  try {
    const snapshot = JSON.parse(storage.getItem(editorSessionKey(context)) || "null");
    if (!snapshot || snapshot.draft?.id !== context.id || snapshot.draft?.kind !== context.kind ||
      !["title", "slug", "body", "excerpt", "seoTitle", "seoDescription", "status"].every(key => typeof snapshot.draft[key] === "string")) return null;
    const order = Array.isArray(snapshot.blockOrder) && snapshot.blockOrder.length === 3 &&
      new Set(snapshot.blockOrder).size === 3 && snapshot.blockOrder.every((key: string) => ["excerpt", "text", "image"].includes(key)) ? snapshot.blockOrder : ["excerpt", "text", "image"];
    return { draft: snapshot.draft, tab: isEditorTab(snapshot.tab) ? snapshot.tab : "content",
      scrollY: typeof snapshot.scrollY === "number" && Number.isFinite(snapshot.scrollY) ? Math.max(0, snapshot.scrollY) : 0,
      blockOrder: order, codeBlock: snapshot.codeBlock === true, customCode: typeof snapshot.customCode === "string" ? snapshot.customCode : "" };
  } catch { return null; }
}

export function writeEditorSession(storage: EditorStorage, context: EditorContext, snapshot: EditorSnapshot): void {
  if (snapshot.draft.id !== context.id || snapshot.draft.kind !== context.kind) throw new Error("Запись редактора не совпадает с предпросмотром");
  storage.setItem(editorSessionKey(context), JSON.stringify(snapshot));
}

export function clearEditorSession(storage: EditorStorage, context: EditorContext): void {
  try { storage.removeItem(editorSessionKey(context)); } catch { /* A saved record remains the source of truth if storage is unavailable. */ }
}

export function commitDemoEntity(storage: Pick<Storage, "setItem">, payload: { entities: DemoEntity[] } & Record<string, unknown>, entity: DemoEntity): DemoEntity[] {
  const previous = payload.entities.find(record => record.id === entity.id);
  const saveHistory = [{ savedAt: new Date().toISOString(), title: entity.title, status: entity.status }, ...(previous?.saveHistory || [])].slice(0,50);
  const saved = { ...entity, updated: "Только что", saveHistory };
  const entities = payload.entities.some(record => record.id === entity.id)
    ? payload.entities.map(record => record.id === entity.id ? saved : record) : [saved, ...payload.entities];
  // Do not return success or navigate until the actual demo session write succeeds.
  storage.setItem("bypcms-real-demo-v1", JSON.stringify({ ...payload, entities }));
  return entities;
}

/** Only the explicit Close link may traverse history; browser Back is never intercepted. */
export function cameFromEditor(referrer: string, closeHref: string, currentHref: string): boolean {
  try {
    const source = new URL(referrer);
    const target = new URL(closeHref, currentHref);
    // An in-preview anchor may have added a history entry: Close must still leave preview.
    if(new URL(currentHref).hash || source.origin!==target.origin || source.pathname!==target.pathname || source.searchParams.has("preview") || source.searchParams.has("previewDraft"))return false;
    if(!["edition","section"].every(key=>source.searchParams.get(key)===target.searchParams.get(key)))return false;
    if(target.searchParams.get("record"))return source.searchParams.get("record")===target.searchParams.get("record");
    return target.searchParams.get("editor")==="new" && source.searchParams.get("editor")==="new" && Boolean(target.searchParams.get("draft")) &&
      (!source.searchParams.get("draft") || source.searchParams.get("draft")===target.searchParams.get("draft"));
  } catch { return false; }
}
