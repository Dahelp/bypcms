import Link from "next/link";
import { notFound } from "next/navigation";
import { publicModules } from "../data";
import "./module.css";

export function generateStaticParams(){return publicModules.map(module=>({slug:module.slug}))}

export default async function ModulePage({params}:{params:Promise<{slug:string}>}){
  const {slug}=await params;
  const module=publicModules.find(item=>item.slug===slug);
  if(!module)notFound();
  return <main className="modulePage"><nav><Link href="/"><b>B</b> BYPCMS</Link><Link href="/#builder">Калькулятор</Link></nav><section className="moduleHero"><p>{module.category} / МОДУЛЬ</p><h1>{module.name}</h1><span>{module.lead}</span><div><strong>{module.price?`${module.price.toLocaleString("ru-RU")} ₽`:"Входит в редакцию"}</strong><small>{module.price?"единоразово к выбранной лицензии":"базовая возможность BYPCMS"}</small></div></section><section className="moduleFeatures"><div><p>ВОЗМОЖНОСТИ</p><h2>Что входит в модуль</h2></div><div>{module.features.map((feature,index)=><article key={feature}><span>{String(index+1).padStart(2,"0")}</span><h3>{feature}</h3><p>Настраивается в единой панели BYPCMS и обновляется независимо от ядра.</p></article>)}</div></section><section className="moduleCta"><h2>Добавить {module.name} в свою сборку?</h2><Link href="/#builder">Рассчитать стоимость →</Link></section></main>
}
