/* js/ultimas.js  – “Últimas importaciones” (12 más recientes) */
import { API_URL }          from './config.js';
import { actualizarCarritoUI } from './carrito-utils.js';

/* util para escapar posibles ‘< > &’ en nombres, etc.  */
const esc = (t = '') =>
  t.replace(/&/g, '&amp;')
   .replace(/</g, '&lt;')
   .replace(/>/g, '&gt;')
   .replace(/"/g, '&quot;')
   .replace(/'/g, '&#039;');

const $ = s => document.querySelector(s);
const cont = $('#contenedor');

document.addEventListener('DOMContentLoaded', () => {
  fetch(`${API_URL}?accion=productos`)
    .then(r => r.ok ? r.json() : Promise.reject('API error'))
    .then(pintar)
    .catch(() => { cont.innerHTML = '<p>Error al cargar productos.</p>'; });

  actualizarCarritoUI();    // contador del carrito
});

/* --------- render ---------- */
function pintar(lista) {
  cont.innerHTML = '';                           // limpia “Cargando…”
  if (!lista?.length) {
    cont.innerHTML = '<p>No hay productos disponibles.</p>';
    return;
  }

  // 12 más recientes por id
  lista.sort((a, b) => b.id - a.id)
       .slice(0, 12)
       .forEach(p => cont.appendChild(card(p)));
}

/*  tarjeta muy ligera solo con nombre/categoría/…  */
function card(p) {
  const div = document.createElement('div');
  div.className = 'producto';
  div.innerHTML = `
      <img src="${esc(p.imagen)}" class="img" alt="${esc(p.nombre)}" loading="lazy">
      <div class="nombre"        title="${esc(p.nombre)}">${esc(p.nombre)}</div>
      <div class="categoria">${esc(p.categoria)} – ${esc(p.subcategoria)}</div>
      <div class="precio">S/. ${parseFloat(p.precio).toFixed(2)}</div>
      <div class="estado">${(p.estado || '').toUpperCase().includes('SIN STOCK')
                              ? 'AGOTADO' : 'En stock'}</div>`;
  return div;
}
