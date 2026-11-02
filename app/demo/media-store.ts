import { mediaItems } from "./demo-data";

export type DemoMedia = {
  id: number; name: string; alt: string; caption: string; type: "image" | "document";
  mime: string; size?: number; width?: number; height?: number; createdAt?: number;
  source: "seed" | "upload"; trashedAt?: number;
};
export type MediaSort = "newest" | "oldest" | "name" | "largest";
export type MediaFilters = { query: string; sort: MediaSort; type: "all" | "image" | "document"; period: "all" | "7" | "30"; origin: "all" | "upload"; page: number; trashed?: boolean };
export const MEDIA_PAGE_SIZE = 24;
export const MAX_MEDIA_BYTES = 15 * 1024 * 1024;
export const IMAGE_ACCEPT = ".jpg,.jpeg,.png,.webp,.gif,.avif";
export const seedMedia: DemoMedia[] = mediaItems.map(item => ({ ...item, caption: "", type: "image", mime: "image/jpeg", width: 512, height: 512, source: "seed" }));

export function queryMedia(items: DemoMedia[], filters: MediaFilters, now = Date.now()) {
  const terms = filters.query.toLocaleLowerCase("ru").trim().split(/\s+/).filter(Boolean);
  const filtered = items.filter(item => Boolean(item.trashedAt) === Boolean(filters.trashed) && (filters.type === "all" || item.type === filters.type) &&
    (filters.origin === "all" || item.source === "upload") &&
    (filters.period === "all" || Boolean(item.createdAt && item.createdAt >= now - Number(filters.period) * 86400000)) &&
    terms.every(term => `${item.name} ${item.alt} ${item.caption}`.toLocaleLowerCase("ru").includes(term)));
  filtered.sort((a,b) => filters.sort === "name" ? a.name.localeCompare(b.name,"ru",{numeric:true}) || b.id-a.id :
    filters.sort === "largest" ? (b.size || 0)-(a.size || 0) || b.id-a.id :
    filters.sort === "oldest" ? (a.createdAt || 0)-(b.createdAt || 0) || a.id-b.id :
    (b.createdAt || 0)-(a.createdAt || 0) || b.id-a.id);
  const pages = Math.max(1,Math.ceil(filtered.length/MEDIA_PAGE_SIZE));
  const page = Math.min(pages,Math.max(1,Math.trunc(filters.page) || 1));
  return { items: filtered.slice((page-1)*MEDIA_PAGE_SIZE,page*MEDIA_PAGE_SIZE), total: filtered.length, page, pages };
}

export function validateMediaFile(file: Pick<File,"name" | "size" | "type">, imagesOnly = false): string | null {
  if (!file.size) return "Файл пустой";
  if (file.size > MAX_MEDIA_BYTES) return "Размер файла больше 15 МБ";
  const image = /\.(jpe?g|png|webp|gif|avif)$/i.test(file.name) && /^image\/(jpeg|png|webp|gif|avif)$/.test(file.type);
  const document = /\.(pdf|docx?)$/i.test(file.name) && ["application/pdf","application/msword","application/vnd.openxmlformats-officedocument.wordprocessingml.document"].includes(file.type);
  return image || (!imagesOnly && document) ? null : imagesOnly ? "Выберите JPG, PNG, WebP, GIF или AVIF" : "Поддерживаются JPG, PNG, WebP, GIF, AVIF, PDF, DOC и DOCX";
}

export function mediaDetails(item: DemoMedia): string {
  const parts = [item.width && item.height ? `${item.width} × ${item.height}` : item.type === "document" ? "Документ" : "Изображение"];
  if (item.size !== undefined) parts.push(item.size >= 1048576 ? `${(item.size/1048576).toFixed(1)} МБ` : `${Math.max(1,Math.round(item.size/1024))} КБ`);
  parts.push(item.source === "seed" ? "Демо-файл" : "Загружено вами");
  return parts.join(" · ");
}

