"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import PanelSearch from "../components/PanelSearch";
import { IMAGE_ACCEPT, mediaDetails, mediaError, queryMedia, readMedia, readMediaBlob, seedMedia, storeMediaFile, updateMedia, validateMediaFile, type DemoMedia, type MediaFilters } from "./media-store";
import "./media-browser.css";

type UploadProgress = { done: number; total: number; name: string };
type UploadResult = { added: DemoMedia[]; errors: string[]; cancelled: boolean };
type MediaContextValue = {
  items: DemoMedia[]; loading: boolean; error: string; progress: UploadProgress | null;
  lookup: (id: number) => DemoMedia | undefined; reload: () => Promise<void>;
  upload: (files: File[], imagesOnly: boolean) => Promise<UploadResult>;
  save: (record: DemoMedia) => Promise<void>; cancelUpload: () => void;
};
const MediaContext=createContext<MediaContextValue | null>(null);
export function useDemoMedia() { const value=useContext(MediaContext);if(!value)throw new Error("DemoMediaProvider is required");return value; }

export function DemoMediaProvider({ children }: { children: ReactNode }) {
  const [items,setItems]=useState(seedMedia);
  const [loading,setLoading]=useState(true);const [error,setError]=useState("");
  const [progress,setProgress]=useState<UploadProgress | null>(null);
  const busy=useRef(false);const cancelled=useRef(false);
  const revision=useRef(0);const reloadSequence=useRef(0);
  async function reload() {
    if(busy.current)return;
    const sequence=++reloadSequence.current;const before=revision.current;
    setLoading(true);setError("");
    try {const records=await readMedia();if(sequence===reloadSequence.current && before===revision.current && !busy.current)setItems(records);}
    catch(error){if(sequence===reloadSequence.current && before===revision.current)setError(`Медиатека недоступна: ${mediaError(error)}`);}
    finally{if(sequence===reloadSequence.current)setLoading(false);}
  }
  useEffect(()=>{
    void reload();
    const focus=()=>{if(document.visibilityState==="visible")void reload();};
    const pageshow=(event:PageTransitionEvent)=>{if(event.persisted)void reload();};
    window.addEventListener("focus",focus);window.addEventListener("pageshow",pageshow);
    document.addEventListener("visibilitychange",focus);
    return()=>{window.removeEventListener("focus",focus);window.removeEventListener("pageshow",pageshow);document.removeEventListener("visibilitychange",focus);};
  },[]);
  const byId=useMemo(()=>new Map(items.map(item=>[item.id,item])),[items]);
  async function upload(files: File[], imagesOnly: boolean): Promise<UploadResult> {
    if(busy.current)return {added:[],errors:["Дождитесь текущей загрузки"],cancelled:false};
    busy.current=true;cancelled.current=false;
    const added: DemoMedia[]=[];const errors: string[]=[];
    try {
      for(let index=0;index<files.length;index++){
        if(cancelled.current)break;
        const file=files[index];setProgress({done:index,total:files.length,name:file.name});
        try {
          const invalid=validateMediaFile(file,imagesOnly);if(invalid)throw new Error(invalid);
          const record=await storeMediaFile(file);added.push(record);revision.current++;
          setItems(current=>[record,...current]);
        }catch(error){errors.push(`${file.name}: ${mediaError(error)}`);}
      }
      return {added,errors,cancelled:cancelled.current};
    }finally{busy.current=false;setProgress(null);}
  }
  async function save(record: DemoMedia) {
    await updateMedia(record);revision.current++;setItems(current=>current.map(item=>item.id===record.id?record:item));
  }
  return <MediaContext.Provider value={{items,loading,error,progress,lookup:id=>byId.get(id),reload,upload,save,cancelUpload:()=>{cancelled.current=true;}}}>{children}</MediaContext.Provider>;
}

export function MediaThumb({ index, large = false, thumbnail = false }: { index: number; large?: boolean; thumbnail?: boolean }) {
  const media=useDemoMedia();const item=media.lookup(index);
  const [preview,setPreview]=useState<{id:number;url?:string;error?:string} | null>(null);
  useEffect(()=>{
    if(item?.source!=="upload" || item.type!=="image")return;
    let active=true;let url="";
    readMediaBlob(index,thumbnail).then(blob=>{if(!active)return;url=URL.createObjectURL(blob);setPreview({id:index,url});}).catch(error=>{if(active)setPreview({id:index,error:mediaError(error)});});
    return()=>{active=false;if(url)URL.revokeObjectURL(url);};
  },[index,item?.source,item?.type,thumbnail]);
  const className=`mediaThumb ${large?"large":""}`;
  if(!item || item.type!=="image")return <span className={`${className} emptyMediaThumb`}><span>{index>=0 && media.loading ? "Загрузка изображения…" : "Изображение не выбрано"}</span></span>;
  if(item.source==="upload")return <span className={`${className} storedMediaThumb`}>{preview?.id===index && preview.url ? <img src={preview.url} alt={item.alt || item.name} loading="lazy" decoding="async"/> : <span role={preview?.error?"alert":undefined}>{preview?.id===index && preview.error ? "Не удалось открыть файл" : "Загрузка изображения…"}</span>}</span>;
  return <span className={className} role="img" aria-label={item.alt || item.name}><svg viewBox={`${index%3*512} ${Math.floor(index/3)*512} 512 512`} preserveAspectRatio="xMidYMid slice" width="100%" height="100%" aria-hidden="true"><image href="https://bypcms.ru/demo/cms-media-board.png" width="1536" height="1024"/></svg></span>;
}

