"use client";
import {useEffect,useRef,useState} from 'react';
import {panelRequest} from '../components/panel-api';
import PanelSearch from '../components/PanelSearch';
import PanelIcon from '../components/PanelIcon';
import {Heading} from './ClientWorkspace';
import ClientUpload from './ClientUpload';
import ClientPending from '../components/PanelPending';
import {useClientGuard,useClientRouter} from './ClientRouter';
type MediaItem={id:number;filename:string;url:string;thumbnail:string;alt_text:string;mime_type:string};
type Listing={items:MediaItem[];total:number;pages:number;page:number};
export default function ClientMedia({csrf}:{csrf:string}){
 const {query}=useClientRouter();
 const [data,setData]=useState<Listing|null>(null),[page,setPage]=useState(Math.max(1,Number(query?.get('page')||1))),[search,setSearch]=useState(query?.get('q')||''),[committed,setCommitted]=useState(query?.get('q')||''),[composing,setComposing]=useState(false),[retry,setRetry]=useState(0),[listError,setListError]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[selected,setSelected]=useState<MediaItem|null>(null),[alt,setAlt]=useState(''),[notice,setNotice]=useState('');
 const searchControl=useRef<HTMLDivElement>(null),saving=useRef(false);
 useClientGuard(!!selected&&alt!==selected.alt_text,busy);
 useEffect(()=>{if(composing||search===committed)return;const timer=setTimeout(()=>{setCommitted(search);setPage(1)},300);return()=>clearTimeout(timer)},[search,composing,committed]);
 useEffect(()=>{const controller=new AbortController();setListError('');void panelRequest<Listing>('media.list',{signal:controller.signal},csrf,true,{q:committed,page}).then(next=>{if(!controller.signal.aborted){setData(next);const url=new URL(location.href);url.searchParams.set('q',committed);url.searchParams.set('page',String(next.page));history.replaceState(history.state,'',url)}}).catch(e=>{if(!controller.signal.aborted)setListError(e.message)});return()=>controller.abort()},[csrf,page,committed,retry]);
 function clear(){setSearch('');setCommitted('');setPage(1);searchControl.current?.querySelector('input')?.focus()}
 async function saveAlt(){if(!selected||saving.current)return;saving.current=true;setBusy(true);setError('');try{await panelRequest('media.alt',{method:'POST',body:JSON.stringify({id:selected.id,alt})},csrf);setRetry(n=>n+1);setSelected(null);setNotice('Описание файла сохранено.')}catch(e){setError((e as Error).message)}finally{saving.current=false;setBusy(false)}}
 return <><Heading title="Медиатека" description="Файлы сайта и изображения материалов"/>
  <ClientUpload csrf={csrf} onUploaded={file=>{setNotice(`Файл «${file.filename}» добавлен в медиатеку.`);setSearch('');setCommitted('');setPage(1);setRetry(n=>n+1)}}/>
  <div className="clientMediaToolbar"><div ref={searchControl} className="clientMediaSearch" onCompositionStart={()=>setComposing(true)} onCompositionEnd={()=>setComposing(false)}><PanelSearch value={search} onChange={setSearch} placeholder="Поиск файлов"/>{search&&<button type="button" className="clientClearSearch" aria-label="Очистить поиск файлов" onClick={clear}><PanelIcon name="close"/></button>}</div><span>{data?`Файлов: ${data.total}`:'Файлы сайта'}</span></div>
  {notice&&<p className="demoNotice" role="status">{notice}</p>}
  {listError&&<p className="clientError" role="alert">{listError} <button type="button" onClick={()=>setRetry(n=>n+1)}>Повторить</button></p>}
  {!data&&!listError?<ClientPending label="Загружаем файлы…"/>:data&&data.items.length?<div className="clientMediaGrid">{data.items.map(item=><button type="button" key={item.id} disabled={busy||!!selected} onClick={()=>{setSelected(item);setAlt(item.alt_text);setError('');setNotice('')}}>{item.mime_type.startsWith('image/')?<img loading="lazy" src={item.thumbnail} alt={item.alt_text}/>:<span className="clientMediaPdf"><PanelIcon name="file"/>PDF</span>}<span>{item.filename}</span><small>Изменить описание</small></button>)}</div>:!listError&&<section className="clientMediaEmpty"><PanelIcon name="image"/><h2>{committed?'По вашему запросу файлов нет':'В медиатеке пока нет файлов'}</h2><p>{committed?'Измените запрос или очистите поиск.':'Добавьте изображение или PDF — файл появится здесь и будет доступен для материалов сайта.'}</p>{committed&&<button type="button" onClick={clear}>Очистить поиск</button>}</section>}
  {selected&&<section className="clientSurface clientForm"><h2>{selected.filename}</h2><a href={selected.url} target="_blank" rel="noopener">Открыть файл</a><label htmlFor="client-media-alt">Описание изображения<input id="client-media-alt" maxLength={500} disabled={busy} value={alt} onChange={e=>setAlt(e.target.value)}/></label>{error&&<p className="clientError" role="alert">{error}</p>}<div className="clientActions"><button type="button" className="clientPrimary" disabled={busy} onClick={()=>void saveAlt()}>Сохранить описание</button><button type="button" disabled={busy} onClick={()=>{setSelected(null);setError('')}}>Отмена</button></div></section>}
  {data&&<footer className="listFooter"><span>Найдено файлов: {data.total}</span><nav className="panelPagination" aria-label="Страницы медиатеки"><button disabled={page<=1||busy} onClick={()=>setPage(n=>n-1)}>Назад</button><span>Страница {data.page} из {data.pages}</span><button disabled={page>=data.pages||busy} onClick={()=>setPage(n=>n+1)}>Далее</button></nav></footer>}
 </>;
}
