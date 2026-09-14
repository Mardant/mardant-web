// Prueba aislada de Productos a pedido usando Cloudflare Worker + D1.
// Producción sigue usando pedidos.js directamente.

import './pedidos.js?v=13';
import './account-widget.js?v=5';

const nativeFetch = window.fetch.bind(window);
const CORE_TEST_API = 'https://mardant-core-test.gamesmardant.workers.dev/';

window.fetch = (input, init) => {
  const raw = typeof input === 'string' ? input : input?.url;

  try {
    const source = new URL(raw, location.href);
    const accion = source.searchParams.get('accion');
    const route = source.searchParams.get('route');

    if (accion === 'pedidosDisponiblesPage' || accion === 'pedidosDisponibles') {
      const target = new URL(CORE_TEST_API);
      source.searchParams.forEach((value, key) => target.searchParams.set(key, value));
      return nativeFetch(target.toString(), init);
    }

    // En la prueba no leemos ni escribimos interacciones del backend viejo.
    if (accion === 'pedidosSocialCounts') {
      return Promise.resolve(new Response(JSON.stringify({ ok:true, likes:{} }), {
        status:200,
        headers:{ 'Content-Type':'application/json; charset=utf-8' }
      }));
    }

    if (route === 'pedido_social_toggle') {
      return Promise.resolve(new Response(JSON.stringify({ ok:true, test:true, count:0 }), {
        status:200,
        headers:{ 'Content-Type':'application/json; charset=utf-8' }
      }));
    }
  } catch (_) {}

  return nativeFetch(input, init);
};

document.addEventListener('DOMContentLoaded', () => {
  const buttons = document.querySelectorAll('.cta-pedidos .btn-pill');
  if (buttons[0]) {
    buttons[0].href = './inicio-cloudflare-test.html';
    buttons[0].innerHTML = '🏠 <span>Volver al inicio</span>';
  }
  if (buttons[1]) {
    buttons[1].href = './catalogo-cloudflare-test.html';
    buttons[1].innerHTML = '🛍️ <span>Ir al catálogo</span>';
  }
  if (buttons[2]) {
    buttons[2].href = './catalogo-japon-cloudflare-test.html';
    buttons[2].innerHTML = '<span>日本</span><span>Catálogo Japón</span>';
  }
});
