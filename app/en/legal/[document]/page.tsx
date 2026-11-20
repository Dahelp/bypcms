import {notFound} from "next/navigation";
import data from "../../../../server/legal/documents/2026-11-13.1.en.json";
import LegalContent from "../../../legal/LegalContent";
import {publicMetadata} from "../../../../lib/public-locale";
export function generateStaticParams(){return Object.keys(data.documents).map(document=>({document}));}
export async function generateMetadata({params}:{params:Promise<{document:string}>}){const {document}=await params;const doc=data.documents[document as keyof typeof data.documents];return doc?publicMetadata(`/legal/${document}/`,doc.title+" — BYPCMS",doc.lead,"en"):{};}
export default async function Page({params}:{params:Promise<{document:string}>}){const {document}=await params;if(!Object.hasOwn(data.documents,document))notFound();return <LegalContent document={document as keyof typeof data.documents}/>;}
