// Prueba aislada de Mi Cuenta usando Cloudflare Worker + D1.
// Produccion sigue usando cuenta.js + ACCOUNT_API_URL de Apps Script.

const nativeFetch = window.fetch.bind(window);
const ACCOUNT_TEST_API = 'https://mardant-cuenta-test.gamesmardant.workers.dev/';

const ACCOUNT_ROUTES = new Set([
  'login',
  'logout',
  'status',
  'tracking_data',
  'puntos_solicitar_canje'
]);

window.fetch = (input, init) => {
  const raw = typeof input === 'string' ? input : input?.url;

  try {
    const source = new URL(raw, location.href);
    const route = String(source.searchParams.get('route') || '').trim().toLowerCase();

    // En esta pagina TEST ninguna ruta privada de Cuenta debe tocar Apps Script.
    if (ACCOUNT_ROUTES.has(route)) {
      const target = new URL(ACCOUNT_TEST_API);
      source.searchParams.forEach((value, key) => target.searchParams.set(key, value));
      return nativeFetch(target.toString(), init);
    }
  } catch (_) {}

  return nativeFetch(input, init);
};

function matchTestNavigation() {
  const brand = document.querySelector('.topbar .brand');
  if (brand) brand.href = './inicio-cloudflare-test.html';

  const links = [...document.querySelectorAll('.topbar .nav a')];
  for (const link of links) {
    const text = String(link.textContent || '').trim().toLowerCase();
    if (text === 'catálogo') link.href = './catalogo-cloudflare-test.html';
    if (text === 'preventas') link.href = './preventa-cloudflare-test.html';
    if (text === 'japón') link.href = './catalogo-japon-cloudflare-test.html';
    if (text === 'a pedido') link.href = './pedidos-cloudflare-test.html';
    if (text === 'mi cuenta') link.href = './cuenta-cloudflare-test.html';
  }
}

function rewriteTrackingLinks(root = document) {
  root.querySelectorAll?.('a.tracking-btn[href*="tracking.html"]').forEach(link => {
    try {
      const source = new URL(link.getAttribute('href'), location.href);
      link.href = `./tracking-cloudflare-test.html${source.search}${source.hash}`;
    } catch (_) {}
  });
}

matchTestNavigation();
rewriteTrackingLinks();

const preTable = document.getElementById('preTable');
if (preTable) {
  const observer = new MutationObserver(() => rewriteTrackingLinks(preTable));
  observer.observe(preTable, { childList: true, subtree: true });
}

// IMPORTANTE: imports dinamicos. Primero se instala el redirect de fetch y despues
// se ejecuta exactamente la logica real de produccion.
await import('./tracking.js?v=8');
await import('./cuenta.js?v=27');
await import('./account-widget.js?v=5');

rewriteTrackingLinks();
