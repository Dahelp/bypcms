"use client";
import {FormEvent,useCallback,useEffect,useRef,useState} from "react";
type Request=<T>(action:string,body?:unknown)=>Promise<T>;
export type Bank={enabled:boolean;recipient:string;inn:string;bank:string;bik:string;correspondent:string;account_hint:string;account_saved:boolean;account?:string};
type Invoice={id:number;number:string;state:string;amount_minor:number;scope:string;expires_on:string;expired:boolean;accepted_at:string|null;print_url:string;yookassa_url:string};
type Order={edition:string;domain:string;id:number;kind:string;payment_state:string;amount_minor:number;active_attempt_id?:string;items:{services:string[];items:{minor:number;service?:string}[]};invoice:Invoice|null;manual_payment:{source:string;paid_on:string}|null};
const serviceNames:Record<string,string>={"ux-ui":"UX/UI-дизайн",frontend:"Frontend-разработка",launch:"Запуск и настройка",migration:"Перенос данных",support:"Сопровождение"};
const money=(n:number)=>new Intl.NumberFormat("ru-RU",{style:"currency",currency:"RUB"}).format(n/100);
function serviceMinor(value:string):number|null{
 const match=value.trim().match(/^([0-9]{1,9}|[0-9]{1,3}(?:[ \u00A0\u202F][0-9]{3}){1,2})(?:[,.]([0-9]{1,2}))?$/);
 if(!match)return null;
 const minor=Number(match[1].replace(/\s/g,""))*100+Number((match[2]||"").padEnd(2,"0"));
 return minor>=100?minor:null;
}
export function BankInvoiceSettings({initial,request}:{initial:Bank;request:Request}){
 const[s,setS]=useState<Bank>(initial),[busy,setBusy]=useState(false),[message,setMessage]=useState(""),[error,setError]=useState("");const running=useRef(false);
 async function save(e:FormEvent){e.preventDefault();if(running.current)return;running.current=true;setBusy(true);setError("");setMessage("");try{const r=await request<{bank_settings:Bank}>("owner.bank.settings",s);setS({...r.bank_settings,account:""});setMessage("Реквизиты сохранены в закрытом хранилище. Ранее выставленные счета сохраняют свои реквизиты.");}catch(e){setError(e instanceof Error?e.message:"Не удалось сохранить реквизиты");}finally{setBusy(false);running.current=false;}}
 return <form className="licenseWorkspace commerceSettings" onSubmit={save} aria-busy={busy}><h2>Счета и банковский перевод · основной способ</h2><p>Реквизиты доступны только владельцу и покупателю в его счёте. В публичный каталог и установочный архив они не попадают.</p>{error&&<p role="alert" className="licenseError">{error}</p>}{message&&<p role="status">{message}</p>}<label className="commerceCheck"><input type="checkbox" checked={s.enabled} onChange={e=>setS({...s,enabled:e.target.checked})}/> Разрешить выставление банковских счетов</label>{([["recipient","Получатель"],["inn","ИНН получателя"],["bank","Банк"],["bik","БИК"],["correspondent","Корреспондентский счёт"]]as const).map(([key,label])=><label key={key}>{label}<input maxLength={190} required={s.enabled} value={s[key]} onChange={e=>setS({...s,[key]:e.target.value})}/></label>)}<label>Счёт получателя {s.account_hint}<input autoComplete="off" inputMode="numeric" maxLength={20} value={s.account||""} required={s.enabled&&!s.account_saved} placeholder={s.account_saved?"Оставьте пустым, чтобы сохранить прежний счёт":"20 цифр"} onChange={e=>setS({...s,account:e.target.value})}/></label><p>Подтверждайте оплату отдельно в карточке заказа после сверки выписки банка. Чеки НПД создавайте в «Мой налог» и добавляйте ссылку покупателю.</p><button disabled={busy}>{busy?"Сохраняем…":"Сохранить реквизиты"}</button></form>;
}
export default function CommerceInvoicePanel({id,bankEnabled,request,refresh}:{id:number;bankEnabled:boolean;request:Request;refresh:()=>Promise<void>}){
 const[domain,setDomain]=useState("");
 const[o,setO]=useState<Order|null>(null),[scope,setScope]=useState("Предоставление лицензии и модулей для домена заказа. Архив и ключ выдаются после подтверждения поступления оплаты, при задержке — в течение одного рабочего дня. Для услуг: уточните результат, срок исполнения и порядок приёмки."),[prices,setPrices]=useState<Record<string,string>>({}),[expires,setExpires]=useState(()=>new Date(Date.now()+14*86400000).toISOString().slice(0,10)),[url,setUrl]=useState(""),[reason,setReason]=useState(""),[amount,setAmount]=useState(""),[date,setDate]=useState(()=>new Date().toISOString().slice(0,10)),[reference,setReference]=useState(""),[source,setSource]=useState("bank"),[busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState(""),[confirm,setConfirm]=useState<{action:string;body:Record<string,unknown>;text:string}|null>(null);
 const running=useRef(false),operation=useRef({key:"",id:""}),dialog=useRef<HTMLDialogElement>(null),cancel=useRef<HTMLButtonElement>(null);
 const load=useCallback(async()=>{const r=await request<{order:Order}>("owner.order&id="+id);setO(r.order);return r.order;},[id,request]);
 useEffect(()=>{void Promise.resolve().then(load).then(r=>{setAmount((r.amount_minor/100).toFixed(2));if(r.items.services.length)setScope("");setDomain(r.domain==="Домен не указан"?"":r.domain);}).catch(e=>setError(e.message));},[load]);
 useEffect(()=>{if(confirm){dialog.current?.showModal();cancel.current?.focus();}else dialog.current?.close();},[confirm]);
 async function run(action:string,body:Record<string,unknown>){if(running.current)return;running.current=true;setBusy(true);setError("");setNotice("");const key=JSON.stringify([action,body]);if(operation.current.key!==key)operation.current={key,id:crypto.randomUUID().replaceAll("-","")};try{await request(action,{...body,operation_id:operation.current.id});setConfirm(null);operation.current={key:"",id:""};setNotice("Действие сохранено. Проверьте новый статус.");const r=await load();setAmount((r.amount_minor/100).toFixed(2));await refresh();}catch(e){setConfirm(null);setError(e instanceof Error?e.message:"Результат не подтверждён. Обновите статус и повторите прежний запрос.");try{await load();await refresh();}catch{}}finally{running.current=false;setBusy(false);}}
 if(!o)return <section className="licenseWorkspace"><p role="status">{error||"Загрузка счёта…"}</p><button onClick={()=>void load().catch(e=>setError(e.message))}>Повторить</button></section>;
 const i=o.invoice;
 const licenseTotal=(o.items.items||[]).filter(item=>!item.service).reduce((sum,item)=>sum+Number(item.minor),0);
 const pricedServices=o.items.services.map(key=>({key,amount:serviceMinor(prices[key]||"")}));
 const servicesComplete=pricedServices.every(service=>service.amount!==null);
 const servicesTotal=pricedServices.reduce((sum,service)=>sum+(service.amount??0),0);
 const invoiceTotal=licenseTotal+servicesTotal;
 const totalValid=servicesComplete&&invoiceTotal>=100&&invoiceTotal<=100000000;
 return <section className="licenseWorkspace commerceSettings" aria-busy={busy}><h2>Счёт и подтверждение оплаты · заказ №{id}</h2>{error&&<p role="alert" className="licenseError">{error}</p>}{notice&&<p role="status">{notice}</p>}<button disabled={busy} onClick={()=>void load().catch(e=>setError(e.message))}>Обновить статус счёта</button>{i&&<article><h3>{i.number} · {money(i.amount_minor)}</h3><p>{i.state==="paid"?"Поступление подтверждено":i.state==="canceled"?"Счёт отменён":i.expired?"Срок оплаты истёк":i.accepted_at?"Принят покупателем, ожидает оплаты":"Ожидает согласования покупателем"}. Срок оплаты: {i.expires_on}.</p><p style={{whiteSpace:"pre-wrap"}}>{i.scope}</p><a href={i.print_url} target="_blank" rel="noopener">Открыть счёт / печать / PDF</a></article>}{o.manual_payment&&<p>Источник: {o.manual_payment.source==="bank"?"Банковский перевод":"Выставленный счёт ЮKassa"}. Дата поступления: {o.manual_payment.paid_on}.</p>}
 {o.payment_state!=="paid"&&(!i||i.state==="canceled")&&<form onSubmit={event=>{
  event.preventDefault();
  if(!bankEnabled||!totalValid)return;
  const servicePrices=Object.fromEntries(pricedServices.map(({key,amount})=>[key,(Number(amount)/100).toFixed(2)]));
  void run("owner.invoice.issue",{id,scope,domain:domain||undefined,expires_on:expires,service_prices:servicePrices,yookassa_url:url});
 }}>
  <h3>Выставить счёт по заказу</h3>
  {!bankEnabled&&<p className="commerceNotice">Для выставления счёта включите банковские реквизиты. <a href="?section=settings&tab=payments">Открыть настройки оплаты</a></p>}
  {o.edition!=="services"&&<label>Домен установки<input required value={domain} onChange={event=>setDomain(event.target.value)} placeholder="example.ru"/></label>}
  {pricedServices.length>0&&<p>Укажите согласованную цену каждой услуги. Покупатель примет счёт с составом работ и сроками в своём кабинете.</p>}
  {pricedServices.map(({key,amount})=>{
   const invalid=!!prices[key]?.trim()&&amount===null;
   return <label key={key}>Цена услуги «{serviceNames[key]||key}», ₽
    <input required inputMode="decimal" aria-invalid={invalid||undefined} aria-describedby={invalid?`invoice-price-${key}`:undefined}
     value={prices[key]||""} onChange={event=>setPrices({...prices,[key]:event.target.value})}/>
    {invalid&&<small id={`invoice-price-${key}`}>Введите сумму от 1 ₽ с точностью до копеек, например 12 000,50.</small>}
   </label>;
  })}
  <dl className="commerceInvoiceEstimate" role="status">
   {licenseTotal>0&&<div><dt>Лицензия и модули</dt><dd>{money(licenseTotal)}</dd></div>}
   {pricedServices.length>0&&<div><dt>Услуги</dt><dd>{servicesComplete?money(servicesTotal):"Укажите точные цены"}</dd></div>}
   <div><dt><strong>Итого по счёту</strong></dt><dd><strong>{servicesComplete?money(invoiceTotal):"После расчёта услуг"}</strong></dd></div>
  </dl>
  {servicesComplete&&!totalValid&&<p className="licenseError" role="alert">Сумма счёта должна быть от 1 до 1 000 000 ₽.</p>}
  <label>Состав, результат, срок исполнения и приёмка<textarea required placeholder="Опишите конкретный результат, срок выполнения и порядок приёмки. Для сопровождения укажите оплачиваемый период." minLength={20} maxLength={6000} rows={6} value={scope} onChange={event=>setScope(event.target.value)}/></label>
  <label>Оплатить до<input type="date" required value={expires} onChange={event=>setExpires(event.target.value)}/></label>
  <label>Ссылка на готовый счёт ЮKassa (необязательно)<input type="url" value={url} onChange={event=>setUrl(event.target.value)} placeholder="https://yookassa.ru/…" maxLength={2048}/></label>
  <small>Если используете ЮKassa, сначала создайте счёт на ту же сумму в её кабинете.</small>
  <button disabled={busy||!bankEnabled||!totalValid}>Выставить счёт</button>
 </form>}
 {i?.state==="issued"&&o.payment_state!=="paid"&&<><form onSubmit={e=>{e.preventDefault();setConfirm({action:"owner.invoice.cancel",body:{id,invoice_id:i.id,reason},text:"Отменить счёт? Сначала убедитесь, что деньги не поступили, и сообщите покупателю, что оплачивать прежний счёт нельзя. Новая сумма требует нового согласования."});}}><label>Причина отмены счёта<textarea required minLength={5} maxLength={2000} value={reason} onChange={e=>setReason(e.target.value)}/></label><button disabled={busy}>Отменить счёт</button></form><form onSubmit={e=>{e.preventDefault();setConfirm({action:"owner.invoice.confirm",body:{id,invoice_id:i.id,amount,source,paid_on:date,reference,confirmed:true},text:`Подтвердить фактическое поступление ${amount} ₽ по счёту ${i.number}? Сверьте выписку банка или результат в кабинете ЮKassa. Скриншот покупателя не подтверждает оплату. ${o.kind==="service"?"Будет отмечена оплата работ; лицензия не выдаётся.":"Лицензия будет выдана после записи этого подтверждения."}`});}}><h3>Подтвердить поступление денег</h3><p>Полная точная сумма; частичный, избыточный и платёж по отменённому счёту сначала разбираются с покупателем. Эта кнопка не переводит и не списывает деньги.</p><label>Источник<select value={source} onChange={e=>setSource(e.target.value)}><option value="bank">Банковский перевод</option><option value="yookassa_invoice">Счёт в кабинете ЮKassa</option></select></label><label>Фактически получено, ₽<input required inputMode="decimal" value={amount} onChange={e=>setAmount(e.target.value)}/></label><label>Дата поступления<input type="date" required max={new Date().toISOString().slice(0,10)} value={date} onChange={e=>setDate(e.target.value)}/></label><label>Уникальный номер операции из выписки / ЮKassa<input required minLength={3} maxLength={190} value={reference} onChange={e=>setReference(e.target.value)}/></label><button disabled={busy||!i.accepted_at||(i.expired&&date>i.expires_on)}>Проверено: подтвердить оплату</button>{(!i.accepted_at||i.expired)&&<p>{i.expired?"Просроченный счёт можно подтвердить только для денег, поступивших в период его действия. Иначе сначала сверьтесь с покупателем.":"Сначала покупатель должен принять счёт в своём кабинете."}</p>}</form></>}
 {o.kind==="service"&&o.payment_state==="paid"&&<p>Оплачены согласованные работы. Лицензия в этот заказ не входит. Исполнение и приёмка — по условиям счёта.</p>}
 <dialog ref={dialog} onCancel={()=>{if(!busy)setConfirm(null);}} onClose={()=>{if(!busy)setConfirm(null);}}><h2>Проверьте действие</h2><p>{confirm?.text}</p><div className="licenseButtons"><button ref={cancel} disabled={busy} onClick={()=>setConfirm(null)}>Отмена</button><button disabled={busy} onClick={()=>confirm&&void run(confirm.action,confirm.body)}>{busy?"Сохраняем…":"Подтвердить"}</button></div></dialog></section>;
}
