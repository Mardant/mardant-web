import { API_URL, whatsappLink } from './config.js';

const PAGE_SIZE = 20;

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

let catalogo = [];
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

function money(value){
  const text = String(value || '').trim();
  if (!text) return 'Por confirmar';
  if (/^(S\/|\$)/i.test(text)) return text;
  return `S/ ${text}`;
}

function etiquetaInfo(value){
  const etiqueta = String(value || 'disponible').trim().toLowerCase();
  if (etiqueta === 'preventa') {
    return { text: 'Preventa', className: 'is-preventa' };
  }
  return { text: 'Disponible', className: 'is-disponible' };
}

function requestUrl(){
  return `${API_URL}?accion=catalogoPreventasJapon`;
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
  const totalPages = Math.max(1, Math.ceil(catalogo.length / PAGE_SIZE));
  currentPage = Math.min(Math.max(currentPage, 1), totalPages);
  const start = (currentPage - 1) * PAGE_SIZE;
  const pageItems = catalogo.slice(start, start + PAGE_SIZE);

  pageItems.forEach(item => grid.appendChild(card(item)));
  renderPagination(totalPages);
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
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || 'No se pudo leer el catálogo');

    catalogo = (Array.isArray(data.productos) ? data.productos : [])
      .filter(item => item && item.id_lote)
      .sort((a, b) => loteNumber(b.id_lote) - loteNumber(a.id_lote));
    currentPage = 1;
    render();
    if (catalogo.length) {
      feedback.hidden = true;
    } else {
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
    dateEl.textContent = 'Revisa que el Apps Script esté desplegado con el endpoint nuevo';
  }
}

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
