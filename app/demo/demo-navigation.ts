import {panelHref} from "../components/panel-route";

export function resolveDemoSection(section:string,menu:readonly {id:string}[]){
  return {view:section,error:section==="overview" || menu.some(item=>item.id===section)?"":"Раздел не найден или его модуль отключён. Выберите доступный раздел в меню."};
}

/** Only a query-only editor destination in this panel, never an external redirect. */
export function editorReturnHref(value:string | null):string | null {
  if(!value?.startsWith("?") || value.length>2000 || /[\r\n]/.test(value))return null;
  const route=new URLSearchParams(value.slice(1));const edition=route.get("edition"),section=route.get("section");
  if(!edition || !["content","business","commerce"].includes(edition) || !section || !/^[a-z0-9_-]+$/.test(section))return null;
  const record=route.get("record"),editor=route.get("editor"),draft=route.get("draft"),tab=route.get("tab");
  const positive=(id:string)=>/^\d+$/.test(id) && Number.isSafeInteger(Number(id)) && Number(id)>0;
  if(record ? !positive(record) || Boolean(editor) : editor!=="new" || !draft || !positive(draft))return null;
  if(tab && !["content","seo","settings"].includes(tab) && !/^module:[a-z0-9_-]+$/.test(tab))return null;
  return panelHref({edition,section,record,editor,draft:editor==="new"?draft:undefined,tab});
}
