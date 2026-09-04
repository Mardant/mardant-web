import { API_URL } from './config.js?v=5';

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
const CACHE_PREFIX = 'mardant_api_cache_v3:';
const CACHE_MAX_ENTRIES = 80;
const CACHE_MAX_BYTES = 3.5 * 1024 * 1024;
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

async function fetchWithTimeout(
  url,
  fetchOptions = {},
  timeoutMs = DEFAULT_REQUEST_TIMEOUT,
  signal,
  consumeResponse
) {
  const controller = new AbortController();
  const abortRequest = () => controller.abort();
  const timeout = setTimeout(abortRequest, Math.max(1, Number(timeoutMs) || DEFAULT_REQUEST_TIMEOUT));

  if (signal?.aborted) controller.abort();
  else signal?.addEventListener('abort', abortRequest, { once: true });

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal
    });
    return consumeResponse ? await consumeResponse(response) : response;
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

function trimCache(store, reserveBytes = 0) {
  const entries = [];
  let totalBytes = 0;
  for (let index = 0; index < store.length; index += 1) {
    const key = store.key(index);
    if (!key?.startsWith(CACHE_PREFIX)) continue;
    const raw = store.getItem(key) || '';
    totalBytes += key.length + raw.length;
    let touched = 0;
    try {
      const parsed = JSON.parse(raw);
      touched = Number(parsed.accessed || parsed.time || 0);
    } catch (_) {}
    entries.push({ key, bytes:key.length + raw.length, touched });
  }
  entries.sort((a, b) => a.touched - b.touched);
  while (entries.length && (
    entries.length >= CACHE_MAX_ENTRIES || totalBytes + reserveBytes > CACHE_MAX_BYTES
  )) {
    const oldest = entries.shift();
    store.removeItem(oldest.key);
    totalBytes -= oldest.bytes;
  }
}

function readCache(key, ttl, maxStale = DEFAULT_MAX_STALE) {
  const store = storage();
  if (!store) return { hit: false, stale: null };

  try {
    const raw = store.getItem(key);
    if (!raw) return { hit: false, stale: null };

    const cached = JSON.parse(raw);
    const age = Date.now() - Number(cached.time || 0);
    if (age <= ttl) {
      cached.accessed = Date.now();
      try { store.setItem(key, JSON.stringify(cached)); } catch (_) {}
      return { hit: true, data: cached.data };
    }
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
    const now = Date.now();
    const raw = JSON.stringify({ time:now, accessed:now, data });
    trimCache(store, key.length + raw.length);
    store.setItem(key, raw);
  } catch (_) {
    try {
      trimCache(store, CACHE_MAX_BYTES);
      store.setItem(key, JSON.stringify({ time:Date.now(), accessed:Date.now(), data }));
    } catch (_) {}
  }
}

export function getCachedJSON(accion, options = {}) {
  const {
    params = {},
    ttl = DEFAULT_TTL,
    cacheId = accion,
    allowStale = false,
    baseUrl = API_URL
  } = options;
  const key = cacheKey('json', cacheId, { source:baseUrl, accion, ...params });
  const cached = readCache(key, ttl);
  if (cached.hit) return cached.data;
  return allowStale ? cached.stale : null;
}

function buildUrl(accion, params = {}, baseUrl = API_URL) {
  const query = new URLSearchParams({ accion });
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      query.set(key, String(value));
    }
  });
  return `${baseUrl}?${query.toString()}`;
}

