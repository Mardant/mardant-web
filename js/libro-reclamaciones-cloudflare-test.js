// Prueba aislada del Libro de Reclamaciones usando Cloudflare Worker + D1.
// Conserva la lógica real de libro-reclamaciones.js y solo cambia el backend.

const nativeFetch = window.fetch.bind(window);
const CORE_TEST_API = 'https://mardant-core-test.gamesmardant.workers.dev/';

window.fetch = (input, init) => {
  const raw = typeof input === 'string' ? input : input?.url;

  try {
    const source = new URL(raw, location.href);
    const accion = source.searchParams.get('accion');
    const route = source.searchParams.get('route');

    if (accion === 'reclamacionChallenge' || route === 'registrarReclamacion') {
      const target = new URL(CORE_TEST_API);
      source.searchParams.forEach((value, key) => target.searchParams.set(key, value));
      return nativeFetch(target.toString(), init);
    }
  } catch (_) {}

  return nativeFetch(input, init);
};

// Import dinámico: primero instalamos el redirect del backend y después
// ejecutamos exactamente la lógica real de producción.
await import('./libro-reclamaciones.js?v=6');
