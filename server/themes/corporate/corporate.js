/* Ordinary routes and native forms remain usable without JavaScript. */
(()=>{'use strict';const toggle=document.querySelector('.co-menu-toggle'),nav=document.querySelector('#corporate-nav');
const close=()=>{toggle?.setAttribute('aria-expanded','false');nav?.classList.remove('co-open')};
toggle?.addEventListener('click',()=>{const open=toggle.getAttribute('aria-expanded')!=='true';toggle.setAttribute('aria-expanded',String(open));nav?.classList.toggle('co-open',open)});
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&toggle?.getAttribute('aria-expanded')==='true'){close();toggle.focus()}});
document.addEventListener('click',event=>{if(toggle?.getAttribute('aria-expanded')==='true'&&!event.target.closest('.co-header'))close()});
const form=document.querySelector('#business-request');let pending=false;
// A draft belongs to this history entry. Keep the original token on Back so a
// retry returns the same receipt; CSRF always comes from the current response.
const fields=['name','email','phone','message','consent','service_id','project_id','request_token'];
const remember=()=>{if(!form)return;const draft={};for(const name of fields){const field=form.elements.namedItem(name);if(field)draft[name]=field.type==='checkbox'?field.checked:field.value}try{history.replaceState({...history.state,corporateDraft:draft},'')}catch{}};
const restore=()=>{const draft=history.state?.corporateDraft;if(!form||!draft)return;for(const name of fields){const field=form.elements.namedItem(name);if(field&&Object.hasOwn(draft,name)){if(field.type==='checkbox')field.checked=draft[name]===true;else field.value=String(draft[name])}}};
form?.addEventListener('input',remember);form?.addEventListener('change',remember);restore();
window.addEventListener('pageshow',()=>{restore();close();pending=false;const button=form?.querySelector('button[type=submit]');if(button){button.disabled=false;button.removeAttribute('aria-busy')}});
form?.addEventListener('submit',async event=>{if(!window.fetch)return;event.preventDefault();if(pending||!form.reportValidity())return;pending=true;remember();const button=form.querySelector('button[type=submit]'),feedback=form.querySelector('[role=alert]');button.disabled=true;button.setAttribute('aria-busy','true');if(feedback)feedback.hidden=true;
try{const response=await fetch(form.action,{method:'POST',headers:{Accept:'application/json'},body:new FormData(form),signal:AbortSignal.timeout(20000)});let data;try{data=await response.json()}catch{throw Error('Ответ не получен. Введённое сохранено. Повторите отправку — вторая заявка не создастся.')}
if(!response.ok||!data.url)throw Error(data.error||'Не удалось сохранить заявку. Попробуйте ещё раз.');const target=new URL(data.url,location.origin);if(target.origin!==location.origin)throw Error('Некорректный адрес подтверждения.');location.assign(target.href);
}catch(error){if(feedback){feedback.textContent=error.name==='TimeoutError'?'Ответ задерживается. Ваш ввод сохранён. Повторите отправку с этой формы.':error instanceof TypeError?'Не удалось соединиться с сервером. Введённое сохранено. Проверьте соединение и повторите отправку.':error.message;feedback.hidden=false;feedback.scrollIntoView({block:'center'});feedback.setAttribute('tabindex','-1');feedback.focus()}}
finally{pending=false;button.disabled=false;button.removeAttribute('aria-busy')}});
})();
