// Prueba aislada de Inicio usando Cloudflare Workers + D1.
// Core -> mardant-core-test
// Japon -> mardant-japon-test

import './scripts_inicio.js?v=17';

const nativeFetch = window.fetch.bind(window);
const CORE_TEST_API = 'https://mardant-core-test.gamesmardant.workers.dev/';
const JAPAN_TEST_API = 'https://mardant-japon-test.gamesmardant.workers.dev/';

const CORE_ACTIONS = new Set([
  'homeData',
  'productosPage',
  'productos',
  'preventasPage',
  'preventas',
  'pedidosDisponiblesPage',
  'pedidosDisponibles'
]);

window.fetch = (input, init) => {
  const raw = typeof input === 'string' ? input : input?.url;

  try {
    const source = new URL(raw, location.href);
    const accion = source.searchParams.get('accion');
    const route = source.searchParams.get('route');

    if (CORE_ACTIONS.has(accion)) {
      const target = new URL(CORE_TEST_API);
      source.searchParams.forEach((value, key) => target.searchParams.set(key, value));
      return nativeFetch(target.toString(), init);
    }

    // Catálogo Japón normal.
    if (accion === 'catalogoPreventasJaponPage') {
      const target = new URL(JAPAN_TEST_API);
      source.searchParams.forEach((value, key) => target.searchParams.set(key, value));
      return nativeFetch(target.toString(), init);
    }

    // La portada usa un endpoint propio llamado catalogoJaponHome.
    // En D1 reutilizamos el endpoint paginado ya validado y devolvemos
    // un lote suficiente de productos recientes para que la Home elija 3.
    if (accion === 'catalogoJaponHome') {
      const target = new URL(JAPAN_TEST_API);
      source.searchParams.forEach((value, key) => target.searchParams.set(key, value));
      target.searchParams.set('accion', 'catalogoPreventasJaponPage');
      if (!target.searchParams.has('page')) target.searchParams.set('page', '1');
      if (!target.searchParams.has('page_size')) target.searchParams.set('page_size', '60');
      target.searchParams.set('include_meta', '0');
      return nativeFetch(target.toString(), init);
    }

    // No contaminar tracking del sistema viejo durante esta prueba.
    if (route === 'registrar_busqueda_catalogo' || route === 'pedido_social_toggle') {
      return Promise.resolve(new Response(JSON.stringify({ ok:true, test:true }), {
        status:200,
        headers:{ 'Content-Type':'application/json; charset=utf-8' }
      }));
    }
  } catch (_) {}

  return nativeFetch(input, init);
};
