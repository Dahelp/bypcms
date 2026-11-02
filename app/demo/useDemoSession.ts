"use client";
import {useCallback,useEffect,useState} from "react";
import {DEMO_SESSION_KEY,endDemoSession,readDemoSession,startDemoSession,type DemoSession} from "./demo-session";

export function useDemoSession(){
  const [session,setSession]=useState<DemoSession | null>(null);
  const [ready,setReady]=useState(false);const [error,setError]=useState("");
  const refresh=useCallback(()=>{
    try{setSession(readDemoSession(localStorage,sessionStorage));setError("");}
    catch{setSession(null);setError("Не удалось прочитать демо-сессию. Разрешите хранилище для demo.bypcms.ru и повторите вход.");}
    setReady(true);
  },[]);
  useEffect(()=>{
    refresh();
    const storage=(event:StorageEvent)=>{if(event.key===DEMO_SESSION_KEY || event.key===null)refresh();};
    const visible=()=>{if(document.visibilityState==="visible")refresh();};
    window.addEventListener("storage",storage);window.addEventListener("focus",visible);window.addEventListener("pageshow",refresh);document.addEventListener("visibilitychange",visible);
    return()=>{window.removeEventListener("storage",storage);window.removeEventListener("focus",visible);window.removeEventListener("pageshow",refresh);document.removeEventListener("visibilitychange",visible);};
  },[refresh]);
  useEffect(()=>{if(!session)return;const timer=window.setTimeout(refresh,Math.max(0,session.expiresAt-Date.now()));return()=>window.clearTimeout(timer);},[session?.expiresAt,refresh]);
  function login(){const next=startDemoSession(localStorage,sessionStorage);setSession(next);setReady(true);setError("");}
  function logout(){endDemoSession(localStorage,sessionStorage);setSession(null);setError("");}
  return {logged:Boolean(session),ready,error,login,logout};
}
