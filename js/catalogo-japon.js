import { whatsappLink } from './config.js?v=5';
import { API_CACHE_TTL } from './api-client.js?v=7';
import {
  cachedFetchJapanJSON,
  fetchJapanJSON,
  fetchJapanRoute
} from './japan-api.js?v=1';
import { createSearchTracker } from './search-tracking.js?v=5';

const PAGE_SIZE = 20;
const CATALOG_PAGE_PRIMARY_TIMEOUT_MS = 35000;
const CATALOG_PAGE_FALLBACK_TIMEOUT_MS = 20000;
const sharedLoteId = new URLSearchParams(location.search).get('lote') || '';
const PRODUCT_NOTE = 'No incluye envío de Japón 🇯🇵 a Perú 🇵🇪';

const grid = document.getElementById('catalogoJaponGrid');
const feedback = document.getElementById('catalogoJaponFeedback');
const statusEl = document.getElementById('catalogoJaponEstado');
const dateEl = document.getElementById('catalogoJaponFecha');
const pagination = document.getElementById('catalogoJaponPagination');
const modal = document.getElementById('catalogoJaponModal');
const modalPanel = modal?.querySelector('.japan-modal-panel');
const modalTitle = document.getElementById('catalogoJaponModalTitle');
const modalImage = document.getElementById('catalogoJaponModalImage');
const closeBtn = document.getElementById('catalogoJaponClose');
const filterForm = document.getElementById('catalogoJaponFilters');
const searchInput = document.getElementById('catalogoJaponSearch');
const animeSelect = document.getElementById('catalogoJaponAnime');
const availabilitySelect = document.getElementById('catalogoJaponAvailability');
const sortSelect = document.getElementById('catalogoJaponSort');
const minInput = document.getElementById('catalogoJaponMin');
const maxInput = document.getElementById('catalogoJaponMax');
const clearFiltersBtn = document.getElementById('catalogoJaponClear');

let catalogo = [];
let filteredCatalogo = [];
let currentPage = Math.max(1, Number(new URLSearchParams(location.search).get('pagina')) || 1);
let sharedLoteApplied = false;
let serverPagination = true;
let serverTotalPages = 1;
let catalogRequestController = null;
let catalogPrefetchIdleHandle = null;
let catalogPrefetchIdleType = '';
let activeCatalogQueryKey = '';
const catalogPrefetchRequests = new Map();
let catalogRequestId = 0;
let animeMetaLoaded = false;
const catalogImageUrls = new Map();
const catalogImageClassNames = new Map();
let catalogImageStyleElement = null;
let catalogImageStyleSheet = null;
let catalogImageRules = '';
let catalogImageObserver = null;
const searchTracker = createSearchTracker('CATALOGO_JAPON', { requestRoute:fetchJapanRoute });

function escapeHtml(value){
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function cssUrl(value){
  return String(value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/[\n\r\f]/g, '');
}

function imageClassForId(id){
  const text = String(id || 'sin-imagen');
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = ((hash << 5) - hash + text.charCodeAt(i)) >>> 0;
  }
  return `japan-image-bg-${hash.toString(36)}`;
}

function ensureImageStyleElement(){
  if (catalogImageStyleSheet || catalogImageStyleElement) return;

  if ('adoptedStyleSheets' in document && typeof CSSStyleSheet !== 'undefined') {
    catalogImageStyleSheet = new CSSStyleSheet();
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, catalogImageStyleSheet];
    return;
  }

  catalogImageStyleElement = document.createElement('style');
  catalogImageStyleElement.id = 'catalogo-japon-image-rules';
  document.head.appendChild(catalogImageStyleElement);
}

function syncCatalogImageRules(){
  ensureImageStyleElement();
  if (catalogImageStyleSheet) {
    catalogImageStyleSheet.replaceSync(catalogImageRules);
  } else if (catalogImageStyleElement) {
    catalogImageStyleElement.textContent = catalogImageRules;
  }
}

function resetCatalogImages(){
  if (catalogImageObserver) {
    catalogImageObserver.disconnect();
    catalogImageObserver = null;
  }
  catalogImageUrls.clear();
  catalogImageClassNames.clear();
  catalogImageRules = '';
  if (catalogImageStyleSheet || catalogImageStyleElement) syncCatalogImageRules();
}

function registerCatalogImage(id, imageUrl){
  const key = String(id || '').trim();
  const url = String(imageUrl || '').trim();
  if (!key || !url) return;
  catalogImageUrls.set(key, url);
}

function addCatalogImageRule(id, imageUrl){
  const key = String(id || '').trim();
  if (!key) return '';

  if (catalogImageClassNames.has(key)) return catalogImageClassNames.get(key);

  const className = imageClassForId(key);
  catalogImageClassNames.set(key, className);
  catalogImageRules += `\n.${className}{background-image:url("${cssUrl(imageUrl)}");}`;
  syncCatalogImageRules();
  return className;
}

