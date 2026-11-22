import type {WorkspaceNavigation} from "../components/WorkspaceFrame";
export type Field={name:string;label:string;value:unknown;type?:string;options?:Record<string,string>;readonly?:boolean};
export type RecordData={id:number;revision:number;kind:string;title:string;slug:string;status:string;excerpt?:string;content?:string;blocks?:{type:string;content?:string;data?:{content?:string}}[];cover?:string;role?:string;updated_at?:string;public_url?:string;editor_fields?:Field[];create_token?:string;[key:string]:unknown};
export type Manifest={edition:string;version:string;site_name:string;theme:string;locales:string[];navigation:WorkspaceNavigation[];project:{needs_import?:boolean;theme?:string;name?:string;fixed_sections?:string[];sections?:Record<string,string>};user:{id:number;name:string;role:string};modules:{module_key:string;name:string;version:string;status:string}[]};
export type Request=<T=Record<string,unknown>>(action:string,body?:unknown,query?:Record<string,string|number>,signal?:AbortSignal)=>Promise<T>;
export type Listing={rows:RecordData[];total:number;page:number;pages:number;can_create?:boolean};
