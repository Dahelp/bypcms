"use client";

import { useEffect, useState } from "react";
import "./concepts.css";

type ConceptView = { title:string; html:string; locale:string; languages:string[]; asset_base:string };

export default function ConceptViewer() {
  const [slug,setSlug] = useState("");
  const [token,setToken] = useState("");
  const [locale,setLocale] = useState("");
  const [view,setView] = useState<ConceptView|null>(null);
  const [error,setError] = useState("");
  const [loading,setLoading] = useState(false);
  useEffect(() => {
    const path=window.location.pathname.split("/").filter(Boolean);
    const params=new URLSearchParams(window.location.hash.slice(1));
    const raw=window.location.hash.slice(1);
    setSlug(path[0]==="concepts"&&path[1]?path[1]:new URLSearchParams(window.location.search).get("slug")||"");
    setToken(params.get("key")||(/^[a-f0-9]{64}$/.test(raw)?raw:""));
  },[]);
  useEffect(() => {
    if (!slug || !token) return;
    let cancelled=false;
    setLoading(true);
    fetch("/api/index.php?action=concepts.view",{method:"POST",headers:{"Content-Type":"application/json"},
      cache:"no-store",credentials:"omit",body:JSON.stringify({slug,token,locale})})
      .then(async r=>{const data=await r.json();if(!r.ok||!data.ok)throw new Error(data.error||"Не удалось открыть концепцию");return data as ConceptView})
      .then(data=>{if(!cancelled){setView(data);setError("")}})
      .catch(e=>{if(!cancelled){setView(null);setError(e instanceof Error?e.message:"Не удалось открыть концепцию")}})
      .finally(()=>{if(!cancelled)setLoading(false)});
    return ()=>{cancelled=true};
  },[slug,token,locale]);
  const assetBase=view?.asset_base?.match(/^\/[a-z0-9/_-]*\/$/)?view.asset_base:"/";
  const base=typeof window!=="undefined"?window.location.origin+assetBase:"/";
  const html=view?.html.replace(/<head([^>]*)>/i,`<head$1><base href="${base}"><meta name="robots" content="noindex,nofollow,noarchive">`) || "";
  return <main className="conceptViewer">
    <header><div><a href="/">B</a><span>BYPCMS <b>/ Концепции</b></span></div>{view&&<nav aria-label="Язык концепции">{view.languages.map(lang=><button type="button" key={lang} className={view.locale===lang?"active":""} onClick={()=>setLocale(lang)}>{lang.toUpperCase()}</button>)}</nav>}</header>
    {view?<iframe title={view.title} srcDoc={html} sandbox="allow-scripts allow-forms" referrerPolicy="no-referrer"/>:<section><p>ПЕРСОНАЛЬНАЯ ПРЕЗЕНТАЦИЯ</p><h1>{loading?"Открываем концепцию…":"Концепция доступна по персональной ссылке"}</h1><span>{error||"Попросите ссылку с ключом у автора проекта."}</span></section>}
  </main>;
}
