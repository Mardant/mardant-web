import { fetchJSON, fetchRoute } from './api-client.js?v=3';

const PROVIDER = {
  proveedor: 'Mardant',
  ruc: '15615825481',
  correo: 'gamesmardant@gmail.com',
  whatsapp: '+51 985 135 331',
  ubicacion: 'Lima, Perú'
};

const formPanel = document.getElementById('claimFormPanel');
const form = document.getElementById('claimForm');
const statusEl = document.getElementById('claimStatus');
const submitBtn = document.getElementById('submitClaimBtn');
const successPanel = document.getElementById('claimSuccess');
const printArea = document.getElementById('claimPrintArea');
const menorEdad = document.getElementById('menorEdad');
const apoderadoGroup = document.getElementById('apoderadoGroup');
const datosApoderado = document.getElementById('datosApoderado');
const downloadBtn = document.getElementById('downloadReceiptBtn');
const printBtn = document.getElementById('printReceiptBtn');
const newClaimBtn = document.getElementById('newClaimBtn');

let latestReceipt = null;
let reclamacionChallenge = '';
let formStartedAt = Date.now();

const fieldIds = [
  'tipo',
  'nombreCompleto',
  'tipoDocumento',
  'numeroDocumento',
  'telefono',
  'correo',
  'domicilio',
  'datosApoderado',
  'productoServicio',
  'montoReclamado',
  'fechaCompra',
  'numeroPedido',
  'tipoPedido',
  'detalle',
  'pedidoConsumidor'
];

function el(id) {
  return document.getElementById(id);
}

