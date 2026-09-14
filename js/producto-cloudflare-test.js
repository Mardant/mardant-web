import { whatsappLink } from './config.js?v=5';
import {
  agregarAlCarrito,
  actualizarCarritoUI,
  actualizarContador,
  mostrarMiniCarrito,
  notificar
} from './carrito-utils.js?v=2';
import './account-widget.js?v=5';

const CORE_TEST_API = 'https://mardant-core-test.gamesmardant.workers.dev/';
const $ = (s) => document.querySelector(s);

function showError(html){
  const box = $('#pdp-error');
  box.innerHTML = `⚠️ ${html}`;
  box.style.display = 'block';
  $('#pdp').style.display = 'none';
}

function updateCounterNow(){
  actualizarCarritoUI();
  actualizarContador();
}

function initMiniCarritoHover(){
  const carritoBtn = document.querySelector('.boton-carrito-flotante');
  const miniCarrito = document.getElementById('mini-carrito');
  if (!carritoBtn || !miniCarrito) return;

  carritoBtn.addEventListener('mouseenter', () => {
    mostrarMiniCarrito();
    miniCarrito.style.display = 'block';
  });
  carritoBtn.addEventListener('mouseleave', () =>
    setTimeout(() => (miniCarrito.style.display = 'none'), 400)
  );

  miniCarrito.addEventListener('mouseenter', () => {
    miniCarrito.style.display = 'block';
  });
  miniCarrito.addEventListener('mouseleave', () => {
    miniCarrito.style.display = 'none';
  });
}

async function loadProducto(){
  const id = new URLSearchParams(location.search).get('id');
  if (!id) return showError('Falta el parámetro <b>id</b> en el link del producto.');

  try {
    const url = new URL(CORE_TEST_API);
    url.searchParams.set('accion', 'producto');
    url.searchParams.set('id', id);

    const res = await fetch(url.toString(), { cache:'no-store' });
    const data = await res.json();
    if (!res.ok || !data?.ok || !data?.producto) throw new Error(data?.error || 'not_found');

    renderProducto(data.producto);
  } catch (err) {
    console.error(err);
    showError('No se pudo cargar el producto desde Cloudflare D1.');
  }
}

function renderProducto(p){
  $('#pdp-error').style.display = 'none';
  $('#pdp').style.display = 'block';

  const nombre = String(p.nombre || '').trim();
  const img = String(p.imagen || '').trim();
  const id = String(p.id ?? '').trim();
  const precioNum = Number(p.precio_num ?? p.precio ?? 0);
  const ofertaNum = Number(p.oferta_num ?? p.oferta ?? NaN);
  const tieneOferta = Number.isFinite(ofertaNum) && ofertaNum > 0 && ofertaNum < precioNum;
  const rawEstado = String(p.estado || '').toUpperCase();
  const estaAgotado = rawEstado.includes('SIN STOCK') || rawEstado.includes('AGOTADO');
  const precioFinal = !estaAgotado && tieneOferta ? ofertaNum : precioNum;

  $('#pdp-nombre').textContent = nombre || 'Producto';
  $('#pdp-id').textContent = id ? `ID: ${id}` : '';
  $('#pdp-cat').textContent = p.categoria || '-';
  $('#pdp-sub').textContent = p.subcategoria || '-';
  $('#pdp-estado').textContent = estaAgotado ? 'AGOTADO' : (tieneOferta ? 'OFERTA' : 'DISPONIBLE');

  const imgEl = $('#pdp-img');
  imgEl.src = img || 'https://via.placeholder.com/900x900?text=Sin+imagen';
  imgEl.alt = nombre;
  imgEl.referrerPolicy = 'no-referrer';

  const precioEl = $('#pdp-precio');
  if (!estaAgotado && tieneOferta) {
    precioEl.innerHTML = `<span class="pdp-old">S/. ${precioNum.toFixed(2)}</span> <span class="pdp-new">S/. ${precioFinal.toFixed(2)}</span>`;
  } else {
    precioEl.textContent = `S/. ${precioFinal.toFixed(2)}`;
  }

  const addBtn = $('#pdp-add');
  addBtn.hidden = estaAgotado;
  addBtn.disabled = estaAgotado;
  addBtn.onclick = () => {
    if (estaAgotado) return;
    agregarAlCarrito({
      id,
      nombre,
      precio: precioFinal,
      oferta: null,
      imagen: img
    });
    actualizarContador();
  };

  const copyBtn = $('#pdp-copy');
  copyBtn.hidden = estaAgotado;
  copyBtn.onclick = async () => {
    try {
      await navigator.clipboard.writeText(location.href);
      notificar('🔗 Link copiado', 'success');
    } catch (_) {
      notificar('No se pudo copiar el link.', 'warning');
    }
  };

  const waBtn = $('#pdp-wa');
  const msg = [
    estaAgotado ? 'Hola, quiero cotizar este producto agotado:' : '¡Hola! Quiero este producto:',
    `• ${nombre}`,
    id ? `• ID: ${id}` : null,
    `• Precio: S/. ${precioFinal.toFixed(2)}`,
    `• Link: ${location.href}`
  ].filter(Boolean).join('\n');
  waBtn.href = whatsappLink(msg);
  waBtn.textContent = estaAgotado ? 'Cotizar producto agotado' : 'Pedir por WhatsApp';

  updateCounterNow();
}

document.addEventListener('DOMContentLoaded', () => {
  initMiniCarritoHover();
  updateCounterNow();
  loadProducto();
});
