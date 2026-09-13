// Prueba aislada de detalle de producto usando Cloudflare Worker + D1.
// Produccion sigue usando producto.js directamente.

import './producto.js?v=7';

const nativeFetch = window.fetch.bind(window);
const CORE_TEST_API = 'https://mardant-core-test.gamesmardant.workers.dev/';
const CART_KEY = 'carritoMardant';

window.fetch = (input, init) => {
  const raw = typeof input === 'string' ? input : input?.url;
  try {
    const source = new URL(raw, location.href);
    const accion = source.searchParams.get('accion');
    if (accion === 'producto') {
      const target = new URL(CORE_TEST_API);
      source.searchParams.forEach((value, key) => target.searchParams.set(key, value));
      return nativeFetch(target.toString(), init);
    }
  } catch (_) {}
  return nativeFetch(input, init);
};

function readCart() {
  try {
    const value = JSON.parse(localStorage.getItem(CART_KEY) || '[]');
    return Array.isArray(value) ? value : [];
  } catch (_) {
    return [];
  }
}

function updateCounter() {
  const counter = document.getElementById('contador-carrito');
  if (!counter) return;
  const qty = readCart().length;
  counter.textContent = String(qty);
  counter.style.display = qty ? 'inline-block' : 'none';
}

function notify(message) {
  const el = document.createElement('div');
  el.className = 'notificacion-flotante';
  el.textContent = message;
  el.style.backgroundColor = '#4CAF50';
  document.body.appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 300);
  }, 2200);
}

function addVisibleProductToCart() {
  const nameEl = document.getElementById('pdp-nombre');
  const imgEl = document.getElementById('pdp-img');
  const idEl = document.getElementById('pdp-id');
  const priceEl = document.getElementById('pdp-precio');

  const id = String(idEl?.textContent || '').replace(/^ID:\s*/i, '').trim();
  const nombre = String(nameEl?.textContent || '').trim();
  const imagen = String(imgEl?.src || '').trim();
  const priceMatches = String(priceEl?.textContent || '').match(/\d+(?:\.\d{1,2})?/g) || [];
  const precio = Number(priceMatches.at(-1) || 0);

  if (!nombre || !id || !Number.isFinite(precio)) {
    notify('⚠️ Aún no termina de cargar el producto');
    return;
  }

  const cart = readCart();
  cart.push({ id, nombre, precio, imagen });
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
  updateCounter();
  notify('✅ Producto añadido al carrito TEST');
}

// Interceptamos ANTES que el onclick de producto.js.
document.addEventListener('click', (event) => {
  const button = event.target.closest?.('#pdp-add');
  if (!button) return;

  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
  addVisibleProductToCart();
}, true);

document.addEventListener('DOMContentLoaded', updateCounter);
