// === js/cuenta.js ===
import { API_URL, AUTH_KEYS, WHATSAPP_NUMBER } from './config.js';

/* =================================
   CONFIG WHATSAPP
   - Si quieres que el botón vaya directo a tu WhatsApp:
     pon tu número con código país, SOLO dígitos. Ej: 51987654321 (Perú)
   - Si lo dejas vacío, se abrirá WhatsApp con el texto y el cliente elige el chat.
================================= */
// El numero se define en config.js para mantener una sola fuente de verdad.

/* ---------------------------------
   Elementos del DOM
---------------------------------- */
const loginSection  = document.getElementById('loginSection');
const statusSection = document.getElementById('statusSection');
const clientAccessNote = document.querySelector('.client-access-note');
const loginForm     = document.getElementById('loginForm');
const loginMsg      = document.getElementById('loginMsg');
const togglePassBtn = document.getElementById('togglePass');

const clientNameEl    = document.getElementById('clientName');
const clientCodeEl    = document.getElementById('clientCode');

const diasGratisEl    = document.getElementById('diasGratis');
const diasUsadosEl    = document.getElementById('diasUsados');
const diasRestantesEl = document.getElementById('diasRestantes');
const diasExcedidosEl = document.getElementById('diasExcedidos');

const puntosPanelEl       = document.getElementById('pointsPanel');
const puntosDisponiblesEl = document.getElementById('puntosDisponibles');
const puntosGanadosEl     = document.getElementById('puntosGanados');
const puntosUsadosEl      = document.getElementById('puntosUsados');
const puntosFaltanEl      = document.getElementById('puntosFaltan');
const puntosEstadoEl      = document.getElementById('puntosEstado');
const puntosProgressEl    = document.getElementById('puntosProgress');
const puntosMovimientosEl = document.getElementById('puntosMovimientos');
const puntosMiniDisponiblesEl = document.getElementById('puntosMiniDisponibles');
const puntosCanjeMsg      = document.getElementById('puntosCanjeMsg');
const puntosPreventaSelect = document.getElementById('puntosPreventaSelect');
const rewardBtns          = document.querySelectorAll('.reward-btn');

const itemsTbody      = document.querySelector('#itemsTable tbody');
const preTbody        = document.querySelector('#preTable tbody');

const almacenMsg      = document.getElementById('almacenMsg');
const preMsg          = document.getElementById('preMsg');

const logoutBtn       = document.getElementById('logoutBtn');

const tabBtns         = document.querySelectorAll('.tab-btn');
const tabAlmacen      = document.getElementById('tab-almacen');
const tabPreventas    = document.getElementById('tab-preventas');
const tabPedido       = document.getElementById('tab-pedido'); // ✅ NUEVO
const tabPuntos       = document.getElementById('tab-puntos');

// Pedido (form + tabla)
const pedidoForm      = document.getElementById('pedidoForm');
const pedidoUrlEl     = document.getElementById('pedidoUrl');
const pedidoNombreEl  = document.getElementById('pedidoNombre');
const pedidoPesoEl    = document.getElementById('pedidoPeso');
const pedidoTamanoEl  = document.getElementById('pedidoTamano');
const pedidoYenesEl   = document.getElementById('pedidoYenes');

const pedidoFormMsg   = document.getElementById('pedidoFormMsg');
const pedidosMsg      = document.getElementById('pedidosMsg');
const pedidosTbody    = document.getElementById('pedidosTbody');

/* ---------------------------------
   Lightbox (igual al de Catálogo)
---------------------------------- */
const lb = document.getElementById('lbCuenta');
const lbImg = document.getElementById('lbImagen');
const lbClose = lb?.querySelector('.lb-close');

function openLB(src){
  if (!lb || !lbImg || !src) return;
  lbImg.src = src;
  lb.hidden = false;
  document.body.style.overflow = 'hidden';
}
function closeLB(){
  if (!lb || !lbImg) return;
  lb.hidden = true;
  lbImg.src = '';
  document.body.style.overflow = '';
}

