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

function normalizeTrackingKey(value = '') {
  return String(value)
    .replace(/\u00A0/g, ' ')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

function normalizeText(value = '') {
  return String(value).replace(/\u00A0/g, ' ').replace(/\s+/g, ' ').trim();
}

function translateTrackingState(state = '') {
  const text = normalizeText(state);
  const map = {
    ENTREGADO: 'Lleg\u00f3 al almac\u00e9n de Mardant',
    'LIBERADO PARA CONTINUAR': 'Liberado por aduanas',
    'EN PROCESO DE INGRESO A PERU': 'En revisi\u00f3n de aduanas',
    'EN TRASLADO DENTRO DE PERU': 'En proceso de distribuci\u00f3n en Per\u00fa',
    'ENVIO ENTREGADO': 'Lleg\u00f3 al almac\u00e9n de Mardant',
    'FINAL DELIVERY': 'Lleg\u00f3 al almac\u00e9n de Mardant',
    'ENVIO LLEGO A LA OFICINA POSTAL ASCARRUNZ': 'En proceso de entrega a almac\u00e9n Mardant',
    'ENVIO EN PROCESO DE DISTRIBUCION': 'En proceso de entrega a almac\u00e9n Mardant',
    'ENVIO EN PROCESAMIENTO DE DISTRIBUCION EN EL DOMICILIO DE DESTINO': 'En proceso de entrega a almac\u00e9n Mardant',
    'ITEM OUT FOR PHYSICAL DELIVERY': 'En reparto hacia almac\u00e9n Mardant',
    'PROCESSING AT DELIVERY POST OFFICE': 'En proceso de entrega a almac\u00e9n Mardant',
    'ITEM RETURNED FROM IMPORT CUSTOMS': 'Liberado por aduanas',
    'ITEM PRESENTED TO IMPORT CUSTOMS': 'En revisi\u00f3n de aduanas',
    'DEPARTURE FROM INWARD OFFICE OF EXCHANGE': 'En proceso de distribuci\u00f3n en Per\u00fa',
    'ARRIVAL AT INWARD OFFICE OF EXCHANGE': 'Lleg\u00f3 a Per\u00fa',
    'DISPATCH FROM OUTWARD OFFICE OF EXCHANGE': 'Sali\u00f3 de Jap\u00f3n',
    'ARRIVAL AT OUTWARD OFFICE OF EXCHANGE': 'En centro internacional de salida',
    'POSTING COLLECTION': 'Recibido en Jap\u00f3n',
  };

  return map[normalizeTrackingKey(text)] || text;
}

function isHiddenTrackingState(state = '') {
  const key = normalizeTrackingKey(state);
  if (!key) return true;
  if (
    key === 'SEGUIMIENTO EN ACTUALIZACION' ||
    key === 'EN ACTUALIZACION' ||
    key === 'EN ESPERA DE ACTUALIZACION'
  ) return true;

  return key.includes('ERROR') ||
    key.includes('TECNICO') ||
    key.includes('TECHNICAL') ||
    key.includes('STACK') ||
    key.includes('EXCEPTION') ||
    key.includes('TRACKING REAL') ||
    key.includes('ESTADO ORIGINAL') ||
    key.includes('COURIER INTERNO') ||
    key.includes('NOTA INTERNA');
}

function normalizeTrackingEvent(item = {}) {
  if (!item || typeof item !== 'object') return null;

  const rawState = normalizeText(
    item.estado_publico || item.estado || item.evento || item.titulo || item.status || ''
  );
  if (isHiddenTrackingState(rawState)) return null;

  const state = translateTrackingState(rawState);
  if (isHiddenTrackingState(state)) return null;

  const rawDetail = normalizeText(item.mensaje || item.descripcion_publica || item.detalle_publico || item.detalle || '');
  const detail = rawDetail &&
    !isHiddenTrackingState(rawDetail) &&
    normalizeTrackingKey(rawDetail) !== normalizeTrackingKey(rawState) &&
    normalizeTrackingKey(rawDetail) !== normalizeTrackingKey(state)
      ? rawDetail
      : '';

  return {
    fecha: item.fecha || item.fecha_evento || item.actualizacion || item.updated_at || item.created_at || '',
    estado: state,
    detalle: detail,
  };
}

function cleanTrackingData(data = {}) {
  const rawHistory = Array.isArray(data.history) ? data.history : [];
  const history = [];
  let previousState = '';

  rawHistory.forEach((item) => {
    const event = normalizeTrackingEvent(item);
    if (!event) return;

    const stateKey = normalizeTrackingKey(event.estado);
    if (stateKey && stateKey === previousState) return;

    history.push(event);
    previousState = stateKey;
  });

  let estado = translateTrackingState(data.estado || '');
  if (isHiddenTrackingState(estado)) estado = '';

  if (!history.length) {
    return {
      ...data,
      estado: estado || 'En espera de nuevos movimientos',
      actualizado: '',
      mensaje: data.mensaje || 'Estamos esperando nuevos movimientos del env\u00edo.',
      history,
    };
  }

  return {
    ...data,
    estado: estado || history[0].estado,
    actualizado: data.actualizado || history[0].fecha || '',
    mensaje: '',
    history,
  };
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

  data = cleanTrackingData(data);

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
        <strong>${escapeHtml(data.mensaje || 'Estamos esperando nuevos movimientos del env\u00edo.')}</strong>
      </article>
    `;
  const currentNote = data.mensaje
    ? data.mensaje
    : `\u00daltima actualizaci\u00f3n: ${data.actualizado || '-'}`;

  content.className = 'tracking-card';
  content.innerHTML = `
    <section class="tracking-current">
      <span>Estado actual</span>
      <strong>${escapeHtml(data.estado || '-')}</strong>
      <small>${escapeHtml(currentNote)}</small>
    </section>

    <div class="tracking-content-wrap">
      <section class="tracking-grid">
        <div class="tracking-info">
          <span>Pedido</span>
          <strong>${escapeHtml(data.pre_id || preId || '-')}</strong>
        </div>
        <div class="tracking-info">
          <span>C\u00f3digo p\u00fablico</span>
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
    setError('Pedido no indicado', 'No recibimos el codigo del pedido para mostrar el seguimiento.');
    return;
  }

  let token = '';
  try {
    token = sessionStorage.getItem(AUTH_KEYS.TOKEN) || '';
  } catch (_) {}
  if (!token) {
    setError('Sesion no iniciada', 'Ingresa nuevamente a Mi Cuenta para ver el seguimiento de este pedido.');
    return;
  }

  const res = await fetch(`${API_URL}?route=tracking_data`, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ token, pre_id: preId }),
    cache: 'no-store'
  });
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
