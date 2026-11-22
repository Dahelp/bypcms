import type {PortfolioProject} from "../app/portfolio/data";
import type {Locale} from "./public-locale";

/** Built-in translations take priority; CMS copy uses the shared public catalog. */
export function localizePortfolioProject(source:PortfolioProject,locale:Locale,translate:(text:string)=>string):PortfolioProject {
 if(locale!=="en")return source;
 const project={...source,...source.en};
 const text=(value:string)=>translate(value.trim());
 return {...project,title:text(project.title),category:text(project.category),lead:text(project.lead),description:text(project.description),result:text(project.result),features:project.features.map(text),modules:project.modules.map(text),services:project.services.map(text)};
}
