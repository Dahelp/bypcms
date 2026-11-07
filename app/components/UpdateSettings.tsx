"use client";
import {useCallback,useEffect,useRef,useState} from "react";
import "./license.css";
type Job={id:string;version:string;previous_version:string;created_at:number;state:string;phase:string;error:string;backup_ready:boolean;files_done?:number;files_total?:number;tables_done?:number;tables_total?:number};
type Release={id:string;version:string;from:string[];bytes:number;compatible?:boolean};
type State={current?:{version:string;release:string|null};client?:boolean;maintenance?:boolean;backup_directory?:string;jobs?:Job[];releases:Release[];candidate?:string|null};
const phases:Record<string,string>={download:"Загрузка и проверка пакета",preflight:"Проверка совместимости и места",backup_files:"Резервная копия файлов",backup_database:"Резервная копия БД",migrations:"Миграции БД",switch:"Переключение версии",health:"Проверка новой версии",restore_prepare:"Проверка резервной копии",restore_database:"Восстановление БД",restore_files:"Восстановление файлов",restore_pointer:"Возврат предыдущей версии",done:"Завершено"};
const states:Record<string,string>={running:"Выполняется",restoring:"Выполняется откат",recovery_required:"Нужно продолжить восстановление",completed:"Обновление установлено",rolled_back:"Предыдущая версия восстановлена",failed:"Обновление не начато"};
export default function UpdateSettings({csrf,owner,publisher=false}:{csrf:string;owner:boolean;publisher?:boolean}){
 const[data,setData]=useState<State|null>(null),[error,setError]=useState(""),[notice,setNotice]=useState(""),[busy,setBusy]=useState(false),[progress,setProgress]=useState<Job|null>(null),[confirmation,setConfirmation]=useState<{action:string;id?:string}|null>(null);
 const running=useRef(false),operation=useRef({package:"",id:""});
 const confirmationDialog=useRef<HTMLDialogElement>(null),confirmationCancel=useRef<HTMLButtonElement>(null);
 useEffect(()=>{if(confirmation){confirmationDialog.current?.showModal();confirmationCancel.current?.focus();}},[confirmation]);
 const request=useCallback(async<T,>(action:string,body?:unknown):Promise<T>=>{
  const response=await fetch(`/updates/index.php?action=${action}`,{method:body===undefined?"GET":"POST",credentials:"same-origin",cache:"no-store",headers:{"Content-Type":"application/json","X-CSRF-Token":csrf},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(60000)});
  const json=await response.json().catch(()=>null);if(!json)throw new Error("Сервер вернул некорректный ответ. Повторите продолжение через восстановление");if(!response.ok){if(response.status===401||json.details?.code==="csrf_expired")window.dispatchEvent(new CustomEvent("bypcms-panel-session",{detail:response.status===401?401:419}));throw new Error(json.error||"Сервер не подтвердил действие");}return json;
 },[csrf]);
 const load=useCallback(async()=>{if(!owner)return;const result=await request<State>(publisher?"publisher":"status");setData(result);},[owner,publisher,request]);
 useEffect(()=>{let live=true;if(owner)void request<State>(publisher?"publisher":"status").then(result=>{if(live)setData(result);},e=>{if(live)setError(e.message);});return()=>{live=false;};},[owner,publisher,request]);
 async function run(action:string,id?:string){
  if(running.current)return;running.current=true;setBusy(true);setError("");setNotice("");setProgress(null);
  try{
   if(action==="publish"){await request("publish",{});setNotice("Подписанный выпуск опубликован");}
   else if(action==="check"){setData(await request<State>("check",{}));setNotice("Каталог и лицензия проверены");}
   else{
    let job:Job;
    if(action==="begin"){
      if(operation.current.package!==id)operation.current={package:id!,id:crypto.randomUUID().replaceAll("-","")};
      job=(await request<{job:Job}>("begin",{package:id,operation_id:operation.current.id})).job;
    }else if(action==="rollback")job=(await request<{job:Job}>("rollback",{id})).job;
    else job={id:id!}as Job;
    for(let i=0;i<10000;i++){job=(await request<{job:Job}>("step",{id:job.id})).job;setProgress(job);if(["completed","rolled_back","failed","recovery_required"].includes(job.state))break;}
    setNotice(states[job.state]||job.state);operation.current={package:"",id:""};
   }
   setConfirmation(null);await load();
  }catch(e){setError((e instanceof Error?e.message:"Запрос прерван")+". Состояние операции сохранено; повторите продолжение или откройте восстановление.");await load().catch(()=>{});}
  finally{running.current=false;setBusy(false);}
 }
 if(!owner)return <section className="licenseWorkspace"><p>Обновления и восстановление доступны владельцу установки.</p></section>;
 return <section className="licenseWorkspace" aria-busy={busy}><header><div><small>{publisher?"ПУБЛИКАЦИЯ ВЫПУСКОВ":"ОБНОВЛЕНИЯ И РЕЗЕРВНЫЕ КОПИИ"}</small><h2>{publisher?"Подписанный каталог":`Текущая версия: ${data?.current?.version||"…"}`}</h2></div><a href="/updates/recovery.php">Независимое восстановление</a></header>
 {error&&<p className="licenseError" role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
 {!data?<button disabled={busy} onClick={()=>void load().catch(e=>setError(e.message))}>Повторить загрузку</button>:<>
 {publisher?<><p>Публикуется подготовленная сборка ядра. Клиент получает её только после проверки лицензии; подпись проверяется перед установкой.</p><button disabled={busy||!data.candidate} onClick={()=>setConfirmation({action:"publish"})}>{data.candidate?`Опубликовать ${data.candidate}`:"Подготовленной сборки пока нет"}</button></>:!data.client?<p>Эта установка — платформа. Выпуски клиентской CMS публикуются в <a href="/owner/?section=updates">Owner Center</a>.</p>:<><p>Перед миграциями сохраняются файлы и вся БД. На время резервирования и установки сайт перейдёт в обслуживание. Если закрыть вкладку, продолжить можно с этого экрана или через независимое восстановление.</p><button disabled={busy||data.maintenance} onClick={()=>void run("check")}>Проверить обновления</button></>}
 {data.releases.length===0&&<p>Выпусков пока нет.</p>}
 {data.client&&data.backup_directory&&<details><summary>Где находятся резервные копии</summary><p>Каталог вне публичной части сайта для внешнего резервирования: <code>{data.backup_directory}</code></p></details>}
 {data.releases.map(release=><article className="licenseConfirm" key={release.id}><b>BYPCMS {release.version}</b><p>С версий: {release.from.join(", ")} · {(release.bytes/1048576).toFixed(1)} МБ</p>{!publisher&&data.client&&(release.compatible?<button disabled={busy||data.maintenance} onClick={()=>setConfirmation({action:"begin",id:release.id})}>Создать копию и обновить</button>:<p>Не подходит для текущей версии или комплектации.</p>)}</article>)}
 {progress&&<p role="status">{states[progress.state]} · {phases[progress.phase]||progress.phase}{progress.phase==="backup_files"?` · ${progress.files_done}/${progress.files_total}`:progress.phase==="backup_database"?` · ${progress.tables_done}/${progress.tables_total}`:""}</p>}
 {data.jobs?.map(job=><article className="licenseConfirm" key={job.id}><b>{job.previous_version} → {job.version}</b><p>{new Date(job.created_at*1000).toLocaleString("ru-RU")} · {states[job.state]} · {phases[job.phase]||job.phase}</p><p>{job.backup_ready?`Копия проверена: файлов ${job.files_total}, таблиц ${job.tables_total}`:"Копия ещё не завершена"}</p>{job.error&&<p className="licenseError">{job.error}</p>}{["running","restoring","recovery_required"].includes(job.state)&&<button disabled={busy} onClick={()=>void run("step",job.id)}>Продолжить процесс</button>}{job.backup_ready&&((job.state==="completed"&&data.current?.release===job.id)||["running","restoring","recovery_required"].includes(job.state))&&<button disabled={busy} onClick={()=>setConfirmation({action:"rollback",id:job.id})}>Восстановить копию</button>}</article>)}
 </>}
 {confirmation&&<dialog ref={confirmationDialog} className="licenseDialog" aria-labelledby="update-confirmation-title" aria-busy={busy} onCancel={event=>{event.preventDefault();if(!busy)setConfirmation(null);}}><h3 id="update-confirmation-title">{confirmation.action==="publish"?"Публикация выпуска":confirmation.action==="rollback"?"Восстановление резервной копии":"Установка обновления"}</h3><p>{confirmation.action==="rollback"?"Вернуть БД и версию к состоянию до обновления? Изменения записей после создания копии будут потеряны.":confirmation.action==="publish"?"Опубликовать подготовленную сборку для клиентских установок?":"Создать резервную копию и установить выпуск? На время операции сайт будет в обслуживании."}</p>{error&&<p className="licenseError" role="alert">{error}</p>}{busy&&<p role="status">{progress?`${states[progress.state]} · ${phases[progress.phase]||progress.phase}`:"Выполняется запрос…"}</p>}<div className="licenseButtons"><button disabled={busy} onClick={()=>void run(confirmation.action,confirmation.id)}>Подтвердить</button><button ref={confirmationCancel} disabled={busy} onClick={()=>setConfirmation(null)}>Отмена</button></div></dialog>}
 </section>;
}
