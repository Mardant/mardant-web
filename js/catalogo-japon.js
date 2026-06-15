import { whatsappLink } from './config.js';

const PAGE_SIZE = 20;
const SPREADSHEET_ID = '17UeC7f4aIGmqEdmXD20wlV-kNidpm1MKK4V5v33X5yc';
const SHEET_NAME = 'catalogo';
const GVIZ_URL = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(SHEET_NAME)}&tq=select%20*`;

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

function escapeHtml(value){
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
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

function card(item){
  const id = String(item.id_lote || '').trim();
  const imageUrl = String(item.imagen_url || '').trim();
  const etiqueta = etiquetaInfo(item.etiqueta);
  const article = document.createElement('article');
  article.className = 'japan-card';
  article.innerHTML = `
    <div class="japan-image-wrap">
      ${imageUrl ? `
        <button class="japan-image-button" type="button" data-id="${escapeHtml(id)}" data-image="${escapeHtml(imageUrl)}" aria-label="Ver lote #${escapeHtml(id)}">
          <img src="${escapeHtml(imageUrl)}" alt="Lote #${escapeHtml(id)}" loading="lazy" referrerpolicy="no-referrer">
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
        <small>No incluye envío.</small>
      </div>
      <a class="japan-request" href="${whatsappLink(`Hola, quiero consultar el lote #${id}`)}" target="_blank" rel="noopener">Solicitar</a>
    </div>
  `;
  return article;
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
  grid.replaceChildren();
  const totalPages = Math.max(1, Math.ceil(filteredCatalogo.length / PAGE_SIZE));
  currentPage = Math.min(Math.max(currentPage, 1), totalPages);
  const start = (currentPage - 1) * PAGE_SIZE;
  const pageItems = filteredCatalogo.slice(start, start + PAGE_SIZE);

  pageItems.forEach(item => grid.appendChild(card(item)));
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
    const res = await fetch(requestUrl(), { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();

    catalogo = parseGvizCatalog(text)
      .sort((a, b) => loteNumber(b.id_lote) - loteNumber(a.id_lote));
    fillFilterSelect(animeSelect, catalogo.map(item => item.anime));
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
  const button = event.target.closest('.japan-image-button');
  if (!button) return;
  openModal(button.dataset.image, button.dataset.id);
});

closeBtn?.addEventListener('click', closeModal);
modal?.addEventListener('click', event => {
  if (!modalPanel?.contains(event.target)) closeModal();
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && modal?.classList.contains('open')) closeModal();
});

loadCatalog();