// Cerrar por botón, click en fondo o ESC
if (lb){
  lb.addEventListener('click', (e)=>{
    if (e.target === lb || e.target === lbClose) closeLB();
  });
  document.addEventListener('keydown', (e)=>{
    if (e.key === 'Escape' && !lb.hidden) closeLB();
  });
}

/* ---------------------------------
   Helpers
---------------------------------- */
const PEN = new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' });
const PUNTOS_DESCUENTO_5 = 100;
const DESCUENTO_MAXIMO_5 = 30;
const REWARD_CONFIG = {
  ENTREGA_GRATIS_3: {
    points: 20,
    label: 'Entrega en punto gratis',
    origen: 'ENTREGA'
  },
  ENVIO_GRATIS_8: {
    points: 50,
    label: 'Envío gratis',
    origen: 'ENVIO'
  },
  DESCUENTO_5: {
    points: PUNTOS_DESCUENTO_5,
    label: `5% de descuento máximo S/ ${DESCUENTO_MAXIMO_5}`,
    origen: 'PREVENTA',
    needsPreventa: true,
    maxDiscount: DESCUENTO_MAXIMO_5
  }
};

const getToken = () => localStorage.getItem(AUTH_KEYS.TOKEN);
const setAuth  = (t,id,name)=>{
  localStorage.setItem(AUTH_KEYS.TOKEN,t);
  localStorage.setItem(AUTH_KEYS.CLIENT,id||'');
  localStorage.setItem(AUTH_KEYS.NAME,name||'');
};
const clearAuth= ()=>{
  localStorage.removeItem(AUTH_KEYS.TOKEN);
  localStorage.removeItem(AUTH_KEYS.CLIENT);
  localStorage.removeItem(AUTH_KEYS.NAME);
};

const showLogin= ()=>{
  if (statusSection) statusSection.style.display='none';
  if (loginSection)  loginSection.style.display='block';
  if (clientAccessNote) clientAccessNote.style.display='flex';
};
const showPanel= ()=>{
  if (loginSection)  loginSection.style.display='none';
  if (statusSection) statusSection.style.display='block';
  if (clientAccessNote) clientAccessNote.style.display='none';
};

function escapeHtml(s){
  return String(s ?? '')
    .replaceAll('&','&amp;')
    .replaceAll('<','&lt;')
    .replaceAll('>','&gt;')
    .replaceAll('"','&quot;')
    .replaceAll("'","&#039;");
}

function onlyDigits(s){
  return String(s || '').replace(/\D+/g,'');
}

function isValidUrl(u){
  try { new URL(u); return true; } catch(_) { return false; }
}

function fmtPenMaybe(v){
  if (v == null) return '—';
  const s = String(v).trim();
  if (!s) return '—';
  // acepta "12.5" o "12,5" o "S/ 12.5"
  const n = Number(s.replace(/[^\d.,-]/g,'').replace(',','.'));
  if (!isFinite(n) || isNaN(n)) return '—';
  return PEN.format(n);
}

