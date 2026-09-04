import { API_URL } from './config.js';

export const API_CACHE_TTL = {
  HOME_DATA: 10 * 60 * 1000,
  PRODUCTOS: 10 * 60 * 1000,
  PREVENTAS: 10 * 60 * 1000,
  PEDIDOS_DISPONIBLES: 10 * 60 * 1000,
  CATALOGO_PREVENTAS_JAPON: 10 * 60 * 1000,
  PRODUCTO: 5 * 60 * 1000
};

const DEFAULT_TTL = 10 * 60 * 1000;
const DEFAULT_MAX_STALE = 30 * 60 * 1000;
const DEFAULT_REQUEST_TIMEOUT = 15 * 1000;
const CACHE_PREFIX = 'mardant_api_cache_v2:';
const RETRYABLE_PUBLIC_STATUSES = new Set([404, 408, 429, 500, 502, 503, 504]);
const inFlightJSON = new Map();

function waitForRetry(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Solicitud cancelada', 'AbortError'));
      return;
    }

    const cleanup = () => signal?.removeEventListener('abort', abortWait);
    const timer = setTimeout(() => {
      cleanup();
      resolve();
    }, ms);
    const abortWait = () => {
      clearTimeout(timer);
      cleanup();
      reject(new DOMException('Solicitud cancelada', 'AbortError'));
    };
    signal?.addEventListener('abort', abortWait, { once: true });
  });
}

function waitForRequest(promise, signal) {
  if (!signal) return promise;
  if (signal.aborted) return Promise.reject(new DOMException('Solicitud cancelada', 'AbortError'));

  return new Promise((resolve, reject) => {
    const cleanup = () => signal.removeEventListener('abort', abortRequest);
    const abortRequest = () => {
      cleanup();
      reject(new DOMException('Solicitud cancelada', 'AbortError'));
    };

    signal.addEventListener('abort', abortRequest, { once: true });
    promise.then(
      value => {
        cleanup();
        resolve(value);
      },
      error => {
        cleanup();
        reject(error);
      }
    );
  });
}

async function fetchWithTimeout(url, fetchOptions = {}, timeoutMs = DEFAULT_REQUEST_TIMEOUT, signal) {
  const controller = new AbortController();
  const abortRequest = () => controller.abort();
  const timeout = setTimeout(abortRequest, Math.max(1, Number(timeoutMs) || DEFAULT_REQUEST_TIMEOUT));

  if (signal?.aborted) controller.abort();
  else signal?.addEventListener('abort', abortRequest, { once: true });

  try {
    return await fetch(url, {
      ...fetchOptions,
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', abortRequest);
  }
}

function storage() {
  try {
    const testKey = `${CACHE_PREFIX}test`;
    localStorage.setItem(testKey, '1');
    localStorage.removeItem(testKey);
    return localStorage;
  } catch (_) {
    return null;
  }
}

function stableStringify(value) {
  if (!value || typeof value !== 'object') return '';
  const sorted = Object.keys(value)
    .sort()
    .reduce((acc, key) => {
      const val = value[key];
      if (val !== undefined && val !== null && val !== '') acc[key] = val;
      return acc;
    }, {});
  return JSON.stringify(sorted);
}

function cacheKey(type, id, params = {}) {
  return `${CACHE_PREFIX}${type}:${id}:${stableStringify(params)}`;
}

function readCache(key, ttl, maxStale = DEFAULT_MAX_STALE) {
  const store = storage();
  if (!store) return { hit: false, stale: null };

  try {
    const raw = store.getItem(key);
    if (!raw) return { hit: false, stale: null };

    const cached = JSON.parse(raw);
    const age = Date.now() - Number(cached.time || 0);
    if (age <= ttl) return { hit: true, data: cached.data };
    if (age > maxStale) {
      store.removeItem(key);
      return { hit: false, stale: null };
    }

    return { hit: false, stale: cached.data };
  } catch (_) {
    return { hit: false, stale: null };
  }
}

function writeCache(key, data) {
  const store = storage();
  if (!store) return;

  try {
    store.setItem(key, JSON.stringify({ time: Date.now(), data }));
  } catch (_) {}
}

export function getCachedJSON(accion, options = {}) {
  const {
    params = {},
    ttl = DEFAULT_TTL,
    cacheId = accion,
    allowStale = false
  } = options;
  const key = cacheKey('json', cacheId, { accion, ...params });
  const cached = readCache(key, ttl);
  if (cached.hit) return cached.data;
  return allowStale ? cached.stale : null;
}

function buildUrl(accion, params = {}) {
  const query = new URLSearchParams({ accion });
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      query.set(key, String(value));
    }
  });
  return `${API_URL}?${query.toString()}`;
}

