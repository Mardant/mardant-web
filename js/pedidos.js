/* js/pedidos.js */
import { API_URL } from './config.js';
import { actualizarCarritoUI } from './carrito-utils.js';

const $ = (s) => document.querySelector(s);

document.addEventListener('DOMContentLoaded', () => {
  fetch(`${API_URL}?accion=pedidosDisponibles`) // Endpoint corregido
    .then(r => {
      if (!r.ok) throw new Error('Error API: ' + r.status);
      return r.json();
    })
    .then(lista => {
      const disponibles = lista.filter(p => 
        (p.estado || '').toUpperCase().includes('DISPONIBLE A PEDIDO')
      );
      render(disponibles);
    })
    .catch(showErr);

  actualizarCarritoUI();
});

function render(lista = []) {
  const cont = $('#contenedor');
  cont.innerHTML = '';

  if (!lista.length) {
    cont.innerHTML = '<p>No hay productos disponibles para pedido actualmente.</p>';
    return;
  }

  lista.forEach(p => {
    const card = document.createElement('div');
    card.className = 'producto';
    card.innerHTML = `
      <img src="${p.imagen || 'https://via.placeholder.com/300x300?text=Sin+imagen'}" 
           alt="${p.nombre}" 
           class="img" 
           loading="lazy">
      <div class="nombre">${p.nombre}</div>
      <div class="precio">S/. ${parseFloat(p.precio).toFixed(2)}</div>
      <div class="estado disponible-a-pedido">${p.estado}</div>
      <a href="${p.enlace || '#'}" 
         target="_blank" 
         class="boton">
         📩 Pedir por WhatsApp
      </a>
    `;
    cont.appendChild(card);
  });
}

function showErr(error) {
  console.error('Error:', error);
  $('#contenedor').innerHTML = `
    <div class="error">
      <p>⚠️ Error al cargar los productos. Intenta recargar la página.</p>
      <small>${error.message}</small>
    </div>
  `;
}