function loadCatalogImageButton(button){
  if (!button || button.dataset.loaded === '1' || button.dataset.loaded === 'loading') return;

  const id = String(button.dataset.id || '').trim();
  const imageUrl = catalogImageUrls.get(id);
  const imageElement = button.querySelector('.japan-image-background');

  if (!id || !imageUrl || !imageElement) {
    button.classList.add('is-error');
    button.dataset.loaded = 'error';
    return;
  }

  button.dataset.loaded = 'loading';
  const image = new Image();
  image.decoding = 'async';
  image.referrerPolicy = 'no-referrer';
  image.onload = () => {
    if (!button.isConnected || catalogImageUrls.get(id) !== imageUrl) return;
    imageElement.classList.add(addCatalogImageRule(id, imageUrl));
    button.classList.add('is-loaded');
    button.dataset.loaded = '1';
  };
  image.onerror = () => {
    if (!button.isConnected || catalogImageUrls.get(id) !== imageUrl) return;
    button.classList.add('is-error');
    button.dataset.loaded = 'error';
  };
  image.src = imageUrl;
}

function setupCatalogImageLazyLoad(){
  const buttons = [...grid.querySelectorAll('.japan-image-button')];
  if (!buttons.length) return;

  if (!('IntersectionObserver' in window)) {
    buttons.forEach(loadCatalogImageButton);
    return;
  }

  catalogImageObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting && entry.intersectionRatio <= 0) return;
      observer.unobserve(entry.target);
      loadCatalogImageButton(entry.target);
    });
  }, {
    rootMargin: '360px 0px',
    threshold: 0.01
  });

  buttons.forEach(button => catalogImageObserver.observe(button));
}

function loteNumber(value){
  const match = String(value || '').match(/\d+/g);
  return match ? Number(match.join('')) || 0 : 0;
}

