"use client";
import {useLocale,LocaleLink as Link} from "../components/PublicLocale";
import {PublicHeader,PublicFooter,Breadcrumbs} from "../components/PublicChrome";
import ru from "../../server/legal/documents/2026-11-13.1.json";
import en from "../../server/legal/documents/2026-11-13.1.en.json";
import "./legal.css";
export default function LegalContent({document}:{document:keyof typeof ru.documents}){
 const locale=useLocale(),data=locale==="en"?en:ru,doc=data.documents[document];
 return <main className="legalPage"><PublicHeader/><Breadcrumbs items={[{label:"Главная",href:"/"},{label:doc.title}]}/><article className="legalContent publicContainer"><header><p className="sectionLabel">{locale==="en"?"BYPCMS DOCUMENTS":"ДОКУМЕНТЫ BYPCMS"}</p><h1>{doc.title}</h1><p>{doc.lead}</p><small>{locale==="en"?"Version":"Версия"} {data.version} · {data.published}</small></header><nav aria-label={locale==="en"?"BYPCMS documents":"Документы BYPCMS"}>{Object.entries(data.documents).map(([key,value])=><Link key={key} href={`/legal/${key}/`} aria-current={key===document?"page":undefined}>{value.title}</Link>)}</nav>{doc.sections.map((section,index)=><section key={index}><h2>{section.title}</h2>{section.paragraphs.map((text,i)=><p key={i}>{text}</p>)}</section>)}<footer><Link href="/contacts/">{locale==="en"?"Contact and seller details":"Контакты и реквизиты"}</Link><a href={`/legal/documents/${data.version}${locale==="en"?".en":""}.json`} download>{locale==="en"?"Download these documents":"Сохранить текст документов"}</a></footer></article><PublicFooter/></main>;
}
