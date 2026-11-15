/* Ordinary routes and native forms remain usable without JavaScript. */
(()=>{'use strict';const toggle=document.querySelector('.co-menu-toggle'),nav=document.querySelector('#corporate-nav');
const close=()=>{toggle?.setAttribute('aria-expanded','false');nav?.classList.remove('co-open')};
toggle?.addEventListener('click',()=>{const open=toggle.getAttribute('aria-expanded')!=='true';toggle.setAttribute('aria-expanded',String(open));nav?.classList.toggle('co-open',open)});
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&toggle?.getAttribute('aria-expanded')==='true'){close();toggle.focus()}});
document.addEventListener('click',event=>{if(toggle?.getAttribute('aria-expanded')==='true'&&!event.target.closest('.co-header'))close()});
window.addEventListener('pageshow',close);
})();