export async function fetchJSON(accion, options = {}) {
  const {
    params = {},
    signal,
    fetchOptions = {},
    retries = 1,
    timeoutMs = DEFAULT_REQUEST_TIMEOUT,
    baseUrl = API_URL,
    abortUnderlying = false
  } = options;
  const url = buildUrl(accion, params, baseUrl);

  const createRequest = () => (async () => {
    let lastError;
    for (let attempt = 0; attempt <= retries; attempt += 1) {
      try {
        return await fetchWithTimeout(url, fetchOptions, timeoutMs, abortUnderlying ? signal : undefined, async (response) => {
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
        });
      } catch (error) {
        if (error?.name === 'AbortError' && signal?.aborted) throw error;
        lastError = error?.name === 'AbortError'
          ? new Error('El servidor demoro demasiado en responder')
          : error;
        const retryable = !error?.status || RETRYABLE_PUBLIC_STATUSES.has(error.status);
        if (attempt >= retries || !retryable) break;
        await waitForRetry(450 * (attempt + 1), abortUnderlying ? signal : undefined);
      }
    }
    throw lastError || new Error('No se pudo consultar el servidor');
  })();

  if (abortUnderlying) return createRequest();

  let request = inFlightJSON.get(url);

  if (!request) {
    request = createRequest();
    inFlightJSON.set(url, request);
    request.finally(() => {
      if (inFlightJSON.get(url) === request) inFlightJSON.delete(url);
    }).catch(() => {});
  }

  return waitForRequest(request, signal);
}

export async function fetchRoute(route, body = {}, options = {}) {
  const {
    baseUrl = API_URL,
    signal,
    fetchOptions = {},
    timeoutMs = DEFAULT_REQUEST_TIMEOUT,
    onTiming
  } = options;
  const startedAt = performance.now();
  const timing = (event, detail = {}) => {
    if (typeof onTiming !== 'function') return;
    onTiming(event, { elapsedMs: Math.round(performance.now() - startedAt), ...detail });
  };

  timing('request_start');
  return fetchWithTimeout(`${baseUrl}?route=${encodeURIComponent(route)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(body || {}),
    ...fetchOptions
  }, timeoutMs, signal, async (response) => {
    timing('response_received', { status: response.status });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const raw = await response.text();
    timing('response_body_received', { bytes: raw.length });
    try {
      const data = JSON.parse(raw);
      timing('json_parsed');
      return data;
    } catch (_) {
      throw new Error('Respuesta JSON invalida del servidor');
    }
  });
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
    timeoutMs = DEFAULT_REQUEST_TIMEOUT,
    baseUrl = API_URL,
    abortUnderlying = false
  } = options;
  const key = cacheKey('json', cacheId, { source:baseUrl, accion, ...params });

  if (!force) {
    const cached = readCache(key, ttl);
    if (cached.hit) return cached.data;
    if (staleWhileRevalidate && cached.stale !== null && cached.stale !== undefined) {
      fetchJSON(accion, { params, fetchOptions, retries, timeoutMs, baseUrl })
        .then(data => writeCache(key, data))
        .catch(error => console.warn(`No se pudo actualizar ${accion} en segundo plano:`, error));
      return cached.stale;
    }
  }

  const stale = readCache(key, 0).stale;
  try {
    // Las solicitudes compartidas terminan de llenar cache. Las vistas
    // interactivas pueden optar por abortUnderlying para cancelar el HTTP real.
    const request = fetchJSON(accion, {
      params, fetchOptions, retries, timeoutMs, baseUrl,
      signal:abortUnderlying ? signal : undefined,
      abortUnderlying
    })
      .then(data => {
        // Los errores de aplicacion deben poder recuperarse en el siguiente
        // intento; guardarlos durante el TTL bloquearia fallbacks o arreglos.
        if (!data || data.ok !== false) writeCache(key, data);
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
    cacheId = accion,
    baseUrl = API_URL,
    signal
  } = options;
  if (signal?.aborted) return;
  const first = Math.max(1, Number(current) - Math.max(0, Number(behind) || 0));
  const last = Math.min(Number(total) || 1, Number(current) + Math.max(0, Number(ahead) || 0));
  const pages = [];
  for (let page = first; page <= last; page += 1) {
    if (page !== Number(current)) pages.push(page);
  }

  for (const page of pages) {
    if (signal?.aborted) break;
    try {
      await cachedFetchJSON(accion, {
        ttl,
        cacheId,
        params: { ...params, page },
        staleWhileRevalidate: true,
        retries: 0,
        timeoutMs: 12000,
        baseUrl,
        signal,
        abortUnderlying:Boolean(signal)
      });
    } catch (_) {}
  }
}
