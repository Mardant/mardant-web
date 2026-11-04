'use strict';
const $=id=>document.getElementById(id);
let catalog=null,section='lanzamientos',period='day',page=1;
const pageSize=20;
const publicCatalogBase='https://mardant-calendario-japon.pages.dev/';
const todayJapan=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const isoDay=date=>date.toISOString().slice(0,10);
function currentRange(mode,anchor=todayJapan()){
  if(mode==='day')return[anchor,anchor];
  const date=new Date(anchor+'T00:00:00Z');
  if(mode==='week'){
    const monday=new Date(date);monday.setUTCDate(date.getUTCDate()-(date.getUTCDay()+6)%7);
    const sunday=new Date(monday);sunday.setUTCDate(monday.getUTCDate()+6);
    return[isoDay(monday),isoDay(sunday)];
  }
  return[anchor.slice(0,7)+'-01',isoDay(new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth()+1,0)))];
}
function matchesPeriod(product,range,mode){
  if(!product.start_date||!product.end_date)return false;
  if(mode==='day'&&!['exact_date','shipping_date'].includes(product.date_type))return false;
  if(mode==='week'&&!['exact_date','shipping_date','week'].includes(product.date_type))return false;
  return product.start_date<=range[1]&&product.end_date>=range[0];
}
function stale(product){return !product.checked_at||Date.now()-Date.parse(product.checked_at)>36*3600*1000;}
function messageFor(product){const prefix='Hola, Mardant. Quiero consultar por el lote '+product.code;if(product.section==='pokemon')return prefix+' de Pokémon.';if(product.section==='preventas')return prefix+' en preventa.';if(product.label.toLowerCase().startsWith('semana'))return prefix+', anunciado para la '+product.label.toLowerCase()+'.';if(!product.start_date)return prefix+', con fecha de lanzamiento por confirmar.';return prefix+', anunciado para '+(['exact_date','shipping_date'].includes(product.date_type)?'el ':'')+product.label+'.';}
function rangeLabel(range){
  const day=value=>new Intl.DateTimeFormat('es-PE',{day:'numeric',month:'long',timeZone:'UTC'}).format(new Date(value+'T00:00:00Z'));
  if(period==='day')return'Hoy, '+day(range[0])+' · Japón';
  if(period==='week')return'Del '+day(range[0])+' al '+day(range[1])+' · Japón';
  return new Intl.DateTimeFormat('es-PE',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(range[0]+'T00:00:00Z'))+' · Japón';
}
function render(){
  if(!catalog)return;
  const dated=section==='lanzamientos'||section==='gashapones',range=currentRange(period);
  const rows=catalog.products.filter(p=>p.section===section&&(!dated||matchesPeriod(p,range,period)));
  const pages=Math.max(1,Math.ceil(rows.length/pageSize));page=Math.min(page,pages);
  $('period-controls').hidden=!dated;
  document.querySelectorAll('[data-period]').forEach(button=>{const active=button.dataset.period===period;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));});
  $('count').textContent=rows.length+(rows.length===1?' producto':' productos');
  $('context').textContent=section==='pokemon'?'Disponibilidad sujeta a confirmación':section==='preventas'?'Preventas sujetas a confirmación':rangeLabel(range);
  $('page').textContent='Página '+page+' de '+pages;$('prev').disabled=page===1;$('next').disabled=page===pages;
  const grid=$('grid');grid.replaceChildren();
  for(const p of rows.slice((page-1)*pageSize,page*pageSize)){
    const card=document.createElement('article');card.className='card';
    const wrap=document.createElement('div');wrap.className='photo-wrap';
    const img=document.createElement('img');img.className='photo';img.src=p.image;img.alt='Producto '+p.code+' · Mardant';img.loading='lazy';img.draggable=false;wrap.append(img);
    const info=document.createElement('div');info.className='info';
    const timing=document.createElement('div');timing.className='date';
    const label=document.createElement('span');label.className='date-label';label.textContent=section==='pokemon'?'Disponibilidad':section==='preventas'?'Preventa':p.date_type.startsWith('shipping')?'Envío':'Lanzamiento';
    const value=document.createElement('span');value.className='date-value';value.textContent=section==='pokemon'?(stale(p)?'Por confirmar':'Disponible'):p.label;timing.append(label,value);
    const code=document.createElement('div');code.className='code';const strong=document.createElement('strong');strong.textContent=p.code;code.append(document.createTextNode('Código: '),strong);
    const consult=document.createElement('a');consult.className='consult';consult.textContent='Consultar por WhatsApp';consult.href='https://wa.me/51985135331?text='+encodeURIComponent(messageFor(p));consult.target='_blank';consult.rel='noopener noreferrer';
    info.append(timing,code,consult);card.append(wrap,info);grid.append(card);
  }
  if(!rows.length){const empty=document.createElement('div');empty.className='empty';empty.textContent=dated?'No hay lanzamientos confirmados para '+(period==='day'?'hoy. Revisa también Semana o Mes.':period==='week'?'esta semana. Revisa también Mes.':'este mes.'):'No hay productos disponibles en esta categoría.';grid.append(empty);}
}
function setup(){
  document.querySelectorAll('[data-section]').forEach(button=>button.addEventListener('click',()=>{section=button.dataset.section;page=1;document.querySelectorAll('[data-section]').forEach(b=>b.classList.toggle('active',b===button));render();}));
  document.querySelectorAll('[data-period]').forEach(button=>button.addEventListener('click',()=>{period=button.dataset.period;page=1;render();}));
  for(const[id,delta]of[['prev',-1],['next',1]])$(id).addEventListener('click',()=>{page+=delta;render();$('grid').scrollIntoView({behavior:'smooth',block:'start'});});
  fetch(publicCatalogBase+'catalog.json',{cache:'no-cache',credentials:'omit'}).then(r=>{if(!r.ok)throw Error('load');return r.json();}).then(data=>{if(data.schema!==1||!Array.isArray(data.products))throw Error('schema');catalog={...data,products:data.products.map(product=>{if(!/^images\/MD-[A-Z2-9]{5}-[a-f0-9]{16}\.webp$/.test(product.image))throw Error('image');return {...product,image:publicCatalogBase+product.image};})};render();}).catch(()=>{const error=document.createElement('div');error.className='empty';error.textContent='No pudimos cargar el catálogo. Recarga la página en unos momentos.';$('grid').replaceChildren(error);});
  let previousDay=todayJapan();setInterval(()=>{const nextDay=todayJapan();if(nextDay!==previousDay){previousDay=nextDay;page=1;render();}},60000);
}
if(typeof document!=='undefined')setup();
