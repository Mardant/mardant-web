import { API_URL, whatsappLink } from './config.js';
import { API_CACHE_TTL, cachedFetchText } from './api-client.js';

const PAGE_SIZE = 20;
const SPREADSHEET_ID = '17UeC7f4aIGmqEdmXD20wlV-kNidpm1MKK4V5v33X5yc';
const SHEET_NAME = 'catalogo';
const GVIZ_URL = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(SHEET_NAME)}&tq=select%20*`;
const LIKES_STORAGE_KEY = 'mardant_japon_likes_v1';
const VISITOR_STORAGE_KEY = 'mardant_japon_visitor_id_v1';
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
const sortSelect = document.getElementById('catalogoJaponSort');
const minInput = document.getElementById('catalogoJaponMin');
const maxInput = document.getElementById('catalogoJaponMax');
const clearFiltersBtn = document.getElementById('catalogoJaponClear');

let catalogo = [];
let filteredCatalogo = [];
let currentPage = 1;
let sharedLoteApplied = false;
let likeCounts = new Map();
let likedLots = new Set(loadLikedLots());
const catalogImageUrls = new Map();
const catalogImageClassNames = new Map();
let catalogImageStyleElement = null;
let catalogImageStyleSheet = null;
let catalogImageRules = '';
let catalogImageObserver = null;

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

function debounce(fn, delay = 250){
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
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

function likeIcon(){
  return `
    <svg class="japan-tool-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 10v11"></path>
      <path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2h.5a2.5 2.5 0 0 1 2.5 3.88Z"></path>
    </svg>
  `;
}

function loadLikedLots(){
  try {
    const raw = localStorage.getItem(LIKES_STORAGE_KEY);
    const values = raw ? JSON.parse(raw) : [];
    return Array.isArray(values) ? values.map(String) : [];
  } catch (_) {
    return [];
  }
}

function saveLikedLots(){
  try {
    localStorage.setItem(LIKES_STORAGE_KEY, JSON.stringify([...likedLots]));
  } catch (_) {}
}

function getVisitorId(){
  try {
    let visitorId = localStorage.getItem(VISITOR_STORAGE_KEY);
    if (!visitorId) {
      const random = (crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`)
        .replace(/[^\w-]/g, '');
      visitorId = `vj-${random}`;
      localStorage.setItem(VISITOR_STORAGE_KEY, visitorId);
    }
    return visitorId;
  } catch (_) {
    return `vj-${Date.now()}`;
  }
}

function likeCountFor(id){
  return likeCounts.get(String(id)) || 0;
}

function loteShareUrl(id){
  const url = new URL(location.href);
  url.searchParams.set('lote', String(id));
  url.hash = '';
  return url.toString();
}

function setLikeCount(id, count){
  likeCounts.set(String(id), Math.max(0, Number(count) || 0));
  document.querySelectorAll('.japan-like-button').forEach(button => {
    if (button.dataset.likeId !== String(id)) return;
    const countEl = button.querySelector('.japan-like-count');
    if (countEl) countEl.textContent = String(likeCountFor(id));
  });
}

