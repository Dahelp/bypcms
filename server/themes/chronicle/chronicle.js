document.documentElement.classList.add('c-enhanced');
const menu=document.querySelector('.c-menu'),nav=document.getElementById('chronicle-nav');
const closeMenu=()=>{menu?.setAttribute('aria-expanded','false');nav?.classList.remove('is-open')};
menu?.addEventListener('click',()=>{const open=menu.getAttribute('aria-expanded')!=='true';menu.setAttribute('aria-expanded',String(open));nav?.classList.toggle('is-open',open)});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&menu?.getAttribute('aria-expanded')==='true'){closeMenu();menu.focus()}});
window.addEventListener('pageshow',()=>{closeMenu();document.querySelectorAll('.c-filters').forEach(form=>form.reset())});
const prose=document.querySelector('.c-prose');
if(prose){
 document.querySelectorAll('.c-enhancement').forEach(el=>el.hidden=false);
 let size=18;try{const saved=Number(localStorage.getItem('chronicle-reading-size'));if(saved>=16&&saved<=24)size=saved}catch{}
 const updateSize=()=>{prose.style.setProperty('--c-reading-size',size+'px');document.querySelectorAll('[data-reading-size]').forEach(button=>{button.disabled=button.dataset.readingSize==='larger'?size>=24:size<=16})};updateSize();
 document.querySelectorAll('[data-reading-size]').forEach(button=>button.addEventListener('click',()=>{size=Math.max(16,Math.min(24,size+(button.dataset.readingSize==='larger'?2:-2)));updateSize();try{localStorage.setItem('chronicle-reading-size',String(size))}catch{}}));
 const progress=document.querySelector('.c-reading-progress>span');let queued=false;
 const updateProgress=()=>{queued=false;const rect=prose.getBoundingClientRect();const total=Math.max(1,prose.offsetHeight-innerHeight*.5);if(progress)progress.style.width=Math.min(100,Math.max(0,-rect.top/total*100))+'%'};
 addEventListener('scroll',()=>{if(!queued){queued=true;requestAnimationFrame(updateProgress)}},{passive:true});addEventListener('resize',updateProgress);updateProgress();
}
document.querySelector('[data-copy-url]')?.addEventListener('click',async event=>{const button=event.currentTarget,status=document.querySelector('.c-copy-status'),fallback=document.querySelector('.c-copy-fallback');try{await navigator.clipboard.writeText(button.dataset.copyUrl);if(status)status.textContent='Ссылка скопирована'}catch{if(status)status.textContent='Скопируйте ссылку из поля';if(fallback){fallback.hidden=false;fallback.focus();fallback.select()}}});
