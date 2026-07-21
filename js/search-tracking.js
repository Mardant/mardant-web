import { fetchRoute } from './api-client.js';

const MIN_SEARCH_LENGTH = 3;
const MAX_SEARCH_LENGTH = 100;
const sentSearches = new Set();

function normalizeSearch(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, MAX_SEARCH_LENGTH);
}

function searchKey(catalog, search) {
  return `${catalog}:${search.toLocaleLowerCase('es')}`;
}

export function setupSearchTracking(input, catalog, options = {}) {
  if (!input) return () => {};

  const delay = Number(options.delay) || 1000;
  let timer = null;

  const registerSearch = async () => {
    const search = normalizeSearch(input.value);
    if (search.length < MIN_SEARCH_LENGTH) return;

    const key = searchKey(catalog, search);
    if (sentSearches.has(key)) return;
    sentSearches.add(key);

    try {
      const result = await fetchRoute('registrar_busqueda_catalogo', {
        catalogo: catalog,
        busqueda: search
      }, {
        fetchOptions: { keepalive: true }
      });

      // Permite reintentar si el Apps Script aun no tiene desplegada la ruta.
      if (!result?.ok) sentSearches.delete(key);
    } catch (_) {
      sentSearches.delete(key);
    }
  };

  const onInput = () => {
    clearTimeout(timer);
    timer = setTimeout(registerSearch, delay);
  };

  input.addEventListener('input', onInput);
  return () => {
    clearTimeout(timer);
    input.removeEventListener('input', onInput);
  };
}
