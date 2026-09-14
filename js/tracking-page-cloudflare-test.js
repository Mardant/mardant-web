// Prueba aislada de Tracking usando Cloudflare Worker + D1.
// Produccion sigue usando tracking-page.js + ACCOUNT_API_URL de Apps Script.

const nativeFetch = window.fetch.bind(window);
const ACCOUNT_TEST_API = 'https://mardant-cuenta-test.gamesmardant.workers.dev/';

window.fetch = (input, init) => {
  const raw = typeof input === 'string' ? input : input?.url;

  try {
    const source = new URL(raw, location.href);
    const route = String(source.searchParams.get('route') || '').trim().toLowerCase();

    if (route === 'tracking_data') {
      const target = new URL(ACCOUNT_TEST_API);
      source.searchParams.forEach((value, key) => target.searchParams.set(key, value));
      return nativeFetch(target.toString(), init);
    }
  } catch (_) {}

  return nativeFetch(input, init);
};

await import('./tracking-page.js?v=11');
await import('./tracking.js?v=8');

// Reescribe enlaces internos que pinta tracking-page.js para mantenernos en TEST.
document.addEventListener('click', (event) => {
  const link = event.target.closest?.('a');
  if (!link) return;

  const href = String(link.getAttribute('href') || '');
  if (href === './cuenta.html') link.href = './cuenta-cloudflare-test.html';
  if (href === './inicio.html') link.href = './inicio-cloudflare-test.html';
}, true);
