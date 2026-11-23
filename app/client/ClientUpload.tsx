"use client";
import {useRef,useState} from 'react';
import PanelIcon from '../components/PanelIcon';
import {panelRequest} from '../components/panel-api';
import {useClientGuard} from './ClientRouter';
type Uploaded={id:number;url:string;filename:string};
export default function ClientUpload({csrf,imagesOnly=false,disabled=false,onUploaded}:{csrf:string;imagesOnly?:boolean;disabled?:boolean;onUploaded:(file:Uploaded)=>void}){
 const input=useRef<HTMLInputElement>(null),running=useRef(false);
 const [file,setFile]=useState<File|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[done,setDone]=useState(false),[over,setOver]=useState(false);
 useClientGuard(false,busy);
 const formats=imagesOnly?'JPG, PNG, WebP, GIF':'JPG, PNG, WebP, GIF, PDF';
 async function upload(next:File){
  if(running.current||disabled)return;
  setFile(next);setDone(false);setError('');
  if(next.size>10*1024*1024){setError('Файл больше 10 МБ. Уменьшите размер и выберите его снова.');return}
  const types=['image/jpeg','image/png','image/webp','image/gif',...(!imagesOnly?['application/pdf']:[])];
  if(!types.includes(next.type)){setError(`Выберите файл в формате ${formats}.`);return}
  running.current=true;setBusy(true);
  try{const body=new FormData();body.set('file',next);const result=await panelRequest<{file:Uploaded}>('media.upload',{method:'POST',body},csrf);onUploaded(result.file);setDone(true)}catch(e){setError((e as Error).message)}finally{running.current=false;setBusy(false)}
 }
 return <section className={`clientUpload ${over?'clientUploadOver':''}`} aria-label={imagesOnly?'Загрузка изображения':'Загрузка файла'} aria-busy={busy} onDragOver={event=>{event.preventDefault();if(!busy&&!disabled)setOver(true)}} onDragLeave={()=>setOver(false)} onDrop={event=>{event.preventDefault();setOver(false);if(event.dataTransfer.files.length!==1){setError('Перенесите один файл за раз.');return}void upload(event.dataTransfer.files[0])}}>
  <div className="clientUploadCopy"><span className="clientUploadIcon"><PanelIcon name="image"/></span><div><h2>{imagesOnly?'Добавить изображение':'Добавить файл'}</h2><p>Перетащите сюда или выберите на устройстве</p><small>{formats} · до 10 МБ</small></div></div>
  <input ref={input} className="clientFileInput" aria-hidden="true" tabIndex={-1} aria-label={imagesOnly?'Выбрать изображение':'Выбрать файл'} type="file" accept={imagesOnly?'image/jpeg,image/png,image/webp,image/gif':'image/jpeg,image/png,image/webp,image/gif,application/pdf'} disabled={disabled||busy} onChange={event=>{const next=event.target.files?.[0];event.target.value='';if(next)void upload(next)}}/>
  <button type="button" className="clientPrimary" disabled={disabled||busy} onClick={()=>input.current?.click()}><PanelIcon name="plus"/>{imagesOnly?'Выбрать изображение':'Выбрать файл'}</button>
  {file&&<div className="clientUploadFile"><PanelIcon name={done?'check':'file'}/><span><b>{file.name}</b><small>{new Intl.NumberFormat('ru-RU',{maximumFractionDigits:1}).format(file.size/1024)} КБ</small></span><span role="status">{busy?'Загружаем…':done?'Загружен':error?'Не загружен':''}</span></div>}
  {busy&&<progress aria-label="Загрузка файла"/>}
  {error&&<div className="clientError" role="alert"><p>{error}</p>{file&&file.size<=10*1024*1024&&<button type="button" disabled={busy||disabled} onClick={()=>void upload(file)}>Повторить загрузку</button>}</div>}
 </section>;
}