let database: Promise<IDBDatabase> | undefined;
export function openMediaDatabase(): Promise<IDBDatabase> {
  if (database) return database;
  database = new Promise((resolve,reject) => {
    const request = indexedDB.open("bypcms-demo-media-v1",1);
    let failed = false;
    request.onupgradeneeded = () => {
      const metadata = request.result.createObjectStore("metadata",{keyPath:"id",autoIncrement:true});
      metadata.createIndex("createdAt","createdAt");
      seedMedia.forEach(item=>metadata.put(item));
      request.result.createObjectStore("files",{keyPath:"id"});
    };
    request.onblocked = () => { failed=true; database=undefined; reject(new Error("Закройте другие вкладки демо и повторите открытие медиатеки")); };
    request.onerror = () => { failed=true; database=undefined; reject(request.error); };
    request.onsuccess = () => {
      if (failed) { request.result.close(); return; }
      request.result.onversionchange = () => { request.result.close(); database=undefined; };
      resolve(request.result);
    };
  });
  database.catch(()=>{database=undefined;});
  return database;
}

export async function readMedia(): Promise<DemoMedia[]> {
  const db = await openMediaDatabase();
  return new Promise((resolve,reject)=>{
    const request=db.transaction("metadata","readonly").objectStore("metadata").getAll();
    request.onsuccess=()=>resolve(request.result); request.onerror=()=>reject(request.error);
  });
}

export async function readMediaBlob(id: number, thumbnail = true): Promise<Blob> {
  const db = await openMediaDatabase();
  return new Promise((resolve,reject)=>{
    const request=db.transaction("files","readonly").objectStore("files").get(id);
    request.onsuccess=()=>{ const blob=thumbnail ? request.result?.thumbnail || request.result?.original : request.result?.original;
      if(blob instanceof Blob)resolve(blob);else reject(new Error("Файл не найден в медиатеке этого браузера")); };
    request.onerror=()=>reject(request.error);
  });
}

async function imageThumbnail(file: File): Promise<{ thumbnail: Blob; width: number; height: number }> {
  const url=URL.createObjectURL(file);
  try {
    const image=new Image(); image.src=url;
    try {await image.decode();}catch{throw new Error("Не удалось прочитать изображение. Проверьте формат и целостность файла.");}
    if(!image.naturalWidth || !image.naturalHeight || image.naturalWidth*image.naturalHeight > 60_000_000) throw new Error("Изображение слишком большое или повреждено (до 60 мегапикселей)");
    const scale=Math.min(1,480/Math.max(image.naturalWidth,image.naturalHeight));
    const canvas=document.createElement("canvas");canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));
    const ctx=canvas.getContext("2d");if(!ctx)throw new Error("Браузер не смог подготовить миниатюру");
    ctx.drawImage(image,0,0,canvas.width,canvas.height);
    const thumbnail=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error("Не удалось создать миниатюру")),"image/webp",0.82));
    return {thumbnail,width:image.naturalWidth,height:image.naturalHeight};
  } finally { URL.revokeObjectURL(url); }
}

export async function storeMediaFile(file: File): Promise<DemoMedia> {
  const invalid=validateMediaFile(file);if(invalid)throw new Error(invalid);
  const image=file.type.startsWith("image/");
  const thumbnail=image ? await imageThumbnail(file) : undefined;
  const record: Omit<DemoMedia,"id">={name:file.name,alt:file.name.replace(/\.[^.]+$/,"").replace(/[-_]/g," "),caption:"",type:image?"image":"document",mime:file.type,size:file.size,width:thumbnail?.width,height:thumbnail?.height,createdAt:Date.now(),source:"upload"};
  const db=await openMediaDatabase();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(["metadata","files"],"readwrite");
    let saved: DemoMedia;
    const request=tx.objectStore("metadata").add(record);
    request.onsuccess=()=>{ const id=Number(request.result); saved={...record,id}; tx.objectStore("files").put({id,original:file,thumbnail:thumbnail?.thumbnail}); };
    tx.oncomplete=()=>resolve(saved);tx.onabort=()=>reject(tx.error || new Error("Файл не сохранён"));tx.onerror=()=>{};
  });
}

export async function updateMedia(record: DemoMedia): Promise<void> {
  const db=await openMediaDatabase();
  return new Promise((resolve,reject)=>{const tx=db.transaction("metadata","readwrite");tx.objectStore("metadata").put(record);tx.oncomplete=()=>resolve();tx.onabort=()=>reject(tx.error);tx.onerror=()=>{};});
}

export function mediaError(error: unknown): string {
  if (error instanceof DOMException && error.name === "QuotaExceededError") return "Недостаточно места в хранилище браузера. Файл не добавлен; ранее загруженные файлы сохранены.";
  return error instanceof Error ? error.message : "Не удалось сохранить файл. Повторите загрузку.";
}
