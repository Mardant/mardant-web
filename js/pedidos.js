/* js/pedidos.js – muestra solo los productos “disponible a pedido”   */

import { API_URL }                 from './config.js';
import { actualizarCarritoUI }     from './carrito-utils.js';

const $          = (s) => document.querySelector(s);
const escapeHtml = (t) =>
  typeof t === 'string'
    ? t.replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;')
    : t;

const contenedor = $('#contenedor');

document.addEventListener('DOMContentLoaded', () => {
  fetch(`${API_URL}?accion=productos`)
    .then(r => r.json())
    .then(render)
    .catch(() => (contenedor.innerHTML = '<p>Error al cargar productos.</p>'));

  actualizarCarritoUI();
});

function render(data = []) {
  contenedor.innerHTML = '';

  /* filtra solo los que están marcados como “Disponible a pedido” */
  const lista = data.filter((p) =>
    (p.estado || '').toUpperCase().includes('A PEDIDO')
  );

  if (!lista.length) {
    contenedor.innerHTML = '<p>No hay productos disponibles a pedido.</p>';
    return;
  }

  lista.forEach((p) => contenedor.appendChild(card(p)));
}

/* plantilla de tarjeta (sin botón “añadir al carrito”) */
function card(p) {
  const div         = document.createElement('div');
  div.className     = 'producto';

  const nombre      = escapeHtml(p.nombre);
  const categoria   = escapeHtml(p.categoria);
  const subcategoria= escapeHtml(p.subcategoria);
  const precio      = parseFloat(p.precio).toFixed(2);
  const estado      = 'Disponible a pedido';

  div.innerHTML = `
    <img  src="${escapeHtml(p.imagen)}" alt="${nombre}" class="img" loading="lazy">
    <div class="nombre"     title="${nombre}">${nombre}</div>
    <div class="categoria">${categoria} – ${subcategoria}</div>
    <div class="precio">S/. ${precio}</div>
    <div class="estado disponible-a-pedido">${estado}</div>
    <a href="https://wa.me/51985135331?text=${encodeURIComponent(
      'Hola, quiero pedir: ' + p.nombre
    )}" class="boton" target="_blank">📩 Pedir por WhatsApp</a>
  `;
  return div;
}
