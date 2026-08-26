/* js/catalogo.js - Versión Final Corregida */
import { PRODUCTOS_POR_PAGINA } from './config.js';
import { API_CACHE_TTL, cachedFetchJSON } from './api-client.js';
import { 
  agregarAlCarrito,
  actualizarCarritoUI,
  mostrarMiniCarrito,
  actualizarContador
} from './carrito-utils.js';
import { buildShareUrl, shareIcon, shareVisualItem } from './social-actions.js?v=2';
import { setupSearchTracking } from './search-tracking.js?v=1';
import { pageFromUrl, renderCatalogPagination, updateCatalogUrl } from './pagination-utils.js?v=2';

const productosPorPagina = PRODUCTOS_POR_PAGINA;
let productosGlobal = [];
let categoriaActual = '';
let paginaActual = pageFromUrl();
let totalPaginas = 1;
let catalogRequestController = null;
let catalogRequestId = 0;
let subcategoriaActual = '';

function parseMoney(value) {
  const text = String(value ?? '').trim();
  if (!text) return null;

  const normalized = text
    .replace(/\s/g, '')
    .replace(/s\/\.?/i, '')
    .replace(/,/g, '.')
    .replace(/[^\d.]/g, '');

  const parts = normalized.split('.');
  const safeNumber = parts.length > 2
    ? `${parts[0]}.${parts.slice(1).join('')}`
    : normalized;
  const number = Number(safeNumber);

  return Number.isFinite(number) ? number : null;
}

function precioReal(p) {
  const precio = parseMoney(p?.precio) ?? 0;
  const oferta = parseMoney(p?.oferta);
  return oferta !== null && oferta > 0 && oferta < precio ? oferta : precio;
}

function estaAgotado(p) {
  const estado = String(p?.estado || '').toUpperCase();
  return estado.includes('SIN STOCK') || estado.includes('AGOTADO');
}

// ---------------------------
// FUNCIÓN PRINCIPAL DE FILTROS (DECLARADA PRIMERO)
// ---------------------------
function filtrarProductosLocales() {
  const texto = ($('#buscador').value || '').toLowerCase();
  const orden = $('#orden').value;
  const estadoFiltro = $('#estado').value;
  const subcat = subcategoriaActual.toLowerCase();
  const precioMin = parseMoney($('#precio-min')?.value);
  const precioMax = parseMoney($('#precio-max')?.value);

  let lista = productosGlobal.filter((p) => {
    const nombre = String(p.nombre || '').toLowerCase();
    const categoria = String(p.categoria || '').toUpperCase();
    const subcategoria = String(p.subcategoria || '').toLowerCase();
    const catOK = !categoriaActual || categoria === categoriaActual;
    const subOK = !subcat || subcategoria === subcat;
    const txtOK = nombre.includes(texto) ||
                  categoria.toLowerCase().includes(texto) ||
                  subcategoria.includes(texto);

    const isAgotado = estaAgotado(p);
    const estadoOK = estadoFiltro === 'todos' ||
                    (estadoFiltro === 'disponible' && !isAgotado) ||
                    (estadoFiltro === 'agotado' && isAgotado);

    const precio = precioReal(p);
    const precioOK =
      (precioMin === null || precio >= precioMin) &&
      (precioMax === null || precio <= precioMax);

    return catOK && subOK && txtOK && estadoOK && precioOK;
  });

  if (orden === 'oferta') {
    lista = lista.filter(p => p.oferta && !isNaN(p.oferta));
  }

  switch (orden) {
    case 'recientes':   lista.sort((a, b) => b.id - a.id); break;
    case 'precio-asc':  lista.sort((a, b) => precioReal(a) - precioReal(b)); break;
    case 'precio-desc': lista.sort((a, b) => precioReal(b) - precioReal(a)); break;
    case 'nombre-az':   lista.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' })); break;
    case 'nombre-za':   lista.sort((a, b) => b.nombre.localeCompare(a.nombre, 'es', { sensitivity: 'base' })); break;
  }

  return lista;
}

function catalogParams() {
  return {
    page: paginaActual,
    page_size: productosPorPagina,
    search: String($('#buscador')?.value || '').trim(),
    category: categoriaActual,
    subcategory: subcategoriaActual,
    sort: $('#orden')?.value || 'recientes',
    state: $('#estado')?.value || 'todos',
    min_price: String($('#precio-min')?.value || '').trim(),
    max_price: String($('#precio-max')?.value || '').trim()
  };
}

