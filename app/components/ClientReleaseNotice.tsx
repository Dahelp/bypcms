"use client";
import {useEffect,useState} from "react";
type Notice={discovery:{error:string;unread:boolean;latest:{version:string}|null}};
export default function ClientReleaseNotice({csrf,href='/admin/?section=updates'}:{csrf:string;href?:string}){
 const [notice,setNotice]=useState<Notice|null>(null),[error,setError]=useState(false);
 useEffect(()=>{let live=true;void (async()=>{for(let i=0;i<25&&live;i++){const r=await fetch('/api/index.php?action=client.updates.discover',{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json','X-CSRF-Token':csrf},body:'{}',signal:AbortSignal.timeout(25000)});if(!r.ok)throw Error('Discovery unavailable');const data=await r.json();if(!data.checking){if(live)setNotice(data);return;}await new Promise(resolve=>setTimeout(resolve,1000));}if(live)setError(true);})().catch(()=>{if(live)setError(true);});return()=>{live=false;};},[csrf]);
 const d=notice?.discovery;if(!error&&!d?.error&&!(d?.latest&&d.unread))return null;
 return <aside className="licenseConfirm" aria-live="polite"><p>{error||d?.error?'Проверка выпусков временно недоступна. Рабочая версия не изменена.':`Доступен выпуск BYPCMS ${d?.latest?.version}. Установка — только после вашего подтверждения.`}</p><a href={href}>Обновления и подробности →</a></aside>;
}
