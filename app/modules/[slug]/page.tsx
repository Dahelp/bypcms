import {notFound} from "next/navigation";
import {publicModules} from "../data";
import ModuleContent from "../ModuleContent";
import {publicMetadata} from "../../../lib/public-locale";
export function generateStaticParams(){return publicModules.map(item=>({slug:item.slug}));}
export async function generateMetadata({params}:{params:Promise<{slug:string}>}){const {slug}=await params;const item=publicModules.find(item=>item.slug===slug);return item?publicMetadata(`/modules/${slug}/`,item.name+" — BYPCMS",item.lead,"ru"):{};}
export default async function Page({params}:{params:Promise<{slug:string}>}){const {slug}=await params;const item=publicModules.find(item=>item.slug===slug);if(!item)notFound();return <ModuleContent item={item}/>;}