function value(id) {
  const node = el(id);
  return node ? node.value.trim() : '';
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function setStatus(message, type = '') {
  statusEl.className = `claim-status ${type}`.trim();
  statusEl.textContent = message || '';
}

function setStatusList(messages) {
  statusEl.className = 'claim-status error';
  statusEl.innerHTML = `
    <strong>Revisa estos campos:</strong>
    <ul>${messages.map(msg => `<li>${escapeHtml(msg)}</li>`).join('')}</ul>
  `;
}

function markInvalid(ids) {
  fieldIds.forEach(id => {
    const node = el(id);
    if (node) node.classList.toggle('is-invalid', ids.includes(id));
  });
}

function normalizePhone(phone) {
  return phone.replace(/\s+/g, ' ').trim();
}

function hasNaturalWords(text, minLength, minWords) {
  const words = String(text || '').match(/[A-Za-zÀ-ÿÑñ]{2,}/g) || [];
  return String(text || '').length >= minLength && words.length >= minWords;
}

function buildPayload() {
  return {
    tipo: value('tipo'),
    nombreCompleto: value('nombreCompleto'),
    tipoDocumento: value('tipoDocumento'),
    numeroDocumento: value('numeroDocumento'),
    telefono: normalizePhone(value('telefono')),
    correo: value('correo'),
    domicilio: value('domicilio'),
    menorEdad: menorEdad.checked,
    datosApoderado: value('datosApoderado'),
    productoServicio: value('productoServicio'),
    montoReclamado: value('montoReclamado'),
    fechaCompra: value('fechaCompra'),
    numeroPedido: value('numeroPedido'),
    tipoPedido: value('tipoPedido'),
    detalle: value('detalle'),
    pedidoConsumidor: value('pedidoConsumidor'),
    aceptaDeclaracion: el('aceptaDeclaracion').checked,
    website: value('website'),
    reclamacionChallenge,
    formStartedAt
  };
}

async function loadReclamacionChallenge() {
  reclamacionChallenge = '';
  submitBtn.disabled = true;
  try {
    const result = await fetchJSON('reclamacionChallenge', {
      params: { _: Date.now() },
      retries: 0,
      timeoutMs: 15000,
      fetchOptions: { cache: 'no-store' }
    });
    if (!result.ok || !result.challenge) throw new Error('challenge_unavailable');
    reclamacionChallenge = result.challenge;
    formStartedAt = Date.now();
    return true;
  } catch (_) {
    setStatus('No se pudo preparar el formulario. Recarga la página e intenta nuevamente.', 'error');
    return false;
  } finally {
    submitBtn.disabled = !reclamacionChallenge;
  }
}

function validatePayload(payload) {
  const errors = [];
  const invalid = [];
  const required = [
    ['tipo', 'Selecciona si deseas registrar un reclamo o una queja.'],
    ['nombreCompleto', 'Ingresa tu nombre completo.'],
    ['tipoDocumento', 'Selecciona el tipo de documento.'],
    ['numeroDocumento', 'Ingresa tu número de documento.'],
    ['telefono', 'Ingresa tu teléfono de contacto.'],
    ['correo', 'Ingresa tu correo electrónico.'],
    ['productoServicio', 'Ingresa el producto o servicio relacionado.'],
    ['tipoPedido', 'Selecciona el tipo de pedido.'],
    ['detalle', 'Describe el detalle del reclamo o queja.'],
    ['pedidoConsumidor', 'Indica cuál es tu pedido como consumidor.']
  ];

  required.forEach(([key, message]) => {
    if (!payload[key]) {
      errors.push(message);
      invalid.push(key);
    }
  });

  if (payload.correo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.correo)) {
    errors.push('Ingresa un correo electrónico válido.');
    invalid.push('correo');
  }

  if (payload.telefono && !/^[+0-9\s()\-]{6,30}$/.test(payload.telefono)) {
    errors.push('Ingresa un teléfono válido.');
    invalid.push('telefono');
  }

  const phoneDigits = payload.telefono.replace(/\D/g, '');
  if (payload.telefono && (phoneDigits.length < 9 || phoneDigits.length > 15 || /^(\d)\1+$/.test(phoneDigits))) {
    errors.push('El teléfono debe tener entre 9 y 15 dígitos válidos.');
    invalid.push('telefono');
  }

  const documentNumber = payload.numeroDocumento.replace(/[\s.-]/g, '');
  if (payload.tipoDocumento === 'DNI' && !/^\d{8}$/.test(documentNumber)) {
    errors.push('El DNI debe tener 8 dígitos.');
    invalid.push('numeroDocumento');
  } else if (payload.tipoDocumento === 'RUC' && !/^\d{11}$/.test(documentNumber)) {
    errors.push('El RUC debe tener 11 dígitos.');
    invalid.push('numeroDocumento');
  } else if ((payload.tipoDocumento === 'CE' || payload.tipoDocumento === 'Pasaporte') &&
      !/^[A-Za-z0-9-]{6,20}$/.test(documentNumber)) {
    errors.push('Ingresa un número de documento válido.');
    invalid.push('numeroDocumento');
  }

  if (payload.nombreCompleto && !hasNaturalWords(payload.nombreCompleto, 5, 2)) {
    errors.push('Ingresa tu nombre y apellido.');
    invalid.push('nombreCompleto');
  }

  if (payload.detalle && !hasNaturalWords(payload.detalle, 20, 4)) {
    errors.push('Describe el reclamo o queja con un poco más de detalle.');
    invalid.push('detalle');
  }

  if (payload.pedidoConsumidor && !hasNaturalWords(payload.pedidoConsumidor, 10, 2)) {
    errors.push('Explica con más detalle qué solución solicitas.');
    invalid.push('pedidoConsumidor');
  }

  if (payload.fechaCompra) {
    const selectedDate = new Date(`${payload.fechaCompra}T00:00:00`);
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(payload.fechaCompra) ||
        selectedDate.getFullYear() < 2000 || selectedDate > today) {
      errors.push('Ingresa una fecha de compra válida.');
      invalid.push('fechaCompra');
    }
  }

  if (payload.menorEdad && !payload.datosApoderado) {
    errors.push('Ingresa los datos del padre, madre o apoderado.');
    invalid.push('datosApoderado');
  }

  if (!payload.aceptaDeclaracion) {
    errors.push('Debes aceptar la declaración para registrar la hoja.');
  }

  markInvalid([...new Set(invalid)]);
  return errors;
}

