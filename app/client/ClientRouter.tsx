"use client";
import {createContext,useCallback,useContext,useEffect,useRef,useState,type ReactNode} from 'react';

type Guard={dirty:boolean;busy:boolean};
type Router={query:URLSearchParams|null;navigate:(href:string,force?:boolean)=>void;guards:Map<symbol,Guard>};
const Context=createContext<Router|null>(null);
export function useClientRouter(){const value=useContext(Context);if(!value)throw new Error('Client router is unavailable');return value;}
export function useClientGuard(dirty:boolean,busy=false){
 const {guards}=useClientRouter();const key=useRef(Symbol());
 useEffect(()=>{const id=key.current;guards.set(id,{dirty,busy});return()=>{guards.delete(id)}},[guards,dirty,busy]);
}
/** Customer routes share one authenticated document; public/recovery links remain normal links. */
export default function ClientRouter({children}:{children:ReactNode}){
 const [query,setQuery]=useState<URLSearchParams|null>(null),[pending,setPending]=useState<{run:()=>void;busy:boolean}|null>(null);
 const guards=useRef(new Map<symbol,Guard>()).current,dialog=useRef<HTMLDialogElement>(null),stay=useRef<HTMLButtonElement>(null);
 const index=useRef(0),restoring=useRef(false),approved=useRef(false);
 const commit=useCallback(()=>{const next=new URLSearchParams(location.search);if(next.get('section')==='staff')next.set('section','users');if(/^\d+$/.test(next.get('editor')||''))next.set('record',next.get('editor')!);setQuery(next);requestAnimationFrame(()=>{window.scrollTo(0,0);document.querySelector<HTMLElement>('[data-client-heading]')?.focus({preventScroll:true})})},[]);
 const attempt=useCallback((run:()=>void,force=false)=>{const values=[...guards.values()];if(!force&&values.some(g=>g.dirty||g.busy)){setPending({run,busy:values.some(g=>g.busy)});return}run()},[guards]);
 const navigate=useCallback((href:string,force=false)=>{const target=new URL(href,location.href);if(target.origin!==location.origin||target.pathname!=='/manage/')return;if(target.href===location.href)return;attempt(()=>{index.current++;history.pushState({...history.state,clientIndex:index.current},'',target);commit()},force)},[attempt,commit]);
 useEffect(()=>{
  index.current=Number(history.state?.clientIndex||0);history.replaceState({...history.state,clientIndex:index.current},'');commit();
  const click=(event:MouseEvent)=>{if(event.defaultPrevented||event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;const link=(event.target as Element).closest<HTMLAnchorElement>('a[href]');if(!link||link.target||link.hasAttribute('download'))return;const url=new URL(link.href,location.href);if(url.origin===location.origin&&url.pathname==='/manage/'&&!url.hash){event.preventDefault();navigate(url.href)}};
  const submit=(event:SubmitEvent)=>{const form=event.target as HTMLFormElement;if(event.defaultPrevented||form.method.toLowerCase()!=='get'||form.target)return;const url=new URL(form.action,location.href);if(url.origin!==location.origin||url.pathname!=='/manage/')return;event.preventDefault();url.search=new URLSearchParams(new FormData(form) as unknown as Record<string,string>).toString();navigate(url.href)};
  const pop=()=>{if(restoring.current){restoring.current=false;return}const next=Number(history.state?.clientIndex??index.current);if(approved.current){approved.current=false;index.current=next;commit();return}if([...guards.values()].some(g=>g.dirty||g.busy)&&next!==index.current){const delta=next-index.current;restoring.current=true;history.go(-delta);setPending({busy:[...guards.values()].some(g=>g.busy),run:()=>{approved.current=true;history.go(delta)}})}else{index.current=next;commit()}};
  const unload=(event:BeforeUnloadEvent)=>{if([...guards.values()].some(g=>g.dirty||g.busy)){event.preventDefault();event.returnValue=''}};
  document.addEventListener('click',click);document.addEventListener('submit',submit);window.addEventListener('popstate',pop);window.addEventListener('beforeunload',unload);
  return()=>{document.removeEventListener('click',click);document.removeEventListener('submit',submit);window.removeEventListener('popstate',pop);window.removeEventListener('beforeunload',unload)};
 },[commit,guards,navigate]);
 useEffect(()=>{if(!pending)return;const previous=document.activeElement as HTMLElement|null;dialog.current?.showModal();stay.current?.focus();return()=>{dialog.current?.close();previous?.isConnected&&previous.focus()}},[pending]);
 return <Context.Provider value={{query,navigate,guards}}>{children}{pending&&<dialog ref={dialog} className="clientLeaveDialog" aria-labelledby="client-leave-title" onCancel={event=>{event.preventDefault();setPending(null)}}><h2 id="client-leave-title">{pending.busy?'Дождитесь завершения операции':'Есть несохранённые изменения'}</h2><p>{pending.busy?'После завершения можно будет перейти в другой раздел.':'Если перейти сейчас, изменения в открытой форме будут потеряны.'}</p><div className="clientActions"><button ref={stay} type="button" onClick={()=>setPending(null)}>{pending.busy?'Понятно':'Остаться'}</button>{!pending.busy&&<button type="button" onClick={()=>{const run=pending.run;setPending(null);run()}}>Перейти без сохранения</button>}</div></dialog>}</Context.Provider>;
}