function normalizeText(value){
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function catalogSearchTerms(value){
  return normalizeText(value).split(' ').filter(Boolean);
}

function matchesCatalogSearch(item, value){
  const terms = catalogSearchTerms(value);
  if (!terms.length) return true;

  const searchIndex = normalizeText([
    item.id_lote,
    item.etiqueta,
    item.anime,
    item.tipo,
    item.busqueda
  ].join(' '));

  return terms.every(term => searchIndex.includes(term));
}

function debounce(fn, delay = 250){
  let timer;
  const debounced = (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
  debounced.cancel = () => {
    clearTimeout(timer);
    timer = null;
  };
  return debounced;
}

function cancelCatalogPrefetchIdle(){
  if (catalogPrefetchIdleHandle !== null) {
    if (catalogPrefetchIdleType === 'idle' && typeof window.cancelIdleCallback === 'function') {
      window.cancelIdleCallback(catalogPrefetchIdleHandle);
    } else {
      clearTimeout(catalogPrefetchIdleHandle);
    }
  }
  catalogPrefetchIdleHandle = null;
  catalogPrefetchIdleType = '';
}

function cancelCatalogPrefetch(){
  cancelCatalogPrefetchIdle();
  catalogPrefetchRequests.forEach(entry => entry.controller.abort());
  catalogPrefetchRequests.clear();
}

function allowsCatalogPrefetch(){
  const connection = navigator.connection;
  if (connection?.saveData === true) return false;
  const effectiveType = String(connection?.effectiveType || '').toLowerCase();
  return effectiveType !== 'slow-2g' && effectiveType !== '2g';
}

function catalogQueryKey(params){
  return [
    'page_size', 'search', 'anime', 'availability', 'sort', 'min_price', 'max_price'
  ].map(key => `${key}=${encodeURIComponent(String(params?.[key] ?? ''))}`).join('&');
}

function catalogPageRequestKey(params){
  return `${catalogQueryKey(params)}&page=${Number(params?.page) || 1}&include_meta=${String(params?.include_meta || '0')}`;
}

function waitForCatalogRequest(promise, signal){
  if (!signal) return promise;
  if (signal.aborted) return Promise.reject(new DOMException('Solicitud cancelada', 'AbortError'));
  return new Promise((resolve, reject) => {
    const cleanup = () => signal.removeEventListener('abort', abortWait);
    const abortWait = () => {
      cleanup();
      reject(new DOMException('Solicitud cancelada', 'AbortError'));
    };
    signal.addEventListener('abort', abortWait, { once:true });
    promise.then(
      value => { cleanup(); resolve(value); },
      error => { cleanup(); reject(error); }
    );
  });
}

function fetchCatalogPageForeground(params, signal){
  return cachedFetchJapanJSON('catalogoPreventasJaponPage', {
    params,
    ttl: API_CACHE_TTL.CATALOGO_PREVENTAS_JAPON,
    cacheId: 'catalogo-japon-page-v3',
    staleWhileRevalidate: false,
    retries: 0,
    primaryTimeoutMs: CATALOG_PAGE_PRIMARY_TIMEOUT_MS,
    fallbackTimeoutMs: CATALOG_PAGE_FALLBACK_TIMEOUT_MS,
    signal,
    abortUnderlying: true
  });
}

async function fetchCatalogPage(params, signal){
  const key = catalogPageRequestKey(params);
  const prefetched = catalogPrefetchRequests.get(key);
  if (prefetched) {
    try {
      return await waitForCatalogRequest(prefetched.promise, signal);
    } catch (error) {
      if (error?.name === 'AbortError' || signal?.aborted) throw error;
      if (catalogPrefetchRequests.get(key) === prefetched) {
        catalogPrefetchRequests.delete(key);
      }
    }
  }
  return fetchCatalogPageForeground(params, signal);
}

function getOrStartCatalogPrefetch(params){
  const key = catalogPageRequestKey(params);
  const existing = catalogPrefetchRequests.get(key);
  if (existing) return existing.promise;

  const controller = new AbortController();
  const entry = { controller, promise:null };
  entry.promise = fetchCatalogPageForeground(params, controller.signal).finally(() => {
    if (catalogPrefetchRequests.get(key) === entry) catalogPrefetchRequests.delete(key);
  });
  entry.promise.catch(() => {});
  catalogPrefetchRequests.set(key, entry);
  return entry.promise;
}

async function prefetchCatalogPages({ current, total, ahead, params }){
  const last = Math.min(total, current + ahead);
  for (let page = current + 1; page <= last; page += 1) {
    try {
      const data = await getOrStartCatalogPrefetch({ ...params, page, include_meta:'0' });
      if (!data || data.ok === false) return;
    } catch (_) {
      return;
    }
  }
}

function scheduleCatalogPrefetch({ requestId, page, totalPages, params }){
  const current = Math.max(1, Number(page) || 1);
  const total = Math.max(1, Number(totalPages) || 1);
  if (!allowsCatalogPrefetch() || total <= 1 || current >= total) return;

  cancelCatalogPrefetchIdle();
  const prefetch = () => {
    if (requestId !== catalogRequestId) return;
    catalogPrefetchIdleHandle = null;
    catalogPrefetchIdleType = '';
    prefetchCatalogPages({
      current,
      total,
      ahead:current === 1 ? 1 : 2,
      params
    }).catch(() => {});
  };

  if (typeof window.requestIdleCallback === 'function') {
    catalogPrefetchIdleType = 'idle';
    catalogPrefetchIdleHandle = window.requestIdleCallback(prefetch, { timeout:1500 });
  } else {
    catalogPrefetchIdleType = 'timeout';
    catalogPrefetchIdleHandle = setTimeout(prefetch, 250);
  }
}

function shareIcon(){
  return `
    <svg class="japan-tool-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7"></path>
      <path d="M16 6l-4-4-4 4"></path>
      <path d="M12 2v14"></path>
    </svg>
  `;
}

function loteShareUrl(id){
  const url = new URL(location.href);
  url.search = '';
  url.searchParams.set('lote', String(id));
  url.hash = '';
  return url.toString();
}

function money(value){
  const text = String(value || '').trim();
  if (!text) return 'Por confirmar';
  if (/^(S\/|\$)/i.test(text)) return text;
  return `S/ ${text}`;
}

function parsePrice(value){
  const text = String(value ?? '').trim();
  if (!text) return null;
  let normalized = text
    .replace(/\s/g, '')
    .replace(/s\//i, '')
    .replace(/[^\d,.-]/g, '');
  const lastComma = normalized.lastIndexOf(',');
  const lastDot = normalized.lastIndexOf('.');
  if (lastComma >= 0 && lastDot >= 0) {
    normalized = lastComma > lastDot
      ? normalized.replace(/\./g, '').replace(',', '.')
      : normalized.replace(/,/g, '');
  } else if (lastComma >= 0) {
    const parts = normalized.split(',');
    normalized = parts.length > 2 || parts.at(-1).length === 3
      ? normalized.replace(/,/g, '')
      : normalized.replace(',', '.');
  } else if (lastDot >= 0) {
    const parts = normalized.split('.');
    if (parts.length > 2 || parts.at(-1).length === 3) normalized = normalized.replace(/\./g, '');
  }
  const number = Number(normalized);
  return Number.isFinite(number) ? number : null;
}

function filterNumber(input){
  const value = String(input?.value || '').trim();
  if (!value) return null;
  return parsePrice(value);
}

function compareByPrice(a, b, direction){
  const priceA = parsePrice(a.precio_producto);
  const priceB = parsePrice(b.precio_producto);
  const fallback = loteNumber(b.id_lote) - loteNumber(a.id_lote);

  if (priceA === null && priceB === null) return fallback;
  if (priceA === null) return 1;
  if (priceB === null) return -1;

  return direction === 'desc'
    ? (priceB - priceA) || fallback
    : (priceA - priceB) || fallback;
}

function etiquetaInfo(value){
  const etiqueta = String(value || 'disponible').trim().toLowerCase();
  if (etiqueta === 'preventa') {
    return { text: 'Preventa', className: 'is-preventa' };
  }
  return { text: 'Disponible', className: 'is-disponible' };
}

function isAmazonCatalogItem(item){
  const sourceIndex = normalizeText([
    item?.plataforma,
    item?.origen,
    item?.fuente,
    item?.busqueda,
    item?.imagen_url
  ].join(' '));
  return sourceIndex.includes('amazon');
}

function publicAvailability(item){
  const label = normalizeText(item?.etiqueta);
  return label === 'preventa' || isAmazonCatalogItem(item) ? 'preventa' : 'disponible';
}

function matchesAvailability(item, availability){
  const selected = normalizeText(availability);
  if (!selected) return true;
  if (selected === 'rank') return Boolean(String(item?.rank || '').trim());
  return publicAvailability(item) === selected;
}

function rankInfo(value){
  const raw = String(value || '').trim().toUpperCase();
  const match = raw.match(/^(?:RANK\s*)?([NSABCD])(?:\s*RANK)?$/i);
  const rank = match?.[1]?.toUpperCase() || '';
  const descriptions = {
    N: 'Producto nuevo, sin abrir y de venta actual.',
    S: 'Estado similar a nuevo o producto descontinuado.',
    A: 'Muy buen estado y con muy poco uso.',
    B: 'Producto usado con señales leves de uso.',
    C: 'Producto usado con desgaste, rayones o suciedad visibles.',
    D: 'Producto con desgaste notable, daños o partes despintadas.'
  };
  if (!descriptions[rank]) return null;
  return { rank, description: descriptions[rank] };
}

function restoreCatalogStateFromUrl(){
  const params = new URLSearchParams(location.search);
  if (searchInput) searchInput.value = params.get('buscar') || '';
  if (animeSelect) {
    const anime = params.get('anime') || '';
    animeSelect.dataset.initialValue = anime;
    if ([...animeSelect.options].some(option => option.value === anime)) animeSelect.value = anime;
  }
  if (availabilitySelect) availabilitySelect.value = params.get('disponibilidad') || '';
  if (sortSelect) sortSelect.value = params.get('orden') || 'newest';
  if (minInput) minInput.value = params.get('min') || '';
  if (maxInput) maxInput.value = params.get('max') || '';
  currentPage = Math.max(1, Number(params.get('pagina')) || 1);
}

function catalogRequestParams(page = currentPage){
  return {
    page,
    page_size: PAGE_SIZE,
    search: String(searchInput?.value || '').trim(),
    anime: String(animeSelect?.dataset.initialValue ?? animeSelect?.value ?? '').trim(),
    availability: String(availabilitySelect?.value || '').trim(),
    sort: sortSelect?.value || 'newest',
    min_price: String(minInput?.value || '').trim(),
    max_price: String(maxInput?.value || '').trim()
  };
}

function updateCatalogUrl(mode = 'replace'){
  const url = new URL(location.href);
  const values = catalogRequestParams(currentPage);
  const mappings = {
    pagina: currentPage > 1 ? String(currentPage) : '',
    buscar: values.search,
    anime: values.anime,
    disponibilidad: values.availability,
    orden: values.sort !== 'newest' ? values.sort : '',
    min: values.min_price,
    max: values.max_price
  };

  Object.entries(mappings).forEach(([key, value]) => {
    if (value) url.searchParams.set(key, value);
    else url.searchParams.delete(key);
  });
  if (!sharedLoteId) url.searchParams.delete('lote');

  const state = { catalogoJapon: true, pagina: currentPage };
  if (mode === 'push') history.pushState(state, '', url);
  else history.replaceState(state, '', url);
}

function fillFilterSelect(select, values){
  if (!select) return;
  const current = select.dataset.initialValue || select.value;
  const defaultOption = document.createElement('option');
  defaultOption.value = '';
  defaultOption.textContent = 'Todos';
  const options = [...new Set(values.map(value => String(value || '').trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }))
    .map(value => {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = value;
      return option;
    });
  select.replaceChildren(defaultOption, ...options);
  select.value = options.some(option => option.value === current) ? current : '';
  delete select.dataset.initialValue;
}

function openModal(imageUrl, id){
  if (!modal || !modalImage || !imageUrl) return;
  modalTitle.textContent = `Lote #${id}`;
  modalImage.src = imageUrl;
  modalImage.alt = `Lote #${id}`;
  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('modal-open');
  closeBtn?.focus();
}

function closeModal(){
  if (!modal || !modalImage) return;
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('modal-open');
  modalImage.removeAttribute('src');
}

function getCatalogItem(id){
  const loteId = String(id || '').trim();
  return catalogo.find(item => String(item.id_lote || '').trim() === loteId);
}

function loadImageForCanvas(src){
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.referrerPolicy = 'no-referrer';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('image_load_error'));
    image.src = src;
  });
}

