"use client";
import type {CSSProperties,ReactNode} from "react";
import PanelIcon from "./PanelIcon";
import {panelIconBySection} from "./panel-icons";

export type WorkspaceNavigation={id:string;label:string;group?:string;badge?:string|number};
/** Shared visual frame for the isolated demo and installed customer workspace. */
export default function WorkspaceFrame({edition,project,active,items,href,topbar,status,logout,children,overlay,style,className="",brandHref="/"}:{brandHref?:string;edition:string;project:string;active:string;items:WorkspaceNavigation[];href:(id:string)=>string;topbar:ReactNode;status:ReactNode;logout:ReactNode;children:ReactNode;overlay?:ReactNode;style?:CSSProperties;className?:string}){
 return <main className={`realDemo ${className}`} style={style}>
  <aside className="realSidebar workspaceMenu"><a href={brandHref} className="demoBrand workspaceMenuBrand"><b>B</b><span>BYPCMS</span><i>{edition}</i></a>
   <div className="projectBadge"><span>{project.slice(0,1)}</span><div><b>{project}</b><small>BYPCMS {edition}</small></div></div>
   <nav aria-label="Разделы панели">{items.map((item,index)=><div key={item.id}>{item.group&&items[index-1]?.group!==item.group&&<small className="workspaceMenuGroup">{item.group}</small>}<a href={href(item.id)} aria-label={item.label} title={item.label} aria-current={active===item.id?"page":undefined} className={active===item.id?"active":""}><i><PanelIcon name={panelIconBySection[item.id]||"file"}/></i><span>{item.label}</span>{item.badge!==undefined&&<em>{item.badge}</em>}</a></div>)}</nav>
   <div className="demoSafety workspaceMenuStatus">{status}</div>{logout}
  </aside>
  <section className="realWorkspace"><header className="realTopbar">{topbar}</header><div className="realContent">{children}</div></section>{overlay}
 </main>;
}
