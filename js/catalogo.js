/* js/catalogo.js — toda la lógica que tenías, adaptada a fetch + GitHub */

/* -------------- CONFIG --------------- */
import { API_URL } from './config.js'; // Usa el mismo config.js

const productosPorPagina = 21;
let productosGlobal = [];
let categoriaActual = '';
let paginaActual = 1;

/* -------------- HELPERS -------------- */
const $ = (s) => document.querySelector(s);
const escapeHtml = (t) =>
  typeof t === 'string'
    ? t
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;')
    : t;

const fetchJSON = (accion) =>
  fetch(${API_URL}?accion=${accion}).then((r) => {
    if (!r.ok) throw new Error('API error');
    return r.json();
  });

/* -------------- INICIAL -------------- */
document.addEventListener('DOMContentLoaded', () => {
  // Inputs
  $('#orden').addEventListener('change', aplicarFiltros);
  $('#estado').addEventListener('change', aplicarFiltros);
  $('#buscador').addEventListener('input', aplicarFiltros);

  // Categorías
  document.querySelectorAll('.categoria-imagen').forEach((btn) =>
    btn.addEventListener('click', () => {
      document
        .querySelectorAll('.categoria-imagen')
        .forEach((b) => b.classList.remove('selected'));
      btn.classList.add('selected');
      categoriaActual = (btn.dataset.categoria || '').toUpperCase();
      fillSubcategorias();
      aplicarFiltros();
    })
  );

  // Carga de datos
  fetchJSON('productos')
    .then((data) => {
      productosGlobal = data;
      fillSubcategorias(); // todas
      aplicarFiltros();
    })
    .catch((e) => console.error(e));
});

/* -------------- SUB‑CATEGORÍAS -------------- */
function fillSubcategorias() {
  const cont = $('#subfiltro-contenedor');
  cont.innerHTML = '';

  if (!categoriaActual) return;

  const subs = [
    ...new Set(
      productosGlobal
        .filter((p) => p.categoria.toUpperCase() === categoriaActual)
        .map((p) => p.subcategoria)
    ),
  ].sort();

  if (!subs.length) return;

  const select = document.createElement('select');
  select.id = 'subcategoria-select';
  select.innerHTML =
    '<option value="">Todos los personajes</option>' +
    subs.map((s) => <option value="${s}">${s}</option>).join('');
  select.addEventListener('change', aplicarFiltros);
  cont.appendChild(select);
}

/* -------------- FILTROS -------------- */
function aplicarFiltros() {
  const texto = ($('#buscador').value || '').toLowerCase();
  const orden = $('#orden').value;
  const estadoFiltro = $('#estado').value;
  const subcat =
    ($('#subfiltro-contenedor select')?.value || '').toLowerCase();

  let lista = productosGlobal.filter((p) => {
    const catOK =
      !categoriaActual || p.categoria.toUpperCase() === categoriaActual;
    const subOK = !subcat || p.subcategoria.toLowerCase() === subcat;
    const txtOK =
      p.nombre.toLowerCase().includes(texto) ||
      p.categoria.toLowerCase().includes(texto) ||
      p.subcategoria.toLowerCase().includes(texto);

    const estado = (p.estado || '').toUpperCase();
    const estadoOK =
      estadoFiltro === 'todos' ||
      (estadoFiltro === 'disponible' && !estado.includes('SIN STOCK')) ||
      (estadoFiltro === 'agotado' && estado.includes('SIN STOCK'));

    return catOK && subOK && txtOK && estadoOK;
  });

  // ofertas
  if (orden === 'oferta') {
    lista = lista.filter((p) => p.oferta && !isNaN(p.oferta));
  }

  // ordenamiento
  const precioReal = (p) =>
    !isNaN(parseFloat(p.oferta)) ? parseFloat(p.oferta) : parseFloat(p.precio);

  switch (orden) {
    case 'recientes':
      lista.sort((a, b) => b.id - a.id);
      break;
    case 'precio-asc':
      lista.sort((a, b) => precioReal(a) - precioReal(b));
      break;
    case 'precio-desc':
      lista.sort((a, b) => precioReal(b) - precioReal(a));
      break;
    case 'nombre-az':
      lista.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' }));
      break;
    case 'nombre-za':
      lista.sort((a, b) => b.nombre.localeCompare(a.nombre, 'es', { sensitivity: 'base' }));
      break;
  }

  paginaActual = 1;
  renderProductos(lista);
}

