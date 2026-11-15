/* Ordinary HTTP links; the shared Business handler owns enquiries and history. */
(()=>{'use strict';
const toggle=document.querySelector('.a-menu-toggle'),nav=document.querySelector('#atelier-nav');
const closeMenu=()=>{toggle?.setAttribute('aria-expanded','false');nav?.classList.remove('a-open')};
toggle?.addEventListener('click',()=>{const open=toggle.getAttribute('aria-expanded')!=='true';toggle.setAttribute('aria-expanded',String(open));nav?.classList.toggle('a-open',open)});
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&toggle?.getAttribute('aria-expanded')==='true'){closeMenu();toggle.focus()}});
window.addEventListener('pageshow',closeMenu);
})();
