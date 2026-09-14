// Prueba aislada de Ultimas Importaciones usando Cloudflare Worker + D1.
// Produccion sigue usando ultimas.js directamente.

import './ultimas.js?v=4';

const nativeFetch = window.fetch.bind(window);
const CORE_TEST_API = 'https://mardant-core-test.gamesmardant.workers.dev/';

window.fetch = (input, init) => {
  const raw = typeof input === 'string' ? input : input?.url;

  try {
    const source = new URL(raw, location.href);
    const accion = source.searchParams.get('accion');

    if (accion === 'productosPage' || accion === 'productos') {
      const target = new URL(CORE_TEST_API);
      source.searchParams.forEach((value, key) => target.searchParams.set(key, value));
      return nativeFetch(target.toString(), init);
    }
  } catch (_) {}

  return nativeFetch(input, init);
};