function updateLikeButtons(id){
  document.querySelectorAll('.japan-like-button').forEach(button => {
    const loteId = button.dataset.likeId || '';
    if (id && loteId !== String(id)) return;
    const isLiked = likedLots.has(loteId);
    button.classList.toggle('is-liked', isLiked);
    button.setAttribute('aria-pressed', isLiked ? 'true' : 'false');
    button.setAttribute('aria-label', `${isLiked ? 'Quitar me gusta' : 'Me gusta'} lote #${loteId}`);
    button.title = isLiked ? 'Quitar me gusta' : 'Me gusta';
    const countEl = button.querySelector('.japan-like-count');
    if (countEl) countEl.textContent = String(likeCountFor(loteId));
  });
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
  const normalized = text
    .replace(/\s/g, '')
    .replace(/s\//i, '')
    .replace(/,/g, '.')
    .replace(/[^\d.]/g, '');
  const parts = normalized.split('.');
  const safeNumber = parts.length > 2
    ? `${parts[0]}.${parts.slice(1).join('')}`
    : normalized;
  const number = Number(safeNumber);
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

function requestUrl(){
  return GVIZ_URL;
}

function headerKey(value){
  return String(value || '').trim().toLowerCase();
}

function cellValue(row, index){
  if (index < 0) return '';
  const cell = row?.c?.[index];
  const value = cell?.v ?? cell?.f ?? '';
  return String(value ?? '').trim();
}

function parseGvizCatalog(text){
  const jsonText = text.substring(text.indexOf('{'), text.lastIndexOf('}') + 1);
  const safeJsonText = jsonText
    .replace(/:\s*new Date\(([^)]*)\)/g, ':"$1"')
    .replace(/:\s*Date\(([^)]*)\)/g, ':"$1"');
  const payload = JSON.parse(safeJsonText);
  const headers = (payload.table?.cols || []).map(col => headerKey(col.label || col.id));
  const indexOf = (name, fallback) => {
    const index = headers.indexOf(name);
    return index >= 0 ? index : fallback;
  };
  const cols = {
    id_lote: indexOf('id_lote', 0),
    imagen_url: indexOf('imagen_url', 1),
    etiqueta: indexOf('etiqueta', 2),
    precio_producto: indexOf('precio_producto', 3),
    visible: indexOf('visible', 4),
    ultima_revision: indexOf('ultima_revision', 5),
    anime: indexOf('anime', 6),
    tipo: indexOf('tipo', 7),
    busqueda: indexOf('busqueda', 8)
  };

  return (payload.table?.rows || [])
    .map(row => ({
      id_lote: cellValue(row, cols.id_lote),
      imagen_url: cellValue(row, cols.imagen_url),
      etiqueta: cellValue(row, cols.etiqueta),
      precio_producto: cellValue(row, cols.precio_producto),
      visible: cellValue(row, cols.visible),
      ultima_revision: cellValue(row, cols.ultima_revision),
      anime: cellValue(row, cols.anime),
      tipo: cellValue(row, cols.tipo),
      busqueda: cellValue(row, cols.busqueda)
    }))
    .filter(item => item.id_lote && normalizeText(item.visible) === 'si');
}

function fillFilterSelect(select, values){
  if (!select) return;
  const current = select.value;
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
    const res = await fetch(`${API_URL}?accion=catalogoJaponImage&id_lote=${encodeURIComponent(id)}&ts=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
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
  const etiqueta = etiquetaInfo(item.etiqueta);
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
    const image = await loadShareImage(item);
    drawContainedImage(ctx, image, 110, 136, 860, 1050);
  } else {
    ctx.fillStyle = '#ddd1bf';
    ctx.fillRect(110, 136, 860, 1050);
    ctx.fillStyle = '#7c6a55';
    ctx.font = '800 48px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Sin imagen', 540, 660);
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
  const etiqueta = etiquetaInfo(item.etiqueta);
  const liked = likedLots.has(id);
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
        <button class="japan-like-button${liked ? ' is-liked' : ''}" type="button" data-like-id="${escapeHtml(id)}" aria-label="${liked ? 'Quitar me gusta' : 'Me gusta'} lote #${escapeHtml(id)}" aria-pressed="${liked ? 'true' : 'false'}" title="${liked ? 'Quitar me gusta' : 'Me gusta'}">
          ${likeIcon()}
          <strong class="japan-like-count">${likeCountFor(id)}</strong>
        </button>
      </div>
    </div>
  `;
  return article;
}

async function loadLikeCounts(){
  try {
    const res = await fetch(`${API_URL}?accion=catalogoJaponLikes&ts=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!data || data.ok === false) throw new Error(data?.error || 'likes_error');
    likeCounts = new Map(Object.entries(data.likes || {}).map(([id, count]) => [String(id), Number(count) || 0]));
  } catch (error) {
    console.warn('No se pudieron cargar likes del catalogo Japon:', error);
    likeCounts = new Map();
  }
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
    }

    if (navigator.share) {
      await navigator.share({
        title: `Lote #${loteId} - Mardant`,
        text,
        url: shareUrl
      });
      return;
    }

    window.open(whatsappLink(`${text}\n${shareUrl}`), '_blank', 'noopener');
  } catch (error) {
    if (error?.name !== 'AbortError') {
      window.open(whatsappLink(`${text}\n${shareUrl}`), '_blank', 'noopener');
    }
  } finally {
    button?.classList.remove('is-loading');
    if (button) button.disabled = false;
  }
}