async function loadShareImage(item){
  const id = String(item.id_lote || '').trim();
  try {
    const data = await fetchJapanJSON('catalogoJaponImage', {
      params: { id_lote: id, ts: Date.now() },
      retries: 0,
      timeoutMs: 10000,
      fetchOptions: { cache: 'no-store' }
    });
    if (!data || data.ok === false || !data.base64) throw new Error(data?.error || 'image_proxy_error');
    return loadImageForCanvas(`data:${data.mime || 'image/jpeg'};base64,${data.base64}`);
  } catch (error) {
    console.warn('No se pudo preparar la imagen compartible con Apps Script:', error);
    return loadImageForCanvas(String(item.imagen_url || '').trim());
  }
}

function roundedRect(ctx, x, y, width, height, radius){
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawContainedImage(ctx, image, x, y, width, height){
  const imageWidth = image.naturalWidth || image.width;
  const imageHeight = image.naturalHeight || image.height;
  const scale = Math.min(width / imageWidth, height / imageHeight);
  const drawWidth = imageWidth * scale;
  const drawHeight = imageHeight * scale;
  const drawX = x + (width - drawWidth) / 2;
  const drawY = y + (height - drawHeight) / 2;
  ctx.drawImage(image, drawX, drawY, drawWidth, drawHeight);
}

function drawShareImageFallback(ctx, id){
  const fallback = ctx.createLinearGradient(110, 136, 970, 1186);
  fallback.addColorStop(0, '#f8efe4');
  fallback.addColorStop(1, '#e6d4bd');
  ctx.fillStyle = fallback;
  ctx.fillRect(110, 136, 860, 1050);

  ctx.fillStyle = '#a8322a';
  ctx.textAlign = 'center';
  ctx.font = '900 120px Arial, sans-serif';
  ctx.fillText('M', 540, 570);
  ctx.fillStyle = '#30261f';
  ctx.font = '900 54px Arial, sans-serif';
  ctx.fillText(`Lote #${id}`, 540, 690);
  ctx.fillStyle = '#756452';
  ctx.font = '700 34px Arial, sans-serif';
  ctx.fillText('Mira la imagen completa en mardant.com', 540, 770);
}

function canvasToBlob(canvas){
  return new Promise((resolve, reject) => {
    try {
      canvas.toBlob(blob => {
        if (blob) resolve(blob);
        else reject(new Error('canvas_blob_error'));
      }, 'image/png', 0.95);
    } catch (error) {
      reject(error);
    }
  });
}

async function createShareImageBlob(item){
  const id = String(item.id_lote || '').trim();
  const etiqueta = etiquetaInfo(publicAvailability(item));
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1920;
  const ctx = canvas.getContext('2d');

  const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, '#fffdf8');
  gradient.addColorStop(0.58, '#f6eee3');
  gradient.addColorStop(1, '#efe1ce');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.globalAlpha = 0.12;
  ctx.fillStyle = '#a8322a';
  ctx.font = '900 54px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('MARDANT', 540, 186);
  ctx.restore();

  ctx.save();
  roundedRect(ctx, 70, 96, 940, 1130, 42);
  ctx.fillStyle = '#fffdf8';
  ctx.shadowColor = 'rgba(23, 20, 17, .20)';
  ctx.shadowBlur = 34;
  ctx.shadowOffsetY = 18;
  ctx.fill();
  ctx.restore();

  const imageUrl = String(item.imagen_url || '').trim();
  if (imageUrl) {
    try {
      const image = await loadShareImage(item);
      drawContainedImage(ctx, image, 110, 136, 860, 1050);
    } catch (error) {
      console.warn('La imagen original no permite crear el archivo compartible:', error);
      drawShareImageFallback(ctx, id);
    }
  } else {
    drawShareImageFallback(ctx, id);
  }

  ctx.save();
  roundedRect(ctx, 70, 1260, 940, 430, 42);
  ctx.fillStyle = '#15110e';
  ctx.shadowColor = 'rgba(23, 20, 17, .20)';
  ctx.shadowBlur = 20;
  ctx.shadowOffsetY = 14;
  ctx.fill();
  ctx.restore();

  ctx.textAlign = 'left';
  ctx.fillStyle = '#f6cf56';
  ctx.font = '900 72px Arial, sans-serif';
  ctx.fillText(`Lote #${id}`, 120, 1372);

  ctx.save();
  roundedRect(ctx, 704, 1310, 240, 62, 31);
  ctx.fillStyle = etiqueta.className === 'is-preventa' ? '#f4d991' : '#dff3e9';
  ctx.fill();
  ctx.fillStyle = etiqueta.className === 'is-preventa' ? '#5b3600' : '#007c68';
  ctx.font = '900 28px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(etiqueta.text.toUpperCase(), 824, 1351);
  ctx.restore();

  ctx.fillStyle = '#d8c6aa';
  ctx.font = '800 32px Arial, sans-serif';
  ctx.fillText('Precio del producto', 120, 1452);
  ctx.fillStyle = '#ffffff';
  ctx.font = '900 84px Arial, sans-serif';
  ctx.fillText(money(item.precio_producto), 120, 1538);

  ctx.fillStyle = '#d8c6aa';
  ctx.font = '800 34px Arial, sans-serif';
  ctx.fillText(PRODUCT_NOTE, 120, 1612);

  ctx.fillStyle = '#a8322a';
  roundedRect(ctx, 120, 1730, 840, 94, 47);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = '900 38px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Solicitar por WhatsApp en mardant.com', 540, 1790);

  return canvasToBlob(canvas);
}