function toggleApoderado() {
  const show = menorEdad.checked;
  apoderadoGroup.classList.toggle('is-hidden', !show);
  datosApoderado.required = show;
  if (!show) datosApoderado.value = '';
}

function receiptRow(label, value) {
  if (!value) return '';
  return `
    <div class="receipt-row">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </div>
  `;
}

function buildReceiptMarkup(data) {
  return `
    <article class="receipt">
      <header class="receipt-header">
        <span>Libro de Reclamaciones</span>
        <h1>${escapeHtml(data.id)}</h1>
        <p>Fecha de registro: ${escapeHtml(data.fechaRegistro)}</p>
      </header>

      <section>
        <h2>Datos del proveedor</h2>
        <div class="receipt-grid">
          ${receiptRow('Proveedor', data.proveedor || PROVIDER.proveedor)}
          ${receiptRow('RUC', data.ruc || PROVIDER.ruc)}
          ${receiptRow('Correo', data.correoProveedor || data.proveedorCorreo || PROVIDER.correo)}
          ${receiptRow('WhatsApp', data.whatsapp || PROVIDER.whatsapp)}
          ${receiptRow('Ubicación', data.ubicacion || PROVIDER.ubicacion)}
        </div>
      </section>

      <section>
        <h2>Datos del consumidor</h2>
        <div class="receipt-grid">
          ${receiptRow('Nombre completo', data.nombreCompleto)}
          ${receiptRow('Tipo de documento', data.tipoDocumento)}
          ${receiptRow('Número de documento', data.numeroDocumento)}
          ${receiptRow('Teléfono', data.telefono)}
          ${receiptRow('Correo', data.correoConsumidor || data.correo)}
          ${receiptRow('Domicilio', data.domicilio)}
          ${receiptRow('Datos del apoderado', data.datosApoderado)}
        </div>
      </section>

      <section>
        <h2>Datos del reclamo o queja</h2>
        <div class="receipt-grid">
          ${receiptRow('Tipo', data.tipo)}
          ${receiptRow('Producto o servicio', data.productoServicio)}
          ${receiptRow('Monto reclamado', data.montoReclamado)}
          ${receiptRow('Fecha de compra', data.fechaCompra)}
          ${receiptRow('Número de pedido', data.numeroPedido)}
          ${receiptRow('Tipo de pedido', data.tipoPedido)}
        </div>
        <div class="receipt-text">
          <span>Detalle del reclamo o queja</span>
          <p>${escapeHtml(data.detalle)}</p>
        </div>
        <div class="receipt-text">
          <span>Pedido del consumidor</span>
          <p>${escapeHtml(data.pedidoConsumidor)}</p>
        </div>
      </section>

      <section>
        <h2>Plazo de respuesta</h2>
        ${receiptRow('Fecha límite de respuesta', data.fechaLimiteRespuesta)}
        <p class="receipt-final">
          Conserve esta constancia. Mardant responderá su reclamo o queja dentro del plazo máximo de 15 días hábiles.
        </p>
      </section>
    </article>
  `;
}

