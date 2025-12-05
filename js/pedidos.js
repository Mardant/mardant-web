/* js/pedidos.js */
import { API_URL }             from './config.js';
import { actualizarCarritoUI } from './carrito-utils.js';

const $ = (s) => document.querySelector(s);

const ITEMS_PER_PAGE = 20;

let allPedidos      = [];  // todo lo que viene del backend
let pedidos         = [];  // filtrado (categoria + estado)
let paginaActual    = 1;
let categoriaActual = 'TODOS';

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
    .replace(/\u00A0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/* ──────────────────────────────────────── */
/* Init                                    */
/* ──────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  console.log('📦 pedidos.js (cotizador por ID) cargado');

  fetch(`${API_URL}?accion=pedidosDisponibles`)
    .then((r) => {
      if (!r.ok) throw new Error('API error');
      return r.json();
    })
    .then(renderLista)
    .catch(showErr);

  actualizarCarritoUI();

  // Cambio de categoría (anime)
  const sel = $('#filtroCategoria');
  if (sel) {
    sel.addEventListener('change', (ev) => {
      categoriaActual = ev.target.value || 'TODOS';
      aplicarFiltrosYRedibujar();
    });
  }

  // Click en paginación
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
        window.scrollTo({
          top: cont.offsetTop - 120,
          behavior: 'smooth',
        });
      }
    });
  }
});

/* ──────────────────────────────────────── */
/* Render principal                        */
/* ──────────────────────────────────────── */
function renderLista(lista = []) {
  const cont = $('#contenedor');
  const pag  = $('#paginacion');
  if (cont) cont.innerHTML = '';
  if (pag)  pag.innerHTML  = '';

  if (!lista || !lista.length) {
    if (cont) {
      cont.innerHTML =
        '<p>No hay productos disponibles para cotizar en este momento.</p>';
    }
    return;
  }

  // Normalizamos estructura
  allPedidos = lista.map((p) => ({
    id:        (p.id ?? p.ID ?? '').toString().trim(),
    nombre:    (p.nombre ?? '').toString().trim(),
    categoria: (p.categoria ?? '').toString().trim(),
    imagen:    (p.imagen ?? '').toString().trim(),
    estado:    (p.estado ?? '').toString().trim()
  }));

  categoriaActual = 'TODOS';

  rellenarSelectCategorias();
  aplicarFiltrosYRedibujar();
}

function rellenarSelectCategorias() {
  const sel = $('#filtroCategoria');
  if (!sel) return;

  const categorias = Array.from(
    new Set(
      allPedidos
        .map((p) => (p.categoria || '').trim())
        .filter((c) => c)
    )
  ).sort((a, b) => a.localeCompare(b, 'es'));

  let opciones = '<option value="TODOS">Todos los animes</option>';
  categorias.forEach((cat) => {
    const esc = escapeHtml(cat);
    opciones += `<option value="${esc}">${esc}</option>`;
  });

  sel.innerHTML = opciones;
  sel.value = 'TODOS';
}

function aplicarFiltrosYRedibujar() {
  const cont = $('#contenedor');
  const pag  = $('#paginacion');

  if (!allPedidos.length) {
    if (cont) cont.innerHTML = '<p>No hay productos disponibles para cotizar.</p>';
    if (pag)  pag.innerHTML  = '';
    return;
  }

  pedidos = allPedidos.filter((p) => {
    const okEstado =
      !p.estado ||
      norm(p.estado) === 'DISPONIBLE' ||
      norm(p.estado) === 'DISPONIBLE A PEDIDO';

    const okCat =
      categoriaActual === 'TODOS'
        ? true
        : norm(p.categoria) === norm(categoriaActual);

    return okEstado && okCat;
  });

  if (!pedidos.length) {
    if (cont) cont.innerHTML = '<p>No hay productos en esa categoría por ahora.</p>';
    if (pag)  pag.innerHTML  = '';
    return;
  }

  paginaActual = 1;
  pintarPagina();
  dibujarPaginacion();
}

/* ──────────────────────────────────────── */
/* Paginación                              */
/* ──────────────────────────────────────── */
function pintarPagina() {
  const cont = $('#contenedor');
  if (!cont) return;

  cont.innerHTML = '';

  const totalPaginas = Math.ceil(pedidos.length / ITEMS_PER_PAGE);
  if (!totalPaginas) {
    cont.innerHTML =
      '<p>No hay productos disponibles para cotizar en este momento.</p>';
    return;
  }

  const inicio = (paginaActual - 1) * ITEMS_PER_PAGE;
  const fin    = inicio + ITEMS_PER_PAGE;
  const pagina = pedidos.slice(inicio, fin);

  pagina.forEach((p) => cont.appendChild(card(p)));
}

function dibujarPaginacion() {
  const pag = $('#paginacion');
  if (!pag) return;

  const totalPaginas = Math.ceil(pedidos.length / ITEMS_PER_PAGE);
  pag.innerHTML = '';
  if (totalPaginas <= 1) return;

  let html = '';

  const prevPage = paginaActual - 1;
  html += `<button class="page-btn" data-page="${prevPage}" ${
    paginaActual === 1 ? 'disabled' : ''
  }>&laquo;</button>`;

  for (let i = 1; i <= totalPaginas; i++) {
    html += `<button class="page-btn ${
      i === paginaActual ? 'activa' : ''
    }" data-page="${i}">${i}</button>`;
  }

  const nextPage = paginaActual + 1;
  html += `<button class="page-btn" data-page="${nextPage}" ${
    paginaActual === totalPaginas ? 'disabled' : ''
  }>&raquo;</button>`;

  pag.innerHTML = html;
}

/* ──────────────────────────────────────── */
/* Card: sólo imagen + ID (+ categoría)    */
/* ──────────────────────────────────────── */
function card(p) {
  const div = document.createElement('div');
  div.className = 'producto';

  const id          = escapeHtml(p.id || '');
  const etiquetaId  = id || 'sin ID';
  const categoria   = p.categoria ? escapeHtml(p.categoria) : '';

  const imagen = p.imagen && p.imagen.trim()
    ? escapeHtml(p.imagen.trim())
    : 'https://via.placeholder.com/300x300?text=Sin+imagen';

  const mensajeWA = `Deseo cotizar la figura N° ${etiquetaId}`;
  const urlWA = `https://wa.me/51985135331?text=${encodeURIComponent(mensajeWA)}`;

  div.innerHTML = `
    <a href="${urlWA}"
       target="_blank"
       rel="noopener noreferrer"
       class="link-imagen"
       title="Cotizar figura N° ${etiquetaId}">
      <img src="${imagen}"
           alt="Figura N° ${etiquetaId}"
           class="img"
           loading="lazy">
    </a>
    <div class="nombre"><b>Figura N° ${etiquetaId}</b></div>
    ${categoria ? `<div class="categoria-pedido">${categoria}</div>` : ''}
  `;

  return div;
}

/* ──────────────────────────────────────── */
function showErr(e) {
  console.error('❌ Error API pedidos:', e);
  const cont = $('#contenedor');
  const pag  = $('#paginacion');
  if (cont) {
    cont.innerHTML =
      '<p style="color:red;">Error al cargar productos para cotizar.</p>';
  }
  if (pag) pag.innerHTML = '';
}