function card(item){
  const id = String(item.id_lote || '').trim();
  const imageUrl = String(item.imagen_url || '').trim();
  const etiqueta = etiquetaInfo(publicAvailability(item));
  const rank = rankInfo(item.rank);
  const shareUrl = loteShareUrl(id);
  registerCatalogImage(id, imageUrl);
  const article = document.createElement('article');
  article.className = 'japan-card';
  article.innerHTML = `
    <div class="japan-image-wrap">
      ${imageUrl ? `
        <button class="japan-image-button" type="button" data-id="${escapeHtml(id)}" aria-label="Ver imagen del lote #${escapeHtml(id)}">
          <span class="japan-image-background" role="img" aria-label="Imagen del producto lote #${escapeHtml(id)}"></span>
        </button>
      ` : '<div class="japan-no-image">Sin imagen</div>'}
    </div>
    <div class="japan-card-body">
      <div class="japan-card-head">
        <h2>Lote #${escapeHtml(id)}</h2>
        <span class="japan-badge ${etiqueta.className}">${etiqueta.text}</span>
      </div>
      ${rank ? `
        <div class="japan-rank japan-rank-${rank.rank.toLowerCase()}">
          <span class="japan-rank-letter" aria-hidden="true">${rank.rank}</span>
          <span class="japan-rank-copy">
            <strong>Rango ${rank.rank}</strong>
            <small>${escapeHtml(rank.description)}</small>
          </span>
        </div>
      ` : ''}
      <div class="japan-price-box">
        <span>Precio del producto</span>
        <strong>${escapeHtml(money(item.precio_producto))}</strong>
        <small>${escapeHtml(PRODUCT_NOTE)}</small>
      </div>
      <a class="japan-request"
         href="${whatsappLink(`Hola, quiero consultar el lote #${id}`)}"
         target="_blank"
         rel="noopener noreferrer"
         data-track-item-id="${escapeHtml(id)}"
         data-track-item-name="Lote #${escapeHtml(id)}"
         data-track-price="${escapeHtml(String(parsePrice(item.precio_producto) || ''))}"
         data-track-category="Catálogo Japón"
         data-track-source="catalogo_japon"
         data-track-cta="Solicitar">Solicitar</a>
      <div class="japan-card-tools">
        <button class="japan-share-button" type="button" data-share-id="${escapeHtml(id)}" data-share-url="${escapeHtml(shareUrl)}" aria-label="Compartir lote #${escapeHtml(id)}" title="Compartir">
          ${shareIcon()}
          <span class="japan-sr-only">Compartir</span>
        </button>
      </div>
    </div>
  `;
  return article;
}

async function shareLote(id, url, button){
  const loteId = String(id || '').trim();
  const shareUrl = url || loteShareUrl(loteId);
  const item = getCatalogItem(loteId);
  const text = `Mira el lote #${loteId} en el catalogo de productos en Japon de Mardant.`;

  button?.classList.add('is-loading');
  if (button) button.disabled = true;

  try {
    if (item && navigator.share && navigator.canShare) {
      try {
        const blob = await createShareImageBlob(item);
        const file = new File([blob], `mardant-lote-${loteId}.png`, { type: 'image/png' });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({
            title: `Lote #${loteId} - Mardant`,
            text,
            files: [file]
          });
          return;
        }
      } catch (imageError) {
        console.warn('No se pudo crear la imagen para compartir; se usara el enlace:', imageError);
      }
    }

    if (navigator.share) {
      await navigator.share({
        title: `Lote #${loteId} - Mardant`,
        text,
        url: shareUrl
      });
      return;
    }

    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(`${text}\n${shareUrl}`);
      alert('Enlace del lote copiado. Ya puedes compartirlo donde prefieras.');
    }
  } catch (error) {
    if (error?.name !== 'AbortError') console.warn('No se pudo compartir el lote:', error);
  } finally {
    button?.classList.remove('is-loading');
    if (button) button.disabled = false;
  }
}

