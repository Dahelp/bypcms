"use client";
import {useLocale} from "./PublicLocale";
import {estimateBuild,type EstimateService} from "../../lib/build-estimate";
import "./build-estimate.css";

export default function BuildEstimate({licenseMinor,catalog,selected,includeLicense=true,tone="light",licenseItems,totalLabel}:{licenseMinor:number;catalog:readonly EstimateService[];selected:readonly string[];includeLicense?:boolean;tone?:"light"|"dark";licenseItems?:readonly {name:string;minor:number}[];totalLabel?:string}) {
  const locale=useLocale(),tx=(ru:string,en:string)=>locale==="en"?en:ru;
  const estimate=estimateBuild(licenseMinor,catalog,selected);
  const money=(minor:number)=>(minor/100).toLocaleString(locale==="en"?"en-US":"ru-RU",{maximumFractionDigits:2})+" ₽";
  return <aside className={`buildEstimate buildEstimate--${tone}`} aria-label={tx("Расчёт стоимости","Cost estimate")}>
    {(estimate.hasServices||(licenseItems?.length||0)>1)&&<dl className="buildEstimateBreakdown">
      {includeLicense&&(licenseItems?licenseItems.map((item,index)=><div key={index}><dt>{item.name}</dt><dd>{money(item.minor)}</dd></div>):<div><dt>{tx("Лицензия и модули","License and modules")}</dt><dd>{money(estimate.licenseMinor)}</dd></div>)}
      {estimate.oneTimeMinor>0&&<div><dt>{tx("Разовые услуги","One-time services")}</dt><dd>{tx("от ","from ")}{money(estimate.oneTimeMinor)}</dd></div>}
      {estimate.monthlyMinor>0&&<div><dt>{tx("Сопровождение: первый месяц","Support: first month")}</dt><dd>{tx("от ","from ")}{money(estimate.monthlyMinor)}</dd></div>}
    </dl>}
    <div className="buildEstimateTotal" role="status" aria-live="polite" aria-atomic="true"><span>{totalLabel||(estimate.hasServices?tx("Предварительно на старт","Estimated initial total"):tx("Стоимость лицензии и модулей","License and modules"))}</span><strong>{estimate.hasServices&&<small>{tx("от ","from ")}</small>}{money(estimate.initialMinor)}</strong></div>
    {estimate.monthlyMinor>0&&<p className="buildEstimateRecurring">{tx("Первый месяц сопровождения включён в расчёт. Далее — от ","The first month of support is included. After that, from ")}{money(estimate.monthlyMinor)}{tx(" / месяц."," / month.")}</p>}
    {estimate.hasServices&&<p className="buildEstimateNote">{tx("Стоимость услуг предварительная. Точную сумму, состав и сроки согласуем в счёте до оплаты.","Service prices are estimates. Exact scope, price and timing will be agreed in an invoice before payment.")}</p>}
  </aside>;
}
