/* js/preventa.js */
import { whatsappLink } from './config.js';
import { API_CACHE_TTL, cachedFetchJSON } from './api-client.js?v=3';
import { actualizarCarritoUI } from './carrito-utils.js';
import { buildShareUrl, shareIcon, shareVisualItem } from './social-actions.js?v=2';
import { pageFromUrl, renderCatalogPagination, updateCatalogUrl } from './pagination-utils.js?v=2';

const ITEMS_PER_PAGE = 21;
let paginaActual = pageFromUrl();
let totalPaginas = 1;
let preventasGlobal = [];
let preventasRequestController = null;
let preventasRequestId = 0;

const $ = (s) => document.querySelector(s);
const escapeHtml = (t) =>
  typeof t === 'string'
    ? t.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
        .replace(/"/g,'&quot;').replace(/'/g,'&#039;')
    : t;

document.addEventListener('DOMContentLoaded', () => {
  loadPreventasPage();

  window.addEventListener('popstate', () => {
    paginaActual = pageFromUrl();
    loadPreventasPage();
  });

  actualizarCarritoUI();

  $('#contenedor')?.addEventListener('click', (event) => {
    const shareBtn = event.target.closest('[data-share-preventa]');
    if (!shareBtn) return;
    event.preventDefault();
    event.stopPropagation();
    shareVisualItem({
      button: shareBtn,
      title: shareBtn.dataset.shareTitle,
      text: shareBtn.dataset.shareText,
      url: shareBtn.dataset.shareUrl,
      imageUrl: shareBtn.dataset.shareImage,
      eyebrow: shareBtn.dataset.shareEyebrow,
      subtitle: shareBtn.dataset.shareSubtitle,
      price: shareBtn.dataset.sharePrice,
      badge: shareBtn.dataset.shareBadge,
      note: shareBtn.dataset.shareNote,
      cta: shareBtn.dataset.shareCta,
      fileName: shareBtn.dataset.shareFile
    });
  });
});

async function loadPreventasPage({ urlMode = 'replace' } = {}) {
  const requestId = ++preventasRequestId;
  preventasRequestController?.abort();
  const controller = new AbortController();
  preventasRequestController = controller;
  const requestedPage = paginaActual;
  updateCatalogUrl({ pagina: paginaActual }, urlMode);
  $('#contenedor')?.setAttribute('aria-busy', 'true');
  try {
    const data = await cachedFetchJSON('preventas', {
      ttl: API_CACHE_TTL.PREVENTAS,
      cacheId: 'preventas-full-v4',
      staleWhileRevalidate: true,
      retries: 0,
      timeoutMs: 12000,
      signal: controller.signal
    });
    if (requestId !== preventasRequestId || controller.signal.aborted) return;
    if (!Array.isArray(data)) throw new Error('preventas_unavailable');

    preventasGlobal = data.filter(item => String(item?.estado || '').toUpperCase().includes('PREVENTA'));
    totalPaginas = Math.max(1, Math.ceil(preventasGlobal.length / ITEMS_PER_PAGE));
    paginaActual = Math.min(requestedPage, totalPaginas);
    const start = (paginaActual - 1) * ITEMS_PER_PAGE;
    render(preventasGlobal.slice(start, start + ITEMS_PER_PAGE));
    renderPagination();
    updateCatalogUrl({ pagina: paginaActual }, 'replace');
  } catch (error) {
    if (requestId !== preventasRequestId || controller.signal.aborted || error?.name === 'AbortError') return;
    showErr(error);
  } finally {
    if (requestId === preventasRequestId) $('#contenedor')?.removeAttribute('aria-busy');
  }
}

function renderPagination() {
  renderCatalogPagination($('#paginacion'), {
    current: paginaActual,
    total: totalPaginas,
    buttonClass: 'boton',
    activeClass: 'active',
    onSelect: page => {
      paginaActual = page;
      loadPreventasPage({ urlMode: 'push' });
      $('#contenedor')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
}

function render(lista = []) {
  const cont = $('#contenedor');
  cont.innerHTML = '';

  const clean = (s) => (s || '').toUpperCase().replace(/\u00A0/g,' ').trim();
  const preventas = lista.filter(p => clean(p.estado).includes('PREVENTA'));

  if (!preventas.length) {
    cont.innerHTML = '<p>No hay productos en preventa en este momento.</p>';
    $('#paginacion').innerHTML = '';
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
  const precio = `S/. ${(+p.precio || 0).toFixed(2)}`;
  const llegada = p['fecha aprox llegada peru'] || 'Proximamente';
  const trackCategory = [p.categoria, p.subcategoria].filter(Boolean).join(' - ') || 'Preventa';

  const div = document.createElement('div');
  div.className = 'producto';
  div.innerHTML = `
    <img src="${img}" alt="${nombre}" class="img" loading="lazy" referrerpolicy="no-referrer">
    <div class="nombre">${nombre}</div>
    <div class="categoria">${escapeHtml(p.categoria || '')}${p.subcategoria ? ' - ' + escapeHtml(p.subcategoria) : ''}</div>
    <div class="precio">S/. ${(+p.precio || 0).toFixed(2)}</div>
    <div class="estado">Llega: ${escapeHtml(p['fecha aprox llegada peru'] || 'Proximamente')}</div>
    <a href="${urlWA}"
       target="_blank"
       rel="noopener noreferrer"
       class="boton"
       data-track-item-id="${escapeHtml(String(ref).trim())}"
       data-track-item-name="${nombre}"
       data-track-price="${(+p.precio || 0).toFixed(2)}"
       data-track-category="${escapeHtml(trackCategory)}"
       data-track-source="preventa"
       data-track-cta="RESERVAR CON S/ 15">RESERVAR CON S/ 15</a>
    <div class="social-actions social-actions-single">
      <button
        class="social-icon-button"
        type="button"
        data-share-preventa
        data-share-title="${nombre} - Preventa Mardant"
        data-share-text="Mira esta preventa en Mardant: ${nombre}"
        data-share-url="${escapeHtml(buildShareUrl({ preventa: ref }))}"
        data-share-image="${img}"
        data-share-eyebrow="Preventa Mardant"
        data-share-subtitle="Reserva desde S/ 15"
        data-share-price="${escapeHtml(precio)}"
        data-share-badge="PREVENTA"
        data-share-note="Llegada aproximada: ${escapeHtml(llegada)}"
        data-share-cta="Reservar por WhatsApp en mardant.com"
        data-share-file="mardant-preventa-${escapeHtml(String(ref).replace(/\s+/g, '-'))}.png"
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
  $('#paginacion').innerHTML = '';
  console.error('Error API preventas:', e);
}
