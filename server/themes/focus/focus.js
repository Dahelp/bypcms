document.documentElement.classList.add('f-enhanced');
const menu=document.querySelector('.f-menu'),nav=document.getElementById('focus-nav');
const closeMenu=()=>{menu?.setAttribute('aria-expanded','false');nav?.classList.remove('is-open')};
menu?.addEventListener('click',()=>{const open=menu.getAttribute('aria-expanded')!=='true';menu.setAttribute('aria-expanded',String(open));nav?.classList.toggle('is-open',open)});
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&menu?.getAttribute('aria-expanded')==='true'){closeMenu();menu.focus()}});

const prose=document.querySelector('.f-prose');
if(prose){
 document.querySelectorAll('.f-reading-controls').forEach(el=>el.hidden=false);
 let size=18;try{const value=Number(localStorage.getItem('focus-reading-size'));if(value>=16&&value<=24)size=value}catch{}
 const update=()=>{prose.style.setProperty('--f-reading-size',size+'px');document.querySelectorAll('[data-size]').forEach(button=>button.disabled=button.dataset.size==='larger'?size>=24:size<=16)};update();
 document.querySelectorAll('[data-size]').forEach(button=>button.addEventListener('click',()=>{size=Math.max(16,Math.min(24,size+(button.dataset.size==='larger'?2:-2)));update();try{localStorage.setItem('focus-reading-size',String(size))}catch{}}));
 const progress=document.querySelector('.f-progress>span');let queued=false;
 const draw=()=>{queued=false;const rect=prose.getBoundingClientRect();if(progress)progress.style.width=Math.max(0,Math.min(100,-rect.top/Math.max(1,prose.offsetHeight-innerHeight*.5)*100))+'%'};
 addEventListener('scroll',()=>{if(!queued){queued=true;requestAnimationFrame(draw)}},{passive:true});addEventListener('resize',draw);draw();
}
document.querySelector('[data-copy-url]')?.addEventListener('click',async event=>{const status=document.querySelector('.f-copy-status'),fallback=document.querySelector('.f-copy-fallback');try{await navigator.clipboard.writeText(event.currentTarget.dataset.copyUrl);status.textContent='Ссылка скопирована'}catch{status.textContent='Скопируйте ссылку из поля';fallback.hidden=false;fallback.focus();fallback.select()}});

const box=document.querySelector('.f-lightbox');
if(box&&typeof box.showModal==='function'){
 const links=[...document.querySelectorAll('a[data-focus-photo]')];
 const entries=[...new Map(links.map(link=>[Number(link.dataset.focusPhoto),{url:link.href,caption:link.dataset.caption||'',source:link}])).entries()].sort((a,b)=>a[0]-b[0]).map(([number,item])=>({...item,number}));
 const image=box.querySelector('img'),counter=box.querySelector('[data-photo-counter]'),caption=box.querySelector('[data-photo-caption]'),previous=box.querySelector('[data-photo-prev]'),next=box.querySelector('[data-photo-next]'),close=box.querySelector('[data-photo-close]'),status=box.querySelector('[data-photo-status]'),retry=box.querySelector('[data-photo-retry]'),original=box.querySelector('[data-photo-original]');
 let current=0,source=null,returnY=0,closing=false,guardUntil=0,guardPoint=null;
 document.addEventListener('click',event=>{if(!box.open&&guardPoint&&Date.now()<guardUntil&&Math.abs(event.clientX-guardPoint.x)<25&&Math.abs(event.clientY-guardPoint.y)<25){event.preventDefault();event.stopImmediatePropagation();}},true);
 function show(index){
  if(index<0||index>=entries.length)return;
  current=index;const item=entries[index];image.classList.add('is-loading');status.textContent='Загрузка фотографии…';retry.hidden=true;
  image.alt=item.caption||'Фотография '+(index+1);caption.textContent=item.caption;counter.textContent=(index+1)+' / '+entries.length;previous.disabled=index===0;next.disabled=index===entries.length-1;original.href=item.url;image.src=item.url;
  if(!box.open){returnY=scrollY;box.showModal();document.documentElement.classList.add('f-modal-open');close.focus()}
  closing=false;close.disabled=false;
 }
 function loaded(){image.classList.remove('is-loading');status.textContent='';retry.hidden=true}
 image.addEventListener('load',loaded);image.addEventListener('error',()=>{status.textContent='Не удалось загрузить фотографию. Можно повторить или открыть оригинал.';retry.hidden=false;image.classList.add('is-loading')});
 retry.addEventListener('click',()=>{retry.hidden=true;status.textContent='Повторная загрузка…';image.src=entries[current].url});
 function cleanClose(){if(!box.open)return;box.close();document.documentElement.classList.remove('f-modal-open');closing=false;close.disabled=false;if(source?.isConnected){source.focus({preventScroll:true});requestAnimationFrame(()=>scrollTo(0,returnY))}}
 function sync(){const match=location.hash.match(/^#photo-(\d+)$/);const index=match?entries.findIndex(item=>item.number===Number(match[1])):-1;if(index>=0)show(index);else cleanClose()}
 function requestClose(){if(closing)return;closing=true;close.disabled=true;if(history.state?.focusLightbox&&/^#photo-\d+$/.test(location.hash))history.back();else{history.replaceState(history.state,'',location.pathname+location.search);cleanClose()}}
 function step(delta){const index=current+delta;if(index<0||index>=entries.length||closing)return;history.replaceState({...history.state,focusLightbox:true},'',location.pathname+location.search+'#photo-'+entries[index].number);show(index)}
 links.forEach(link=>link.addEventListener('click',event=>{if(event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;const index=entries.findIndex(item=>item.number===Number(link.dataset.focusPhoto));if(index<0)return;event.preventDefault();source=link;if(box.open)history.replaceState({...history.state,focusLightbox:true},'',location.pathname+location.search+'#photo-'+entries[index].number);else history.pushState({...history.state,focusLightbox:true},'',location.pathname+location.search+'#photo-'+entries[index].number);show(index)}));
 previous.addEventListener('click',()=>step(-1));next.addEventListener('click',()=>step(1));close.addEventListener('click',event=>{guardPoint={x:event.clientX,y:event.clientY};guardUntil=Date.now()+550;requestClose()});
 box.addEventListener('cancel',event=>{event.preventDefault();requestClose()});box.addEventListener('keydown',event=>{if(event.key==='ArrowLeft'){event.preventDefault();step(-1)}if(event.key==='ArrowRight'){event.preventDefault();step(1)}});
 addEventListener('popstate',sync);addEventListener('pageshow',sync);sync();
}
addEventListener('pageshow',()=>{closeMenu();document.querySelectorAll('.f-filters').forEach(form=>form.reset())});
