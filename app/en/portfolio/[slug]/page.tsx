import Page,{generateStaticParams} from "../../../portfolio/[slug]/page";
import {portfolioProjects} from "../../../portfolio/data";
import {publicMetadata} from "../../../../lib/public-locale";
export {generateStaticParams};
export default Page;
export async function generateMetadata({params}:{params:Promise<{slug:string}>}){const {slug}=await params;const item=portfolioProjects.find(item=>item.slug===slug);return item?publicMetadata(`/portfolio/${slug}/`,item.title+" — BYPCMS",item.en?.lead||item.lead,"en"):{};}
