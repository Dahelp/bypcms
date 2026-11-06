"use client";
import {FormEvent,useCallback,useEffect,useRef,useState} from "react";
import {panelRequest} from "./panel-api";
import "./license.css";

export const licenseStateLabels:Record<string,string>={platform:"Платформа BYPCMS",unactivated:"Не активирована",active:"Активна",grace:"Временная работа без связи",offline:"Нужна проверка связи",expired:"Срок обновлений истёк",suspended:"Приостановлена",invalid:"Подтверждение повреждено",activation_revoked:"Привязка отозвана",license_suspended:"Приостановлена",domain_mismatch:"Изменился домен",modules_mismatch:"Состав сборки не совпадает"};
type Status={state:string;edition:string;domain:string;installation_id?:string;can_update:boolean;license_term?:string;valid_until?:string|null;modules?:string[];checked_at?:number|null;error?:string};
export function licenseOperationId(){return crypto.randomUUID().replaceAll("-","");}
export default function LicenseSettings({csrf,owner}:{csrf:string;owner:boolean}){
  const[license,setLicense]=useState<Status|null>(null),[loading,setLoading]=useState(true),[key,setKey]=useState(""),[busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState(""),[confirm,setConfirm]=useState(false);
  const running=useRef(false),operation=useRef("");
  const load=useCallback(async()=>{try{const result=await panelRequest<{license:Status}>("license.status");setLicense(result.license);}finally{setLoading(false);}},[]);
  useEffect(()=>{void load().catch(e=>setError(e.message));},[load]);
  async function run(action:string){
    if(running.current)return;running.current=true;setBusy(true);setError("");setNotice("");
    try{
      if(action==="activate"&&!operation.current)operation.current=licenseOperationId();
      const result=await panelRequest<{license:Status}>(`license.${action}`,{method:"POST",body:JSON.stringify({key,operation_id:operation.current})},csrf);
      setLicense(result.license);setConfirm(false);operation.current="";if(action==="activate")setKey("");
      setNotice(action==="activate"?"Лицензия активирована":action==="release"?"Привязка освобождена":"Подтверждение обновлено");
    }catch(e){setError(e instanceof Error?e.message:"Не удалось выполнить действие");await load().catch(()=>{});}
    finally{setBusy(false);running.current=false;}
  }
  return <section className="licenseWorkspace" aria-busy={busy}>
    {error&&<p className="licenseError" role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
    {!license?loading?<p role="status">Загрузка лицензии…</p>:<button disabled={busy} onClick={()=>{setLoading(true);void load().catch(e=>setError(e.message));}}>Повторить загрузку</button>:<>
      <header><div><small>ЛИЦЕНЗИЯ УСТАНОВКИ</small><h2>{licenseStateLabels[license.state]||license.state}</h2></div><span>BYPCMS {license.edition}</span></header>
      {license.state==="platform"?<p>Управление выданными лицензиями находится в <a href="/owner/?section=licenses">Owner Center</a>.</p>:<>
        <dl><div><dt>Домен</dt><dd>{license.domain}</dd></div><div><dt>Установка</dt><dd><code>{license.installation_id}</code></dd></div><div><dt>Обновления</dt><dd>{license.can_update?"Доступны":"Требуется действующая лицензия и проверка"}</dd></div><div><dt>Срок</dt><dd>{license.license_term==="lifetime"?"Пожизненно":license.valid_until?new Date(license.valid_until).toLocaleDateString("ru-RU"):"Не подтверждён"}</dd></div><div><dt>Последняя проверка</dt><dd>{license.checked_at?new Date(license.checked_at*1000).toLocaleString("ru-RU"):"Ещё не выполнялась"}</dd></div></dl>
        {license.error&&<p className="licenseError" role="status">{license.error}</p>}
        <p>Работа сайта и сохранённые данные доступны при истечении срока или потере связи. Подтверждение действительно сутки; при временном сбое связи обновления доступны ещё до 7 суток с последней успешной проверки, в пределах срока лицензии.</p>
        {owner?<>
          <form onSubmit={(e:FormEvent)=>{e.preventDefault();void run("activate");}}><label htmlFor="activation-key">Ключ лицензии</label><input id="activation-key" type="password" autoComplete="off" spellCheck={false} value={key} onChange={e=>{setKey(e.target.value);operation.current="";}} required placeholder="BYP-…" disabled={busy}/><small>Ключ передаётся серверу активации и не сохраняется в черновиках формы.</small><button disabled={busy||!key.trim()}>{busy?"Выполняется…":"Активировать ключ"}</button></form>
          {license.state!=="unactivated"&&<div className="licenseButtons"><button disabled={busy} onClick={()=>void run("check")}>Проверить лицензию</button><button disabled={busy} onClick={()=>setConfirm(true)}>Отключить от установки</button></div>}
          {confirm&&<div className="licenseConfirm" role="group" aria-label="Подтверждение отключения"><p>Освободить привязку лицензии? Обновления потребуют повторной активации.</p><button disabled={busy} onClick={()=>void run("release")}>Освободить привязку</button><button disabled={busy} onClick={()=>setConfirm(false)}>Отмена</button></div>}
        </>:<p>Активировать и отключать лицензию может владелец установки.</p>}
      </>}
    </>}
  </section>;
}
