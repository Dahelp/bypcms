import Page,{generateStaticParams} from "../../../modules/[slug]/page";
import {publicModules} from "../../../modules/data";
import {publicMetadata} from "../../../../lib/public-locale";
export {generateStaticParams};
export default Page;
import english from "../../../../lib/public-en.json";
export async function generateMetadata({params}:{params:Promise<{slug:string}>}){const {slug}=await params;const item=publicModules.find(item=>item.slug===slug);return item?publicMetadata(`/modules/${slug}/`,((english as Record<string,string>)[item.name]||item.name)+" — BYPCMS",(english as Record<string,string>)[item.lead]||item.lead,"en"):{};}
