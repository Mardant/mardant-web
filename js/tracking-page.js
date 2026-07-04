import { API_URL, AUTH_KEYS } from './config.js';

const content = document.getElementById('trackingContent');
const params = new URLSearchParams(window.location.search);
const preId = (params.get('pre_id') || params.get('pedido') || '').trim();

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function setError(title, message) {
  if (!content) return;
  content.className = 'tracking-card tracking-error';
  content.innerHTML = `
    <h2>${escapeHtml(title)}</h2>
    <p>${escapeHtml(message)}</p>
    <div class="tracking-actions">
      <a class="tracking-action" href="./cuenta.html">Volver a Mi Cuenta</a>
    </div>
  `;
}

function renderTracking(data) {
  if (!content) return;

  const history = Array.isArray(data.history) ? data.history : [];
  const historyHtml = history.length
    ? history.map((item) => `
        <article class="tracking-event">
          <time>${escapeHtml(item.fecha || '')}</time>
          <strong>${escapeHtml(item.estado || '-')}</strong>
          ${item.detalle ? `<p>${escapeHtml(item.detalle)}</p>` : ''}
        </article>
      `).join('')
    : `
      <article class="tracking-event">
        <strong>No hay eventos de seguimiento para mostrar.</strong>
      </article>
    `;

  content.className = 'tracking-card';
  content.innerHTML = `
    <section class="tracking-current">
      <span>Estado actual</span>
      <strong>${escapeHtml(data.estado || '-')}</strong>
      <small>Última actualización: ${escapeHtml(data.actualizado || '-')}</small>
    </section>

    <div class="tracking-content-wrap">
      <section class="tracking-grid">
        <div class="tracking-info">
          <span>Pedido</span>
          <strong>${escapeHtml(data.pre_id || preId || '-')}</strong>
        </div>
        <div class="tracking-info">
          <span>Código público</span>
          <strong>${escapeHtml(data.codigo || '-')}</strong>
        </div>
      </section>

      <h2 class="tracking-section-title">Producto</h2>
      <p class="tracking-product">${escapeHtml(data.producto || '-')}</p>

      <h2 class="tracking-section-title">Historial</h2>
      <section class="tracking-history">${historyHtml}</section>

      <p class="tracking-thanks">Muchas gracias por preferir a Mardant.</p>
      <div class="tracking-actions">
        <a class="tracking-action" href="./cuenta.html">Volver a Mi Cuenta</a>
        <a class="tracking-action secondary" href="./inicio.html">Ir al inicio</a>
      </div>
    </div>
  `;
}

async function loadTracking() {
  if (!preId) {
    setError('Pedido no indicado', 'No recibimos el código del pedido para mostrar el seguimiento.');
    return;
  }

  const token = localStorage.getItem(AUTH_KEYS.TOKEN) || '';
  if (!token) {
    setError('Sesión no iniciada', 'Ingresa nuevamente a Mi Cuenta para ver el seguimiento de este pedido.');
    return;
  }

  const url = `${API_URL}?route=tracking_data&token=${encodeURIComponent(token)}&pre_id=${encodeURIComponent(preId)}`;
  const res = await fetch(url, { cache: 'no-store' });
  const data = await res.json();

  if (!data.ok) {
    setError('Seguimiento no disponible', data.mensaje || data.error || 'No se pudo cargar el seguimiento.');
    return;
  }

  renderTracking(data);
}

loadTracking().catch((err) => {
  setError('Seguimiento no disponible', err.message || 'No se pudo cargar el seguimiento.');
});
