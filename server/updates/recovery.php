<?php
declare(strict_types=1);
// This page has no dependency on the active release, its scripts, or the database schema.
session_name('bypcms_session');session_set_cookie_params(['path'=>'/','secure'=>!empty($_SERVER['HTTPS'])&&$_SERVER['HTTPS']!=='off','httponly'=>true,'samesite'=>'Lax']);session_start();$_SESSION['csrf']??=bin2hex(random_bytes(24));
header('Cache-Control: no-store');header('X-Frame-Options: SAMEORIGIN');header('X-Robots-Tag: noindex, nofollow');
$csrf=htmlspecialchars($_SESSION['csrf'],ENT_QUOTES,'UTF-8');
?><!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Восстановление BYPCMS</title><style>body{font:16px/1.6 system-ui;background:#f1f4ef;color:#26362b;max-width:850px;margin:30px auto;padding:20px}section{background:#fff;border:1px solid #ccd8c9;border-radius:12px;padding:24px;margin:20px 0}label{display:grid;margin:15px 0;gap:6px}input,button{font:inherit;padding:12px;border:1px solid #b6c6b1;border-radius:7px;box-sizing:border-box;max-width:100%}button{cursor:pointer;margin:5px 8px 5px 0}pre{white-space:pre-wrap;overflow-wrap:anywhere}.error{color:#923f2d}button:disabled{opacity:.5}h1,h2,p{overflow-wrap:anywhere}@media(max-width:600px){body{margin:0 auto;padding:16px}section{padding:16px}h1{font-size:27px}button{min-height:44px}}</style></head><body><a href="/admin/?section=updates">← В панель обновлений</a><h1>Восстановление BYPCMS</h1><p>Этот экран работает независимо от установленной версии. Возобновите прерванный процесс либо восстановите копию до обновления.</p><p id="message" role="status"></p><section id="login"><h2>Вход владельца</h2><form id="form"><label>Email<input name="email" type="email" required autocomplete="username"></label><label>Пароль<input name="password" type="password" required autocomplete="current-password"></label><button>Войти</button></form></section><section id="jobs" hidden></section><script>
let csrf=<?= json_encode(html_entity_decode($csrf,ENT_QUOTES)) ?>,busy=false;const message=document.querySelector('#message'),jobs=document.querySelector('#jobs'),login=document.querySelector('#login');
async function request(action,body){const response=await fetch('/updates/index.php?action='+action,{method:body?'POST':'GET',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json','X-CSRF-Token':csrf},body:body?JSON.stringify(body):undefined});const data=await response.json();if(!response.ok)throw Object.assign(new Error(data.error||'Ошибка запроса'),{status:response.status});return data;}
const stateLabels={running:'Выполняется',restoring:'Выполняется откат',recovery_required:'Нужно продолжить восстановление',completed:'Обновление установлено',rolled_back:'Предыдущая версия восстановлена',failed:'Обновление не начато'};
const phaseLabels={download:'Загрузка и проверка пакета',preflight:'Проверка совместимости и места',backup_files:'Резервная копия файлов',backup_database:'Резервная копия БД',migrations:'Миграции БД',switch:'Переключение версии',health:'Проверка новой версии',restore_prepare:'Проверка резервной копии',restore_database:'Восстановление БД',restore_files:'Восстановление файлов',restore_pointer:'Возврат предыдущей версии',done:'Завершено'};
const jobStatus=job=>(stateLabels[job.state]||job.state)+' · '+(phaseLabels[job.phase]||job.phase);
async function load(){
  try{
    const data=await request('status');login.hidden=true;jobs.hidden=false;jobs.replaceChildren();
    if(message.className==='error'){message.textContent='';message.className='';}
    const current=document.createElement('p');current.textContent='Текущая версия: '+data.current.version+(data.maintenance?' · сайт в режиме обслуживания':'');jobs.append(current);
    for(const job of data.jobs){
      const active=['running','restoring','recovery_required'].includes(job.state);
      const box=document.createElement('section'),title=document.createElement('h2'),text=document.createElement('p');
      title.textContent=job.previous_version+' → '+job.version;text.textContent=(job.created_at?new Date(job.created_at*1000).toLocaleString('ru-RU')+' · ':'')+jobStatus(job)+(job.error?' · '+job.error:'');box.append(title,text);
      if(active){const resume=document.createElement('button');resume.textContent='Продолжить процесс';resume.onclick=()=>run(job.id,false);box.append(resume);}
      if(job.backup_ready&&(active||(job.state==='completed'&&data.current.release===job.id))){
        const restore=document.createElement('button');restore.textContent='Восстановить копию до обновления';
        restore.onclick=()=>{if(confirm('Вернуть БД и версию к состоянию до обновления? Изменения записей после создания копии будут потеряны.'))run(job.id,true);};box.append(restore);
      }
      jobs.append(box);
    }
    if(!data.jobs.length){const empty=document.createElement('p');empty.textContent='Операций обновления пока нет.';jobs.append(empty);}
  }catch(error){login.hidden=error.status!==401;if(error.status===401)jobs.hidden=true;message.textContent=error.message;message.className='error';}
}
async function run(id,rollback){
  if(busy)return;busy=true;message.className='';document.querySelectorAll('button').forEach(b=>b.disabled=true);
  try{
    if(rollback)await request('rollback',{id});
    for(let i=0;i<10000;i++){const {job}=await request('step',{id});message.textContent=jobStatus(job);if(['completed','rolled_back','failed','recovery_required'].includes(job.state))break;}
    await load();
  }catch(error){message.textContent=error.message+' Повторите продолжение; состояние сохранено.';message.className='error';}
  finally{busy=false;document.querySelectorAll('button').forEach(b=>b.disabled=false);}
}
document.querySelector('#form').onsubmit=async event=>{event.preventDefault();try{const form=new FormData(event.target);const result=await request('recover.login',Object.fromEntries(form));csrf=result.csrf;event.target.reset();await load();}catch(error){message.textContent=error.message;}};
load();
</script></body></html>
