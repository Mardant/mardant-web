import { JAPAN_API_URL, JAPAN_LEGACY_API_URL } from './config.js?v=5';
import {
  cachedFetchJSON,
  fetchJSON,
  fetchRoute,
  getCachedJSON
} from './api-client.js?v=7';

export const JAPAN_PRIMARY_TIMEOUT_MS = 5000;
const JAPAN_FALLBACK_TIMEOUT_MS = 15000;

const RECOVERABLE_JAPAN_ERRORS = new Set([
  'query_index_not_ready',
  'catalog_query_index_not_ready',
  'catalog_index_not_ready',
  'catalog_index_inconsistent',
  'server_error'
]);

function normalizeErrorCode(data) {
  return String(data?.error || '').trim().toLowerCase();
}

export function shouldFallbackJapanResponse(data) {
  if (!data || data.ok !== false) return false;
  const code = normalizeErrorCode(data);
  return RECOVERABLE_JAPAN_ERRORS.has(code) || code.includes('query_index');
}

function canUseLegacy() {
  return Boolean(JAPAN_LEGACY_API_URL && JAPAN_LEGACY_API_URL !== JAPAN_API_URL);
}

function wasCancelledByCaller(error, signal) {
  return Boolean(signal?.aborted && error?.name === 'AbortError');
}

async function withJapanFallback(primaryRequest, legacyRequest, signal) {
  let primaryError = null;
  try {
    const data = await primaryRequest();
    if (!shouldFallbackJapanResponse(data) || !canUseLegacy()) return data;
    primaryError = new Error(normalizeErrorCode(data) || 'japan_backend_unavailable');
  } catch (error) {
    if (wasCancelledByCaller(error, signal)) throw error;
    primaryError = error;
    if (!canUseLegacy()) throw error;
  }

  try {
    return await legacyRequest();
  } catch (legacyError) {
    if (wasCancelledByCaller(legacyError, signal)) throw legacyError;
    const error = new Error('No se pudo consultar el catalogo Japon');
    error.primaryError = primaryError;
    error.legacyError = legacyError;
    throw error;
  }
}

function requestTimeout(options, fallback = false) {
  if (fallback) return Math.max(1000, Number(options.fallbackTimeoutMs) || Number(options.timeoutMs) || JAPAN_FALLBACK_TIMEOUT_MS);
  return Math.max(1000, Number(options.primaryTimeoutMs) || JAPAN_PRIMARY_TIMEOUT_MS);
}

function cleanOptions(options = {}) {
  const cleaned = { ...options };
  delete cleaned.baseUrl;
  delete cleaned.fallbackBaseUrl;
  delete cleaned.primaryTimeoutMs;
  delete cleaned.fallbackTimeoutMs;
  return cleaned;
}

export function getCachedJapanJSON(accion, options = {}) {
  const shared = cleanOptions(options);
  const primary = getCachedJSON(accion, { ...shared, baseUrl:JAPAN_API_URL });
  if (primary !== null && primary !== undefined && !shouldFallbackJapanResponse(primary)) return primary;
  if (!canUseLegacy()) return primary;
  return getCachedJSON(accion, { ...shared, baseUrl:JAPAN_LEGACY_API_URL });
}

export async function fetchJapanJSON(accion, options = {}) {
  const shared = cleanOptions(options);
  const signal = options.signal;
  return withJapanFallback(
    () => fetchJSON(accion, {
      ...shared,
      baseUrl:JAPAN_API_URL,
      retries:0,
      timeoutMs:requestTimeout(options, false)
    }),
    () => fetchJSON(accion, {
      ...shared,
      baseUrl:JAPAN_LEGACY_API_URL,
      retries:0,
      timeoutMs:requestTimeout(options, true)
    }),
    signal
  );
}

export async function cachedFetchJapanJSON(accion, options = {}) {
  const shared = cleanOptions(options);
  const signal = options.signal;
  return withJapanFallback(
    () => cachedFetchJSON(accion, {
      ...shared,
      baseUrl:JAPAN_API_URL,
      retries:0,
      timeoutMs:requestTimeout(options, false)
    }),
    () => cachedFetchJSON(accion, {
      ...shared,
      baseUrl:JAPAN_LEGACY_API_URL,
      retries:0,
      timeoutMs:requestTimeout(options, true)
    }),
    signal
  );
}

export async function fetchJapanRoute(route, body = {}, options = {}) {
  const shared = cleanOptions(options);
  const signal = options.signal;
  return withJapanFallback(
    () => fetchRoute(route, body, {
      ...shared,
      baseUrl:JAPAN_API_URL,
      timeoutMs:requestTimeout(options, false)
    }),
    () => fetchRoute(route, body, {
      ...shared,
      baseUrl:JAPAN_LEGACY_API_URL,
      timeoutMs:requestTimeout(options, true)
    }),
    signal
  );
}

export async function prefetchJapanJSONPages(accion, options = {}) {
  const {
    current = 1,
    total = 1,
    ahead = 3,
    behind = 1,
    params = {},
    signal
  } = options;
  if (signal?.aborted) return;

  const first = Math.max(1, Number(current) - Math.max(0, Number(behind) || 0));
  const last = Math.min(Number(total) || 1, Number(current) + Math.max(0, Number(ahead) || 0));
  for (let page = first; page <= last; page += 1) {
    if (signal?.aborted) break;
    if (page === Number(current)) continue;
    try {
      await cachedFetchJapanJSON(accion, {
        ...options,
        params: { ...params, page },
        staleWhileRevalidate: true,
        signal,
        abortUnderlying:Boolean(signal)
      });
    } catch (_) {}
  }
}
