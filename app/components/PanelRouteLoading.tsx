import "./panel-route-loading.css";

export default function PanelRouteLoading({error,onRetry}:{error?:string;onRetry?:()=>void}){
  return <main className="panelRouteLoading" aria-label="Загрузка выбранного раздела"><div><b>BYPCMS</b>{error?<><p role="alert">{error}</p>{onRetry&&<button type="button" onClick={onRetry}>Повторить загрузку</button>}</>:<p role="status">Загрузка выбранного раздела…</p>}</div></main>;
}
