// Prueba aislada de Preventas usando Cloudflare Worker + D1.
// Producción sigue usando preventa.js directamente.

import './preventa.js?v=11';

const nativeFetch = window.fetch.bind(window);
const CORE_TEST_API = 'https://mardant-core-test.gamesmardant.workers.dev/';

window.fetch = (input, init) => {
  const raw = typeof input === 'string' ? input : input?.url;

  try {
    const source = new URL(raw, location.href);
    const accion = source.searchParams.get('accion');

    if (accion === 'preventasPage' || accion === 'preventas') {
      const target = new URL(CORE_TEST_API);
      source.searchParams.forEach((value, key) => target.searchParams.set(key, value));
      return nativeFetch(target.toString(), init);
    }
  } catch (_) {}

  return nativeFetch(input, init);
};
