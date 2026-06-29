/* js/pedidos.js */
import { API_URL, whatsappLink } from './config.js';
import { actualizarCarritoUI } from './carrito-utils.js';
import {
  bookmarkIcon,
  buildShareUrl,
  getVisitorId,
  likeIcon,
  loadStoredSet,
  saveStoredSet,
  shareIcon,
  shareVisualItem
} from './social-actions.js?v=2';

const $ = (s) => document.querySelector(s);
const ITEMS_PER_PAGE = 21;
const PEDIDOS_LIKES_KEY = 'mardant_pedidos_likes_v1';
const PEDIDOS_SAVES_KEY = 'mardant_pedidos_saves_v1';

let allPedidos = [];
let pedidos = [];
let paginaActual = 1;
let ordenActual = 'newest';
let pedidoLikes = new Map();
let likedPedidos = loadStoredSet(PEDIDOS_LIKES_KEY);
let savedPedidos = loadStoredSet(PEDIDOS_SAVES_KEY);

const escapeHtml = (t) =>
  typeof t === 'string'
    ? t
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;')
    : t;

const norm = (s) =>
  (s || '')
    .toString()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\u00A0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

document.addEventListener('DOMContentLoaded', () => {
  Promise.all([
    fetch(`${API_URL}?accion=pedidosDisponibles`).then((r) => {
      if (!r.ok) throw new Error('API error');
      return r.json();
    }),
    cargarInteraccionesPedidos()
  ])
    .then(([lista]) => renderLista(lista))
    .catch(showErr);

  actualizarCarritoUI();

  const orderSelect = document.getElementById('pedidoOrdenSelect');
  if (orderSelect) {
    orderSelect.addEventListener('change', () => {
      ordenActual = orderSelect.value === 'oldest' ? 'oldest' : 'newest';
      aplicarFiltrosYRedibujar();
    });
  }

  const pag = $('#paginacion');
  if (pag) {
    pag.addEventListener('click', (ev) => {
      const btn = ev.target.closest('button[data-page]');
      if (!btn || btn.disabled) return;

      const nueva = Number(btn.dataset.page);
      const totalPaginas = Math.ceil(pedidos.length / ITEMS_PER_PAGE);
      if (Number.isNaN(nueva) || nueva < 1 || nueva > totalPaginas) return;

      paginaActual = nueva;
      pintarPagina();
      dibujarPaginacion();

      const cont = $('#contenedor');
      if (cont) {
        window.scrollTo({ top: cont.offsetTop - 120, behavior: 'smooth' });
      }
    });
  }

  $('#contenedor')?.addEventListener('click', (event) => {
    const shareBtn = event.target.closest('[data-pedido-share]');
    if (shareBtn) {
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
      return;
    }

    const likeBtn = event.target.closest('[data-pedido-like]');
    if (likeBtn) {
      event.preventDefault();
      event.stopPropagation();
      togglePedidoInteraction('LIKE', likeBtn.dataset.pedidoLike, likeBtn);
      return;
    }

    const saveBtn = event.target.closest('[data-pedido-save]');
    if (saveBtn) {
      event.preventDefault();
      event.stopPropagation();
      togglePedidoInteraction('SAVE', saveBtn.dataset.pedidoSave, saveBtn);
    }
  });
});

function likeCountForPedido(id){
  return pedidoLikes.get(String(id)) || 0;
}

