"use client";
import {useRef,useState} from "react";
import {panelRequest} from "../components/panel-api";
import {licenseOperationId} from "../components/LicenseSettings";
import "../components/license.css";

export type ManagedLicense={id:number;license_hint:string;domain:string;edition:string;license_term:string;valid_until:string|null;key_available?:number;activation_active?:number;installation_id?:string};
export default function OwnerLicense({license,csrf,refresh}:{license:ManagedLicense;csrf:string;refresh:()=>Promise<void>}){
  const[key,setKey]=useState(""),[busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState(""),[confirmation,setConfirmation]=useState("");
  const operation=useRef({action:"",id:""}),running=useRef(false);
  async function run(action:string){
    if(running.current)return;running.current=true;setBusy(true);setError("");setNotice("");
    if(operation.current.action!==action)operation.current={action,id:licenseOperationId()};
    try{
      const result=await panelRequest<{key?:string;valid_until?:string}>(`owner.license.${action}`,{method:"POST",body:JSON.stringify({id:license.id,operation_id:operation.current.id})},csrf);
      if(result.key)setKey(result.key);
      if(action!=="key")await refresh();
      setNotice(action==="renew"?`Продлена до ${result.valid_until}`:action==="release"?"Привязка освобождена":action==="rotate"?"Новый ключ выпущен. Прежний ключ больше не подходит для активации.":"Ключ доступен ниже");
      setConfirmation("");operation.current={action:"",id:""};
    }catch(e){setError(e instanceof Error?e.message:"Не удалось выполнить действие");}
    finally{setBusy(false);running.current=false;}
  }
  const confirmations:Record<string,string>={renew:"Продлить доступ к обновлениям на один календарный год от более поздней даты: текущего срока или сегодняшнего дня? Действие не проводит оплату.",release:"Освободить привязку? Текущая установка получит отказ при следующей проверке. Работа сайта продолжится.",rotate:"Выпустить новый ключ взамен прежнего? Прежний ключ перестанет подходить для активации. Текущая привязка сохранится."};
  function download(){const url=URL.createObjectURL(new Blob([`BYPCMS ${license.edition}\n${license.domain}\n${key}\n`],{type:"text/plain;charset=utf-8"}));const a=document.createElement("a");a.href=url;a.download=`bypcms-license-${license.id}.txt`;a.click();URL.revokeObjectURL(url);}
  return <section className="licenseWorkspace" aria-busy={busy}><a href="?section=licenses">← Все лицензии</a><header><div><small>ЛИЦЕНЗИЯ №{license.id}</small><h2>{license.domain}</h2></div><span>{license.edition}</span></header>
    <p>Ключ: <code>{license.license_hint}</code></p><p>Привязка: {Number(license.activation_active)?<code>{license.installation_id}</code>:"Не активирована"}</p>
    {error&&<p className="licenseError" role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
    <div className="licenseButtons"><button disabled={busy||!Number(license.key_available)} onClick={()=>void run("key")}>Показать ключ</button><button disabled={busy} onClick={()=>setConfirmation("rotate")}>Перевыпустить ключ</button>{license.license_term!=="lifetime"&&<button disabled={busy} onClick={()=>setConfirmation("renew")}>Продлить на год</button>}{Boolean(Number(license.activation_active))&&<button disabled={busy} onClick={()=>setConfirmation("release")}>Освободить привязку</button>}</div>
    {!Number(license.key_available)&&<p>У старой лицензии полный ключ не сохранялся. Выпустите новый для передачи клиенту.</p>}
    {confirmation&&<div className="licenseConfirm" role="group" aria-label="Подтверждение действия"><p>{confirmations[confirmation]}</p><button disabled={busy} onClick={()=>void run(confirmation)}>Подтвердить</button><button disabled={busy} onClick={()=>setConfirmation("")}>Отмена</button></div>}
    {key&&<div className="licenseSecret"><label>Ключ для владельца установки<code>{key}</code></label><div className="licenseButtons"><button onClick={()=>void navigator.clipboard.writeText(key).then(()=>setNotice("Ключ скопирован"),()=>setError("Не удалось скопировать. Выделите ключ вручную."))}>Скопировать</button><button onClick={download}>Скачать ключ</button><button onClick={()=>setKey("")}>Скрыть ключ</button></div></div>}
  </section>;
}
