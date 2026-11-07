import {notFound} from "next/navigation";
import {PublicHeader,PublicFooter,Breadcrumbs} from "../../components/PublicChrome";
import data from "../../../server/legal/documents/2026-11-07.1.json";
import "../legal.css";
type Key=keyof typeof data.documents;
export function generateStaticParams(){return Object.keys(data.documents).map(document=>({document}));}
export async function generateMetadata({params}:{params:Promise<{document:string}>}){const{document}=await params;const doc=data.documents[document as Key];return{title:doc?`${doc.title} — BYPCMS`:"Документ не найден"};}
export default async function LegalPage({params}:{params:Promise<{document:string}>}){
 const{document}=await params;if(!Object.hasOwn(data.documents,document))notFound();const doc=data.documents[document as Key];
 return <main className="legalPage"><PublicHeader/><Breadcrumbs items={[{label:"Главная",href:"/"},{label:doc.title}]}/><article className="legalContent publicContainer"><header><p className="sectionLabel">ДОКУМЕНТЫ BYPCMS</p><h1>{doc.title}</h1><p>{doc.lead}</p><small>Версия {data.version} · опубликовано {data.published}</small></header><nav aria-label="Документы BYPCMS">{Object.entries(data.documents).map(([key,value])=><a key={key} href={`/legal/${key}/`} aria-current={key===document?"page":undefined}>{value.title}</a>)}</nav>{doc.sections.map((section,index)=><section key={index}><h2>{section.title}</h2>{section.paragraphs.map((text,i)=><p key={i}>{text}</p>)}</section>)}<footer><a href="/contacts/">Контакты и реквизиты</a><a href={`/legal/documents/${data.version}.json`} download>Сохранить текст документов</a></footer></article><PublicFooter/></main>;
}