function renderPagination(totalPages){
  pagination.replaceChildren();

  if (totalPages <= 1) {
    pagination.hidden = true;
    return;
  }

  pagination.hidden = false;
  const maxAround = 2;
  const makeBtn = (text, page, { active = false, disabled = false } = {}) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `boton${active ? ' active' : ''}`;
    button.textContent = text;
    button.disabled = disabled;
    button.setAttribute('aria-label', `Página ${page}`);
    if (active) button.setAttribute('aria-current', 'page');
    button.addEventListener('click', () => {
      if (disabled || page === currentPage) return;
      if (serverPagination) {
        loadCatalogPage({ page, historyMode: 'push' });
      } else {
        currentPage = page;
        updateCatalogUrl('push');
        render();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });
    return button;
  };

  const addDots = () => {
    const dots = document.createElement('span');
    dots.className = 'page-dots';
    dots.textContent = '...';
    pagination.appendChild(dots);
  };

  pagination.appendChild(makeBtn('«', Math.max(1, currentPage - 1), { disabled: currentPage <= 1 }));

  if (currentPage > maxAround + 2) {
    pagination.appendChild(makeBtn('1', 1));
    addDots();
  }

  const start = Math.max(1, currentPage - maxAround);
  const end = Math.min(totalPages, currentPage + maxAround);
  for (let page = start; page <= end; page += 1) {
    pagination.appendChild(makeBtn(String(page), page, { active: page === currentPage }));
  }

  if (currentPage < totalPages - maxAround - 1) {
    addDots();
    pagination.appendChild(makeBtn(String(totalPages), totalPages));
  }

  pagination.appendChild(makeBtn('»', Math.min(totalPages, currentPage + 1), { disabled: currentPage >= totalPages }));
}

