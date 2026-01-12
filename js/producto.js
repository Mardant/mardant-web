import { API_URL } from './config.js';
import {
  agregarAlCarrito,
  actualizarCarritoUI,
  mostrarMiniCarrito,
  actualizarContador,
  notificar
} from './carrito-utils.js';

const $ = (s) => document.querySelector(s);
const WA_NUMBER = '51985135331';

document.addEventListener('DOMContentLoaded', () => {
  initMiniCarritoHover();
  actualizarCarritoUI();
  loadProducto();
});

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

  miniCarrito.addEventListener('mouseenter', () =>
    miniCarrito.style.display = 'block'
  );
  miniCarrito.addEventListener('mouseleave', () =>
    miniCarrito.style.display = 'none'
  );
}

async function loadProducto(){
  const id = new URLSearchParams(location.search).get('id');
  if (!id) return showError('Falta el parámetro <b>id</b> en el link del producto.');

  try{
    const res = await fetch(`${API_URL}?accion=producto&id=${encodeURIComponent(id)}`);
    const data = await res.json();

    if (!data || data.ok === false || !data.producto) {
      throw new Error(data?.error || 'not_found');
    }

    renderProducto(data.producto);
  }catch(err){
    console.error(err);
    showError('No se pudo cargar el producto. Si el link es correcto, revisa que ya redeployaste el Apps Script.');
  }
}

function showError(html){
  const box = $('#pdp-error');
  box.innerHTML = `⚠️ ${html}`;
  box.style.display = 'block';
  $('#pdp').style.display = 'none';
}

function renderProducto(p){
  $('#pdp-error').style.display = 'none';
  $('#pdp').style.display = 'block';

  const nombre = String(p.nombre || '').trim();
  const img = (p.imagen || '').trim();
  const id = String(p.id ?? '').trim();

  const precioNum = parseFloat(p.precio) || 0;
  const ofertaNum = parseFloat(p.oferta);
  const tieneOferta = !isNaN(ofertaNum) && ofertaNum > 0 && ofertaNum < precioNum;

  const estadoTxt = tieneOferta
    ? 'OFERTA'
    : (String(p.estado || '').toUpperCase().includes('SIN STOCK') ? 'AGOTADO' : 'DISPONIBLE');

  const precioFinal = tieneOferta ? ofertaNum : precioNum;

  $('#pdp-nombre').textContent = nombre || 'Producto';
  $('#pdp-id').textContent = id ? `ID: ${id}` : '';
  $('#pdp-cat').textContent = p.categoria || '-';
  $('#pdp-sub').textContent = p.subcategoria || '-';

  const estadoEl = $('#pdp-estado');
  estadoEl.textContent = estadoTxt;

  // Imagen
  const imgEl = $('#pdp-img');
  imgEl.src = img || 'https://via.placeholder.com/900x900?text=Sin+imagen';
  imgEl.alt = nombre;

  // Precio
  const precioEl = $('#pdp-precio');
  if (tieneOferta){
    precioEl.innerHTML = `<span class="pdp-old">S/. ${precioNum.toFixed(2)}</span> <span class="pdp-new">S/. ${precioFinal.toFixed(2)}</span>`;
  } else {
    precioEl.textContent = `S/. ${precioFinal.toFixed(2)}`;
  }

  // Botón carrito
  const addBtn = $('#pdp-add');
  addBtn.disabled = (estadoTxt === 'AGOTADO');
  addBtn.onclick = () => {
    agregarAlCarrito({ ...p, precio: precioFinal });
    actualizarContador();
    notificar('✅ Producto añadido al carrito', 'success');
  };

  // Copy link
  $('#pdp-copy').onclick = async () => {
    try{
      await navigator.clipboard.writeText(location.href);
      notificar('🔗 Link copiado', 'success');
    }catch(_){
      notificar('No se pudo copiar el link (tu navegador lo bloqueó).', 'warning');
    }
  };

  // WhatsApp
  const msg = [
    '¡Hola! Quiero este producto:',
    `• ${nombre}`,
    id ? `• ID: ${id}` : null,
    `• Precio: S/. ${precioFinal.toFixed(2)}`,
    `• Link: ${location.href}`
  ].filter(Boolean).join('\n');

  const waUrl = `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(msg)}`;
  const waBtn = $('#pdp-wa');
  waBtn.href = waUrl;
}
