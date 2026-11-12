/* js/preventa.js */
import { whatsappLink } from './config.js?v=5';
import { API_CACHE_TTL, cachedFetchJSON, prefetchJSONPages } from './api-client.js?v=7';
import { actualizarCarritoUI } from './carrito-utils.js?v=2';
import { buildShareUrl, shareIcon, shareVisualItem } from './social-actions.js?v=3';
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
  const requestedParams = { page: requestedPage, page_size: ITEMS_PER_PAGE };
  updateCatalogUrl({ pagina: paginaActual }, urlMode);
  $('#contenedor')?.setAttribute('aria-busy', 'true');
  try {
    const data = await cachedFetchJSON('preventasPage', {
      ttl: API_CACHE_TTL.PREVENTAS,
      cacheId: 'preventas-page-v6',
      params: requestedParams,
      staleWhileRevalidate: true,
      retries: 0,
      timeoutMs: 12000,
      signal: controller.signal
    });
    if (requestId !== preventasRequestId || controller.signal.aborted) return;
    if (!data?.ok || !Array.isArray(data.productos)) throw new Error(data?.error || 'preventas_page_unavailable');

    const responsePage = Number(data.page) || 1;
    const responseTotalPages = Number(data.total_pages) || 1;
    if (responsePage !== requestedPage && requestedPage <= responseTotalPages) {
      throw new Error('preventas_page_response_mismatch');
    }

    preventasGlobal = data.productos;
    totalPaginas = responseTotalPages;
    paginaActual = responsePage;
    render(preventasGlobal);
    renderPagination();
    updateCatalogUrl({ pagina: paginaActual }, 'replace');

    prefetchJSONPages('preventasPage', {
      current: paginaActual,
      total: totalPaginas,
      ahead: 3,
      behind: 1,
      ttl: API_CACHE_TTL.PREVENTAS,
      params: requestedParams,
      cacheId: 'preventas-page-v6',
      signal: controller.signal
    }).catch(() => {});
  } catch (error) {
    if (requestId !== preventasRequestId || controller.signal.aborted || error?.name === 'AbortError') return;
    await loadPreventasFallback(error, { requestId, controller, requestedPage });
  } finally {
    if (requestId === preventasRequestId) $('#contenedor')?.removeAttribute('aria-busy');
  }
}