async function cargarInteraccionesPedidos(){
  try {
    const res = await fetch(`${API_URL}?accion=pedidosSocialCounts&ts=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!data || data.ok === false) throw new Error(data?.error || 'social_counts_error');
    pedidoLikes = new Map(Object.entries(data.likes || {}).map(([id, count]) => [String(id), Number(count) || 0]));
  } catch (error) {
    console.warn('No se pudieron cargar interacciones de pedidos:', error);
    pedidoLikes = new Map();
  }
}

function actualizarBotonesPedido(id){
  const itemId = String(id || '');
  document.querySelectorAll('[data-pedido-like]').forEach(button => {
    if (button.dataset.pedidoLike !== itemId) return;
    const liked = likedPedidos.has(itemId);
    button.classList.toggle('is-active', liked);
    button.setAttribute('aria-pressed', liked ? 'true' : 'false');
    button.title = liked ? 'Quitar me gusta' : 'Me gusta';
    button.setAttribute('aria-label', `${liked ? 'Quitar me gusta' : 'Me gusta'} figura ${itemId}`);
    const count = button.querySelector('.social-count');
    if (count) count.textContent = String(likeCountForPedido(itemId));
  });
  document.querySelectorAll('[data-pedido-save]').forEach(button => {
    if (button.dataset.pedidoSave !== itemId) return;
    const saved = savedPedidos.has(itemId);
    button.classList.toggle('is-active', saved);
    button.setAttribute('aria-pressed', saved ? 'true' : 'false');
    button.title = saved ? 'Quitar guardado' : 'Guardar';
    button.setAttribute('aria-label', `${saved ? 'Quitar guardado' : 'Guardar'} figura ${itemId}`);
  });
}

async function togglePedidoInteraction(tipo, id, button){
  const itemId = String(id || '').trim();
  if (!itemId) return;

  const isLike = tipo === 'LIKE';
  const set = isLike ? likedPedidos : savedPedidos;
  const storageKey = isLike ? PEDIDOS_LIKES_KEY : PEDIDOS_SAVES_KEY;
  const wasActive = set.has(itemId);
  const nextActive = !wasActive;
  const previousCount = likeCountForPedido(itemId);

  if (button) button.disabled = true;
  if (nextActive) set.add(itemId);
  else set.delete(itemId);
  saveStoredSet(storageKey, set);

  if (isLike) pedidoLikes.set(itemId, Math.max(0, previousCount + (nextActive ? 1 : -1)));
  actualizarBotonesPedido(itemId);

  try {
    const res = await fetch(`${API_URL}?route=pedido_social_toggle`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        item_id: itemId,
        tipo,
        active: nextActive,
        visitor_id: getVisitorId(),
        user_agent: navigator.userAgent || ''
      })
    });
    const data = await res.json();
    if (!data || data.ok === false) throw new Error(data?.error || 'social_toggle_error');
    if (isLike && data.count != null) pedidoLikes.set(itemId, Number(data.count) || 0);
    actualizarBotonesPedido(itemId);
  } catch (error) {
    if (wasActive) set.add(itemId);
    else set.delete(itemId);
    saveStoredSet(storageKey, set);
    if (isLike) pedidoLikes.set(itemId, previousCount);
    actualizarBotonesPedido(itemId);
    alert('No se pudo actualizar esta accion. Intentalo otra vez.');
  } finally {
    if (button) button.disabled = false;
  }
}

function renderLista(lista = []) {
  const cont = $('#contenedor');
  const pag = $('#paginacion');
  if (cont) cont.innerHTML = '';
  if (pag) pag.innerHTML = '';

  if (!lista || !lista.length) {
    if (cont) cont.innerHTML = '<p>No hay productos disponibles para cotizar en este momento.</p>';
    return;
  }

  allPedidos = lista.map((p) => ({
    id: (p.id ?? p.ID ?? '').toString().trim(),
    nombre: (p.nombre ?? '').toString().trim(),
    imagen: (p.imagen ?? '').toString().trim(),
    estado: (p.estado ?? '').toString().trim()
  }));

  aplicarFiltrosYRedibujar();
}

function aplicarFiltrosYRedibujar() {
  const cont = $('#contenedor');
  const pag = $('#paginacion');

  if (!allPedidos.length) {
    if (cont) cont.innerHTML = '<p>No hay productos disponibles para cotizar.</p>';
    if (pag) pag.innerHTML = '';
    return;
  }

  pedidos = allPedidos.filter((p) => {
    const estado = norm(p.estado);
    return !estado || estado === 'DISPONIBLE' || estado === 'DISPONIBLE A PEDIDO';
  });

  pedidos.sort((a, b) => {
    const na = Number(a.id) || 0;
    const nb = Number(b.id) || 0;
    return ordenActual === 'oldest' ? na - nb : nb - na;
  });

  if (!pedidos.length) {
    if (cont) cont.innerHTML = '<p>No hay productos disponibles para cotizar por ahora.</p>';
    if (pag) pag.innerHTML = '';
    return;
  }

  paginaActual = 1;
  pintarPagina();
  dibujarPaginacion();
}

function pintarPagina() {
  const cont = $('#contenedor');
  if (!cont) return;

  cont.innerHTML = '';

  const totalPaginas = Math.ceil(pedidos.length / ITEMS_PER_PAGE);
  if (!totalPaginas) {
    cont.innerHTML = '<p>No hay productos disponibles para cotizar en este momento.</p>';
    return;
  }

  const inicio = (paginaActual - 1) * ITEMS_PER_PAGE;
  const fin = inicio + ITEMS_PER_PAGE;
  pedidos.slice(inicio, fin).forEach((p) => cont.appendChild(card(p)));
}

function dibujarPaginacion() {
  const pag = $('#paginacion');
  if (!pag) return;

  const totalPaginas = Math.ceil(pedidos.length / ITEMS_PER_PAGE);
  pag.innerHTML = '';
  if (totalPaginas <= 1) return;

  const partes = [];
  const btn = (page, label = page, disabled = false) => `
    <button class="page-btn ${page === paginaActual ? 'activa' : ''}"
      data-page="${page}"
      ${disabled ? 'disabled' : ''}>${label}</button>`;

  partes.push(btn(Math.max(1, paginaActual - 1), '«', paginaActual === 1));

  if (totalPaginas <= 7) {
    for (let i = 1; i <= totalPaginas; i++) partes.push(btn(i));
  } else if (paginaActual <= 3) {
    for (let i = 1; i <= 4; i++) partes.push(btn(i));
    partes.push('<span class="page-ellipsis">...</span>');
    partes.push(btn(totalPaginas));
  } else if (paginaActual >= totalPaginas - 2) {
    partes.push(btn(1));
    partes.push('<span class="page-ellipsis">...</span>');
    for (let i = totalPaginas - 3; i <= totalPaginas; i++) partes.push(btn(i));
  } else {
    partes.push(btn(1));
    partes.push('<span class="page-ellipsis">...</span>');
    for (let i = paginaActual - 1; i <= paginaActual + 1; i++) partes.push(btn(i));
    partes.push('<span class="page-ellipsis">...</span>');
    partes.push(btn(totalPaginas));
  }

  partes.push(btn(Math.min(totalPaginas, paginaActual + 1), '»', paginaActual === totalPaginas));
  pag.innerHTML = partes.join('');
}

function card(p) {
  const div = document.createElement('div');
  div.className = 'producto';

  const rawId = String(p.id || '').trim();
  const id = escapeHtml(rawId);
  const etiquetaId = id || 'sin ID';
  const liked = likedPedidos.has(rawId);
  const saved = savedPedidos.has(rawId);

  const imagen = p.imagen && p.imagen.trim()
    ? escapeHtml(p.imagen.trim())
    : 'https://via.placeholder.com/300x300?text=Sin+imagen';

  const mensajeWA = `Deseo pedir desde Japon la figura Nro ${rawId || 'sin ID'}`;
  const urlWA = whatsappLink(mensajeWA);
  const shareUrl = buildShareUrl({ pedido: rawId });

  div.innerHTML = `
    <img src="${imagen}"
         alt="Figura Nro ${etiquetaId}"
         class="img"
         loading="lazy"
         referrerpolicy="no-referrer">
    <div class="nombre"><b>Figura Nro ${etiquetaId}</b></div>
    <a href="${urlWA}"
       target="_blank"
       rel="noopener noreferrer"
       class="boton boton-cotizar">PEDIR DESDE JAPON</a>
    <div class="social-actions social-actions-three">
      <button
        class="social-icon-button"
        type="button"
        data-pedido-share="${id}"
        data-share-title="Figura Nro ${etiquetaId} - Mardant"
        data-share-text="Mira esta figura a pedido en Mardant: Figura Nro ${etiquetaId}"
        data-share-url="${escapeHtml(shareUrl)}"
        data-share-image="${imagen}"
        data-share-eyebrow="Productos a pedido"
        data-share-subtitle="Figura Nro ${etiquetaId}"
        data-share-badge="A PEDIDO"
        data-share-note="Pidelo desde Japon con Mardant."
        data-share-cta="Pedir desde Japon en mardant.com"
        data-share-file="mardant-pedido-${id || 'producto'}.png"
        aria-label="Compartir figura ${etiquetaId}"
        title="Compartir">
        ${shareIcon()}
        <span class="sr-only">Compartir</span>
      </button>
      <button
        class="social-icon-button is-wide${liked ? ' is-active' : ''}"
        type="button"
        data-pedido-like="${id}"
        aria-label="${liked ? 'Quitar me gusta' : 'Me gusta'} figura ${etiquetaId}"
        aria-pressed="${liked ? 'true' : 'false'}"
        title="${liked ? 'Quitar me gusta' : 'Me gusta'}">
        ${likeIcon()}
        <span class="social-count">${likeCountForPedido(rawId)}</span>
      </button>
      <button
        class="social-icon-button${saved ? ' is-active' : ''}"
        type="button"
        data-pedido-save="${id}"
        aria-label="${saved ? 'Quitar guardado' : 'Guardar'} figura ${etiquetaId}"
        aria-pressed="${saved ? 'true' : 'false'}"
        title="${saved ? 'Quitar guardado' : 'Guardar'}">
        ${bookmarkIcon()}
        <span class="sr-only">Guardar</span>
      </button>
    </div>
  `;

  return div;
}

function showErr(e) {
  console.error('Error API pedidos:', e);
  const cont = $('#contenedor');
  const pag = $('#paginacion');
  if (cont) cont.innerHTML = '<p style="color:red;">Error al cargar productos para cotizar.</p>';
  if (pag) pag.innerHTML = '';
}