export async function fetchJSON(accion, options = {}) {
  const {
    params = {},
    signal,
    fetchOptions = {},
    retries = 1,
    timeoutMs = DEFAULT_REQUEST_TIMEOUT
  } = options;
  const url = buildUrl(accion, params);
  let request = inFlightJSON.get(url);

  if (!request) {
    request = (async () => {
      let lastError;
      for (let attempt = 0; attempt <= retries; attempt += 1) {
        try {
          const response = await fetchWithTimeout(url, fetchOptions, timeoutMs);
          if (!response.ok) {
            const error = new Error(`HTTP ${response.status}`);
            error.status = response.status;
            throw error;
          }

          const raw = await response.text();
          try {
            return JSON.parse(raw);
          } catch (_) {
            throw new Error('Respuesta JSON invalida del servidor');
          }
        } catch (error) {
          lastError = error?.name === 'AbortError'
            ? new Error('El servidor demoro demasiado en responder')
            : error;
          const retryable = !error?.status || RETRYABLE_PUBLIC_STATUSES.has(error.status);
          if (attempt >= retries || !retryable) break;
          await waitForRetry(450 * (attempt + 1));
        }
      }
      throw lastError || new Error('No se pudo consultar el servidor');
    })();
    inFlightJSON.set(url, request);
    request.finally(() => {
      if (inFlightJSON.get(url) === request) inFlightJSON.delete(url);
    }).catch(() => {});
  }

  return waitForRequest(request, signal);
}

export async function fetchRoute(route, body = {}, options = {}) {
  const { signal, fetchOptions = {}, timeoutMs = DEFAULT_REQUEST_TIMEOUT } = options;
  const response = await fetchWithTimeout(`${API_URL}?route=${encodeURIComponent(route)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(body || {}),
    ...fetchOptions
  }, timeoutMs, signal);

  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

export async function cachedFetchJSON(accion, options = {}) {
  const {
    params = {},
    ttl = DEFAULT_TTL,
    force = false,
    staleWhileRevalidate = false,
    cacheId = accion,
    signal,
    fetchOptions = {},
    retries = 1,
    timeoutMs = DEFAULT_REQUEST_TIMEOUT
  } = options;
  const key = cacheKey('json', cacheId, { accion, ...params });

  if (!force) {
    const cached = readCache(key, ttl);
    if (cached.hit) return cached.data;
    if (staleWhileRevalidate && cached.stale !== null && cached.stale !== undefined) {
      fetchJSON(accion, { params, fetchOptions, retries, timeoutMs })
        .then(data => writeCache(key, data))
        .catch(error => console.warn(`No se pudo actualizar ${accion} en segundo plano:`, error));
      return cached.stale;
    }
  }

  const stale = readCache(key, 0).stale;
  try {
    // Aunque la vista cambie y deje de esperar esta solicitud, la respuesta
    // termina de llenar su propia clave de cache para una visita posterior.
    const request = fetchJSON(accion, { params, fetchOptions, retries, timeoutMs })
      .then(data => {
        writeCache(key, data);
        return data;
      });
    return await waitForRequest(request, signal);
  } catch (error) {
    // Una solicitud abortada fue reemplazada por otra más reciente. Devolver
    // caché aquí permitiría que una página anterior vuelva a pintar la vista.
    if (error?.name === 'AbortError' || signal?.aborted) throw error;
    if (stale !== null && stale !== undefined) {
      console.warn(`Usando cache anterior para ${accion}:`, error);
      return stale;
    }
    throw error;
  }
}

export async function prefetchJSONPages(accion, options = {}) {
  const {
    current = 1,
    total = 1,
    ahead = 3,
    behind = 1,
    params = {},
    ttl = DEFAULT_TTL,
    cacheId = accion
  } = options;
  const first = Math.max(1, Number(current) - Math.max(0, Number(behind) || 0));
  const last = Math.min(Number(total) || 1, Number(current) + Math.max(0, Number(ahead) || 0));
  const pages = [];
  for (let page = first; page <= last; page += 1) {
    if (page !== Number(current)) pages.push(page);
  }

  for (const page of pages) {
    try {
      await cachedFetchJSON(accion, {
        ttl,
        cacheId,
        params: { ...params, page },
        staleWhileRevalidate: true,
        retries: 0,
        timeoutMs: 12000
      });
    } catch (_) {}
  }
}
