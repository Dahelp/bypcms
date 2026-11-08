document.querySelector('.g-menu')?.addEventListener('click',event=>{const button=event.currentTarget;const open=button.getAttribute('aria-expanded')!=='true';button.setAttribute('aria-expanded',String(open));document.getElementById('gallery-nav')?.classList.toggle('is-open',open)});
document.addEventListener('keydown',event=>{const menu=document.querySelector('.g-menu');if(event.key==='Escape'&&menu?.getAttribute('aria-expanded')==='true'){menu.setAttribute('aria-expanded','false');document.getElementById('gallery-nav')?.classList.remove('is-open');menu.focus()}});
const lightbox=document.querySelector('.g-lightbox');let source;
document.querySelectorAll('.g-zoom').forEach(button=>button.addEventListener('click',()=>{source=button;lightbox.querySelector('img').src=button.dataset.image;lightbox.showModal()}));
lightbox?.querySelector('button').addEventListener('click',()=>lightbox.close());lightbox?.addEventListener('close',()=>source?.focus());
// Native links/forms keep browser history and work without JavaScript.
document.querySelectorAll('form').forEach(form=>form.addEventListener('submit',event=>{if(form.dataset.confirm&&!confirm(form.dataset.confirm)){event.preventDefault();return}const button=event.submitter;if(button){setTimeout(()=>{button.dataset.busy="1";button.disabled=true},0);setTimeout(()=>{button.disabled=false},20000)}}));
window.addEventListener('pageshow',()=>{
  document.querySelector('.g-menu')?.setAttribute('aria-expanded','false');
  document.getElementById('gallery-nav')?.classList.remove('is-open');
  // History restoration must agree with the server-rendered price/results.
  // Keep POST checkout fields intact so a validation error never clears contact data.
  document.querySelectorAll('form').forEach(form=>{
    if(form.method.toLowerCase()==='get')form.reset();
    if(form.querySelector('input[name="action"][value="quantity"]')){
      const quantity=form.querySelector('input[name="quantity"]');
      if(quantity)quantity.value=quantity.defaultValue;
    }
  });
  document.querySelectorAll('button[disabled]').forEach(button=>{if(button.dataset.busy)button.disabled=false});
});
