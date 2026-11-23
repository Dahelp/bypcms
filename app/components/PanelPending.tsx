"use client";
import {useEffect,useState} from 'react';
import './panel-pending.css';
/** Reserve space immediately; short requests never flash a loading message. */
export default function PanelPending({label='Загружаем данные…'}:{label?:string}){
 const [visible,setVisible]=useState(false);
 useEffect(()=>{const timer=setTimeout(()=>setVisible(true),350);return()=>clearTimeout(timer)},[]);
 return <div className="panelPending" aria-busy="true">{visible&&<p role="status"><span aria-hidden="true"/>{label}</p>}</div>;
}
