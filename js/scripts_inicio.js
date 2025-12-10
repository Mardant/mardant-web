// === js/scripts_inicio.js ===
import { API_URL, AUTH_KEYS } from './config.js';

/* Utilidades */
const $ = sel => document.querySelector(sel);
const escapeHtml = t => typeof t === 'string'
  ? t.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;').replace(/'/g,'&#039;')
  : t;
const limitarProductos = arr => arr.slice(0,4).map((p,i)=>({...p,soloDesktop:i===3}));

/* ====== Botón "Mi cuenta" ====== */
const KEYS = {
  TOKEN:  (AUTH_KEYS && AUTH_KEYS.TOKEN)  || 'mardant_token',
  NAME:   (AUTH_KEYS && AUTH_KEYS.NAME)   || 'mardant_name',
  CLIENT: (AUTH_KEYS && AUTH_KEYS.CLIENT) || 'mardant_client'
};

function ensureCuentaButton() {
  // Si el HTML ya trae el botón (con id="btnCuenta"), lo usamos; si no, lo creamos.
  let btn = document.getElementById('btnCuenta');
  if (!btn) {
    btn = document.createElement('a');
    btn.id = 'btnCuenta';
    btn.className = 'boton-cuenta-flotante';
    btn.href = './cuenta.html';
    btn.innerHTML = `<span class="emoji">👤</span><span class="texto">Entrar</span>`;
    document.body.appendChild(btn);
  }

  const hasToken = !!localStorage.getItem(KEYS.TOKEN);
  const name = (localStorage.getItem(KEYS.NAME) || '').trim();
  const short = name ? (name.split(' ')[0]) : '';

  const texto = hasToken
    ? (short ? `Mi cuenta / ${short}` : 'Mi cuenta')
    : 'Entrar';

  btn.innerHTML = `<span class="emoji">👤</span><span class="texto">${texto}</span>`;
  btn.title = hasToken ? 'Ver mi cuenta' : 'Iniciar sesión';
  btn.href = './cuenta.html';
}

// Corre apenas el DOM esté listo (este archivo se carga al final, pero por si acaso)
document.addEventListener('DOMContentLoaded', ensureCuentaButton);

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
        <div class="precio">S/. ${parseFloat(p.precio).toFixed(2)}</div>
        <div class="${estadoClase}">${estado}</div>
        <a href="https://wa.me/51985135331?text=${encodeURIComponent('Hola, me interesa el producto: '+p.nombre)}" class="boton" target="_blank">📢 Pedir por WhatsApp</a>`;
      c.appendChild(div);
    });
  })
  .catch(console.error);

/* ====== Preventas (home) ====== */
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
        <div class="estado">📦 Llega: ${escapeHtml(p['fecha aprox llegada peru'] || 'Próximamente')}</div>
        <a href="${urlWA}" target="_blank" class="boton">📩 Pedir por WhatsApp</a>`;
      c.appendChild(div);
    });
  })
  .catch(console.error);

/* ====== Productos a pedido (portada) ====== */
fetchJSON('pedidosDisponibles')
  .then(lista =>
    lista
      // Solo los que están disponibles a pedido
      .filter(p => (p.estado || '').toUpperCase() === 'DISPONIBLE A PEDIDO')
      // Más nuevos primero (ID más grande = más nuevo)
      .sort((a, b) => (Number(b.id) || 0) - (Number(a.id) || 0))
  )
  .then(limitarProductos)   // sigue usando tu función para limitar la cantidad en portada
  .then(lista => {
    const c = $("#pedidos-disponibles");
    if (!c) return;
    c.innerHTML = '';

    lista.forEach(p => {
      const div = document.createElement('div');
      div.className = 'producto' + (p.soloDesktop ? ' mostrar-solo-desktop' : '');

      const nombre = escapeHtml(p.nombre || '');

      const img = p.imagen && p.imagen.trim()
        ? p.imagen.trim()
        : 'https://via.placeholder.com/300x300?text=Producto+a+pedido';

      const mensajeWA = `Hola, me interesa este producto a pedido: ${nombre}`;
      const urlWA = `https://wa.me/51985135331?text=${encodeURIComponent(mensajeWA)}`;

      div.innerHTML = `
        <img src="${img}" alt="${nombre}" class="img" loading="lazy">
        <div class="nombre">${nombre}</div>
        <div class="estado">Producto a pedido</div>
        <a href="${urlWA}"
           class="boton"
           target="_blank"
           rel="noopener noreferrer">
           📩 Cotizar por WhatsApp
        </a>
      `;

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
          <span style="text-decoration:line-through;color:#bbb;">S/. ${parseFloat(p.precio).toFixed(2)}</span><br>
          <span style="color:#ffee58;font-weight:bold;font-size:22px;">S/. ${parseFloat(p.oferta).toFixed(2)}</span>
        </div>
        <div class="estado en-stock">OFERTA</div>
        <a href="https://wa.me/51985135331?text=${encodeURIComponent('Hola, me interesa el producto: '+nombre)}" class="boton" target="_blank">🔥 Pedir por WhatsApp</a>`;
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

/* Por si el usuario inicia/cierra sesión en otra pestaña,
   actualizamos el botón cuando cambie localStorage */
window.addEventListener('storage', (ev)=>{
  if ([KEYS.TOKEN, KEYS.NAME].includes(ev.key)) ensureCuentaButton();
});


