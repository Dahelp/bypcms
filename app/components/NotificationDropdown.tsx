"use client";
import PanelIcon from "./PanelIcon";
import {useEffect,useRef,useState} from "react";
export type NotificationItem={id:number;title:string;message:string;is_read:number;created_at:string};
export default function NotificationDropdown({items=[],onRead}:{items?:NotificationItem[];onRead?:(id:number)=>Promise<void>}){
  const [open,setOpen]=useState(false);
  const root=useRef<HTMLDivElement>(null);
  const unread=items.filter(item=>!Number(item.is_read)).length;
  useEffect(()=>{const close=(event:PointerEvent)=>{if(!root.current?.contains(event.target as Node))setOpen(false)};const key=(event:KeyboardEvent)=>{if(event.key==="Escape")setOpen(false)};document.addEventListener("pointerdown",close);document.addEventListener("keydown",key);return()=>{document.removeEventListener("pointerdown",close);document.removeEventListener("keydown",key)}},[]);
  return <div className="workspaceNotifications" ref={root}><button type="button" className="notificationTrigger" aria-label={`Оповещения: ${unread} непрочитанных`} aria-expanded={open} onClick={()=>setOpen(value=>!value)}><PanelIcon name="bell" size={20} />{unread>0&&<span className="notificationCount">{unread}</span>}</button>{open&&<section className="notificationPopover" aria-label="Список оповещений"><header><div><h2>Оповещения</h2><small>{unread?`Непрочитанных: ${unread}`:"Всё прочитано"}</small></div><button type="button" aria-label="Закрыть оповещения" onClick={()=>setOpen(false)}><PanelIcon name="close" /></button></header><div className="notificationItems">{items.length?items.slice(0,20).map(item=><article className={Number(item.is_read)?"read":"unread"} key={item.id}><b>{item.title}</b><p>{item.message}</p><time>{new Date(item.created_at).toLocaleString("ru-RU")}</time>{!Number(item.is_read)&&onRead&&<button type="button" onClick={()=>void onRead(item.id)}>Отметить прочитанным</button>}</article>):<p className="notificationEmpty">Новых оповещений нет.</p>}</div></section>}</div>;
}
