// Prueba aislada del catálogo normal usando Cloudflare Worker + D1.
// Conserva la lógica real de producción y solo cambia la fuente de datos.

import './catalogo.js?v=16';
import './account-widget.js?v=5';

const nativeFetch = window.fetch.bind(window);
const CORE_TEST_API = 'https://mardant-core-test.gamesmardant.workers.dev/';

window.fetch = (input, init) => {
  const raw = typeof input === 'string' ? input : input?.url;

  try {
    const source = new URL(raw, location.href);
    const accion = source.searchParams.get('accion');
    const route = source.searchParams.get('route');

    if (accion === 'productosPage' || accion === 'productos') {
      const target = new URL(CORE_TEST_API);
      source.searchParams.forEach((value, key) => target.searchParams.set(key, value));
      return nativeFetch(target.toString(), init);
    }

    // No contaminar estadísticas reales durante las pruebas.
    if (route === 'registrar_busqueda_catalogo') {
      return Promise.resolve(new Response(JSON.stringify({ ok:true, test:true }), {
        status: 200,
        headers: { 'Content-Type':'application/json; charset=utf-8' }
      }));
    }
  } catch (_) {}

  return nativeFetch(input, init);
};

function rewriteProductDetailLinks(root = document) {
  root.querySelectorAll?.('a.ver-detalle[href*="producto.html"]').forEach(link => {
    try {
      const target = new URL(link.getAttribute('href'), location.href);
      link.href = `./producto-cloudflare-test.html${target.search}${target.hash}`;
    } catch (_) {}
  });
}

function matchProductionNavigation() {
  const buttons = document.querySelectorAll('.cta-catalogo .btn-pill');
  if (buttons[0]) {
    buttons[0].href = './inicio-cloudflare-test.html';
    buttons[0].innerHTML = '🏠 <span>Volver al inicio</span>';
  }
  if (buttons[1]) {
    buttons[1].href = './preventa-cloudflare-test.html';
    buttons[1].innerHTML = '📦 <span>Ver preventas</span>';
  }
  if (buttons[2]) {
    buttons[2].href = './catalogo-japon-cloudflare-test.html';
    buttons[2].innerHTML = '<span>日本</span><span>Catálogo Japón</span>';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  matchProductionNavigation();

  const container = document.getElementById('contenedor');
  if (!container) return;

  rewriteProductDetailLinks(container);
  const observer = new MutationObserver(() => rewriteProductDetailLinks(container));
  observer.observe(container, { childList:true, subtree:true });
});
