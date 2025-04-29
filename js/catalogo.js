/* js/catalogo.js — versión corregida */
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

let timeoutBusqueda;

const $ = (s) => document.querySelector(s);
const debounce = (func, delay = 300) => (...args) => {
  clearTimeout(timeoutBusqueda);
  timeoutBusqueda = setTimeout(() => func.apply(this, args), delay);
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

document.addEventListener('DOMContentLoaded', () => {
  $('#orden').addEventListener('change', aplicarFiltros);
  $('#estado').addEventListener('change', aplicarFiltros);
  $('#buscador').addEventListener('input', debounce(aplicarFiltros));

  document.querySelectorAll('.categoria-imagen').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.categoria-imagen')
        .forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      categoriaActual = (btn.dataset.categoria || '').toUpperCase();
      fillSubcategorias();
      aplicarFiltros();
    });
  });

  const carritoBtn = $('.boton-carrito-flotante');
  const miniCarrito = $('#mini-carrito');
  if (carritoBtn && miniCarrito) {
    // ... (keep existing hover logic)
  }

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

// ... (keep fillSubcategorias and aplicarFiltros functions)

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

// ... (resto del código manteniendo las mejoras de paginación)
