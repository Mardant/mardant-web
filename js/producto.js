import { whatsappLink } from './config.js';
import { API_CACHE_TTL, cachedFetchJSON } from './api-client.js';
import {
  agregarAlCarrito,
  actualizarCarritoUI,
  mostrarMiniCarrito,
  actualizarContador,
  notificar
} from './carrito-utils.js';

const $ = (s) => document.querySelector(s);

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
    const data = await cachedFetchJSON('producto', {
      params: { id },
      ttl: API_CACHE_TTL.PRODUCTO,
      cacheId: `producto:${id}`
    });

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

function setMeta(selector, value) {
  const el = document.head.querySelector(selector);
  if (el && value) el.setAttribute('content', value);
}

function setCanonical(url) {
  let el = document.head.querySelector('link[rel="canonical"]');
  if (!el) {
    el = document.createElement('link');
    el.rel = 'canonical';
    document.head.appendChild(el);
  }
  el.href = url;
}

function updateProductMetadata({ nombre, id, categoria }) {
  const cleanName = nombre || 'Producto Mardant';
  const title = `${cleanName} | Mardant Perú`;
  const description = `Consulta ${cleanName} en Mardant Perú. Productos oficiales de anime, figuras, peluches y coleccionables importados desde Japón.`;
  const url = `https://mardant.com${location.pathname}${id ? `?id=${encodeURIComponent(id)}` : ''}`;

  document.title = title;
  setCanonical(url);
  setMeta('meta[name="description"]', description);
  setMeta('meta[property="og:title"]', title);
  setMeta('meta[property="og:description"]', description);
  setMeta('meta[property="og:url"]', url);
  setMeta('meta[name="twitter:title"]', title);
  setMeta('meta[name="twitter:description"]', description);
  if (categoria) setMeta('meta[property="product:category"]', categoria);
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
  const rawEstado = String(p.estado || '').toUpperCase();
  const estaAgotado = rawEstado.includes('SIN STOCK') || rawEstado.includes('AGOTADO');

  const estadoTxt = estaAgotado
    ? 'AGOTADO'
    : (tieneOferta ? 'OFERTA' : 'DISPONIBLE');

  const precioFinal = !estaAgotado && tieneOferta ? ofertaNum : precioNum;
  const categoria = [p.categoria, p.subcategoria].filter(Boolean).join(' - ');

  $('#pdp-nombre').textContent = nombre || 'Producto';
  $('#pdp-id').textContent = id ? `ID: ${id}` : '';
  $('#pdp-cat').textContent = p.categoria || '-';
  $('#pdp-sub').textContent = p.subcategoria || '-';
  updateProductMetadata({ nombre, id, categoria });

  const estadoEl = $('#pdp-estado');
  estadoEl.textContent = estadoTxt;
  $('#pdp').classList.toggle('pdp-is-agotado', estaAgotado);

  // Imagen
  const imgEl = $('#pdp-img');
  imgEl.src = img || 'https://via.placeholder.com/900x900?text=Sin+imagen';
  imgEl.alt = nombre;
  imgEl.referrerPolicy = 'no-referrer';

  // Precio
  const precioEl = $('#pdp-precio');
  if (!estaAgotado && tieneOferta){
    precioEl.innerHTML = `<span class="pdp-old">S/. ${precioNum.toFixed(2)}</span> <span class="pdp-new">S/. ${precioFinal.toFixed(2)}</span>`;
  } else {
    precioEl.textContent = `S/. ${precioFinal.toFixed(2)}`;
  }

  // Botón carrito
  const addBtn = $('#pdp-add');
  addBtn.hidden = estaAgotado;
  addBtn.disabled = (estadoTxt === 'AGOTADO');
  addBtn.dataset.trackAction = 'add_to_cart';
  addBtn.dataset.trackItemId = id;
  addBtn.dataset.trackItemName = nombre;
  addBtn.dataset.trackPrice = precioFinal.toFixed(2);
  addBtn.dataset.trackCategory = categoria;
  addBtn.dataset.trackSource = 'producto_detalle';
  addBtn.dataset.trackCta = 'Añadir al carrito';
  addBtn.onclick = () => {
    if (estaAgotado) return;
    agregarAlCarrito({ ...p, precio: precioFinal });
    actualizarContador();
    notificar('✅ Producto añadido al carrito', 'success');
  };

  // Copy link
  $('#pdp-copy').hidden = estaAgotado;
  $('#pdp-copy').onclick = async () => {
    if (estaAgotado) return;
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

  const waUrl = whatsappLink(estaAgotado ? [
    'Hola, quiero cotizar este producto agotado:',
    `- ${nombre}`,
    id ? `- ID: ${id}` : null,
    `- Link: ${location.href}`
  ].filter(Boolean).join('\n') : msg);
  const waBtn = $('#pdp-wa');
  waBtn.href = waUrl;
  waBtn.textContent = estaAgotado ? 'Cotizar producto agotado' : 'Pedir por WhatsApp';
  waBtn.classList.toggle('is-agotado', estaAgotado);
  waBtn.dataset.trackItemId = id;
  waBtn.dataset.trackItemName = nombre;
  waBtn.dataset.trackPrice = precioFinal.toFixed(2);
  waBtn.dataset.trackCategory = categoria;
  waBtn.dataset.trackSource = 'producto_detalle';
  waBtn.dataset.trackCta = waBtn.textContent;

  window.MardantTracking?.trackViewItem?.({
    item_id: id,
    item_name: nombre,
    item_category: categoria,
    price: precioFinal,
    source_section: 'producto_detalle'
  });
}
