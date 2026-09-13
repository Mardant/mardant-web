// Prueba aislada del catálogo normal usando Cloudflare Worker + D1.
// No modifica producción: solo se carga desde catalogo-cloudflare-test.html.

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

// catalogo-cloudflare-test.html reconstruye catalogo.html después de una carga async.
// Para ese momento DOMContentLoaded puede haber ocurrido ya; catalogo.js registra su
// inicialización en ese evento, por lo que hay que dispararlo manualmente si ya pasó.
const domAlreadyReady = document.readyState !== 'loading';
await import('./catalogo.js?v=16');

if (domAlreadyReady || document.readyState !== 'loading') {
  queueMicrotask(() => {
    document.dispatchEvent(new Event('DOMContentLoaded'));
  });
}