function parseDateValue(value){
  const raw = String(value || '').trim();
  if (!raw) return 0;

  const isoLike = raw.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (isoLike) {
    return new Date(
      Number(isoLike[1]),
      Number(isoLike[2]) - 1,
      Number(isoLike[3])
    ).getTime();
  }

  const dmyLike = raw.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (dmyLike) {
    return new Date(
      Number(dmyLike[3]),
      Number(dmyLike[2]) - 1,
      Number(dmyLike[1])
    ).getTime();
  }

  const parsed = Date.parse(raw);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function preIdNumber(preId){
  const match = String(preId || '').match(/(\d+)/);
  return match ? Number(match[1]) : 0;
}

function sortPreventasNewestFirst(preventas){
  return [...(Array.isArray(preventas) ? preventas : [])].sort((a, b) => {
    const dateDiff = parseDateValue(b.fecha_pedido) - parseDateValue(a.fecha_pedido);
    if (dateDiff !== 0) return dateDiff;
    return preIdNumber(b.pre_id) - preIdNumber(a.pre_id);
  });
}

function canWhatsapp(c){
  const a = String(c?.precio_aereo_pen || '').trim();
  const m = String(c?.precio_maritimo_pen || '').trim();
  const hasA = a !== '' && fmtPenMaybe(a) !== '—';
  const hasM = m !== '' && fmtPenMaybe(m) !== '—';
  return hasA || hasM; // si tiene al menos uno, mostramos botón (ideal ambos)
}

function buildWhatsappLink(c){
  const url = String(c?.url || '').trim();
  const nombre = String(c?.nombre_producto || '').trim();
  const cotId = String(c?.cot_id || '').trim();

  const aereo = fmtPenMaybe(c?.precio_aereo_pen);
  const marit = fmtPenMaybe(c?.precio_maritimo_pen);

  const lines = [
    'Hola Mardant, quiero comprar esta cotización:',
    cotId ? `ID: ${cotId}` : '',
    nombre ? `Producto: ${nombre}` : '',
    url ? `URL: ${url}` : '',
    `Precio AÉREO: ${aereo}`,
    `Precio MARÍTIMO: ${marit}`,
    '',
    'Gracias.'
  ].filter(Boolean);

  const text = encodeURIComponent(lines.join('\n'));

  const num = onlyDigits(WHATSAPP_NUMBER);
  if (num) return `https://wa.me/${num}?text=${text}`;

  // Sin número -> abre WhatsApp con el texto (el cliente elige el chat)
  return `https://wa.me/?text=${text}`;
}

/* Mantener ID en mayúsculas */
const clientIdInput = document.getElementById('clientId');
if (clientIdInput){
  clientIdInput.addEventListener('input', (e)=>{
    e.target.value = e.target.value.toUpperCase().trim();
  });
}

/* Mostrar / ocultar contraseña */
if (togglePassBtn){
  togglePassBtn.addEventListener('click', ()=>{
    const input = document.getElementById('password');
    if (!input) return;
    const to = input.type === 'password' ? 'text' : 'password';
    input.type = to;
    togglePassBtn.textContent = (to === 'text') ? 'Ocultar' : 'Mostrar';
  });
}

/* Tabs */
function setActiveTab(tabName){
  tabBtns.forEach(b=>b.classList.remove('active'));
  tabBtns.forEach(b=>{
    if (b.dataset.tab === tabName) b.classList.add('active');
  });

  if (tabAlmacen)   tabAlmacen.style.display   = (tabName === 'almacen')   ? 'block' : 'none';
  if (tabPreventas) tabPreventas.style.display = (tabName === 'preventas') ? 'block' : 'none';
  if (tabPedido)    tabPedido.style.display    = (tabName === 'pedido')    ? 'block' : 'none';
  if (tabPuntos)    tabPuntos.style.display    = (tabName === 'puntos')    ? 'block' : 'none';
}

tabBtns.forEach(btn=>{
  btn.addEventListener('click', ()=>{
    setActiveTab(btn.dataset.tab);
  });
});

rewardBtns.forEach(btn => {
  btn.addEventListener('click', () => solicitarCanje(btn.dataset.reward));
});

/* Estado (badge) */
function stateBadge(text){
  const raw = String(text || '-').trim();
  const t = raw
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_');
  let cls = 'badge state ';
  let label = raw;

  if (t === 'EN_ALMACEN') {
    cls += 'en-almacen';
    label = 'EN ALMACEN';
  }
  else if (t === 'EN_SOLICITUD') {
    cls += 'en-solicitud';
    label = 'EN SOLICITUD';
  }
  else if (t === 'EN_ALMACEN_JP') {
    cls += 'en-almacen-jp';
    label = 'ALMACEN JP';
  }
  else if (t === 'EN_ALMACEN_PE' || t === 'EN_ALMACEN_PERU') {
    cls += 'en-almacen-pe';
    label = 'ALMACEN PE';
  }
  else if (t === 'ABANDONO_-_NO_CANCELO' || t === 'ABANDONO_NO_CANCELO' || t.startsWith('ABANDONO')) {
    cls += 'abandono';
    label = 'ABANDONO';
  }
  else if (t === 'ENVIADO')     cls += 'enviado';
  else if (t === 'RETIRADO')    cls += 'retirado';
  else if (t === 'EN_CAMINO' || t === 'EN_TRANSITO') {
    cls += 'en-camino';
    label = 'EN CAMINO';
  }
  else if (t === 'RESERVADO')   cls += 'reservado';
  else if (t === 'LLEGADO')     cls += 'llegado';
  else if (t === 'ENTREGADO')   cls += 'entregado';
  else if (t === 'CANCELADO')   cls += 'cancelado';
  // Pedido / cotización
  else if (t === 'SOLICITADO')  cls += 'reservado';
  else if (t === 'COTIZADO')    cls += 'llegado';
  else cls += 'en-almacen';
  return `<span class="${cls}">${escapeHtml(label || '-')}</span>`;
}

function fmtPoints(value){
  const n = Number(value);
  if (!isFinite(n) || isNaN(n)) return '0';
  return Math.trunc(n).toLocaleString('es-PE');
}

function renderPuntos(puntos){
  if (!puntosPanelEl) return;

  const disponibles = Number(puntos?.disponibles || 0);
  const ganados = Number(puntos?.ganados || 0);
  const usados = Number(puntos?.usados || 0);
  const faltan = Math.max(0, PUNTOS_DESCUENTO_5 - disponibles);
  const progress = Math.max(0, Math.min(100, (disponibles / PUNTOS_DESCUENTO_5) * 100));
  const firstReward = Object.values(REWARD_CONFIG)
    .sort((a, b) => a.points - b.points)
    .find(reward => disponibles < reward.points);

  if (puntosDisponiblesEl) puntosDisponiblesEl.textContent = fmtPoints(disponibles);
  if (puntosMiniDisponiblesEl) puntosMiniDisponiblesEl.textContent = fmtPoints(disponibles);
  if (puntosGanadosEl) puntosGanadosEl.textContent = fmtPoints(ganados);
  if (puntosUsadosEl) puntosUsadosEl.textContent = fmtPoints(usados);
  if (puntosFaltanEl) puntosFaltanEl.textContent = fmtPoints(faltan);
  if (puntosProgressEl) puntosProgressEl.style.width = `${progress}%`;

  if (puntosEstadoEl) {
    puntosEstadoEl.textContent = firstReward
      ? `Te faltan ${fmtPoints(firstReward.points - disponibles)} puntos para ${firstReward.label.toLowerCase()}.`
      : 'Tienes canjes disponibles. Elige un beneficio abajo.';
  }

  updateRewardCards(disponibles);

  if (!puntosMovimientosEl) return;
  const movimientos = Array.isArray(puntos?.movimientos) ? puntos.movimientos.slice(0, 8) : [];
  if (!movimientos.length) {
    puntosMovimientosEl.innerHTML = '<span class="muted">Aun no hay movimientos de puntos.</span>';
    return;
  }

  puntosMovimientosEl.innerHTML = movimientos.map(m => {
    const pts = Number(m.puntos || 0);
    const sign = pts > 0 ? '+' : '';
    const cls = pts >= 0 ? 'gain' : 'spend';
    const ref = m.referencia_id || m.mov_id || '-';
    const desc = m.descripcion || m.tipo || 'Movimiento';
    return `
      <div class="points-move">
        <span class="points-move-ref">${escapeHtml(ref)}</span>
        <span class="points-move-desc">${escapeHtml(desc)}</span>
        <strong class="${cls}">${sign}${fmtPoints(pts)} pts</strong>
      </div>
    `;
  }).join('');
}

function updateRewardCards(disponibles){
  rewardBtns.forEach(btn => {
    const reward = REWARD_CONFIG[btn.dataset.reward];
    if (!reward) return;
    const available = disponibles >= reward.points;
    btn.disabled = !available;
    btn.textContent = available ? 'Solicitar canje' : `Faltan ${fmtPoints(reward.points - disponibles)} pts`;
    btn.closest('.reward-card')?.classList.toggle('is-disabled', !available);
  });
}

function renderPuntosPreventaOptions(preventas){
  if (!puntosPreventaSelect) return;
  const options = Array.isArray(preventas) ? preventas : [];
  if (!options.length) {
    puntosPreventaSelect.innerHTML = '<option value="">Sin preventas disponibles</option>';
    return;
  }

  puntosPreventaSelect.innerHTML = options.map(p => {
    const id = p.pre_id || '';
    const desc = p.descripcion || 'Preventa';
    return `<option value="${escapeHtml(id)}">${escapeHtml(id)} - ${escapeHtml(desc)}</option>`;
  }).join('');
}

async function solicitarCanje(tipoCanje){
  const reward = REWARD_CONFIG[tipoCanje];
  const token = getToken();
  if (!reward || !token) return;

  const body = {
    token,
    tipo_canje: tipoCanje,
    origen: reward.origen
  };

  if (reward.needsPreventa) {
    const ref = String(puntosPreventaSelect?.value || '').trim();
    if (!ref) {
      if (puntosCanjeMsg) puntosCanjeMsg.textContent = 'Selecciona una preventa para aplicar el descuento.';
      return;
    }
    body.referencia_id = ref;
  }

  try {
    if (puntosCanjeMsg) puntosCanjeMsg.textContent = 'Registrando solicitud de canje...';
    const res = await fetch(API_URL + '?route=puntos_solicitar_canje', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body)
    });
    const data = await res.json();

    if (!data.ok) {
      const map = {
        invalid_token: 'Sesión inválida. Vuelve a iniciar sesión.',
        puntos_insuficientes: 'Aún no tienes puntos suficientes para este canje.',
        referencia_no_encontrada: 'No encontramos esa preventa en tu cuenta.',
        canje_existente: 'Ya existe una solicitud de canje para esa referencia.',
        tipo_canje_no_soportado: 'Este canje aún no está disponible.'
      };
      throw new Error(map[data.error] || (data.error || 'No se pudo registrar el canje.'));
    }

    if (puntosCanjeMsg) puntosCanjeMsg.textContent = data.mensaje || 'Solicitud de canje registrada.';
    await loadStatus();
    setActiveTab('puntos');
  } catch (err) {
    if (puntosCanjeMsg) puntosCanjeMsg.textContent = err.message || String(err);
  }
}