function syncCatalogUrl(mode = 'replace') {
  const params = catalogParams();
  updateCatalogUrl({
    pagina: paginaActual,
    buscar: params.search,
    categoria: params.category,
    subcategoria: params.subcategory,
    orden: params.sort === 'recientes' ? '' : params.sort,
    estado: params.state === 'todos' ? '' : params.state,
    min: params.min_price,
    max: params.max_price
  }, mode);
}

function restoreCatalogStateFromUrl() {
  const params = new URLSearchParams(location.search);
  paginaActual = pageFromUrl();
  categoriaActual = String(params.get('categoria') || '').toUpperCase();
  subcategoriaActual = params.get('subcategoria') || '';
  if ($('#buscador')) $('#buscador').value = params.get('buscar') || '';
  if ($('#orden')) $('#orden').value = params.get('orden') || 'recientes';
  if ($('#estado')) $('#estado').value = params.get('estado') || 'todos';
  if ($('#precio-min')) $('#precio-min').value = params.get('min') || '';
  if ($('#precio-max')) $('#precio-max').value = params.get('max') || '';
  document.querySelectorAll('.categoria-imagen').forEach(button => {
    button.classList.toggle('selected', String(button.dataset.categoria || '').toUpperCase() === categoriaActual);
  });
}

async function loadCatalogPage({ urlMode = 'replace' } = {}) {
  const requestId = ++catalogRequestId;
  catalogRequestController?.abort();
  const controller = new AbortController();
  catalogRequestController = controller;
  const requestedParams = catalogParams();
  const requestedPage = Number(requestedParams.page) || 1;
  syncCatalogUrl(urlMode);
  $('#contenedor')?.setAttribute('aria-busy', 'true');

  try {
    const data = await cachedFetchJSON('productosPage', {
      ttl: API_CACHE_TTL.PRODUCTOS,
      params: requestedParams,
      cacheId: 'productos-page-v3',
      signal: controller.signal
    });
    if (requestId !== catalogRequestId || controller.signal.aborted) return;
    if (!data?.ok || !Array.isArray(data.productos)) throw new Error(data?.error || 'productos_page_unavailable');

    const responsePage = Number(data.page) || 1;
    const responseTotalPages = Number(data.total_pages) || 1;
    // El servidor solo puede corregir la página si la solicitada dejó de existir.
    // Una respuesta distinta dentro del rango corresponde a caché o petición vieja.
    if (responsePage !== requestedPage && requestedPage <= responseTotalPages) {
      throw new Error('catalog_page_response_mismatch');
    }

    paginaActual = responsePage;
    totalPaginas = responseTotalPages;
    fillSubcategorias(data.subcategorias || []);
    renderProductos(data.productos);
    renderPaginacion(totalPaginas);
    syncCatalogUrl('replace');

    if (paginaActual < totalPaginas) {
      cachedFetchJSON('productosPage', {
        ttl: API_CACHE_TTL.PRODUCTOS,
        params: { ...requestedParams, page: paginaActual + 1 },
        cacheId: 'productos-page-v3'
      }).catch(() => {});
    }
  } catch (error) {
    if (requestId !== catalogRequestId || controller.signal.aborted || error?.name === 'AbortError') return;
    await loadCatalogFallback(error, { requestId, controller });
  } finally {
    if (requestId === catalogRequestId) $('#contenedor')?.removeAttribute('aria-busy');
  }
}

async function loadCatalogFallback(serverError, { requestId, controller } = {}) {
  try {
    if (!productosGlobal.length) {
      productosGlobal = await cachedFetchJSON('productos', { ttl: API_CACHE_TTL.PRODUCTOS });
    }
    // Una descarga completa también puede terminar después de que el usuario
    // ya cambió de página. En ese caso no debe volver a pintar datos antiguos.
    if (requestId !== catalogRequestId || controller?.signal.aborted) return;
    fillSubcategorias();
    const lista = filtrarProductosLocales();
    totalPaginas = Math.max(1, Math.ceil(lista.length / productosPorPagina));
    paginaActual = Math.min(paginaActual, totalPaginas);
    const start = (paginaActual - 1) * productosPorPagina;
    renderProductos(lista.slice(start, start + productosPorPagina));
    renderPaginacion(totalPaginas);
    syncCatalogUrl('replace');
    console.warn('Endpoint paginado no disponible; usando catalogo compatible:', serverError);
  } catch (error) {
    console.error('Error:', error);
    $('#contenedor').innerHTML = `
      <div class="error-api">
        <p>Error al cargar productos. Intenta recargar la pagina.</p>
        <button onclick="location.reload()">Recargar</button>
      </div>
    `;
  }
}

