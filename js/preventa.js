/* js/preventa.js */
import { API_URL, whatsappLink } from './config.js';
import { actualizarCarritoUI } from './carrito-utils.js';
import { buildShareUrl, shareIcon, shareItem } from './social-actions.js';

const $ = (s) => document.querySelector(s);
const escapeHtml = (t) =>
  typeof t === 'string'
    ? t.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
        .replace(/"/g,'&quot;').replace(/'/g,'&#039;')
    : t;

document.addEventListener('DOMContentLoaded', () => {
  fetch(`${API_URL}?accion=preventas`)
    .then(r => { if (!r.ok) throw new Error('API'); return r.json(); })
    .then(render)
    .catch(showErr);

  actualizarCarritoUI();

  $('#contenedor')?.addEventListener('click', (event) => {
    const shareBtn = event.target.closest('[data-share-preventa]');
    if (!shareBtn) return;
    event.preventDefault();
    event.stopPropagation();
    shareItem({
      title: shareBtn.dataset.shareTitle,
      text: shareBtn.dataset.shareText,
      url: shareBtn.dataset.shareUrl
    });
  });
});

function render(lista = []) {
  const cont = $('#contenedor');
  cont.innerHTML = '';

  const clean = (s) => (s || '').toUpperCase().replace(/\u00A0/g,' ').trim();
  const preventas = lista.filter(p => clean(p.estado).includes('PREVENTA'));

  if (!preventas.length) {
    cont.innerHTML = '<p>No hay productos en preventa en este momento.</p>';
    return;
  }
  preventas.forEach(p => cont.appendChild(card(p)));
}

function card(p) {
  const nombreRaw = String(p.nombre || 'Preventa Mardant').trim();
  const nombre = escapeHtml(nombreRaw);
  const img = p.imagen?.trim()
    ? escapeHtml(p.imagen)
    : 'https://via.placeholder.com/300x300?text=Sin+imagen';
  const ref = p.id || p.nombre || 'preventa';
  const urlWA = whatsappLink(`Hola, quiero reservar esta preventa con S/ 15: ${nombreRaw}`);

  const div = document.createElement('div');
  div.className = 'producto';
  div.innerHTML = `
    <img src="${img}" alt="${nombre}" class="img" loading="lazy" referrerpolicy="no-referrer">
    <div class="nombre">${nombre}</div>
    <div class="categoria">${escapeHtml(p.categoria || '')}${p.subcategoria ? ' - ' + escapeHtml(p.subcategoria) : ''}</div>
    <div class="precio">S/. ${(+p.precio || 0).toFixed(2)}</div>
    <div class="estado">Llega: ${escapeHtml(p['fecha aprox llegada peru'] || 'Proximamente')}</div>
    <a href="${urlWA}" target="_blank" rel="noopener" class="boton">RESERVAR CON S/ 15</a>
    <div class="social-actions social-actions-single">
      <button
        class="social-icon-button"
        type="button"
        data-share-preventa
        data-share-title="${nombre} - Preventa Mardant"
        data-share-text="Mira esta preventa en Mardant: ${nombre}"
        data-share-url="${escapeHtml(buildShareUrl({ preventa: ref }))}"
        aria-label="Compartir ${nombre}"
        title="Compartir">
        ${shareIcon()}
        <span class="sr-only">Compartir</span>
      </button>
    </div>`;
  return div;
}

function showErr(e){
  $('#contenedor').innerHTML = '<p style="color:red;">Error al cargar productos.</p>';
  console.error('Error API preventas:', e);
}
