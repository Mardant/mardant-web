/* js/pedidos.js */
import { API_URL }             from './config.js';
import { actualizarCarritoUI } from './carrito-utils.js';

const $ = (s) => document.querySelector(s);

const ITEMS_PER_PAGE = 21;

let allPedidos      = [];  // todo lo que viene de la API
let pedidos         = [];  // filtrado por categoría/estado
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
    .normalize('NFD')                  // quita tildes
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\u00A0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/* ──────────────────────────────────────── */
/* Init                                    */
/* ──────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  console.log('📦 pedidos.js (categoría por URL) cargado');

  // Leemos la categoría desde la URL: ?categoria=pokemon
  const params = new URLSearchParams(window.location.search);
  categoriaActual =
    params.get('categoria') || params.get('anime') || params.get('cat') || 'TODOS';

  fetch(`${API_URL}?accion=pedidosDisponibles`)
    .then((r) => {
      if (!r.ok) throw new Error('API error');
      return r.json();
    })
    .then(renderLista)
    .catch(showErr);

  actualizarCarritoUI();

  // paginación
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

  // normalizamos estructura
  allPedidos = lista.map((p) => ({
    id:        (p.id ?? p.ID ?? '').toString().trim(),
    nombre:    (p.nombre ?? '').toString().trim(),
    categoria: (p.categoria ?? '').toString().trim(),
    imagen:    (p.imagen ?? '').toString().trim(),
    estado:    (p.estado ?? '').toString().trim()
  }));

  aplicarFiltrosYRedibujar();
}

function aplicarFiltrosYRedibujar() {
  const cont = $('#contenedor');
  const pag  = $('#paginacion');

  if (!allPedidos.length) {
    if (cont) cont.innerHTML = '<p>No hay productos disponibles para cotizar.</p>';
    if (pag)  pag.innerHTML  = '';
    return;
  }

  // 1) Filtrar por estado y categoría
  pedidos = allPedidos.filter((p) => {
    const okEstado =
      !p.estado ||
      norm(p.estado) === 'DISPONIBLE' ||
      norm(p.estado) === 'DISPONIBLE A PEDIDO';

    let okCat = true;
    if (categoriaActual && norm(categoriaActual) !== 'TODOS') {
      okCat = norm(p.categoria) === norm(categoriaActual);
    }

    return okEstado && okCat;
  });

  // 2) ORDENAR: ID más grande = más nuevo (descendente)
  pedidos.sort((a, b) => {
    const na = Number(a.id) || 0;
    const nb = Number(b.id) || 0;
    return nb - na; // primero el más nuevo
  });

  if (!pedidos.length) {
    if (cont) cont.innerHTML = '<p>No hay productos en esta categoría por ahora.</p>';
    if (pag)  pag.innerHTML  = '';
    return;
  }

  // 3) Reset paginación y pintar
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

  const partes = [];

  // Helper para crear botones
  const btn = (page, label = page, disabled = false) => {
    return `<button class="page-btn ${page === paginaActual ? 'activa' : ''}"
                    data-page="${page}"
                    ${disabled ? 'disabled' : ''}>
              ${label}
            </button>`;
  };

  // Botón « (anterior)
  const prevPage = Math.max(1, paginaActual - 1);
  partes.push(btn(prevPage, '«', paginaActual === 1));

  // --- Lógica de páginas con "..." ---
  if (totalPaginas <= 7) {
    // Pocas páginas: mostramos todas
    for (let i = 1; i <= totalPaginas; i++) {
      partes.push(btn(i));
    }
  } else {
    if (paginaActual <= 3) {
      // Cerca del inicio: 1 2 3 4 ... N
      for (let i = 1; i <= 4; i++) {
        partes.push(btn(i));
      }
      partes.push('<span class="page-ellipsis">…</span>');
      partes.push(btn(totalPaginas));
    } else if (paginaActual >= totalPaginas - 2) {
      // Cerca del final: 1 ... N-3 N-2 N-1 N
      partes.push(btn(1));
      partes.push('<span class="page-ellipsis">…</span>');
      for (let i = totalPaginas - 3; i <= totalPaginas; i++) {
        partes.push(btn(i));
      }
    } else {
      // En medio: 1 ... P-1 P P+1 ... N
      partes.push(btn(1));
      partes.push('<span class="page-ellipsis">…</span>');
      for (let i = paginaActual - 1; i <= paginaActual + 1; i++) {
        partes.push(btn(i));
      }
      partes.push('<span class="page-ellipsis">…</span>');
      partes.push(btn(totalPaginas));
    }
  }

  // Botón » (siguiente)
  const nextPage = Math.min(totalPaginas, paginaActual + 1);
  partes.push(btn(nextPage, '»', paginaActual === totalPaginas));

  pag.innerHTML = partes.join('');
}

/* ──────────────────────────────────────── */
/* Card: imagen + texto + botón WhatsApp   */
/* ──────────────────────────────────────── */
function card(p) {
  const div = document.createElement('div');
  div.className = 'producto';

  const id         = escapeHtml(p.id || '');
  const etiquetaId = id || 'sin ID';

  const imagen = p.imagen && p.imagen.trim()
    ? escapeHtml(p.imagen.trim())
    : 'https://via.placeholder.com/300x300?text=Sin+imagen';

  const mensajeWA = `Deseo cotizar la figura N° ${etiquetaId}`;
  const urlWA = `https://wa.me/51985135331?text=${encodeURIComponent(mensajeWA)}`;

  div.innerHTML = `
    <img src="${imagen}"
         alt="Figura N° ${etiquetaId}"
         class="img"
         loading="lazy">
    <div class="nombre"><b>Figura N° ${etiquetaId}</b></div>
    <a href="${urlWA}"
       target="_blank"
       rel="noopener noreferrer"
       class="boton boton-cotizar">📩 Cotizar figura</a>
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