function AssetPreview({ item, thumbnail = false }: { item: DemoMedia; thumbnail?: boolean }) {
  return item.type==="image" ? <MediaThumb index={item.id} large thumbnail={thumbnail}/> : <span className="mediaDocument">{item.name.split(".").pop()?.toUpperCase()}</span>;
}

const initialFilters: MediaFilters={query:"",sort:"newest",type:"all",period:"all",origin:"all",page:1};
function MediaBrowser({ imagesOnly, initialSelected, onSelect, onClose }: { imagesOnly: boolean; initialSelected?: number; onSelect?: (id:number)=>void; onClose?: ()=>void }) {
  const media=useDemoMedia();const fileInput=useRef<HTMLInputElement>(null);
  const [filters,setFilters]=useState<MediaFilters>({...initialFilters,type:imagesOnly?"image":"all"});
  const [pending,setPending]=useState(initialSelected ?? -1);
  const [result,setResult]=useState<UploadResult | null>(null);const [notice,setNotice]=useState("");
  const [dragging,setDragging]=useState(false);const [saving,setSaving]=useState(false);
  const [alt,setAlt]=useState("");const [caption,setCaption]=useState("");
  const [filtersOpen,setFiltersOpen]=useState(false);
  const catalog=useRef<HTMLDivElement>(null);const inspector=useRef<HTMLElement>(null);
  const selected=media.lookup(pending);
  const visible=queryMedia(media.items,filters);
  const total=media.items.filter(item=>Boolean(item.trashedAt)===Boolean(filters.trashed) && (!imagesOnly || item.type==="image")).length;
  useEffect(()=>{setAlt(selected?.alt || "");setCaption(selected?.caption || "");},[selected?.id,selected?.alt,selected?.caption]);
  const dirty=Boolean(selected && (alt!==selected.alt || caption!==selected.caption));
  function filter<K extends keyof MediaFilters>(key:K,value:MediaFilters[K]) {setFilters(current=>({...current,[key]:value,page:key==="page"?Number(value):1}));}
  function page(value:number){filter("page",value);requestAnimationFrame(()=>catalog.current?.scrollIntoView({block:"start"}));}
  function choose(id:number){setPending(id);setNotice("");if(window.matchMedia("(max-width:750px)").matches)requestAnimationFrame(()=>inspector.current?.scrollIntoView({block:"start"}));}
  async function upload(files: File[]) {
    if(!files.length || media.progress)return;
    setResult(null);setNotice("");
    const result=await media.upload(files,imagesOnly);setResult(result);
    if(result.added.length){setFilters({...initialFilters,type:imagesOnly?"image":"all"});setPending(result.added[result.added.length-1].id);}
  }
  async function saveMetadata() {
    if(!selected)return;
    setSaving(true);setNotice("");
    try {await media.save({...selected,alt,caption});setNotice("Описание файла сохранено");}catch(error){setNotice(mediaError(error));}finally{setSaving(false);}
  }
  async function confirmSelection() {
    if(!selected || selected.trashedAt || selected.type!=="image")return;
    setSaving(true);setNotice("");
    try {if(dirty)await media.save({...selected,alt,caption});onSelect?.(selected.id);}catch(error){setNotice(mediaError(error));}finally{setSaving(false);}
  }
  async function hideSelected() {
    if(!selected)return;
    setSaving(true);setNotice("");
    try {await media.save({...selected,trashedAt:selected.trashedAt?undefined:Date.now()});setPending(-1);setNotice(selected.trashedAt?"Файл возвращён в медиатеку":"Файл скрыт из выбора. Его можно вернуть через фильтр «Скрытые». Изображения в сохранённых материалах доступны.");}catch(error){setNotice(mediaError(error));}finally{setSaving(false);}
  }
  return <div className={`assetBrowser ${imagesOnly?"assetPickerBrowser":"assetLibraryBrowser"}`} onDragOver={event=>{event.preventDefault();if(event.dataTransfer.types.includes("Files"))setDragging(true);}} onDragLeave={event=>{if(!event.currentTarget.contains(event.relatedTarget as Node))setDragging(false);}} onDrop={event=>{event.preventDefault();setDragging(false);void upload(Array.from(event.dataTransfer.files));}}>
    <div className="assetUploadBar"><div><b>{imagesOnly?"Загрузите фото прямо здесь":"Добавьте файлы в медиатеку"}</b><span>Перетащите файлы или выберите на компьютере · до 15 МБ на файл</span><small>{imagesOnly?"JPG, PNG, WebP, GIF, AVIF":"JPG, PNG, WebP, GIF, AVIF, PDF, DOC, DOCX"}</small></div><input ref={fileInput} className="mediaFileInput" type="file" multiple accept={imagesOnly?IMAGE_ACCEPT:`${IMAGE_ACCEPT},.pdf,.doc,.docx`} onChange={event=>{void upload(Array.from(event.target.files || []));event.target.value="";}}/><button type="button" className="assetUploadButton" disabled={media.loading || Boolean(media.progress)} onClick={()=>fileInput.current?.click()}>Загрузить {imagesOnly?"фото":"файлы"}</button></div>
    {dragging && <div className="assetDropHint">Отпустите файлы для загрузки</div>}
    {media.error && <div className="assetError" role="alert">{media.error}<button type="button" onClick={()=>void media.reload()}>Повторить</button></div>}
    {media.progress && <div className="assetProgress" role="status"><progress max={media.progress.total} value={media.progress.done}/><span>Загрузка {media.progress.done+1} из {media.progress.total}: {media.progress.name}</span><button type="button" onClick={media.cancelUpload}>Остановить загрузку</button></div>}
    {result && <div className="assetUploadResult" role="status"><b>Загружено: {result.added.length}{result.cancelled?" · Загрузка остановлена":""}</b>{result.errors.length>0 && <details open><summary>Не загружено: {result.errors.length}</summary><ul>{result.errors.map((error,index)=><li key={index}>{error}</li>)}</ul></details>}</div>}
    <button type="button" className="assetFilterToggle" aria-expanded={filtersOpen} onClick={()=>setFiltersOpen(value=>!value)}>Фильтры и сортировка</button>
    <div className="assetFilters" data-expanded={filtersOpen}><PanelSearch value={filters.query} onChange={value=>filter("query",value)} placeholder="Поиск по имени, Alt или подписи"/>
      <label>Сортировка<select value={filters.sort} onChange={event=>filter("sort",event.target.value as MediaFilters["sort"])}><option value="newest">Сначала новые</option><option value="oldest">Сначала старые</option><option value="name">По имени</option><option value="largest">Сначала большие</option></select></label>
      <label>Дата загрузки<select value={filters.period} onChange={event=>filter("period",event.target.value as MediaFilters["period"])}><option value="all">За всё время</option><option value="7">За 7 дней</option><option value="30">За 30 дней</option></select></label>
      <label>Источник<select value={filters.origin} onChange={event=>filter("origin",event.target.value as MediaFilters["origin"])}><option value="all">Все файлы</option><option value="upload">Мои загрузки</option></select></label>
      {!imagesOnly && <label>Тип файла<select value={filters.type} onChange={event=>filter("type",event.target.value as MediaFilters["type"])}><option value="all">Все типы</option><option value="image">Изображения</option><option value="document">Документы</option></select></label>}
      {!imagesOnly && <label>Показать<select value={filters.trashed?"hidden":"active"} onChange={event=>filter("trashed",event.target.value==="hidden")}><option value="active">Активные файлы</option><option value="hidden">Скрытые</option></select></label>}
      <button type="button" className="assetReset" onClick={()=>setFilters({...initialFilters,type:imagesOnly?"image":"all"})}>Сбросить фильтры</button>
    </div>
    <div className="assetResultsHeader"><span aria-live="polite">Найдено: {visible.total} из {total}{media.loading?" · Загрузка…":""}</span><span>По 24 файла на странице <button type="button" className="assetRefresh" disabled={media.loading || Boolean(media.progress)} onClick={()=>void media.reload()}>Обновить список</button></span></div>
    <div className="assetBody"><div className="assetCatalog" ref={catalog}><div className="assetGrid" aria-label="Файлы медиатеки">{visible.items.map(item=><button type="button" aria-label={`Выбрать файл: ${item.name}`} aria-pressed={pending===item.id} className={`assetTile ${pending===item.id?"selected":""}`} key={item.id} onClick={()=>choose(item.id)}><AssetPreview item={item} thumbnail/><span className="assetName" title={item.name}>{item.name}</span><small>{mediaDetails(item)}</small><time dateTime={item.createdAt?new Date(item.createdAt).toISOString():undefined}>{item.createdAt?new Date(item.createdAt).toLocaleString("ru-RU"):"Демо-файл · дата загрузки не задана"}</time>{pending===item.id && <i aria-hidden="true">✓</i>}</button>)}</div>
      {!visible.items.length && !media.loading && <div className="assetEmpty"><b>Файлы не найдены</b><span>Измените запрос или загрузите новое изображение.</span></div>}
      <nav className="assetPagination" aria-label="Страницы медиатеки"><button type="button" disabled={visible.page===1} onClick={()=>page(visible.page-1)}>Назад</button><span aria-live="polite">Страница {visible.page} из {visible.pages}</span><button type="button" disabled={visible.page>=visible.pages} onClick={()=>page(visible.page+1)}>Далее</button><label>На страницу<input type="number" min={1} max={visible.pages} value={visible.page} onChange={event=>page(Number(event.target.value))}/></label></nav>
    </div><aside ref={inspector} className="assetInspector" aria-label="Выбранный файл">{selected && (!imagesOnly || !selected.trashedAt) ? <><AssetPreview item={selected}/><h3>{selected.name}</h3><p>{mediaDetails(selected)}</p><p>{selected.createdAt?`Загружено ${new Date(selected.createdAt).toLocaleString("ru-RU")}`:"Встроенный демо-файл"}</p><label>Alt-текст<input value={alt} onChange={event=>setAlt(event.target.value)}/></label><label>Подпись<textarea rows={3} value={caption} onChange={event=>setCaption(event.target.value)}/></label><button type="button" disabled={saving || !dirty} onClick={()=>void saveMetadata()}>Сохранить описание</button>{!imagesOnly && <button type="button" disabled={saving} onClick={()=>void hideSelected()}>{selected.trashedAt?"Вернуть в медиатеку":"Скрыть из медиатеки"}</button>}</> : <p>Выберите файл, чтобы увидеть фото, размеры, дату загрузки и описание.</p>}</aside></div>
    {notice && <p role="status" className="assetNotice">{notice}</p>}
    <footer className="assetFooter"><small>Демо-медиатека хранится в этом браузере. Загрузка файла не сохраняет материал.</small>{onSelect && <div><button type="button" onClick={onClose}>Отмена</button><button type="button" className="assetConfirm" disabled={!selected || selected.trashedAt!==undefined || selected.type!=="image" || saving || Boolean(media.progress)} onClick={()=>void confirmSelection()}>Использовать изображение</button></div>}</footer>
  </div>;
}