async function toggleLikeLote(id, button){
  const loteId = String(id || '').trim();
  if (!loteId) return;

  const wasLiked = likedLots.has(loteId);
  const nextLiked = !wasLiked;
  const previousCount = likeCountFor(loteId);

  if (button) button.disabled = true;

  if (nextLiked) likedLots.add(loteId);
  else likedLots.delete(loteId);
  saveLikedLots();
  setLikeCount(loteId, Math.max(0, previousCount + (nextLiked ? 1 : -1)));
  updateLikeButtons(loteId);

  try {
    const route = nextLiked ? 'catalogo_japon_like' : 'catalogo_japon_unlike';
    const res = await fetch(`${API_URL}?route=${route}`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        id_lote: loteId,
        visitor_id: getVisitorId(),
        user_agent: navigator.userAgent || ''
      })
    });
    const data = await res.json();
    if (!data || data.ok === false) throw new Error(data?.error || 'like_error');
    setLikeCount(loteId, data.count);
    updateLikeButtons(loteId);
  } catch (error) {
    if (wasLiked) likedLots.add(loteId);
    else likedLots.delete(loteId);
    saveLikedLots();
    setLikeCount(loteId, previousCount);
    updateLikeButtons(loteId);
    alert('No se pudo actualizar tu me gusta. Intentalo otra vez.');
  } finally {
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
      currentPage = page;
      render();
      window.scrollTo({ top: 0, behavior: 'smooth' });
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
  const totalPages = Math.max(1, Math.ceil(filteredCatalogo.length / PAGE_SIZE));
  currentPage = Math.min(Math.max(currentPage, 1), totalPages);
  const start = (currentPage - 1) * PAGE_SIZE;
  const pageItems = filteredCatalogo.slice(start, start + PAGE_SIZE);

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

function applyFilters({ resetPage = true } = {}){
  const search = normalizeText(searchInput?.value);
  const anime = normalizeText(animeSelect?.value);
  const minPrice = filterNumber(minInput);
  const maxPrice = filterNumber(maxInput);
  const sortMode = sortSelect?.value || 'newest';

  filteredCatalogo = catalogo.filter(item => {
    const searchable = normalizeText([
      item.id_lote,
      item.anime,
      item.busqueda,
      item.etiqueta
    ].join(' '));
    if (search && !searchable.includes(search)) return false;
    if (anime && normalizeText(item.anime) !== anime) return false;

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

async function loadCatalog(){
  feedback.hidden = false;
  statusEl.textContent = 'Cargando catálogo...';
  statusEl.classList.remove('is-error');
  dateEl.textContent = '';
  grid.replaceChildren();
  pagination.replaceChildren();

  try {
    const text = await cachedFetchText(requestUrl(), {
      ttl: API_CACHE_TTL.CATALOGO_JAPON_GVIZ,
      cacheId: 'catalogo-japon-gviz'
    });

    catalogo = parseGvizCatalog(text)
      .sort((a, b) => loteNumber(b.id_lote) - loteNumber(a.id_lote));
    fillFilterSelect(animeSelect, catalogo.map(item => item.anime));
    await loadLikeCounts();
    if (sharedLoteId && !sharedLoteApplied && searchInput && !searchInput.value.trim()) {
      searchInput.value = sharedLoteId;
      sharedLoteApplied = true;
    }
    applyFilters();
    if (!catalogo.length) {
      feedback.hidden = false;
      statusEl.textContent = 'No hay lotes disponibles por ahora';
      dateEl.textContent = '';
    }
  } catch (error) {
    catalogo = [];
    grid.replaceChildren();
    pagination.replaceChildren();
    feedback.hidden = false;
    statusEl.textContent = `No se pudo cargar el catálogo: ${error.message}`;
    statusEl.classList.add('is-error');
    dateEl.textContent = 'Revisa que el Google Sheet sea publico y tenga la pestana catalogo';
  }
}

filterForm?.addEventListener('submit', event => {
  event.preventDefault();
  applyFilters();
});

sortSelect?.addEventListener('change', () => {
  applyFilters();
});

searchInput?.addEventListener('input', debounce(() => {
  applyFilters();
}));

animeSelect?.addEventListener('change', () => {
  applyFilters();
});

clearFiltersBtn?.addEventListener('click', () => {
  if (searchInput) searchInput.value = '';
  if (animeSelect) animeSelect.value = '';
  if (sortSelect) sortSelect.value = 'newest';
  if (minInput) minInput.value = '';
  if (maxInput) maxInput.value = '';
  applyFilters();
});

grid.addEventListener('click', event => {
  const shareButton = event.target.closest('.japan-share-button');
  if (shareButton) {
    shareLote(shareButton.dataset.shareId, shareButton.dataset.shareUrl, shareButton);
    return;
  }

  const likeButton = event.target.closest('.japan-like-button');
  if (likeButton) {
    toggleLikeLote(likeButton.dataset.likeId, likeButton);
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