/* -------------- RENDER -------------- */
function renderProductos(arr){
  const cont = $('#contenedor');
  cont.innerHTML = '';

  if(!arr.length){
    cont.innerHTML = '<p>No hay productos que coincidan.</p>';
    $('#paginacion').innerHTML='';
    return;
  }

  const totalPag = Math.ceil(arr.length / productosPorPagina);
  const desde    = (paginaActual-1)*productosPorPagina;
  const hasta    = desde + productosPorPagina;
  arr.slice(desde,hasta).forEach(p => cont.appendChild(cardProducto(p)));

  renderPaginacion(totalPag, arr);
}

function cardProducto(p){
  const card = document.createElement('div');
  card.className = 'producto';

  const nombre = escapeHtml(p.nombre);
  const img    = escapeHtml(p.imagen);
  const oferta = p.oferta && !isNaN(p.oferta);
  const precioO = (+p.precio).toFixed(2);
  const precioF = oferta ? (+p.oferta).toFixed(2) : precioO;

  const estado = oferta
      ? 'OFERTA'
      : (p.estado||'').toUpperCase().includes('SIN STOCK') ? 'AGOTADO' : 'Disponible';

  card.innerHTML = `
    <img src="${img}" alt="${nombre}" class="img" loading="lazy">
    <div class="nombre" title="${nombre}">${nombre}</div>
    <div class="precio">${
       oferta
        ? `<span style="text-decoration:line-through;color:#bbb;">S/. ${precioO}</span><br>
           <span style="color:#FFFF00;font-weight:bold;">S/. ${precioF}</span>`
        : `<span style="color:#4caf50;font-weight:bold;">S/. ${precioO}</span>`
    }</div>
    <div class="estado">${estado}</div>
    <button class="agregar-carrito" ${estado==='AGOTADO'?'disabled':''}>Añadir al carrito</button>
  `;
  card.querySelector('.agregar-carrito').onclick = ()=>{
    agregarAlCarrito({
      nombre,
      precio:+precioF,
      imagen:img||'https://via.placeholder.com/300x300?text=Sin+imagen',
      estado
    });
    mostrarNotificacionCarrito('✅ Producto añadido al carrito');
  };

  return card;
}

/* ------------- PAGINACIÓN --------------- */
function renderPaginacion(total, arr){
  const pag = $('#paginacion');
  pag.innerHTML='';

  const crearBtn = (txt,num,extra='')=>{
    const b=document.createElement('button');
    b.className=`boton ${extra}`;
    b.textContent=txt;
    b.onclick=()=>{paginaActual=num;renderProductos(arr);};
    return b;
  };

  const mostrar=3;

  if(paginaActual>1) pag.appendChild(crearBtn('«',paginaActual-1));

  if(paginaActual>mostrar+1){
    pag.appendChild(crearBtn(1,1));
    pag.appendChild(document.createTextNode(' … '));
  }

  for(let i=Math.max(1,paginaActual-mostrar); i<=Math.min(total,paginaActual+mostrar); i++){
    pag.appendChild(crearBtn(i,i, i===paginaActual?'active':''));
  }

  if(paginaActual<total-mostrar){
    pag.appendChild(document.createTextNode(' … '));
    pag.appendChild(crearBtn(total,total));
  }

  if(paginaActual<total) pag.appendChild(crearBtn('»',paginaActual+1));
}

import {
  agregarAlCarrito,
  actualizarCarritoUI,
  mostrarMiniCarrito,
} from './carrito-utils.js'; // si decides separarlo
document.addEventListener('DOMContentLoaded', actualizarCarritoUI);


  if(paginaActual<total) pag.appendChild(crearBtn('»',paginaActual+1));
}