function buildReceiptDocument(data) {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Hoja de Reclamación ${escapeHtml(data.id)}</title>
  <style>
    body{font-family:Arial,sans-serif;margin:0;background:#f8f3ea;color:#171411}
    .receipt{max-width:820px;margin:24px auto;padding:24px;background:#fffaf2;border:1px solid #d8bea1;border-left:6px solid #a8322a;border-radius:10px}
    .receipt-header{border-bottom:2px solid #a8322a;padding-bottom:14px;margin-bottom:20px}
    .receipt-header span,.receipt-row span,.receipt-text span{color:#735f4f;font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.06em}
    h1{margin:6px 0 4px;font-size:34px} h2{margin:22px 0 12px;font-size:20px}
    .receipt-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
    .receipt-row,.receipt-text{border:1px solid #dfc9af;border-radius:8px;padding:12px;background:#fff}
    .receipt-row strong{display:block;margin-top:4px;font-size:15px}
    .receipt-text{margin-top:10px}.receipt-text p{white-space:pre-wrap;line-height:1.55}
    .receipt-final{font-weight:700;line-height:1.55}
    @media print{body{background:#fff}.receipt{box-shadow:none;margin:0;max-width:none;border-radius:0}}
    @media (max-width:640px){.receipt-grid{grid-template-columns:1fr}.receipt{margin:0;border-radius:0}}
  </style>
</head>
<body>${buildReceiptMarkup(data)}</body>
</html>`;
}

function showSuccess(receipt) {
  latestReceipt = receipt;
  document.getElementById('successId').textContent = receipt.id;
  document.getElementById('successFecha').textContent = receipt.fechaRegistro;
  document.getElementById('successLimite').textContent = receipt.fechaLimiteRespuesta;
  printArea.innerHTML = buildReceiptMarkup(receipt);
  formPanel.classList.add('is-hidden');
  successPanel.classList.remove('is-hidden');
  successPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function downloadReceipt() {
  if (!latestReceipt) return;
  const html = buildReceiptDocument(latestReceipt);
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `Hoja_Reclamacion_${latestReceipt.id}.html`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function printReceipt() {
  if (!latestReceipt) return;
  printArea.innerHTML = buildReceiptMarkup(latestReceipt);
  document.body.classList.add('claim-printing');
  window.print();
}

function resetForm() {
  latestReceipt = null;
  form.reset();
  toggleApoderado();
  markInvalid([]);
  setStatus('');
  printArea.innerHTML = '';
  successPanel.classList.add('is-hidden');
  formPanel.classList.remove('is-hidden');
  formPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  loadReclamacionChallenge();
}

async function submitClaim(event) {
  event.preventDefault();
  if (!reclamacionChallenge) {
    setStatus('El formulario aún no está listo. Espera un momento e intenta nuevamente.', 'error');
    await loadReclamacionChallenge();
    return;
  }
  const payload = buildPayload();
  const errors = validatePayload(payload);
  if (errors.length) {
    setStatusList(errors);
    return;
  }

  submitBtn.disabled = true;
  setStatus('Enviando hoja de reclamación...', 'info');

  try {
    const result = await fetchRoute('registrarReclamacion', payload, {
      timeoutMs: 20000,
      fetchOptions: { cache: 'no-store' }
    });
    if (!result.ok) throw new Error(result.error || 'No se pudo registrar la hoja de reclamación.');

    reclamacionChallenge = '';
    const receipt = {
      ...payload,
      ...result,
      correoConsumidor: payload.correo,
      correoProveedor: result.correo || PROVIDER.correo
    };
    showSuccess(receipt);
  } catch (err) {
    setStatus(err.message || 'No se pudo registrar la hoja de reclamación.', 'error');
    await loadReclamacionChallenge();
  } finally {
    submitBtn.disabled = !reclamacionChallenge && !latestReceipt;
  }
}

function setupNoticeFallback() {
  const notice = document.querySelector('.claim-notice');
  const img = notice ? notice.querySelector('img') : null;
  if (!notice || !img) return;
  img.addEventListener('error', () => {
    notice.classList.add('missing-image');
    img.setAttribute('aria-hidden', 'true');
  }, { once: true });
}

function setDateLimits() {
  const dateInput = el('fechaCompra');
  if (!dateInput) return;
  const today = new Date();
  const localToday = new Date(today.getTime() - today.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10);
  dateInput.max = localToday;
}

menorEdad.addEventListener('change', toggleApoderado);
form.addEventListener('submit', submitClaim);
downloadBtn.addEventListener('click', downloadReceipt);
printBtn.addEventListener('click', printReceipt);
newClaimBtn.addEventListener('click', resetForm);
window.addEventListener('afterprint', () => document.body.classList.remove('claim-printing'));

toggleApoderado();
setupNoticeFallback();
setDateLimits();
loadReclamacionChallenge();
