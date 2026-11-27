"use client";
import { LocaleLink as Link, usePublicText, useLocale } from "../components/PublicLocale";
import {FormEvent,useCallback,useEffect,useRef,useState} from "react";
import {BackToTop,PublicFooter,PublicHeader} from "../components/PublicChrome";
import "./order.css";
import BuildEstimate from "../components/BuildEstimate";
import CheckoutEmail, { type CheckoutCustomer, type EmailPending } from "./CheckoutEmail";
import {publicServices} from "../modules/data";
import {checkoutComparisonSource,parseComparisonTag,trackComparison} from "../../lib/comparison-tracking";
type Quote={edition:string;term:string;domain?:string;modules:string[];services:string[];items:{name:string;minor:number}[];amount_minor:number;kind:string};
type Bootstrap={legal:{version:string};customer:CheckoutCustomer|null;csrf:string;checkout_email_available:boolean;checkout_email_pending:EmailPending|null;bank_available:boolean;payments_available:boolean;test_mode:boolean;renewal_quote:Quote|null;catalog:{editions:Record<string,{name:string;annual:number;lifetime:number}>;modules:{module_key:string;name:string;minor:number}[];availability:{edition:string;module_key:string;availability:string}[];services:Record<string,[string,number]>}};
type Draft={edition:string;term:string;modules:string[];services:string[];domain:string;company:string;phone:string;comment:string};
const initial:Draft={edition:"business",term:"annual",modules:[],services:[],domain:"",company:"",phone:"",comment:""};
async function checkoutJson(response:Response,fallback:string){try{if(!response.headers.get("content-type")?.includes("application/json"))throw new Error();return await response.json();}catch{throw new Error(fallback);}}
export default function OrderPage(){
 const t=usePublicText(),locale=useLocale();
 const money=(minor:number)=>new Intl.NumberFormat(locale==="en"?"en-US":"ru-RU",{style:"currency",currency:"RUB"}).format(minor/100);
 const[terms,setTerms]=useState(false),[privacy,setPrivacy]=useState(false);
 const[data,setData]=useState<Bootstrap|null>(null),[draft,setDraft]=useState<Draft>(initial),[quote,setQuote]=useState<Quote|null>(null),[error,setError]=useState(""),[quoteError,setQuoteError]=useState(""),[quoteKey,setQuoteKey]=useState(""),[busy,setBusy]=useState(false),[next,setNext]=useState("/order/"),[renewal,setRenewal]=useState(0);
 const selectionKey=JSON.stringify([draft.edition,draft.term,draft.modules,draft.services,renewal]);
 const quoteCurrent=!!quote&&quoteKey===selectionKey;
 const operation=useRef(""),storageKey=useRef(""),submitted=useRef(false);
 const privacyInput=useRef<HTMLInputElement>(null),buyerStatus=useRef<HTMLParagraphElement>(null);
 const [emailStatus,setEmailStatus]=useState<{ legacyPasswordRevoked: boolean } | null>(null);
 const load=useCallback(async()=>{
  setError("");
  try {
   const params=new URLSearchParams(location.search);
   const request=new URLSearchParams({action:"bootstrap"});
   if(params.has("renewal"))request.set("renewal",params.get("renewal")!);
   else if(operation.current)request.set("checkout",operation.current);
   const response=await fetch("/commerce/index.php?"+request,{credentials:"same-origin",cache:"no-store",signal:AbortSignal.timeout(20000)});
   const result=await checkoutJson(response,t("Сервис оформления недоступен. Повторите загрузку."));
   if(!response.ok)throw new Error(t(result.error||"")||t("Не удалось загрузить оформление"));
   setData(result);
   if(result.renewal_quote)setDraft(old=>({...old,edition:result.renewal_quote.edition,term:"annual",domain:result.renewal_quote.domain,modules:[],services:[]}));
  }catch(e){
   setError(e instanceof Error?t(e.message):t("Сервис оформления недоступен. Повторите загрузку."));
  }
 },[t]);
 useEffect(()=>{void Promise.resolve().then(()=>{const query=new URLSearchParams(location.search);setNext(location.pathname+location.search);setRenewal(Number(query.get("renewal"))||0);storageKey.current="bypcms-checkout-v1:"+location.search;let saved:{draft?:Partial<Draft>;operation?:string}|null=null;try{saved=JSON.parse(sessionStorage.getItem(storageKey.current)||"null");}catch{}const restored={...initial};if(saved?.draft){for(const key of ["domain","company","phone","comment"]as const)if(typeof saved.draft[key]==="string")restored[key]=saved.draft[key];}if(query.has("edition"))restored.edition=(query.get("edition")||"business").toLowerCase();if(query.get("services_only")==="1")restored.edition="services";if(query.has("term"))restored.term=query.get("term")==="lifetime"?"lifetime":"annual";restored.modules=(query.get("modules")||"").split(",").filter(Boolean);restored.services=(query.get("services")||"").split(",").filter(Boolean);if(saved?.draft){if(typeof saved.draft.edition==="string")restored.edition=saved.draft.edition;if(saved.draft.term)restored.term=saved.draft.term;if(Array.isArray(saved.draft.modules))restored.modules=saved.draft.modules.filter((v):v is string=>typeof v==="string");if(Array.isArray(saved.draft.services))restored.services=saved.draft.services.filter((v):v is string=>typeof v==="string");}operation.current=saved?.operation&&/^[a-f0-9]{32}$/.test(saved.operation)?saved.operation:crypto.randomUUID().replaceAll("-","");setDraft(restored);void load();});},[load]);
 useEffect(()=>{if(!data)return;try{sessionStorage.setItem(storageKey.current,JSON.stringify({draft,operation:operation.current}));}catch{/* The live form remains usable if storage is full. */}},[data,draft]);
 useEffect(()=>{if(!data)return;if(renewal){void Promise.resolve().then(()=>{setQuote(data.renewal_quote);setQuoteKey(selectionKey);});return;}const controller=new AbortController();const timer=setTimeout(()=>{void fetch("/commerce/index.php?action=quote",{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify({services_only:draft.edition==="services",edition:draft.edition,term:draft.term,modules:draft.modules,services:draft.services}),signal:controller.signal}).then(async response=>{const json=await checkoutJson(response,t("Сервис оформления недоступен. Повторите загрузку."));if(!response.ok)throw new Error(json.error);setQuote(json.quote);setQuoteKey(selectionKey);setQuoteError("");}).catch(e=>{if(!controller.signal.aborted){setQuote(null);setQuoteError(t(e.message)||t("Не удалось рассчитать заказ"));}});},100);return()=>{clearTimeout(timer);controller.abort();};},[data,draft.edition,draft.term,draft.modules,draft.services,renewal,selectionKey,t]);
 useEffect(()=>{if(!quoteCurrent||!quote||renewal)return;const source=parseComparisonTag(new URLSearchParams(location.search).get("cmp"));if(source)trackComparison("checkout_open",source,true);},[quoteCurrent,quote,renewal]);
 useEffect(()=>{if(emailStatus)buyerStatus.current?.focus();},[emailStatus]);
 const update=<K extends keyof Draft>(key:K,value:Draft[K])=>setDraft(old=>({...old,[key]:value}));
 async function submit(event:FormEvent){
  event.preventDefault();
  if(submitted.current||!data?.customer||!quoteCurrent)return;
  submitted.current=true;
  setBusy(true);
  setError("");
  try {
   const response=await fetch("/commerce/index.php?action=create",{
    method:"POST",
    credentials:"same-origin",
    headers:{"Content-Type":"application/json","X-CSRF-Token":data.csrf},
    body:JSON.stringify({
     ...draft,
     services_only:draft.edition==="services",
     legal_version:data.legal.version,
     accept_terms:terms,
     accept_privacy:privacy,
     renewal_license_id:renewal||undefined,
     operation_id:operation.current,
     comparison_source:checkoutComparisonSource(new URLSearchParams(location.search)),
    }),
    signal:AbortSignal.timeout(45000),
   });
   const json=await response.json();
   if(!response.ok){
    if(response.status===401||json.details?.code==="csrf_expired")void load();
    throw new Error(t(json.error||"")||t("Заказ не подтверждён сервером"));
   }
   try{sessionStorage.removeItem(storageKey.current);}catch{}
   location.assign(`/account/order.php?id=${Number(json.order.id)}`);
  }catch(e){
   setError((e instanceof Error?t(e.message):t("Запрос прерван"))+t(". Данные остаются в форме. Повтор отправки использует тот же заказ."));
  }finally{
   submitted.current=false;
   setBusy(false);
  }
 }
 const availableModules=data?.catalog.modules.filter(m=>data.catalog.availability.some(a=>a.edition.toLowerCase()===draft.edition&&a.module_key===m.module_key&&a.availability!=="hidden"))||[];
 const estimateServices=Object.entries(data?.catalog.services||{}).map(([slug,[,amountMinor]])=>({slug,amountMinor,billing:publicServices.find(service=>service.slug===slug)?.billing||"once" as const}));
 const unavailable=draft.modules.filter(key=>!availableModules.some(m=>m.module_key===key));
 const servicesOnly=draft.edition==="services";
 const needsDomain=!servicesOnly&&!draft.services.length;
 const steps=[
  [t("Сохраните заказ"),t("Проверьте состав и отправьте форму. Заказ появится в личном кабинете.")],
  [t("Получите счёт"),draft.services.length?t("Согласуем состав услуг, результат, сроки и точную стоимость до оплаты."):t("Проверьте состав, сумму и реквизиты счёта в личном кабинете.")],
  [t("Оплатите счёт"),t("Основной способ — банковский перевод. ЮKassa доступна, если ссылка указана в счёте.")],
  [renewal?t("Продлите лицензию"):servicesOnly?t("Начните работу над проектом"):t("Получите сборку"),renewal?t("После проверки оплаты срок лицензии обновится в личном кабинете."):servicesOnly?t("Работы выполняются по согласованному составу, срокам и порядку приёмки."):t("После проверки оплаты архив, ключ и инструкция будут доступны в личном кабинете.")],
 ];
 return <main className="orderPage">
  <PublicHeader active="order"/>
  <div className="orderLayout">
   <section className="orderOverview" aria-labelledby="order-title">
    <h1 id="order-title">{renewal?t("Продление лицензии"):t("Заказ BYPCMS")}</h1>
    <p className="orderLead">{t("Проверьте состав и оставьте детали проекта. Оплата — после проверки счёта в личном кабинете.")}</p>
    {data?.test_mode&&data.payments_available&&<p className="checkoutNotice">{t("Тестовый магазин: реального списания не будет.")}</p>}
    {data&&<section className="orderSummary" aria-labelledby="order-summary-title" aria-busy={!quoteCurrent&&!quoteError}>
     <h2 id="order-summary-title">{t("Ваш расчёт")}</h2>
     <p className="orderSelection">{servicesOnly?t("Только услуги, без лицензии"):`BYPCMS ${data.catalog.editions[draft.edition]?.name||draft.edition} · ${draft.term==="lifetime"?t("Пожизненная"):t("1 год")}`}</p>
     {quoteCurrent&&quote?<BuildEstimate licenseMinor={quote.amount_minor} catalog={estimateServices} selected={quote.services} includeLicense={!servicesOnly} licenseItems={quote.items.map((item,index)=>({...item,name:index===0&&!renewal?t("Лицензия BYPCMS"):t(item.name)}))} totalLabel={quote.services.length?undefined:t("Итого")}/>:quoteError?<div className="checkoutError" role="alert"><p>{quoteError}</p><button className="checkoutRetry" type="button" onClick={()=>void load()}>{t("Повторить расчёт")}</button></div>:<p role="status">{t("Пересчитываем стоимость…")}</p>}
    </section>}
    <Link className="orderAccountLink" href="/account/">{t("Мой кабинет и покупки →")}</Link>
   </section>
   {!data?<section className="checkoutForm" aria-live="polite"><p>{error||t("Загрузка оформления…")}</p>{error&&<button className="checkoutRetry" onClick={()=>void load()}>{t("Повторить загрузку")}</button>}</section>:<form className="checkoutForm" onSubmit={submit} aria-busy={busy} aria-labelledby="order-form-title">
    <h2 id="order-form-title">{renewal?t("Проверьте продление"):t("Состав заказа")}</h2>
    {!renewal&&<>
     <div className="checkoutFields">
      <label>{t("Редакция")}<select value={draft.edition} onChange={e=>setDraft(old=>({...old,edition:e.target.value,modules:[]}))}>{Object.entries(data.catalog.editions).map(([key,item])=><option key={key} value={key}>{t(item.name)}</option>)}<option value="services">{t("Только услуги, без лицензии")}</option></select></label>
      {!servicesOnly&&<label>{t("Срок лицензии")}<select value={draft.term} onChange={e=>update("term",e.target.value)}><option value="annual">{t("1 год")}</option><option value="lifetime">{t("Пожизненная")}</option></select></label>}
     </div>
     {!servicesOnly&&(availableModules.length>0||unavailable.length>0)&&<fieldset className="checkoutOptions"><legend>{t("Модули")}</legend>
      {unavailable.length>0&&<div className="checkoutNotice" role="alert"><p>{t("В сохранённом составе есть недоступные модули. Остальные поля сохранены.")}</p><button className="checkoutRetry" type="button" onClick={()=>update("modules",draft.modules.filter(key=>!unavailable.includes(key)))}>{t("Убрать недоступные модули")}</button></div>}
      {availableModules.map(m=>{const included=data.catalog.availability.some(a=>a.edition.toLowerCase()===draft.edition&&a.module_key===m.module_key&&a.availability==="included");return <label className="checkoutCheck" key={m.module_key}><input type="checkbox" disabled={included} checked={included||draft.modules.includes(m.module_key)} onChange={e=>update("modules",e.target.checked?[...draft.modules,m.module_key]:draft.modules.filter(x=>x!==m.module_key))}/><span className="checkoutOptionText">{t(m.name)}<small>{included?t("Входит в редакцию"):money(m.minor)}</small></span></label>;})}
     </fieldset>}
     <fieldset className="checkoutOptions"><legend>{t("Услуги по согласованию")}</legend><p className="checkoutHelp">{t("Добавьте нужные услуги. Их стоимость предварительная и входит в расчёт на старт.")}</p>
      {Object.entries(data.catalog.services).map(([key,[name,minor]])=><label className="checkoutCheck" key={key}><input type="checkbox" checked={draft.services.includes(key)} onChange={e=>update("services",e.target.checked?[...draft.services,key]:draft.services.filter(x=>x!==key))}/><span className="checkoutOptionText">{t(name)}<small>{t("от")}{" "}{money(minor)}{key==="support"?t(" / месяц"):t(" / проект")}</small></span></label>)}
     </fieldset>
    </>}
    <section className="checkoutDetails" aria-labelledby="order-details-title">
     <h3 id="order-details-title">{t("Детали проекта")}</h3>
     <label htmlFor="order-domain">{t("Домен установки")}{!renewal&&<small>{needsDomain?t("Обязательно"):t("Необязательно")}</small>}</label>
     <input id="order-domain" value={draft.domain} readOnly={!!renewal} required={needsDomain} aria-describedby="order-domain-help" placeholder="example.ru" autoCapitalize="none" autoCorrect="off" spellCheck={false} onChange={e=>update("domain",e.target.value)}/>
     <p className="checkoutHelp" id="order-domain-help">{t("Без https://, пути и порта")}{!needsDomain&&!renewal&&t(". Можно согласовать позже.")}</p>
     {renewal?<p>{t("Продление на год по текущей цене редакции. Приобретённые модули повторно не оплачиваются.")}</p>:<>
      <p className="checkoutHelp">{t("Остальные поля необязательны. Укажите то, что поможет подготовить заказ.")}</p>
      <div className="checkoutFields"><label>{t("Компания")}<input autoComplete="organization" maxLength={190} value={draft.company} onChange={e=>update("company",e.target.value)}/></label><label>{t("Телефон")}<input type="tel" autoComplete="tel" maxLength={60} value={draft.phone} onChange={e=>update("phone",e.target.value)}/></label></div>
      <label>{t("Комментарий")}<textarea rows={3} maxLength={2000} value={draft.comment} onChange={e=>update("comment",e.target.value)}/></label>
     </>}
    </section>
    <div className="checkoutSubmit">
     {data.customer&&<p ref={buyerStatus} className="checkoutBuyer" tabIndex={-1} role={emailStatus?"status":undefined}>
      {emailStatus?t("Email подтверждён"):t("Покупатель:")}{" "}
      {data.customer.name!==data.customer.email&&data.customer.name}<span>{data.customer.email}</span>
     </p>}
     {emailStatus?.legacyPasswordRevoked&&<p className="checkoutNotice">{t("Для входа по паролю задайте новый пароль через восстановление доступа.")}</p>}
     {error&&<p className="checkoutError" role="alert">{error}</p>}
     <label className="checkoutCheck checkoutConsent"><input type="checkbox" required checked={terms} onChange={e=>setTerms(e.target.checked)}/><span>{t("Принимаю")}{" "}<Link href="/legal/offer/" target="_blank" rel="noopener">{t("условия покупки")}</Link>{" "}{t("и")}{" "}<Link href="/legal/refunds/" target="_blank" rel="noopener">{t("возврата")}</Link>.</span></label>
     <label className="checkoutCheck checkoutConsent"><input ref={privacyInput} type="checkbox" required checked={privacy} onChange={e=>setPrivacy(e.target.checked)}/><span>{t("Даю отдельное")}{" "}<Link href="/legal/consent/" target="_blank" rel="noopener">{t("согласие на обработку данных")}</Link>. <Link href="/legal/privacy/" target="_blank" rel="noopener">{t("Политика")}</Link>.</span></label>
     <p className="checkoutHelp">{t("Для отправки подтвердите оба согласия.")}</p>
     {!data.customer&&(data.checkout_email_available&&!renewal?
      <CheckoutEmail csrf={data.csrf} legalVersion={data.legal.version} getOperation={()=>operation.current} pending={data.checkout_email_pending}
       returnUrl={next} privacyAccepted={privacy} focusPrivacy={()=>privacyInput.current?.focus()} refresh={()=>void load()}
       onVerified={result=>{
        setData(current=>current&&({...current,customer:result.customer,csrf:result.csrf,checkout_email_pending:null}));
        setEmailStatus({legacyPasswordRevoked:!!result.legacy_password_revoked});
       }} />:
      <p className="checkoutNotice">{!renewal&&<>{t("Отправка кодов временно недоступна.")}{" "}</>}{t("Чтобы сохранить заказ,")}{" "}
       <Link href={`/account/?next=${encodeURIComponent(next)}`}>{t("войдите или зарегистрируйтесь")}</Link>{t(". Заполненные данные сохраняются в этой вкладке.")}</p>)}
     <button className="checkoutPrimary" disabled={busy||!data.customer||!quoteCurrent||!terms||!privacy} aria-describedby="order-submit-help">{busy?t("Сохраняем…"):quote?.kind==="inquiry"?t("Отправить заявку"):t("Сохранить заказ")}</button>
     <p className="checkoutHelp checkoutAfterSubmit" id="order-submit-help">{t("После отправки откроется заказ в личном кабинете. Деньги на этом шаге не списываются.")}</p>
     <a className="checkoutStepsLink" href="#order-next">{t("Что будет дальше")}</a>
    </div>
   </form>}
   <section className="orderNext" id="order-next" aria-labelledby="order-next-title">
    <h2 id="order-next-title">{t("Что будет дальше")}</h2>
    <ol>{steps.map(([title,description])=><li key={title}><h3>{title}</h3><p>{description}</p></li>)}</ol>
   </section>
  </div>
  <PublicFooter/><BackToTop/>
 </main>;
}