function render(){
  resetCatalogImages();
  grid.replaceChildren();
  const totalPages = serverPagination
    ? Math.max(1, serverTotalPages)
    : Math.max(1, Math.ceil(filteredCatalogo.length / PAGE_SIZE));
  currentPage = Math.min(Math.max(currentPage, 1), totalPages);
  const start = (currentPage - 1) * PAGE_SIZE;
  const pageItems = serverPagination
    ? filteredCatalogo
    : filteredCatalogo.slice(start, start + PAGE_SIZE);

  pageItems.forEach(item => grid.appendChild(card(item)));
  setupCatalogImageLazyLoad();
  renderPagination(totalPages);

  if (catalogo.length && !filteredCatalogo.length) {
    feedback.hidden = false;
    statusEl.textContent = 'No hay lotes con ese filtro';
    statusEl.classList.remove('is-error');
    dateEl.textContent = 'Prueba con otra busqueda o cambia los filtros';
  } else if (filteredCatalogo.length) {
    feedback.hidden = true;
    statusEl.classList.remove('is-error');
    dateEl.textContent = '';
  }
}

function applyFilters({ resetPage = true, historyMode = 'push' } = {}){
  if (serverPagination) {
    loadCatalogPage({
      page: resetPage ? 1 : currentPage,
      historyMode
    });
    return;
  }

  const search = searchInput?.value || '';
  const anime = normalizeText(animeSelect?.value);
  const availability = availabilitySelect?.value || '';
  const minPrice = filterNumber(minInput);
  const maxPrice = filterNumber(maxInput);
  const sortMode = sortSelect?.value || 'newest';

  filteredCatalogo = catalogo.filter(item => {
    if (!matchesCatalogSearch(item, search)) return false;
    if (anime && normalizeText(item.anime) !== anime) return false;
    if (!matchesAvailability(item, availability)) return false;

    const price = parsePrice(item.precio_producto);
    const hasRange = minPrice !== null || maxPrice !== null;

    if (hasRange && price === null) return false;
    if (minPrice !== null && price < minPrice) return false;
    if (maxPrice !== null && price > maxPrice) return false;
    return true;
  });

  if (sortMode === 'price_asc') {
    filteredCatalogo.sort((a, b) => compareByPrice(a, b, 'asc'));
  } else if (sortMode === 'price_desc') {
    filteredCatalogo.sort((a, b) => compareByPrice(a, b, 'desc'));
  } else {
    filteredCatalogo.sort((a, b) => loteNumber(b.id_lote) - loteNumber(a.id_lote));
  }

  if (resetPage) currentPage = 1;
  render();
}

