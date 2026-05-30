// === js/scripts_inicio.js ===
import { API_URL, AUTH_KEYS, whatsappLink } from './config.js';
import { actualizarCarritoUI } from './carrito-utils.js';
import { ensureAccountWidget } from './account-widget.js?v=2';

/* Utilidades */
const $ = sel => document.querySelector(sel);
const escapeHtml = t => typeof t === 'string'
  ? t.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;').replace(/'/g,'&#039;')
  : t;

// Cantidad máxima de tarjetas en cada bloque de la portada
const MAX_HOME_ITEMS = 4;
// Para "Últimas importaciones" rotamos entre las 15 últimas
const MAX_ULTIMAS_ROTACION = 15;
// Cada cuántos ms cambian las últimas importaciones
const ROTACION_ULTIMAS_MS = 15000; // 15 segundos

/* Helpers para rotaciones */

const marcarSoloDesktop = (lista) =>
  lista.map((p, i) => ({ ...p, soloDesktop: i === lista.length - 1 }));

/**
 * Recibe TODA la lista y elige un bloque rotativo de hasta `max` productos.
 * El bloque cambia automáticamente según el día u hora actual.
 *
 * - modo = 'dia'  -> cambia una vez por día
 * - modo = 'hora' -> cambia una vez por hora
 * - clave: string para que cada sección tenga rotación independiente
 */
function elegirBloqueRotativo(lista, max = MAX_HOME_ITEMS, { modo = 'dia', clave = '' } = {}) {
  const total = lista.length;
  if (!total) return [];

  const ahora = new Date();
  const base = (modo === 'hora')
    ? `${ahora.getFullYear()}-${ahora.getMonth()}-${ahora.getDate()}-${ahora.getHours()}`
    : `${ahora.getFullYear()}-${ahora.getMonth()}-${ahora.getDate()}`;

  const strSeed = base + '|' + clave;
  let seed = 0;
  for (let i = 0; i < strSeed.length; i++) {
    seed = (seed * 31 + strSeed.charCodeAt(i)) >>> 0;
  }

  const start = seed % total;
  const cantidad = Math.min(max, total);
  const resultado = [];
  for (let i = 0; i < cantidad; i++) {
    resultado.push(lista[(start + i) % total]);
  }
  return marcarSoloDesktop(resultado);
}

/* ====== Botón "Mi cuenta" ====== */
const KEYS = {
  TOKEN:  (AUTH_KEYS && AUTH_KEYS.TOKEN)  || 'mardant_token',
  NAME:   (AUTH_KEYS && AUTH_KEYS.NAME)   || 'mardant_name',
  CLIENT: (AUTH_KEYS && AUTH_KEYS.CLIENT) || 'mardant_client'
};

function ensureCuentaButton() {
  ensureAccountWidget();
  return;
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

// Corre apenas el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
  ensureCuentaButton();
  if (typeof actualizarCarritoUI === 'function') {
    try { actualizarCarritoUI(); } catch (e) { console.error(e); }
  }
});

/* Helpers de red */
const fetchJSON = accion =>
  fetch(`${API_URL}?accion=${accion}`)
    .then(r => { if(!r.ok) throw new Error('API'); return r.json(); });

function estadoClass(texto){
  const estado = String(texto || '')
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

  if (estado.includes('OFERTA')) return 'estado-oferta';
  if (estado.includes('AGOTADO') || estado.includes('SIN STOCK')) return 'estado-agotado';
  if (estado.includes('DISPONIBLE')) return 'estado-disponible';
  return 'estado-neutro';
}

function loteNumber(value){
  const match = String(value || '').match(/\d+/g);
  return match ? Number(match.join('')) || 0 : 0;
}

function costoCatalogoJapon(value){
  const text = String(value || '').trim();
  if (!text) return 'Por confirmar';
  if (/^(S\/|\$)/i.test(text)) return text;
  return `S/ ${text}`;
}

function normalizarCatalogoJapon(data){
  return Array.isArray(data)
    ? data
    : (Array.isArray(data?.productos) ? data.productos : []);
}

/* ====== Últimas importaciones (rotan entre las 15 últimas) ====== */
let ultimasLista15 = [];
let ultimasIndiceInicio = 0;

