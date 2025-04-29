/* js/pedidos.js (versión de diagnóstico) */
import { API_URL } from './config.js';
import { actualizarCarritoUI } from './carrito-utils.js';

const $ = (s) => document.querySelector(s);

document.addEventListener('DOMContentLoaded', () => {
  console.log('📦 pedidos.js cargado');

  fetch(`${API_URL}?accion=productos`)
    .then((r) => {
      if (!r.ok) throw new Error(`Error HTTP: ${r.status}`);
      return r.json();
    })
    .then(data => {
      console.log('Respuesta cruda de la API:', data); // 1. Ver estructura real
      return data;
    })
    .then(render)
    .catch(showErr);

  actualizarCarritoUI();
});

function render(lista = []) {
  const cont = $('#contenedor');
  cont.innerHTML = '';

  const norm = (s) => (s || '')
    .toUpperCase()
    .replace(/\u00A0/g, ' ')
    .replace(/[^A-Z0-9]/g, ' ') // Eliminar caracteres especiales
    .replace(/\s+/g, ' ')       // Unificar espacios múltiples
    .trim();

  console.log('Todos los productos:', lista); // 2. Ver todos los productos

  const disponibles = lista.filter(p => {
    const estadoNormalizado = norm(p.estado);
    console.log('Estado normalizado:', estadoNormalizado, '| Original:', p.estado); // 3. Ver comparación
    return estadoNormalizado === 'DISPONIBLEAPEDIDO'; // Versión sin espacios
  });

  console.log('Productos filtrados:', disponibles); // 4. Ver resultado final

  if (!disponibles.length) {
    cont.innerHTML = '<p>No hay productos disponibles para pedido en este momento.</p>';
    return;
  }

  disponibles.forEach((p) => cont.appendChild(card(p)));
}

function card(p) {
  const div = document.createElement('div');
  div.className = 'producto';

  const nombre = escapeHtml(p.nombre || '');
  const precio = parseFloat(p.precio || 0).toFixed(2);
  const imagen = p.imagen && p.imagen.trim()
    ? `../${escapeHtml(p.imagen)}`  // Añadido ../ para ruta correcta
    : 'https://via.placeholder.com/300x300?text=Sin+imagen';

  const urlWA =
    'https://wa.me/51985135331?text=' +
    encodeURIComponent('Hola, estoy interesado en: ' + nombre);

  div.innerHTML = `
    <img src="${imagen}" alt="${nombre}" class="img" loading="lazy">
    <div class="nombre"><b>${nombre}</b></div>
    <div class="precio">S/. ${precio}</div>
    <div class="estado disponible-a-pedido">Disponible a pedido</div>
    <a href="${urlWA}" target="_blank" class="boton">📩 Pedir por WhatsApp</a>
  `;
  return div;
}

function showErr(e) {
  $('#contenedor').innerHTML =
    '<p style="color:red;">Error al cargar productos.</p>';
  console.error('❌ Error API:', e);
}
