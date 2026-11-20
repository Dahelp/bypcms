import {notFound} from "next/navigation";
import {portfolioProjects} from "../data";
import PortfolioCase from "../PortfolioCase";
import {publicMetadata} from "../../../lib/public-locale";
export function generateStaticParams(){return portfolioProjects.map(item=>({slug:item.slug}));}
export async function generateMetadata({params}:{params:Promise<{slug:string}>}){const {slug}=await params;const item=portfolioProjects.find(item=>item.slug===slug);return item?publicMetadata(`/portfolio/${slug}/`,item.title+" — BYPCMS",item.lead,"ru"):{};}
export default async function Page({params}:{params:Promise<{slug:string}>}){const {slug}=await params;const project=portfolioProjects.find(item=>item.slug===slug);if(!project)notFound();return <PortfolioCase project={project}/>;}