function aplicarFiltros() {
  paginaActual = 1;
  subcategoriaActual = $('#subfiltro-contenedor select')?.value || subcategoriaActual;
  loadCatalogPage({ urlMode: 'replace' });
}

// ---------------------------
// INICIALIZACIÓN (SE DECLARA DESPUÉS DE LAS FUNCIONES QUE USA)
// ---------------------------
document.addEventListener('DOMContentLoaded', () => {
  restoreCatalogStateFromUrl();

  // Configurar listeners
  $('#orden').addEventListener('change', aplicarFiltros);
  $('#estado').addEventListener('change', aplicarFiltros);
  $('#buscador').addEventListener('input', debounce(aplicarFiltros, 300));
  setupSearchTracking($('#buscador'), 'CATALOGO');
  $('#precio-min')?.addEventListener('input', debounce(aplicarFiltros, 300));
  $('#precio-max')?.addEventListener('input', debounce(aplicarFiltros, 300));
  $('#limpiar-precio')?.addEventListener('click', () => {
    const min = $('#precio-min');
    const max = $('#precio-max');
    if (min) min.value = '';
    if (max) max.value = '';
    aplicarFiltros();
  });

  $('#contenedor')?.addEventListener('click', (event) => {
    const shareBtn = event.target.closest('[data-share-product]');
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
      oldPrice: shareBtn.dataset.shareOldPrice,
      badge: shareBtn.dataset.shareBadge,
      note: shareBtn.dataset.shareNote,
      cta: shareBtn.dataset.shareCta,
      fileName: shareBtn.dataset.shareFile
    });
  });

  // Configurar categorías
  document.querySelectorAll('.categoria-imagen').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.categoria-imagen').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      categoriaActual = (btn.dataset.categoria || '').toUpperCase();
      subcategoriaActual = '';
      paginaActual = 1;
      loadCatalogPage({ urlMode: 'replace' });
    });
  });

  // Configurar mini-carrito
  const carritoBtn = $('.boton-carrito-flotante');
  const miniCarrito = $('#mini-carrito');
  if (carritoBtn && miniCarrito) {
    carritoBtn.addEventListener('mouseenter', () => {
      mostrarMiniCarrito();
      miniCarrito.style.display = 'block';
    });
    carritoBtn.addEventListener('mouseleave', () => 
      setTimeout(() => (miniCarrito.style.display = 'none'), 400)
    );
    miniCarrito.addEventListener('mouseenter', () => 
      miniCarrito.style.display = 'block'
    );
    miniCarrito.addEventListener('mouseleave', () => 
      miniCarrito.style.display = 'none'
    );
  }

  window.addEventListener('popstate', () => {
    restoreCatalogStateFromUrl();
    loadCatalogPage({ urlMode: 'replace' });
  });

  loadCatalogPage({ urlMode: 'replace' });

  actualizarCarritoUI();
});

// ---------------------------
// FUNCIONES AUXILIARES
// ---------------------------
const $ = (s) => document.querySelector(s);

const debounce = (func, delay = 300) => {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), delay);
  };
};