async function loadCatalogPage({ page = currentPage, historyMode = 'replace', throwOnError = false } = {}){
  const requestId = ++catalogRequestId;
  feedback.hidden = false;
  statusEl.textContent = 'Cargando catálogo...';
  statusEl.classList.remove('is-error');
  dateEl.textContent = '';
  pagination.querySelectorAll('button').forEach(button => { button.disabled = true; });

  if (catalogRequestController) catalogRequestController.abort();
  cancelCatalogPrefetchIdle();
  const controller = new AbortController();
  catalogRequestController = controller;
  const requestedPage = Math.max(1, Number(page) || 1);
  const requestedParams = catalogRequestParams(requestedPage);
  requestedParams.include_meta = animeMetaLoaded ? '0' : '1';
  const requestedQueryKey = catalogQueryKey(requestedParams);
  if (activeCatalogQueryKey && requestedQueryKey !== activeCatalogQueryKey) {
    cancelCatalogPrefetch();
  }
  activeCatalogQueryKey = requestedQueryKey;
  grid?.setAttribute('aria-busy', 'true');

  try {
    const data = await fetchCatalogPage(requestedParams, controller.signal);
    if (requestId !== catalogRequestId || controller.signal.aborted) return null;
    const responseError = String(data?.error || '').trim().toLowerCase();
    const queryIndexPending = data?.ok === false && (
      responseError === 'query_index_not_ready' ||
      responseError === 'catalog_query_index_not_ready'
    );
    if (queryIndexPending) {
      feedback.hidden = false;
      statusEl.textContent = 'La búsqueda del catálogo Japón está actualizándose.';
      statusEl.classList.remove('is-error');
      dateEl.textContent = 'Intenta nuevamente en unos minutos.';
      return null;
    }
    if (!data || data.ok === false || !Array.isArray(data.productos)) {
      throw new Error(data?.error || 'endpoint_paginado_no_disponible');
    }

    const responsePage = Math.max(1, Number(data.page) || 1);
    const responseTotalPages = Math.max(1, Number(data.total_pages) || 1);
    if (responsePage !== requestedPage && requestedPage <= responseTotalPages) {
      throw new Error('catalogo_japon_page_response_mismatch');
    }

    serverPagination = true;
    catalogo = data.productos;
    filteredCatalogo = catalogo.slice();
    currentPage = responsePage;
    serverTotalPages = responseTotalPages;
    if (Array.isArray(data.animes)) {
      fillFilterSelect(animeSelect, data.animes);
      animeMetaLoaded = true;
    }

    render();
    searchTracker.record(requestedParams.search);
    updateCatalogUrl(historyMode);
    if (historyMode === 'push') window.scrollTo({ top: 0, behavior: 'smooth' });

    if (!Number(data.total || 0)) {
      feedback.hidden = false;
      statusEl.textContent = 'No hay lotes con ese filtro';
      statusEl.classList.remove('is-error');
      dateEl.textContent = 'Prueba con otra búsqueda o cambia los filtros';
    }

    scheduleCatalogPrefetch({
      requestId,
      page:currentPage,
      totalPages:serverTotalPages,
      params:requestedParams
    });
    return data;
  } catch (error) {
    if (requestId !== catalogRequestId || controller.signal.aborted || error?.name === 'AbortError') return null;
    if (throwOnError) throw error;
    feedback.hidden = false;
    statusEl.textContent = 'No se pudo cargar esta página del catálogo';
    statusEl.classList.add('is-error');
    dateEl.textContent = 'Intenta nuevamente en unos segundos';
    console.warn('Error al cargar página del Catálogo Japón:', error);
    return null;
  } finally {
    if (requestId === catalogRequestId) {
      grid?.removeAttribute('aria-busy');
      pagination.querySelectorAll('button').forEach(button => { button.disabled = false; });
    }
  }
}

async function loadCatalog(){
  restoreCatalogStateFromUrl();
  if (sharedLoteId && !sharedLoteApplied && searchInput && !searchInput.value.trim()) {
    searchInput.value = sharedLoteId;
    currentPage = 1;
    sharedLoteApplied = true;
  }

  await loadCatalogPage({ page:currentPage, historyMode:'replace' });
}

const applySearchFiltersDebounced = debounce(() => {
  const length = normalizeText(searchInput?.value).length;
  if (length > 0 && length < 3) return;
  applyFilters({ historyMode:'replace' });
}, 850);

function applyFiltersNow(options) {
  applySearchFiltersDebounced.cancel();
  cancelCatalogPrefetch();
  applyFilters(options);
}

filterForm?.addEventListener('submit', event => {
  event.preventDefault();
  applyFiltersNow();
});

sortSelect?.addEventListener('change', () => {
  applyFiltersNow();
});

searchInput?.addEventListener('input', () => {
  cancelCatalogPrefetch();
  applySearchFiltersDebounced();
});

animeSelect?.addEventListener('change', () => {
  applyFiltersNow();
});

availabilitySelect?.addEventListener('change', () => {
  applyFiltersNow();
});

clearFiltersBtn?.addEventListener('click', () => {
  if (searchInput) searchInput.value = '';
  if (animeSelect) animeSelect.value = '';
  if (availabilitySelect) availabilitySelect.value = '';
  if (sortSelect) sortSelect.value = 'newest';
  if (minInput) minInput.value = '';
  if (maxInput) maxInput.value = '';
  applyFiltersNow();
});

window.addEventListener('popstate', () => {
  restoreCatalogStateFromUrl();
  if (serverPagination) loadCatalogPage({ page:currentPage, historyMode:'replace' });
  else applyFilters({ resetPage:false, historyMode:'replace' });
});

grid.addEventListener('click', event => {
  const shareButton = event.target.closest('.japan-share-button');
  if (shareButton) {
    shareLote(shareButton.dataset.shareId, shareButton.dataset.shareUrl, shareButton);
    return;
  }

  const button = event.target.closest('.japan-image-button');
  if (!button) return;
  const id = String(button.dataset.id || '').trim();
  openModal(catalogImageUrls.get(id), id);
});

closeBtn?.addEventListener('click', closeModal);
modal?.addEventListener('click', event => {
  if (!modalPanel?.contains(event.target)) closeModal();
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && modal?.classList.contains('open')) closeModal();
});

loadCatalog();
