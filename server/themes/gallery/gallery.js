document.querySelector('.g-menu')?.addEventListener('click',event=>{const button=event.currentTarget;const open=button.getAttribute('aria-expanded')!=='true';button.setAttribute('aria-expanded',String(open));document.getElementById('gallery-nav')?.classList.toggle('is-open',open)});
const lightbox=document.querySelector('.g-lightbox');let source;
document.querySelectorAll('.g-zoom').forEach(button=>button.addEventListener('click',()=>{source=button;lightbox.querySelector('img').src=button.dataset.image;lightbox.showModal()}));
lightbox?.querySelector('button').addEventListener('click',()=>lightbox.close());lightbox?.addEventListener('close',()=>source?.focus());
// Native links/forms keep browser history and work without JavaScript.
document.querySelectorAll('form').forEach(form=>form.addEventListener('submit',event=>{if(form.dataset.confirm&&!confirm(form.dataset.confirm)){event.preventDefault();return}const button=event.submitter;if(button){setTimeout(()=>{button.dataset.busy="1";button.disabled=true},0);setTimeout(()=>{button.disabled=false},20000)}}));
window.addEventListener('pageshow',()=>document.querySelectorAll('button[disabled]').forEach(button=>{if(button.dataset.busy)button.disabled=false}));
