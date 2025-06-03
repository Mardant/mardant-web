// === js/scripts_inicio.js ===
import { API_URL } from './config.js';

/* Utilidades */
const $ = sel => document.querySelector(sel);
const escapeHtml = t => typeof t === 'string'
  ? t.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;').replace(/'/g,'&#039;')
  : t;
const limitarProductos = arr => arr.slice(0,4).map((p,i)=>({...p,soloDesktop:i===3}));

/* Helpers de red */
const fetchJSON = accion =>
  fetch(`${API_URL}?accion=${accion}`)
    .then(r => { if(!r.ok) throw new Error('API'); return r.json(); });

/* ====== Últimas importaciones ====== */
fetchJSON('productos')
  .then(r => r.sort((a,b)=>b.id-a.id))
  .then(limitarProductos)
  .then(lista => {
    const c=$("#ultimas-importaciones"); c.innerHTML='';
    lista.forEach(p=>{
      const estado=(p.estado||'').toUpperCase().includes('SIN STOCK')?'AGOTADO':'DISPONIBLE';
      const estadoClase=estado==='DISPONIBLE'?'estado en-stock':'estado';
      const div=document.createElement('div');
      div.className='producto'+(p.soloDesktop?' mostrar-solo-desktop':'');
      div.innerHTML=`
        <img src="${p.imagen}" alt="${escapeHtml(p.nombre)}" class="img" loading="lazy">
        <div class="nombre">${escapeHtml(p.nombre)}</div>
        <div class="precio">S/. ${parseFloat(p.precio).toFixed(2)}</div>
        <div class="${estadoClase}">${estado}</div>
        <a href="https://wa.me/51985135331?text=${encodeURIComponent('Hola, me interesa el producto: '+p.nombre)}" class="boton" target="_blank">📢 Pedir por WhatsApp</a>`;
      c.appendChild(div);
    });
  })
  .catch(console.error);

fetchJSON('preventas')

  .then(limitarProductos)

  .then(lista => {

    const c=$("#productos-preventa"); c.innerHTML="";

    lista.forEach(p=>{

      const img = p.imagen?.trim() ? escapeHtml(p.imagen)

        : 'https://via.placeholder.com/300x300?text=Sin+imagen';

      const urlWA = 'https://wa.me/51985135331?text='+

                    encodeURIComponent('Hola, estoy interesado en la preventa: '+p.nombre);

      const div=document.createElement('div');

      div.className='producto'+(p.soloDesktop?' mostrar-solo-desktop':'');

      div.innerHTML=`

        <img src="${img}" alt="${escapeHtml(p.nombre)}" class="img" loading="lazy">

        <div class="nombre">${escapeHtml(p.nombre)}</div>

        <div class="precio">S/. ${(+p.precio||0).toFixed(2)}</div>

        <a href="${urlWA}" target="_blank" class="boton">📩 Pedir por WhatsApp</a>`;

      c.appendChild(div);

    });

  })

  .catch(console.error);


/* ====== Disponibles a pedido ====== */
fetchJSON('pedidosDisponibles')
  .then(lista => lista
        .filter(p => (p.estado||'').toUpperCase()==='DISPONIBLE A PEDIDO')
        .sort((a,b)=>b.id-a.id))
  .then(limitarProductos)
  .then(lista=>{
    const c=$("#pedidos-disponibles"); c.innerHTML='';
    lista.forEach(p=>{
      /* — precios aéreo / barco — */
      const precA = parseFloat(p.precioAereo ?? p.precio ?? 0).toFixed(2);   // ✈️
      const precB = parseFloat(p.precioBarco ?? p.precio ?? 0).toFixed(2);   // 🚢

      const div=document.createElement('div');
      div.className='producto'+(p.soloDesktop?' mostrar-solo-desktop':'');
      div.innerHTML=`
        <img src="${p.imagen}" alt="${escapeHtml(p.nombre)}" class="img" loading="lazy">
        <div class="nombre">${escapeHtml(p.nombre)}</div>
        <div class="precio">
          ✈️ S/. ${precA}<br>
          🚢 S/. ${precB}
        </div>
        <div class="estado">${escapeHtml(p.estado)}</div>
        <a href="https://wa.me/51985135331?text=${encodeURIComponent('Hola, me interesa el producto: '+p.nombre)}"
           class="boton" target="_blank">📩 Pedir por WhatsApp</a>`;
      c.appendChild(div);
    });
  })
  .catch(console.error);

/* ====== Productos en oferta ====== */
fetchJSON('productos')
  .then(lista => lista.filter(p=>p.oferta&&!isNaN(p.oferta)).sort((a,b)=>b.id-a.id))
  .then(limitarProductos)
  .then(lista=>{
    const c=$("#productos-oferta"); c.innerHTML='';
    lista.forEach(p=>{
      const nombre=escapeHtml(p.nombre);
      const html = `
        <img src="${p.imagen}" alt="${nombre}" class="img" loading="lazy">
        <div class="nombre">${nombre}</div>
        <div class="precio">
          <span style="text-decoration:line-through;color:#bbb;">S/. ${parseFloat(p.precio).toFixed(2)}</span><br>
          <span style="color:#ffee58;font-weight:bold;font-size:22px;">S/. ${parseFloat(p.oferta).toFixed(2)}</span>
        </div>
        <div class="estado en-stock">OFERTA</div>
        <a href="https://wa.me/51985135331?text=${encodeURIComponent('Hola, me interesa el producto: '+nombre)}" class="boton" target="_blank">🔥 Pedir por WhatsApp</a>`;
      const div=document.createElement('div');
      div.className='producto'+(p.soloDesktop?' mostrar-solo-desktop':'');
      div.innerHTML=html;
      c.appendChild(div);
    });
  })
  .catch(console.error);

/* ====== Carrusel ====== */
const slides=document.querySelectorAll('.carrusel img');
const ind=$("#indicadores");
slides.forEach((_,i)=>{
  const d=document.createElement('div');
  d.className='punto';
  d.onclick=()=>{idx=i;show();};
  ind.appendChild(d);
});
const puntos=document.querySelectorAll('.punto');
let idx=0;
const show=()=>{
  slides.forEach((s,i)=>s.classList.toggle('activo',i===idx));
  puntos.forEach((p,i)=>p.classList.toggle('activo',i===idx));
};
setInterval(()=>{idx=(idx+1)%slides.length;show();},8000);
show();