function renderUltimas() {
  const c = $("#ultimas-importaciones");
  if (!c) return;

  c.innerHTML = '';
  if (!ultimasLista15.length) return;

  const total = ultimasLista15.length;
  const cantidad = Math.min(MAX_HOME_ITEMS, total);
  const visibles = [];

  for (let i = 0; i < cantidad; i++) {
    const p = ultimasLista15[(ultimasIndiceInicio + i) % total];
    visibles.push({ ...p, soloDesktop: i === cantidad - 1 });
  }

  visibles.forEach(p => {
    const rawEstado = (p.estado || '').toUpperCase();
    const estado = (rawEstado.includes('SIN STOCK') || rawEstado.includes('AGOTADO')) ? 'AGOTADO' : 'DISPONIBLE';
    const estadoClase = `estado ${estadoClass(estado)}`;
    const div = document.createElement('div');
    div.className = 'producto' + (p.soloDesktop ? ' mostrar-solo-desktop' : '');
    div.innerHTML = `
      <img src="${p.imagen}" alt="${escapeHtml(p.nombre)}" class="img" loading="lazy" referrerpolicy="no-referrer">
      <div class="nombre">${escapeHtml(p.nombre)}</div>
      <div class="precio">S/. ${parseFloat(p.precio).toFixed(2)}</div>
      <div class="${estadoClase}">${estado}</div>
      <a href="${whatsappLink('Hola, quiero comprar ahora este producto: ' + p.nombre)}"
         class="boton" target="_blank">COMPRAR AHORA</a>`;
    c.appendChild(div);
  });
}

fetchJSON('productos')
  .then(r => r
    .slice() // copia
    .sort((a,b) => (Number(b.id ?? 0) - Number(a.id ?? 0))) // orden seguro
    .slice(0, MAX_ULTIMAS_ROTACION)
  )
  .then(lista => {
    ultimasLista15 = lista;
    renderUltimas();

    if (ultimasLista15.length > MAX_HOME_ITEMS) {
      setInterval(() => {
        ultimasIndiceInicio = (ultimasIndiceInicio + MAX_HOME_ITEMS) % ultimasLista15.length;
        renderUltimas();
      }, ROTACION_ULTIMAS_MS);
    }
  })
  .catch(console.error);

/* ====== Preventas (home, rotativas entre todas las preventas) ====== */
fetchJSON('preventas')
  .then(lista => elegirBloqueRotativo(lista, MAX_HOME_ITEMS, { modo:'hora', clave:'preventas' }))
  .then(lista => {
    const c = $("#productos-preventa");
    if (!c) return;
    c.innerHTML = "";
    lista.forEach(p => {
      const img = p.imagen?.trim()
        ? escapeHtml(p.imagen)
        : 'https://via.placeholder.com/300x300?text=Sin+imagen';
      const urlWA = whatsappLink('Hola, quiero reservar esta preventa con S/ 15: ' + p.nombre);
      const div = document.createElement('div');
      div.className = 'producto' + (p.soloDesktop ? ' mostrar-solo-desktop' : '');
      div.innerHTML = `
        <img src="${img}" alt="${escapeHtml(p.nombre)}" class="img" loading="lazy" referrerpolicy="no-referrer">
        <div class="nombre">${escapeHtml(p.nombre)}</div>
        <div class="precio">S/. ${( +p.precio || 0 ).toFixed(2)}</div>
        <div class="estado estado-preventa">Llega: ${escapeHtml(p['fecha aprox llegada peru'] || 'Próximamente')}</div>
        <a href="${urlWA}" target="_blank" class="boton">RESERVAR CON S/ 15</a>`;
      c.appendChild(div);
    });
  })
  .catch(console.error);

/* ====== Productos a pedido (home, rotativos sobre todo el catálogo disponible) ====== */
fetchJSON('pedidosDisponibles')
  .then(lista => lista
    // misma lógica de estado que en pedidos.js: DISPONIBLE / DISPONIBLE A PEDIDO
    .filter(p => {
      const est = (p.estado || '')
        .toString()
        .toUpperCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim();
      return !est || est === 'DISPONIBLE' || est === 'DISPONIBLE A PEDIDO';
    })
    .sort((a,b) => Number(b.id ?? b.ID ?? 0) - Number(a.id ?? a.ID ?? 0))
  )
  .then(lista => elegirBloqueRotativo(lista, MAX_HOME_ITEMS, { modo:'hora', clave:'pedidos' }))
  .then(lista => {
    const c = $("#pedidos-disponibles");
    if (!c) return;
    c.innerHTML = '';

    lista.forEach(p => {
      const idRaw = (p.id ?? p.ID ?? '').toString().trim();
      const nombreBase = p.nombre && p.nombre.trim()
        ? p.nombre.trim()
        : (idRaw ? `Figura N° ${idRaw}` : 'Figura sin nombre');

      // Texto que se manda a WhatsApp
      const mensajeWA = p.nombre && p.nombre.trim()
        ? `Deseo pedir desde Japón este producto: ${nombreBase}`
        : `Deseo pedir desde Japón la figura N° ${idRaw || 'sin ID'}`;

      const div = document.createElement('div');
      div.className = 'producto' + (p.soloDesktop ? ' mostrar-solo-desktop' : '');
      div.innerHTML = `
        <img src="${p.imagen}" alt="${escapeHtml(nombreBase)}" class="img" loading="lazy" referrerpolicy="no-referrer">
        <div class="nombre">${escapeHtml(nombreBase)}</div>
        <div class="estado ${estadoClass(p.estado || 'DISPONIBLE A PEDIDO')}">${escapeHtml(p.estado || 'DISPONIBLE A PEDIDO')}</div>
        <a href="${whatsappLink(mensajeWA)}"
           class="boton" target="_blank">PEDIR DESDE JAPÓN</a>`;
      c.appendChild(div);
    });
  })
  .catch(console.error);

