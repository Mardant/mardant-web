import './site-footer.js?v=6';
import {ensureAccountWidget} from './account-widget.js?v=5';
import {actualizarCarritoUI} from './carrito-utils.js?v=2';

function syncStoreControls(){
  ensureAccountWidget();
  try{actualizarCarritoUI();}catch{}
}
function setup(){
  syncStoreControls();
  if('IntersectionObserver' in window){
    const observer=new IntersectionObserver(entries=>{
      for(const entry of entries)if(entry.target.id==='grid')document.body.classList.toggle('floating-controls-clear-content',entry.isIntersecting);
    });
    const grid=document.getElementById('grid');if(grid)observer.observe(grid);
  }
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup,{once:true});else setup();
window.addEventListener('pageshow',syncStoreControls);
window.addEventListener('storage',()=>{try{actualizarCarritoUI();}catch{}});
