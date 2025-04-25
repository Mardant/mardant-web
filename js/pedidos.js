/* js/pedidos.js  – equivalente a scripts_pedido.html para GitHub Pages */

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
  console.log('📦 pedidos.js cargado correctamente');

  fetch(`${API_URL}?accion=productos`)
    .then((r) => {
      if (!r.ok) throw new Error('API error');
      return r.json();
    })
    .then(mostrarPedidos)
    .catch((e) => errorPedidos(e));

  actualizarCarritoUI();
});

function mostrarPedidos(lista = []) {
  const cont = $('#contenedor');
  cont.innerHTML = '';

  /* ⇢ sólo los marcados EXACTAMENTE “DISPONIBLE A PEDIDO” */
  const disponibles = lista.filter(
    (p) => (p.estado || '').toUpperCase().trim() === 'DISPONIBLE A PEDIDO'
  );

  if (!disponibles.length) {
    cont.innerHTML =
      '<p>No hay productos disponibles para pedido en este momento.</p>';
    return;
  }

  disponibles.forEach((p) => cont.appendChild(card(p)));
}

function card(p) {
  const div   = document.createElement('div');
  div.className = 'producto';

  const nombre   = escapeHtml(p.nombre || '');
  const estado   = 'Disponible a pedido';
  const precio   = parseFloat(p.precio || 0).toFixed(2);
  const imagen   =
    p.imagen && p.imagen.trim()
      ? escapeHtml(p.imagen)
      : 'https://via.placeholder.com/300x300?text=Sin+imagen';

  const urlWA = `https://wa.me/51985135331?text=${encodeURIComponent(
    'Hola, estoy interesado en el producto: ' + nombre
  )}`;

  div.innerHTML = `
    <img src="${imagen}" alt="${nombre}" class="img" loading="lazy">
    <div class="nombre"><b>${nombre}</b></div>
    <div class="precio">S/. ${precio}</div>
    <div class="estado disponible-a-pedido">${estado}</div>
    <a href="${urlWA}" target="_blank" class="boton">📩 Pedir por WhatsApp</a>
  `;
  return div;
}

function errorPedidos(e) {
  $('#contenedor').innerHTML =
    '<p style="color:red;">Error al cargar productos.</p>';
  console.error('❌ Error al obtener pedidos:', e);
}
