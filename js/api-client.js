import { API_URL } from './config.js';

export const API_CACHE_TTL = {
  HOME_DATA: 10 * 60 * 1000,
  PRODUCTOS: 10 * 60 * 1000,
  PREVENTAS: 10 * 60 * 1000,
  PEDIDOS_DISPONIBLES: 10 * 60 * 1000,
  CATALOGO_PREVENTAS_JAPON: 10 * 60 * 1000,
  PRODUCTO: 5 * 60 * 1000,
  CATALOGO_JAPON_GVIZ: 10 * 60 * 1000
};

const DEFAULT_TTL = 10 * 60 * 1000;
const CACHE_PREFIX = 'mardant_api_cache_v1:';

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

function readCache(key, ttl) {
  const store = storage();
  if (!store) return { hit: false, stale: null };

  try {
    const raw = store.getItem(key);
    if (!raw) return { hit: false, stale: null };

    const cached = JSON.parse(raw);
    const age = Date.now() - Number(cached.time || 0);
    if (age <= ttl) return { hit: true, data: cached.data };

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
  const { params = {}, signal, fetchOptions = {} } = options;
  const response = await fetch(buildUrl(accion, params), {
    ...fetchOptions,
    signal
  });

  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

export async function fetchRoute(route, body = {}, options = {}) {
  const { signal, fetchOptions = {} } = options;
  const response = await fetch(`${API_URL}?route=${encodeURIComponent(route)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(body || {}),
    ...fetchOptions,
    signal
  });

  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

export async function cachedFetchJSON(accion, options = {}) {
  const {
    params = {},
    ttl = DEFAULT_TTL,
    force = false,
    cacheId = accion,
    signal,
    fetchOptions = {}
  } = options;
  const key = cacheKey('json', cacheId, { accion, ...params });

  if (!force) {
    const cached = readCache(key, ttl);
    if (cached.hit) return cached.data;
  }

  const stale = readCache(key, 0).stale;
  try {
    const data = await fetchJSON(accion, { params, signal, fetchOptions });
    writeCache(key, data);
    return data;
  } catch (error) {
    if (stale !== null && stale !== undefined) {
      console.warn(`Usando cache anterior para ${accion}:`, error);
      return stale;
    }
    throw error;
  }
}

export async function cachedFetchText(url, options = {}) {
  const {
    ttl = DEFAULT_TTL,
    force = false,
    cacheId = url,
    signal,
    fetchOptions = {}
  } = options;
  const key = cacheKey('text', cacheId);

  if (!force) {
    const cached = readCache(key, ttl);
    if (cached.hit) return cached.data;
  }

  const stale = readCache(key, 0).stale;
  try {
    const response = await fetch(url, { ...fetchOptions, signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const text = await response.text();
    writeCache(key, text);
    return text;
  } catch (error) {
    if (stale !== null && stale !== undefined) {
      console.warn('Usando cache anterior para recurso publico:', error);
      return stale;
    }
    throw error;
  }
}
