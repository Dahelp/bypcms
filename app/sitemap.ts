import type { MetadataRoute } from "next";
import { publicModules } from "./modules/data";
import { portfolioProjects } from "./portfolio/data";
import {localeHref} from "../lib/public-locale";
export const dynamic="force-static";
export default function sitemap(): MetadataRoute.Sitemap {
 const base=process.env.NEXT_PUBLIC_SITE_URL||"https://bypcms.ru";
 const paths=["/",...(["business","commerce","content"].map(slug=>`/solutions/${slug}/`)),"/services/","/modules/","/portfolio/","/contacts/","/concept-example/",...publicModules.map(item=>`/modules/${item.slug}/`),...portfolioProjects.map(item=>`/portfolio/${item.slug}/`),...["offer","privacy","consent","refunds"].map(key=>`/legal/${key}/`)];
 return paths.flatMap(path=>(["ru","en"] as const).map(locale=>({url:base+localeHref(path,locale),alternates:{languages:{ru:base+localeHref(path,"ru"),en:base+localeHref(path,"en")}}})));
}