/* Miniatura -> abre lightbox */
function thumb(url){
  const u = (url||'').trim();
  if (!u) return `<div class="thumb"><span class="muted">–</span></div>`;
  return `
    <button type="button" class="thumb" data-lb-src="${escapeHtml(u)}" aria-label="Ampliar foto">
      <img src="${escapeHtml(u)}" alt="foto" loading="lazy" referrerpolicy="no-referrer">
    </button>
  `;
}

/* Delegación: abrir lightbox cuando se haga click en una miniatura */
document.addEventListener('click', (e)=>{
  const btn = e.target.closest('.thumb');
  if (!btn) return;
  const src = btn.dataset.lbSrc || btn.querySelector('img')?.src;
  if (src) openLB(src);
});

/* ---------------------------------
   Alertas de almacenaje
---------------------------------- */
const WARN_THRESHOLD = 10; // días restantes para advertir

function getRestantes(it, diasGratisGlobal) {
  if (it?.dias_restantes != null) return Number(it.dias_restantes);
  const usados = Number(it?.dias_en_almacen || 0);
  const gratis = Number(diasGratisGlobal || 0);
  return gratis ? (gratis - usados) : null;
}

function renderDaysBadge(it, diasGratisGlobal) {
  const restantes = getRestantes(it, diasGratisGlobal);
  let cls = 'badge days';
  let title = '';

  if (it?.excedido || (restantes != null && restantes < 0)) {
    cls += ' danger';
    title = 'Almacenaje excedido';
  } else if (restantes != null && restantes <= WARN_THRESHOLD) {
    cls += ' warn';
    title = `Quedan ${Math.max(restantes, 0)} día(s)`;
  } else {
    cls += ' ok';
    title = restantes != null ? `Quedan ${restantes} día(s)` : '';
  }

  return `<span class="${cls}" title="${escapeHtml(title)}">${escapeHtml(it?.dias_en_almacen ?? '-')}</span>`;
}

