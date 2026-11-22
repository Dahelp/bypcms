"use client";
import {useEffect,useRef} from 'react';
import PanelSearch from '../components/PanelSearch';
import PanelIcon from '../components/PanelIcon';
import type {Manifest} from './types';
export default function ClientSearch({value,onChange,onClose,items,href}:{value:string;onChange:(value:string)=>void;onClose:()=>void;items:Manifest['navigation'];href:(section:string)=>string}){
 const dialog=useRef<HTMLDialogElement>(null);
 useEffect(()=>{const previous=document.activeElement as HTMLElement|null;dialog.current?.showModal();return()=>{dialog.current?.close();previous?.focus()}},[]);
 return <dialog ref={dialog} className="clientSearchDialog commandPalette" aria-label="Поиск раздела" onCancel={onClose} onClick={e=>{if(e.target===e.currentTarget)onClose()}}><header><PanelSearch value={value} onChange={onChange} placeholder="Найти раздел"/><button aria-label="Закрыть поиск" onClick={onClose}><PanelIcon name="close"/></button></header><div>{items.filter(item=>item.label.toLocaleLowerCase('ru').includes(value.toLocaleLowerCase('ru'))).map(item=><a key={item.id} href={href(item.id)}>{item.label}</a>)}{!items.some(item=>item.label.toLocaleLowerCase('ru').includes(value.toLocaleLowerCase('ru')))&&<p role="status">Разделы не найдены.</p>}</div></dialog>;
}
