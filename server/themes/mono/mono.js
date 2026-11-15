/* Navigation remains ordinary links; the menu is a disclosure. */
(()=>{'use strict';const toggle=document.querySelector('.mo-menu-toggle'),nav=document.querySelector('#mono-nav');
const close=()=>{toggle?.setAttribute('aria-expanded','false');nav?.classList.remove('mo-open')};
toggle?.addEventListener('click',()=>{const open=toggle.getAttribute('aria-expanded')!=='true';toggle.setAttribute('aria-expanded',String(open));nav?.classList.toggle('mo-open',open)});
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&toggle?.getAttribute('aria-expanded')==='true'){close();toggle.focus()}});
document.addEventListener('click',event=>{if(toggle?.getAttribute('aria-expanded')==='true'&&!event.target.closest('.mo-header'))close()});
window.addEventListener('pageshow',close);
})();
