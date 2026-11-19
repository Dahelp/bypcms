<?php
declare(strict_types=1);
if(!defined('BYPCMS_ROOT'))return;
$releaseEscape=static fn($s)=>htmlspecialchars((string)$s,ENT_QUOTES|ENT_SUBSTITUTE,'UTF-8');
?>
<div style="font-size:13px;color:#52665c;margin-bottom:16px">BYPCMS <?= $releaseEscape(ucfirst($config['app']['edition']??'')) ?> · версия <?= $releaseEscape($config['app']['version']??'') ?> · клиентская CMS</div>
<?php if(($user['role']??'')==='owner'): ?>
<aside id="client-release-notice" hidden style="border:1px solid #cad5cb;padding:16px;border-radius:12px;background:#f0f6e9;margin-bottom:20px" aria-live="polite"><p></p><a href="/admin/?section=updates">Обновления и подробности →</a> <button type="button" hidden>Скрыть уведомление</button></aside>
<script>
(()=>{const box=document.getElementById('client-release-notice'),text=box.querySelector('p'),button=box.querySelector('button');let latest='',running=false,polls=0;const csrf=<?= json_encode($_SESSION['csrf'],JSON_HEX_TAG|JSON_HEX_AMP|JSON_HEX_APOS|JSON_HEX_QUOT) ?>;
async function request(action,body){const r=await fetch('/api/index.php?action=client.updates.'+action,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','X-CSRF-Token':csrf},body:JSON.stringify(body||{}),signal:AbortSignal.timeout(25000)});const data=await r.json();if(!r.ok)throw Error(data.error||'Проверка временно недоступна');return data;}
function show(data){const d=data.discovery;latest=d.latest?.id||'';box.hidden=!((d.latest&&d.unread)||d.error);text.textContent=d.error?'Не удалось проверить выпуски. Рабочая версия не изменена.':`Доступен выпуск BYPCMS ${d.latest?.version}. Установка начнётся только после вашего подтверждения.`;button.hidden=!(d.latest&&d.unread);}
async function check(){if(running)return;running=true;try{const data=await request('discover');if(data.checking&&polls++<25)setTimeout(check,1000);else{polls=0;show(data);}}catch{box.hidden=false;text.textContent='Проверка выпусков временно недоступна. Рабочая версия не изменена.';}finally{running=false;}}
button.addEventListener('click',async()=>{button.disabled=true;try{show(await request('read',{id:latest}));}catch{text.textContent='Не удалось скрыть уведомление. Повторите позже.';}finally{button.disabled=false;}});
check();setInterval(check,21600000);})();
</script>
<?php endif ?>