/* ---------------------------------
   Render: Pedidos / Cotizaciones
---------------------------------- */
function renderPedidos(pedidos){
  if (!pedidosTbody || !pedidosMsg) return;

  pedidosTbody.innerHTML = '';

  if (!Array.isArray(pedidos) || !pedidos.length){
    pedidosMsg.textContent = 'Aún no tienes cotizaciones registradas.';
    return;
  }

  pedidosMsg.textContent = '';

  pedidos.forEach(c=>{
    const fecha = c.fecha_solicitud || '-';
    const url = String(c.url || '').trim();
    const nombre = String(c.nombre_producto || '').trim();
    const estado = c.estado || 'SOLICITADO';

    const aereoTxt = fmtPenMaybe(c.precio_aereo_pen);
    const marTxt   = fmtPenMaybe(c.precio_maritimo_pen);

    const linkHtml = url && isValidUrl(url)
      ? `<a href="${escapeHtml(url)}" target="_blank" rel="noopener">Ver enlace</a>`
      : `<span class="muted">Sin URL</span>`;

    const productHtml = `
      <div style="display:flex; flex-direction:column; gap:4px;">
        <div><strong>${escapeHtml(nombre || 'Producto')}</strong></div>
        <div class="muted" style="font-size:12px; word-break:break-word;">${escapeHtml(url || '')}</div>
        <div>${linkHtml}</div>
      </div>
    `;

    let accionHtml = `<span class="muted">Pendiente</span>`;
    if (canWhatsapp(c)){
      const wa = buildWhatsappLink(c);
      accionHtml = `
        <a class="btn small" href="${escapeHtml(wa)}" target="_blank" rel="noopener">
          PEDIR POR WHATSAPP
        </a>
      `;
    }

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escapeHtml(fecha)}</td>
      <td>${productHtml}</td>
      <td>${stateBadge(estado)}</td>
      <td class="right">${escapeHtml(aereoTxt)}</td>
      <td class="right">${escapeHtml(marTxt)}</td>
      <td class="right">${accionHtml}</td>
    `;
    pedidosTbody.appendChild(tr);
  });
}

/* ---------------------------------
   Carga de panel (status)
---------------------------------- */
async function loadStatus(){
  const token = getToken();
  if (!token){ showLogin(); return; }

  showPanel();
  if (clientCodeEl) clientCodeEl.textContent = localStorage.getItem(AUTH_KEYS.CLIENT)||'';
  if (clientNameEl) clientNameEl.textContent = localStorage.getItem(AUTH_KEYS.NAME)||'';

  // placeholders
  if (almacenMsg) almacenMsg.textContent = 'Cargando…';
  if (preMsg)     preMsg.textContent     = 'Cargando…';
  if (itemsTbody) itemsTbody.innerHTML   = '';
  if (preTbody)   preTbody.innerHTML     = '';

  if (pedidosMsg) pedidosMsg.textContent   = 'Cargando…';
  if (pedidosTbody) pedidosTbody.innerHTML = '';
  if (puntosCanjeMsg) puntosCanjeMsg.textContent = '';
  renderPuntos(null);

  try{
    const res = await fetch(API_URL + '?route=status', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ token })
    });
    const data = await res.json();

    if (!data.ok){
      if (data.error === 'invalid_token'){ clearAuth(); showLogin(); return; }
      throw new Error(data.error||'error');
    }

    // KPIs
    if (diasGratisEl)    diasGratisEl.textContent    = data.dias_gratis;
    if (diasUsadosEl)    diasUsadosEl.textContent    = data.dias_usados;
    if (diasRestantesEl) diasRestantesEl.textContent = data.dias_restantes;
    if (diasExcedidosEl) diasExcedidosEl.textContent = data.dias_excedidos;
    renderPuntos(data.puntos);

    /* ---------- ALMACÉN ---------- */
    const items = data.almacen || data.items || [];
    if (itemsTbody) itemsTbody.innerHTML = '';

    const nearDue = [];
    items.forEach(it=>{
      const restantes = getRestantes(it, data.dias_gratis);
      if (!it.excedido && restantes != null && restantes <= WARN_THRESHOLD) {
        nearDue.push({ id: it.item_id, rest: Math.max(restantes, 0) });
      }

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${thumb(it.foto_url)}</td>
        <td>${escapeHtml(it.item_id)}</td>
        <td>${escapeHtml(it.descripcion || '-')}</td>
        <td>${escapeHtml(it.fecha_ingreso || '-')}</td>
        <td>${stateBadge(it.estado)}</td>
        <td class="right">${renderDaysBadge(it, data.dias_gratis)}</td>
      `;
      itemsTbody?.appendChild(tr);
    });

    if (!items.length){
      if (almacenMsg) almacenMsg.textContent = 'No tienes ítems en almacén.';
    } else if (nearDue.length){
      const lista = nearDue.map(x => `${x.id} (${x.rest}d)`).join(', ');
      if (almacenMsg) almacenMsg.innerHTML = `⚠️ Los siguientes ítems están por vencer (≤ ${WARN_THRESHOLD} días): <strong>${escapeHtml(lista)}</strong>.`;
    } else {
      if (almacenMsg) almacenMsg.textContent = '';
    }

    /* ---------- PREVENTAS ---------- */
    const prevs = sortPreventasNewestFirst(data.preventas || []);
    renderPuntosPreventaOptions(prevs);
    if (preTbody) preTbody.innerHTML = '';
    prevs.forEach(p=>{
      const pagado = (Number(p.deposito)||0) + (Number(p.pagos_adic)||0);
      const saldo  = Number(p.saldo_restante ?? (Number(p.monto_total||0) - pagado));
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${thumb(p.foto_url)}</td>
        <td>${escapeHtml(p.pre_id)}</td>
        <td>${escapeHtml(p.descripcion || '-')}</td>
        <td class="right">${PEN.format(Number(p.monto_total||0))}</td>
        <td class="right">${PEN.format(Number(p.deposito||0))}</td>
        <td class="right">${PEN.format(Number(p.pagos_adic||0))}</td>
        <td class="right">${PEN.format(saldo)}</td>
        <td>${escapeHtml(p.fecha_pedido || '-')}</td>
        <td>${escapeHtml(p.fecha_aprox   || '-')}</td>
        <td>${stateBadge(p.estado)}</td>
      `;
      preTbody?.appendChild(tr);
    });
    if (preMsg) preMsg.textContent = prevs.length ? '' : 'No tienes preventas registradas.';

    /* ---------- PEDIDOS / COTIZACIONES ---------- */
    const pedidos = data.pedidos || data.cotizaciones || [];
    renderPedidos(pedidos);

  }catch(err){
    const msg = 'No se pudo cargar el estado ('+(err.message||err)+')';
    if (almacenMsg) almacenMsg.textContent = msg;
    if (preMsg)     preMsg.textContent     = msg;
    if (pedidosMsg) pedidosMsg.textContent = msg;
    if (puntosEstadoEl) puntosEstadoEl.textContent = 'No se pudo cargar puntos.';
  }
}

/* ---------------------------------
   Login
---------------------------------- */
loginForm?.addEventListener('submit', async (ev)=>{
  ev.preventDefault();
  if (loginMsg) loginMsg.textContent = 'Verificando…';

  const client_id = document.getElementById('clientId')?.value.trim();
  const password  = document.getElementById('password')?.value;

  try{
    const res  = await fetch(API_URL + '?route=login', {
      method:'POST',
      headers:{ 'Content-Type':'text/plain;charset=utf-8' },
      body: JSON.stringify({ client_id, password })
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error||'login_failed');

    setAuth(data.token, data.client_id, data.name);
    if (loginMsg) loginMsg.textContent = '';

    // Al entrar, muestra preventas por defecto.
    setActiveTab('preventas');

    await loadStatus();
  }catch(err){
    const map = {
      client_not_found   : 'Cliente no encontrado',
      invalid_password   : 'Contraseña incorrecta',
      missing_credentials: 'Completa ambos campos',
      too_many_attempts  : 'Demasiados intentos. Intenta más tarde'
    };
    if (loginMsg) loginMsg.textContent = map[err.message] || ('Error: ' + err.message);
  }
});

/* ---------------------------------
   Enviar Pedido / Solicitud de Cotización
---------------------------------- */
pedidoForm?.addEventListener('submit', async (ev)=>{
  ev.preventDefault();

  const token = getToken();
  if (!token){
    showLogin();
    return;
  }

  const url = String(pedidoUrlEl?.value || '').trim();
  if (!url || !isValidUrl(url)){
    if (pedidoFormMsg) pedidoFormMsg.textContent = 'Pega un URL válido (obligatorio).';
    return;
  }

  const body = {
    token,
    url,
    nombre_producto: String(pedidoNombreEl?.value || '').trim(),
    peso:           String(pedidoPesoEl?.value || '').trim(),
    tamano:         String(pedidoTamanoEl?.value || '').trim(),
    precio_yenes:   String(pedidoYenesEl?.value || '').trim()
  };

  try{
    if (pedidoFormMsg) pedidoFormMsg.textContent = 'Enviando solicitud…';

    const res = await fetch(API_URL + '?route=pedido_create', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body)
    });
    const data = await res.json();

    if (!data.ok){
      const map = {
        invalid_token: 'Sesión inválida. Vuelve a iniciar sesión.',
        too_many_requests: 'Has enviado demasiadas solicitudes hoy. Intenta más tarde.',
        invalid_url: 'El URL no es válido.',
        missing_sheet_cotizaciones: 'Falta la hoja "cotizaciones" en tu Google Sheet.'
      };
      throw new Error(map[data.error] || (data.error || 'No se pudo enviar.'));
    }

    if (pedidoFormMsg) pedidoFormMsg.textContent = `✅ Solicitud enviada. ID: ${data.cot_id}`;

    // Limpia solo opcionales (dejamos el URL por si quiere editar)
    if (pedidoNombreEl) pedidoNombreEl.value = '';
    if (pedidoPesoEl)   pedidoPesoEl.value = '';
    if (pedidoTamanoEl) pedidoTamanoEl.value = '';
    if (pedidoYenesEl)  pedidoYenesEl.value = '';

    // Recarga status y muéstrale el tab Pedido
    await loadStatus();
    setActiveTab('pedido');

  }catch(err){
    if (pedidoFormMsg) pedidoFormMsg.textContent = `❌ ${err.message || err}`;
  }
});

/* ---------------------------------
   Logout e inicio
---------------------------------- */
logoutBtn?.addEventListener('click', ()=>{
  clearAuth();
  showLogin();
});

// Al cargar, por defecto tab preventas.
setActiveTab('preventas');
getToken() ? loadStatus() : showLogin();
