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

function installTestCartHandler() {
  const button = document.getElementById('pdp-add');
  const nameEl = document.getElementById('pdp-nombre');
  const imgEl = document.getElementById('pdp-img');
  const idEl = document.getElementById('pdp-id');
  const priceEl = document.getElementById('pdp-precio');

  if (!button || !nameEl || !imgEl || !idEl || !priceEl) return false;
  if (document.getElementById('pdp')?.style.display === 'none') return false;

  // Sustituimos el onclick instalado por producto.js SOLO en la pagina TEST.
  button.onclick = () => {
    const cart = readCart();
    const id = String(idEl.textContent || '').replace(/^ID:\s*/i, '').trim();
    const name = String(nameEl.textContent || '').trim();
    const image = String(imgEl.src || '').trim();

    const priceMatches = String(priceEl.textContent || '').match(/\d+(?:\.\d{1,2})?/g) || [];
    const price = Number(priceMatches.at(-1) || 0);

    cart.push({ id, nombre: name, precio: price, imagen: image });
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
    updateCounter();
    notify('✅ Producto añadido al carrito TEST');
  };

  updateCounter();
  return true;
}

document.addEventListener('DOMContentLoaded', () => {
  let attempts = 0;
  const timer = setInterval(() => {
    attempts += 1;
    if (installTestCartHandler() || attempts > 50) clearInterval(timer);
  }, 100);
});