/* ====== Catálogo Japón (home, 3 lotes rotativos) ====== */
fetchJSON('catalogoPreventasJapon')
  .then(normalizarCatalogoJapon)
  .then(lista => lista
    .filter(p => p && p.id_lote && p.imagen_url)
    .sort((a,b) => loteNumber(b.id_lote) - loteNumber(a.id_lote))
  )
  .then(lista => elegirBloqueRotativo(lista, 3, { modo:'hora', clave:'catalogo-japon' }))
  .then(lista => {
    const c = $("#catalogo-japon-home");
    if (!c) return;
    c.innerHTML = '';

    lista.forEach(p => {
      const id = String(p.id_lote || '').trim();
      const etiqueta = String(p.etiqueta || 'disponible').trim().toLowerCase();
      const estadoTexto = etiqueta === 'preventa' ? 'PREVENTA' : 'DISPONIBLE';
      const estadoClase = etiqueta === 'preventa' ? 'estado-preventa' : 'estado-disponible';
      const div = document.createElement('div');
      div.className = 'producto';
      div.innerHTML = `
        <img src="${escapeHtml(p.imagen_url)}" alt="Lote #${escapeHtml(id)}" class="img" loading="lazy" referrerpolicy="no-referrer">
        <div class="nombre">Lote #${escapeHtml(id)}</div>
        <div class="precio precio-japon-producto">
          <span class="precio-ruta precio-unico"><span>Precio</span><strong>${escapeHtml(costoCatalogoJapon(p.precio_producto))}</strong></span>
          <span class="precio-nota">No incluye envío</span>
        </div>
        <div class="estado ${estadoClase}">${estadoTexto}</div>
        <a href="${whatsappLink(`Hola, quiero consultar el lote #${id}`)}"
           class="boton" target="_blank">SOLICITAR LOTE</a>`;
      c.appendChild(div);
    });
  })
  .catch(console.error);

/* ====== Productos en oferta (home, rotativos entre todas las ofertas) ====== */
fetchJSON('productos')
  .then(lista => lista
    .filter(p => p.oferta && !isNaN(p.oferta))
    .sort((a,b) => Number(b.id ?? 0) - Number(a.id ?? 0))
  )
  .then(lista => elegirBloqueRotativo(lista, MAX_HOME_ITEMS, { modo:'hora', clave:'ofertas' }))
  .then(lista => {
    const c = $("#productos-oferta");
    if (!c) return;
    c.innerHTML = '';
    lista.forEach(p => {
      const nombreTexto = p.nombre || '';
      const nombre = escapeHtml(nombreTexto);
      const div = document.createElement('div');
      div.className = 'producto' + (p.soloDesktop ? ' mostrar-solo-desktop' : '');
      div.innerHTML = `
        <img src="${p.imagen}" alt="${nombre}" class="img" loading="lazy" referrerpolicy="no-referrer">
        <div class="nombre">${nombre}</div>
        <div class="precio">
          <span style="text-decoration:line-through;color:#bbb;">S/. ${parseFloat(p.precio).toFixed(2)}</span><br>
          <span class="precio-oferta">S/. ${parseFloat(p.oferta).toFixed(2)}</span>
        </div>
        <div class="estado estado-oferta">OFERTA</div>
        <a href="${whatsappLink('Hola, quiero aprovechar esta oferta: ' + nombreTexto)}"
           class="boton" target="_blank">APROVECHAR OFERTA</a>`;
      c.appendChild(div);
    });
  })
  .catch(console.error);

/* ====== Carrusel de imágenes del banner ====== */
const slides = document.querySelectorAll('.carrusel img');
const ind = $("#indicadores");
if (ind && slides.length) {
  slides.forEach((_,i)=>{
    const d = document.createElement('div');
    d.className = 'punto';
    d.onclick = () => { idx = i; show(); };
    ind.appendChild(d);
  });
  const puntos = document.querySelectorAll('.punto');
  let idx = 0;
  const show = () => {
    slides.forEach((s,j)=>s.classList.toggle('activo', j === idx));
    puntos.forEach((p,j)=>p.classList.toggle('activo', j === idx));
  };
  setInterval(()=>{ idx = (idx + 1) % slides.length; show(); }, 8000);
  show();
}

/* Por si el usuario inicia/cierra sesión en otra pestaña,
   actualizamos el botón cuando cambie localStorage */
window.addEventListener('storage', (ev)=>{
  if ([KEYS.TOKEN, KEYS.NAME].includes(ev.key)) ensureCuentaButton();
});