export function DemoMediaLibrary() {return <><header className="realPageHeading"><div><small>СИСТЕМА</small><h1>Медиатека</h1><p>Загрузка, поиск и выбор файлов</p></div></header><MediaBrowser imagesOnly={false}/></>;}

export function MediaPicker({ selected, onSelect, onClose }: {selected:number;onSelect:(id:number)=>void;onClose:()=>void}) {
  const dialog=useRef<HTMLElement>(null);const closeRef=useRef(onClose);closeRef.current=onClose;
  const media=useDemoMedia();const cancelRef=useRef(media.cancelUpload);cancelRef.current=media.cancelUpload;
  function close(){cancelRef.current();closeRef.current();}
  useEffect(()=>{
    const previous=document.activeElement as HTMLElement | null;const overflow=document.body.style.overflow;document.body.style.overflow="hidden";
    dialog.current?.querySelector<HTMLInputElement>('input[type="search"]')?.focus();
    function keydown(event:KeyboardEvent){
      if(event.key==="Escape"){event.preventDefault();cancelRef.current();closeRef.current();}
      if(event.key!=="Tab")return;
      const elements=Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href]') || []).filter(element=>element.offsetParent!==null);
      const first=elements[0],last=elements[elements.length-1];
      if(event.shiftKey && document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey && document.activeElement===last){event.preventDefault();first?.focus();}
    }
    document.addEventListener("keydown",keydown);return()=>{document.body.style.overflow=overflow;document.removeEventListener("keydown",keydown);previous?.focus();};
  },[]);
  return <div className="assetOverlay" onMouseDown={event=>{if(event.target===event.currentTarget)close();}}><section ref={dialog} className="assetDialog" role="dialog" aria-modal="true" aria-labelledby="asset-dialog-title"><header><div><small>МЕДИАТЕКА</small><h2 id="asset-dialog-title">Выберите изображение</h2></div><button type="button" aria-label="Закрыть выбор изображения" onClick={close}>×</button></header><MediaBrowser imagesOnly initialSelected={selected} onSelect={onSelect} onClose={close}/></section></div>;
}