const escapeHtml = (t) => {
  if (typeof t !== 'string') return t;
  return t.replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#039;')
          .replace(/\//g, '&#x2F;');
};

function fillSubcategorias(serverSubcategories) {
  const cont = $('#subfiltro-contenedor');
  cont.innerHTML = '';

  if (!categoriaActual) return;

  const subs = Array.isArray(serverSubcategories)
    ? serverSubcategories
    : [
        ...new Set(
          productosGlobal
            .filter(p => String(p.categoria || '').toUpperCase() === categoriaActual)
            .map(p => String(p.subcategoria || '').trim())
            .filter(Boolean)
        ),
      ].sort();

  if (!subs.length) return;

  const select = document.createElement('select');
  select.id = 'subcategoria-select';
  select.innerHTML = '<option value="">Todos los personajes</option>' +
    subs.map(s => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join('');
  if ([...select.options].some(option => option.value === subcategoriaActual)) {
    select.value = subcategoriaActual;
  } else {
    subcategoriaActual = '';
  }
  select.addEventListener('change', () => {
    subcategoriaActual = select.value;
    aplicarFiltros();
  });
  cont.appendChild(select);
}

function renderProductos(arr) {
  const cont = $('#contenedor');
  cont.innerHTML = '';

  if (!arr.length) {
    cont.innerHTML = '<p>No hay productos que coincidan.</p>';
    $('#paginacion').innerHTML = '';
    return;
  }

  arr.forEach(p => cont.appendChild(cardProducto(p)));
}

function cardProducto(p) {
  const card = document.createElement('div');
  card.className = 'producto';

  const nombre = escapeHtml(p.nombre);
  const img = escapeHtml(p.imagen);
  const precioNum = parseFloat(p.precio) || 0;
  const ofertaNum = parseFloat(p.oferta) || precioNum;
  const tieneOferta = !isNaN(ofertaNum) && ofertaNum < precioNum;
  
  const agotado = estaAgotado(p);
  const estado = agotado ? 'AGOTADO' : (tieneOferta ? 'OFERTA' : 'DISPONIBLE');
  const estadoClass = estado === 'OFERTA'
    ? 'estado-oferta'
    : estado === 'AGOTADO'
      ? 'estado-agotado'
      : 'estado-disponible';
  const sharePrice = `S/. ${(tieneOferta ? ofertaNum : precioNum).toFixed(2)}`;
  const shareOldPrice = tieneOferta ? `S/. ${precioNum.toFixed(2)}` : '';
  const shareNote = estado === 'AGOTADO'
    ? 'Producto agotado. Consulta si se puede volver a traer.'
    : estado === 'OFERTA'
      ? 'Oferta activa en el catalogo Mardant.'
      : 'Producto disponible en el catalogo Mardant.';
  const shareCta = estado === 'AGOTADO'
    ? 'Cotizar producto agotado en mardant.com'
    : 'Ver producto en mardant.com';
  const trackPrice = tieneOferta ? ofertaNum : precioNum;
  const trackCategory = [p.categoria, p.subcategoria].filter(Boolean).join(' - ');
  const trackBase = `
    data-track-item-id="${escapeHtml(String(p.id ?? '').trim())}"
    data-track-item-name="${nombre}"
    data-track-price="${trackPrice.toFixed(2)}"
    data-track-category="${escapeHtml(trackCategory)}"
    data-track-source="catalogo"
  `;

  card.innerHTML = `
    <img src="${img}" alt="${nombre}" class="img" loading="lazy" referrerpolicy="no-referrer">
    <div class="nombre" title="${nombre}">${nombre}</div>
    <div class="precio">
      ${tieneOferta ? `
        <span style="text-decoration:line-through;color:#bbb;">
          S/. ${precioNum.toFixed(2)}
        </span><br>
        <span style="color:#FFFF00;font-weight:bold;">
          S/. ${ofertaNum.toFixed(2)}
        </span>` : 
        `<span style="color:#4caf50;font-weight:bold;">
          S/. ${precioNum.toFixed(2)}
        </span>`}
    </div>
    <div class="estado ${estadoClass}">${estado}</div>
    <button class="agregar-carrito"
      data-track-action="add_to_cart"
      data-track-cta="Añadir al carrito"
      ${trackBase}
      ${estado === 'AGOTADO' ? 'disabled' : ''}>
      Añadir al carrito
    </button>
    <a class="boton ver-detalle"
      href="./producto.html?id=${encodeURIComponent(p.id)}"
      data-track-action="select_item"
      data-track-cta="Ver detalle"
      ${trackBase}>Ver detalle</a>
    <div class="social-actions social-actions-single">
      <button
        class="social-icon-button"
        type="button"
        data-share-product
        data-share-title="${nombre} - Mardant"
        data-share-text="Mira este producto en Mardant: ${nombre}"
        data-share-url="${escapeHtml(buildShareUrl({ producto: p.id }))}"
        data-share-image="${img}"
        data-share-eyebrow="Catalogo Mardant"
        data-share-subtitle="ID: ${escapeHtml(String(p.id ?? '').trim())}"
        data-share-price="${escapeHtml(sharePrice)}"
        data-share-old-price="${escapeHtml(shareOldPrice)}"
        data-share-badge="${estado}"
        data-share-note="${escapeHtml(shareNote)}"
        data-share-cta="${escapeHtml(shareCta)}"
        data-share-file="mardant-producto-${escapeHtml(String(p.id ?? 'producto'))}.png"
        aria-label="Compartir ${nombre}"
        title="Compartir">
        ${shareIcon()}
        <span class="sr-only">Compartir</span>
      </button>
    </div>
  `;

  if (estado !== 'AGOTADO') {
    card.querySelector('.agregar-carrito').onclick = () => {
      agregarAlCarrito({
        ...p,
        precio: tieneOferta ? ofertaNum : precioNum
      });
      actualizarContador();
    };
  }

  return card;
}

function renderPaginacion(total) {
  renderCatalogPagination($('#paginacion'), {
    current: paginaActual,
    total,
    buttonClass: 'boton',
    activeClass: 'active',
    onSelect: page => {
      paginaActual = page;
      loadCatalogPage({ urlMode: 'push' });
      $('#contenedor')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
}
