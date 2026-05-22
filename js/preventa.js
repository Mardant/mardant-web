/* js/preventa.js — versión corregida */
import { API_URL, whatsappLink } from './config.js';
import { actualizarCarritoUI } from './carrito-utils.js';

const $ = (s) => document.querySelector(s);
const escapeHtml = (t) =>
  typeof t === 'string'
    ? t.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
        .replace(/"/g,'&quot;').replace(/'/g,'&#039;')
    : t;

document.addEventListener('DOMContentLoaded', () => {
  console.log('🎁 preventa.js cargado');

  /* –––– ① Pide SÓLO las preventas al backend –––– */
  fetch(`${API_URL}?accion=preventas`)          //  ←  cambio clave
    .then(r => { if (!r.ok) throw new Error('API'); return r.json(); })
    .then(render)
    .catch(showErr);

  actualizarCarritoUI();
});

/* –––– ② Normaliza y pinta –––– */
function render(lista = []) {
  const cont = $('#contenedor');
  cont.innerHTML = '';

  // (si tu backend ya envía sólo preventas no hace falta filtrar,
  //  pero dejamos un filtro “robusto” por si acaso)
  const clean = (s) => (s||'').toUpperCase().replace(/\u00A0/g,' ').trim();
  const preventas = lista.filter(p => clean(p.estado).includes('PREVENTA'));

  if (!preventas.length) {
    cont.innerHTML = '<p>No hay productos en preventa en este momento.</p>';
    return;
  }
  preventas.forEach(p => cont.appendChild(card(p)));
}

function card(p) {
  const img = p.imagen?.trim()
    ? escapeHtml(p.imagen)
    : 'https://via.placeholder.com/300x300?text=Sin+imagen';

  const urlWA = whatsappLink('Hola, quiero reservar esta preventa con S/ 15: ' + p.nombre);

  const div = document.createElement('div');
  div.className = 'producto';
  div.innerHTML = `
    <img src="${img}" alt="${escapeHtml(p.nombre)}" class="img" loading="lazy" referrerpolicy="no-referrer">
    <div class="nombre">${escapeHtml(p.nombre)}</div>
    <div class="categoria">${escapeHtml(p.categoria)}${p.subcategoria ? ' – ' + escapeHtml(p.subcategoria) : ''}</div>
    <div class="precio">S/. ${(+p.precio||0).toFixed(2)}</div>
    <div class="estado">Llega: ${escapeHtml(p['fecha aprox llegada peru'] || 'Próximamente')}</div>
    <a href="${urlWA}" target="_blank" class="boton">RESERVAR CON S/ 15</a>`;
  return div;
}

function showErr(e){
  $('#contenedor').innerHTML = '<p style="color:red;">Error al cargar productos.</p>';
  console.error('❌ Error API:', e);
}
