/* js/catalogo.js - Versión Final Corregida */
import { API_URL } from './config.js';
import { 
  agregarAlCarrito,
  actualizarCarritoUI,
  mostrarMiniCarrito,
  actualizarContador
} from './carrito-utils.js';

const productosPorPagina = 21;
let productosGlobal = [];
let categoriaActual = '';
let paginaActual = 1;

// ---------------------------
// FUNCIÓN PRINCIPAL DE FILTROS (DECLARADA PRIMERO)
// ---------------------------
function aplicarFiltros() {
  const texto = ($('#buscador').value || '').toLowerCase();
  const orden = $('#orden').value;
  const estadoFiltro = $('#estado').value;
  const subcat = ($('#subfiltro-contenedor select')?.value || '').toLowerCase();

  let lista = productosGlobal.filter((p) => {
    const catOK = !categoriaActual || p.categoria.toUpperCase() === categoriaActual;
    const subOK = !subcat || p.subcategoria.toLowerCase() === subcat;
    const txtOK = p.nombre.toLowerCase().includes(texto) ||
                  p.categoria.toLowerCase().includes(texto) ||
                  p.subcategoria.toLowerCase().includes(texto);

    const estado = (p.estado || '').toUpperCase();
    const estadoOK = estadoFiltro === 'todos' ||
                    (estadoFiltro === 'disponible' && !estado.includes('SIN STOCK')) ||
                    (estadoFiltro === 'agotado' && estado.includes('SIN STOCK'));

    return catOK && subOK && txtOK && estadoOK;
  });

  if (orden === 'oferta') {
    lista = lista.filter(p => p.oferta && !isNaN(p.oferta));
  }

  const precioReal = (p) => !isNaN(parseFloat(p.oferta)) ? parseFloat(p.oferta) : parseFloat(p.precio);

  switch (orden) {
    case 'recientes':   lista.sort((a, b) => b.id - a.id); break;
    case 'precio-asc':  lista.sort((a, b) => precioReal(a) - precioReal(b)); break;
    case 'precio-desc': lista.sort((a, b) => precioReal(b) - precioReal(a)); break;
    case 'nombre-az':   lista.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' })); break;
    case 'nombre-za':   lista.sort((a, b) => b.nombre.localeCompare(a.nombre, 'es', { sensitivity: 'base' })); break;
  }

  paginaActual = 1;
  renderProductos(lista);
}

// ---------------------------
// INICIALIZACIÓN (SE DECLARA DESPUÉS DE LAS FUNCIONES QUE USA)
// ---------------------------
document.addEventListener('DOMContentLoaded', () => {
  // Configurar listeners
  $('#orden').addEventListener('change', aplicarFiltros);
  $('#estado').addEventListener('change', aplicarFiltros);
  $('#buscador').addEventListener('input', debounce(aplicarFiltros, 300));

  // Configurar categorías
  document.querySelectorAll('.categoria-imagen').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.categoria-imagen').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      categoriaActual = (btn.dataset.categoria || '').toUpperCase();
      fillSubcategorias();
      aplicarFiltros();
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

  // Cargar datos iniciales
  fetchJSON('productos')
    .then(data => {
      productosGlobal = data;
      fillSubcategorias();
      aplicarFiltros();
    })
    .catch(error => {
      console.error('Error:', error);
      $('#contenedor').innerHTML = `
        <div class="error-api">
          <p>⚠️ Error al cargar productos. Intenta recargar la página.</p>
          <button onclick="location.reload()">Recargar</button>
        </div>
      `;
    });

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

const fetchJSON = (accion) => fetch(`${API_URL}?accion=${accion}`)
  .then(r => {
    if (!r.ok) throw new Error(`HTTP error! status: ${r.status}`);
    return r.json();
  });

function fillSubcategorias() {
  const cont = $('#subfiltro-contenedor');
  cont.innerHTML = '';

  if (!categoriaActual) return;

  const subs = [
    ...new Set(
      productosGlobal
        .filter(p => p.categoria.toUpperCase() === categoriaActual)
        .map(p => p.subcategoria)
    ),
  ].sort();

  if (!subs.length) return;

  const select = document.createElement('select');
  select.id = 'subcategoria-select';
  select.innerHTML = '<option value="">Todos los personajes</option>' +
    subs.map(s => `<option value="${s}">${s}</option>`).join('');
  select.addEventListener('change', aplicarFiltros);
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

  const totalPag = Math.ceil(arr.length / productosPorPagina);
  const desde = (paginaActual - 1) * productosPorPagina;
  const hasta = desde + productosPorPagina;
  const page = arr.slice(desde, hasta);

  page.forEach(p => cont.appendChild(cardProducto(p)));
  renderPaginacion(totalPag, arr);
}

function cardProducto(p) {
  const card = document.createElement('div');
  card.className = 'producto';

  const nombre = escapeHtml(p.nombre);
  const img = escapeHtml(p.imagen);
  const precioNum = parseFloat(p.precio) || 0;
  const ofertaNum = parseFloat(p.oferta) || precioNum;
  const tieneOferta = !isNaN(ofertaNum) && ofertaNum < precioNum;
  
  const estado = tieneOferta ? 'OFERTA' : 
    (p.estado || '').toUpperCase().includes('SIN STOCK') ? 'AGOTADO' : 'DISPONIBLE';

  card.innerHTML = `
    <img src="${img}" alt="${nombre}" class="img" loading="lazy">
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
    <div class="estado">${estado}</div>
    <button class="agregar-carrito" ${estado === 'AGOTADO' ? 'disabled' : ''}>
      Añadir al carrito
    </button>
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

function renderPaginacion(total, arr) {
  const pag = $('#paginacion');
  pag.innerHTML = '';

  const MAX_AROUND = 3;
  const makeBtn = (txt, num, extra = '') => {
    const b = document.createElement('button');
    b.className = `boton ${extra}`;
    b.textContent = txt;
    b.setAttribute('aria-label', `Página ${num}`);
    b.onclick = () => { 
      paginaActual = num; 
      renderProductos(arr);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    return b;
  };

  if (paginaActual > 1) pag.appendChild(makeBtn('«', paginaActual - 1));

  if (paginaActual > MAX_AROUND + 1) {
    pag.appendChild(makeBtn('1', 1));
    pag.appendChild(document.createTextNode(' … '));
  }

  for (let i = Math.max(1, paginaActual - MAX_AROUND); i <= Math.min(total, paginaActual + MAX_AROUND); i++) {
    pag.appendChild(makeBtn(i, i, i === paginaActual ? 'active' : ''));
  }

  if (paginaActual < total - MAX_AROUND) {
    pag.appendChild(document.createTextNode(' … '));
    pag.appendChild(makeBtn(total, total));
  }

  if (paginaActual < total) pag.appendChild(makeBtn('»', paginaActual + 1));
}
