const CATALOG_BASE='https://mardant-calendario-japon.pages.dev/';
const IMAGE_PATH=/^images\/MD-[A-Z2-9]{5}-[a-f0-9]{16}\.webp$/;
export const peruToday=(now=new Date())=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Lima',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);

export function chooseLaunches(products,count=3,previousCodes=[],random=Math.random,today=peruToday()){
  const unique=new Map();
  for(const item of products){
    if(!item||!['lanzamientos','gashapones'].includes(item.section)||!/^MD-[A-Z2-9]{5}$/.test(item.code)||!IMAGE_PATH.test(item.image)||!item.end_date||item.end_date<today)continue;
    unique.set(item.code,item);
  }
  const eligible=[...unique.values()],previous=new Set(previousCodes);
  const fresh=eligible.filter(item=>!previous.has(item.code));
  const pool=(fresh.length>=Math.min(count,eligible.length)?fresh:eligible).slice();
  const length=Math.min(count,pool.length);
  for(let i=0;i<length;i++){
    const j=i+Math.floor(random()*(pool.length-i));
    [pool[i],pool[j]]=[pool[j],pool[i]];
  }
  return pool.slice(0,length);
}

function inquiry(item){
  const intro='Hola, Mardant. Quiero consultar por el lote '+item.code;
  if(item.label.toLowerCase().startsWith('semana'))return intro+', anunciado para la '+item.label.toLowerCase()+'.';
  return intro+', anunciado para '+(['exact_date','shipping_date'].includes(item.date_type)?'el ':'')+item.label+'.';
}

function initCalendarHome(){
  const section=document.getElementById('home-calendario-lanzamientos');
  const grid=document.getElementById('calendario-lanzamientos-home');
  if(!section||!grid)return;
  let products=[],shown=[],loaded=false,inView=false,loading=false,lastFetchAt=0,version=null;
  function status(text){const message=document.createElement('p');message.className='home-section-status';message.setAttribute('role','status');message.textContent=text;grid.replaceChildren(message);}
  function rotate(){
    const next=chooseLaunches(products,3,shown.map(item=>item.code));
    if(!next.length){status('Revisa el calendario para conocer los próximos lanzamientos.');return;}
    shown=next;const cards=[];
    for(const item of shown){
      const card=document.createElement('article');card.className='producto calendar-home-card';card.dataset.code=item.code;
      const image=document.createElement('img');image.className='img calendar-home-photo';image.src=CATALOG_BASE+item.image;image.alt='Lote '+item.code;image.loading='lazy';image.draggable=false;
      const name=document.createElement('div');name.className='nombre';name.textContent='Lote '+item.code;
      const date=document.createElement('div');date.className='calendar-home-date';date.textContent=item.label;
      const badge=document.createElement('div');badge.className='estado';badge.textContent=item.section==='gashapones'?'GASHAPON':'LANZAMIENTO';
      const consult=document.createElement('a');consult.className='boton';consult.textContent='Consultar por WhatsApp';consult.href='https://wa.me/51985135331?text='+encodeURIComponent(inquiry(item));consult.target='_blank';consult.rel='noopener noreferrer';
      card.append(image,name,date,badge,consult);cards.push(card);
    }
    grid.replaceChildren(...cards);
  }
  async function load(){
    if(loading)return;loaded=true;loading=true;
    const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),20000);
    try{
      const response=await fetch(CATALOG_BASE+'catalog.json',{cache:'no-cache',credentials:'omit',signal:controller.signal});
      if(!response.ok)throw Error('catalog');
      const data=await response.json();if(data.schema!==1||!Array.isArray(data.products))throw Error('schema');
      if(version!==data.generated_at||!products.length){products=data.products;version=data.generated_at;rotate();}
    }catch{if(!products.length)status('Puedes consultar los lanzamientos en el calendario completo.');}
    finally{clearTimeout(timeout);loading=false;lastFetchAt=Date.now();}
  }
  if('IntersectionObserver' in window){
    const loader=new IntersectionObserver(entries=>{if(entries.some(entry=>entry.isIntersecting)){void load();loader.disconnect();}},{rootMargin:'500px'});loader.observe(section);
    const visibility=new IntersectionObserver(([entry])=>{inView=entry.isIntersecting;},{threshold:0.01});visibility.observe(section);
  }else{inView=true;void load();}
  function refresh(){if(loaded&&!document.hidden&&Date.now()-lastFetchAt>=5*60000)void load();}
  setInterval(refresh,60000);document.addEventListener('visibilitychange',refresh);
  if(!window.matchMedia('(prefers-reduced-motion: reduce)').matches){
    setInterval(()=>{if(products.length&&inView&&!document.hidden&&!section.matches(':hover')&&!section.contains(document.activeElement))rotate();},15000);
  }
}
if(typeof document!=='undefined'){
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initCalendarHome,{once:true});else initCalendarHome();
}
