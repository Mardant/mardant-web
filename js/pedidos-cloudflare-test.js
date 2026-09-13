// Prueba aislada de Productos a pedido usando Cloudflare Worker + D1.
// Producción sigue usando pedidos.js directamente.

import './pedidos.js?v=13';

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
