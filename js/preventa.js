// js/preventa.js  –  muestra los productos marcados “PREVENTA”

import { API_URL }             from './config.js';
import { actualizarCarritoUI } from './carrito-utils.js';

const $ = (s) => document.querySelector(s);

const escapeHtml = (t) =>
  typeof t === 'string'
    ? t.replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;')
    : t;

document.addEventListener('DOMContentLoaded', () => {
  console.log('🎁 preventa.js cargado');

  fetch(`${API_URL}?accion=productos`)
    .then((r) => {
      if (!r.ok) throw new Error('API error');
      return r.json();
    })
    .then(render)
    .catch(showErr);

  actualizarCarritoUI();
});

function render(lista = []) {
  const cont = $('#contenedor');
  cont.innerHTML = '';

  /* ⇢ sólo los que están en PREVENTA */
  const preventas = lista.filter(
    (p) => (p.estado || '').toUpperCase().includes('PREVENTA')
  );

  if (!preventas.length) {
    cont.innerHTML =
      '<p>No hay productos en preventa en este momento.</p>';
    return;
  }

  preventas.forEach((p) => cont.appendChild(card(p)));
}

function card(p) {
  const div = document.createElement('div');
  div.className = 'producto';

  const nombre   = escapeHtml(p.nombre || '');
  const categoria= escapeHtml(p.categoria || '');
  const subcat   = escapeHtml(p.subcategoria || '');
  const precio   = parseFloat(p.precio || 0).toFixed(2);
  const imagen   =
    p.imagen && p.imagen.trim()
      ? escapeHtml(p.imagen)
      : 'https://via.placeholder.com/300x300?text=Sin+imagen';

  const urlWA =
    'https://wa.me/51985135331?text=' +
    encodeURIComponent('Hola, estoy interesado en la preventa: ' + nombre);

  div.innerHTML = `
    <img src="${imagen}" alt="${nombre}" class="img" loading="lazy">
    <div class="nombre">${nombre}</div>
    <div class="categoria">${categoria}${subcat ? ' – ' + subcat : ''}</div>
    <div class="precio">S/. ${precio}</div>
    <a href="${urlWA}" target="_blank" class="boton">📩 Pedir por WhatsApp</a>
  `;
  return div;
}

function showErr(e) {
  $('#contenedor').innerHTML =
    '<p style="color:red;">Error al cargar productos.</p>';
  console.error('❌ Error API:', e);
}
