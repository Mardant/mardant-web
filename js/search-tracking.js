import { fetchRoute } from './api-client.js?v=7';

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
  const tracker = createSearchTracker(catalog, options);

  const onInput = () => {
    clearTimeout(timer);
    timer = setTimeout(() => tracker.record(input.value), delay);
  };

  input.addEventListener('input', onInput);
  return () => {
    clearTimeout(timer);
    tracker.destroy();
    input.removeEventListener('input', onInput);
  };
}

export function createSearchTracker(catalog, options = {}) {
  let pending = null;
  let pendingType = '';
  let destroyed = false;
  const baseUrl = options.baseUrl;
  const requestRoute = typeof options.requestRoute === 'function' ? options.requestRoute : fetchRoute;

  const send = async search => {
    const key = searchKey(catalog, search);
    if (sentSearches.has(key) || destroyed) return;
    sentSearches.add(key);
    try {
      const requestOptions = {
        fetchOptions: { keepalive: true }
      };
      if (baseUrl) requestOptions.baseUrl = baseUrl;
      const result = await requestRoute('registrar_busqueda_catalogo', {
        catalogo: catalog,
        busqueda: search
      }, requestOptions);
      if (!result?.ok) sentSearches.delete(key);
    } catch (_) {
      sentSearches.delete(key);
    }
  };

  return {
    record(value) {
      const search = normalizeSearch(value);
      if (search.length < MIN_SEARCH_LENGTH || destroyed) return;
      if (pending && pendingType === 'idle' && globalThis.cancelIdleCallback) globalThis.cancelIdleCallback(pending);
      else if (pending) clearTimeout(pending);
      const run = () => {
        pending = null;
        pendingType = '';
        send(search);
      };
      if (globalThis.requestIdleCallback) {
        pendingType = 'idle';
        pending = globalThis.requestIdleCallback(run, { timeout:1500 });
      } else {
        pendingType = 'timeout';
        pending = setTimeout(run, 0);
      }
    },
    destroy() {
      destroyed = true;
      if (pending && pendingType === 'idle' && globalThis.cancelIdleCallback) globalThis.cancelIdleCallback(pending);
      else if (pending) clearTimeout(pending);
      pending = null;
      pendingType = '';
    }
  };
}
