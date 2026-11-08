"use client";
import {useState} from "react";
import {MediaPicker,MediaThumb,useDemoMedia} from "./DemoMedia";
import type {DemoContentBlock} from "./demo-data";

type Images=NonNullable<DemoContentBlock["images"]>;
export default function BlockGalleryEditor({images=[],onChange}:{images?:Images;onChange:(images:Images)=>void}){
 const media=useDemoMedia();const [pick,setPick]=useState<number|null>(null);
 const update=(index:number,key:"caption"|"alt",value:string)=>onChange(images.map((image,i)=>i===index?{...image,[key]:value}:image));
 const move=(index:number,delta:number)=>{const target=index+delta;if(target<0||target>=images.length)return;const next=[...images];[next[index],next[target]]=[next[target],next[index]];onChange(next);};
 return <section className="managedGalleryEditor" aria-label="Фотографии галереи">
  {!images.length&&<p>Добавьте фотографии из медиатеки. Порядок и подписи сохраняются вместе с материалом.</p>}
  {images.map((image,index)=><div className="managedGalleryItem" key={index}>
   <MediaThumb index={image.image} thumbnail/>
   <div><small>ФОТОГРАФИЯ {index+1} · {media.lookup(image.image)?.name||"Файл недоступен"}</small>
    <label>Alt-текст фотографии<input value={image.alt??media.lookup(image.image)?.alt??""} maxLength={1000} onChange={e=>update(index,"alt",e.target.value)}/></label>
    <label>Подпись фотографии<input value={image.caption} maxLength={1000} onChange={e=>update(index,"caption",e.target.value)}/></label>
    <div className="managedGalleryActions"><button type="button" onClick={()=>setPick(index)}>Заменить</button><button type="button" aria-label="Фотографию выше" disabled={index===0} onClick={()=>move(index,-1)}>↑</button><button type="button" aria-label="Фотографию ниже" disabled={index===images.length-1} onClick={()=>move(index,1)}>↓</button><button type="button" aria-label="Убрать фотографию из галереи" onClick={()=>onChange(images.filter((_,i)=>i!==index))}>Удалить</button></div>
   </div>
  </div>)}
  <div className="managedGalleryActions"><button type="button" disabled={images.length>=12} onClick={()=>setPick(-1)}>Добавить фотографию</button><span>{images.length} / 12</span></div>
  {pick!==null&&<MediaPicker selected={pick>=0?images[pick]?.image??-1:-1} onSelect={id=>{const value={image:id,caption:pick>=0?images[pick]?.caption||"":"",alt:media.lookup(id)?.alt||""};onChange(pick<0?[...images,value]:images.map((image,i)=>i===pick?value:image));setPick(null);}} onClose={()=>setPick(null)}/>}
 </section>;
}