async function loadPreventasFallback(serverError, { requestId, controller, requestedPage } = {}) {
  try {
    const data = await cachedFetchJSON('preventas', {
      ttl: API_CACHE_TTL.PREVENTAS,
      cacheId: 'preventas-full-v6',
      staleWhileRevalidate: true,
      retries: 0,
      timeoutMs: 12000
    });
    if (requestId !== preventasRequestId || controller?.signal.aborted) return;
    if (!Array.isArray(data)) throw new Error('preventas_unavailable');

    preventasGlobal = data.filter(item => String(item?.estado || '').toUpperCase().includes('PREVENTA'));
    totalPaginas = Math.max(1, Math.ceil(preventasGlobal.length / ITEMS_PER_PAGE));
    paginaActual = Math.min(requestedPage || 1, totalPaginas);
    const start = (paginaActual - 1) * ITEMS_PER_PAGE;
    render(preventasGlobal.slice(start, start + ITEMS_PER_PAGE));
    renderPagination();
    updateCatalogUrl({ pagina: paginaActual }, 'replace');
    console.warn('Endpoint paginado no disponible; usando preventas compatibles:', serverError);
  } catch (error) {
    if (requestId !== preventasRequestId || controller?.signal.aborted || error?.name === 'AbortError') return;
    showErr(error);
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

function positiveAmount(value) {
  if (value === null || value === undefined || String(value).trim() === '') return null;
  const amount = Number(String(value).replace(',', '.'));
  return Number.isFinite(amount) && amount > 0 ? Math.round(amount * 100) / 100 : null;
}

function soles(amount) {
  return `S/ ${amount.toFixed(2)}`;
}

function card(p) {
  const reservado = String(p.estado || '').toUpperCase().split(/\s+/).includes('RESERVADO');
  const nombreRaw = String(p.nombre || 'Preventa Mardant').trim();
  const nombre = escapeHtml(nombreRaw);
  const img = p.imagen?.trim() ? escapeHtml(p.imagen) : 'https://via.placeholder.com/300x300?text=Sin+imagen';
  const ref = String(p.id || p.nombre || 'preventa').trim();
  const total = positiveAmount(p.precio);
  const abono = positiveAmount(p.reserva_minima) ?? 15;
  const totalCompleto = positiveAmount(p.precio_reserva_100) ?? positiveAmount(p.reserva_100) ?? total;
  const llegada = p['fecha aprox llegada peru'] || 'Proximamente';
  const trackCategory = [p.categoria, p.subcategoria].filter(Boolean).join(' - ') || 'Preventa';
  const producto = `${nombreRaw} (ID #${ref})`;
  const opciones = [];

  if (total !== null && abono <= total) {
    const saldo = Math.round((total - abono) * 100) / 100;
    opciones.push({
      tipo: 'abono', titulo: 'Reserva con abono', total,
      detalle: `Abono hoy ${soles(abono)} · Saldo ${soles(saldo)}`,
      boton: `RESERVAR CON ${soles(abono)}`,
      mensaje: `Hola, quiero reservar la preventa ${producto} con un abono de ${soles(abono)}. Precio final: ${soles(total)}. Saldo por pagar: ${soles(saldo)}.`
    });
  }
  if (totalCompleto !== null) {
    opciones.push({
      tipo: 'completa', titulo: 'Reserva con pago completo', total: totalCompleto,
      detalle: `Pagas ${soles(totalCompleto)} al reservar · Saldo S/ 0.00`,
      boton: 'RESERVAR AL 100%',
      mensaje: `Hola, quiero reservar la preventa ${producto} pagando el 100%: ${soles(totalCompleto)}. Precio final: ${soles(totalCompleto)}. Saldo pendiente: S/ 0.00.`
    });
  }
  const precios = opciones.map(opcion => `${opcion.titulo}: precio final ${soles(opcion.total)} (${opcion.detalle}).`).join(' ');
  const shareSubtitle = total !== null && abono <= total ? `Con abono de ${soles(abono)}` : 'Consulta las modalidades de reserva';
  const shareNote = `${totalCompleto !== null ? `Pago completo ${soles(totalCompleto)}. ` : ''}Llegada aproximada: ${llegada}`;
  const consultar = whatsappLink(`Hola, quiero consultar el precio y la reserva de la preventa ${producto}.`);
  const div = document.createElement('div');
  div.className = 'producto';
  div.dataset.reserved = String(reservado);
  div.innerHTML = `
    <div class='preventa-image'>
      <img src='${img}' alt='${nombre}' class='img' loading='lazy' referrerpolicy='no-referrer'>
      ${reservado ? "<img src='/assets/preventas/reservado.png' class='reserved-stamp' alt='RESERVADO' loading='lazy'>" : ''}
    </div>
    <div class='nombre'>${nombre}</div>
    <div class='categoria'>${escapeHtml(p.categoria || '')}${p.subcategoria ? ' - ' + escapeHtml(p.subcategoria) : ''}</div>
    <div class='estado'>Llega: ${escapeHtml(llegada)}</div>
    <div class='preventa-opciones' aria-label='Modalidades de reserva'>
      ${opciones.map(opcion => `
        <section class='preventa-opcion preventa-opcion-${opcion.tipo}' aria-label='${opcion.titulo}'>
          <div class='preventa-modalidad'>${opcion.titulo}</div>
          <div class='precio'><span>Precio final</span> ${soles(opcion.total)}</div>
          <p class='preventa-detalle'>${opcion.detalle}</p>
          ${reservado ? "<p class='preventa-reservada'>RESERVADO</p>" : `<a href='${escapeHtml(whatsappLink(opcion.mensaje))}'
             target='_blank' rel='noopener noreferrer' class='boton reserva-${opcion.tipo}'
             data-track-item-id='${escapeHtml(ref)}' data-track-item-name='${nombre}'
             data-track-price='${opcion.total.toFixed(2)}' data-track-category='${escapeHtml(trackCategory)}'
             data-track-source='preventa' data-track-cta='${opcion.boton}'>${opcion.boton}</a>`}
        </section>`).join('')}
      ${opciones.length ? '' : reservado ? "<p class='preventa-reservada'>RESERVADO</p>" : `<a class='boton' href='${escapeHtml(consultar)}' target='_blank' rel='noopener noreferrer'>CONSULTAR PREVENTA</a>`}
    </div>
    <div class='social-actions social-actions-single'>
      <button class='social-icon-button' type='button' data-share-preventa
        data-share-title='${nombre} - Preventa Mardant'
        data-share-text='${escapeHtml(`${reservado ? 'RESERVADO. ' : ''}Mira esta preventa en Mardant: ${nombreRaw}. ${precios}`)}'
        data-share-url='${escapeHtml(buildShareUrl({ preventa: ref }))}' data-share-image='${img}'
        data-share-eyebrow='Preventa Mardant' data-share-subtitle='${escapeHtml(shareSubtitle)}'
        data-share-price='${escapeHtml(total !== null ? soles(total) : 'Consultar precio')}'
        data-share-badge='${reservado ? 'RESERVADO' : 'PREVENTA'}' data-share-note='${escapeHtml(shareNote)}'
        data-share-cta='${reservado ? 'Ver preventas en mardant.com' : 'Reservar por WhatsApp en mardant.com'}'
        data-share-file='mardant-preventa-${escapeHtml(ref.replace(/\s+/g, '-'))}.png'
        aria-label='Compartir ${nombre}' title='Compartir'>
        ${shareIcon()}<span class='sr-only'>Compartir</span>
      </button>
    </div>`;
  return div;
}


function showErr(e){
  $('#contenedor').innerHTML = '<p style="color:red;">Error al cargar productos.</p>';
  $('#paginacion').innerHTML = '';
  console.error('Error API preventas:', e);
}