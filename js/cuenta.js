// === js/cuenta.js ===
import { API_URL, AUTH_KEYS } from './config.js';

/* ---------------------------------
   Elementos del DOM
---------------------------------- */
const loginSection  = document.getElementById('loginSection');
const statusSection = document.getElementById('statusSection');
const loginForm     = document.getElementById('loginForm');
const loginMsg      = document.getElementById('loginMsg');
const togglePassBtn = document.getElementById('togglePass');

const clientNameEl    = document.getElementById('clientName');
const clientCodeEl    = document.getElementById('clientCode');

const diasGratisEl    = document.getElementById('diasGratis');
const diasUsadosEl    = document.getElementById('diasUsados');
const diasRestantesEl = document.getElementById('diasRestantes');
const diasExcedidosEl = document.getElementById('diasExcedidos');

const itemsTbody      = document.querySelector('#itemsTable tbody');
const preTbody        = document.querySelector('#preTable tbody');

const almacenMsg      = document.getElementById('almacenMsg');
const preMsg          = document.getElementById('preMsg');

const logoutBtn       = document.getElementById('logoutBtn');

const tabBtns         = document.querySelectorAll('.tab-btn');
const tabAlmacen      = document.getElementById('tab-almacen');
const tabPreventas    = document.getElementById('tab-preventas');

/* ----- Modal de imagen (zoom) ----- */
const imgModal  = document.getElementById('imgModal');
const modalImg  = imgModal?.querySelector('img');
const modalClose= imgModal?.querySelector('.img-modal__close');

function openImgModal(src){
  if (!imgModal || !modalImg) return;
  modalImg.src = src || '';
  imgModal.hidden = false;
  document.body.style.overflow = 'hidden';
}
function closeImgModal(){
  if (!imgModal || !modalImg) return;
  imgModal.hidden = true;
  modalImg.src = '';
  document.body.style.overflow = '';
}
// Cierre por fondo / botón / ESC
if (imgModal){
  imgModal.addEventListener('click', (e)=>{
    if (e.target === imgModal || e.target === modalClose) closeImgModal();
  });
  document.addEventListener('keydown', (e)=>{
    if (e.key === 'Escape' && !imgModal.hidden) closeImgModal();
  });
}

/* ---------------------------------
   Helpers
---------------------------------- */
const PEN = new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' });

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
  statusSection.style.display='none';
  loginSection.style.display='block';
};
const showPanel= ()=>{
  loginSection.style.display='none';
  statusSection.style.display='block';
};

/* Mantener ID en mayúsculas */
document.getElementById('clientId').addEventListener('input', (e)=>{
  e.target.value = e.target.value.toUpperCase().trim();
});

/* Mostrar / ocultar contraseña */
togglePassBtn.addEventListener('click', ()=>{
  const input = document.getElementById('password');
  const to = input.type === 'password' ? 'text' : 'password';
  input.type = to;
  togglePassBtn.textContent = (to === 'text') ? 'Ocultar' : 'Mostrar';
});

/* Tabs */
tabBtns.forEach(btn=>{
  btn.addEventListener('click', ()=>{
    tabBtns.forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    const t = btn.dataset.tab;
    tabAlmacen.style.display   = (t === 'almacen')   ? 'block' : 'none';
    tabPreventas.style.display = (t === 'preventas') ? 'block' : 'none';
  });
});

/* Estado (badge) de la columna "Estado" */
function stateBadge(text){
  const t = (text||'').toUpperCase();
  let cls = 'badge state ';
  if (t === 'EN_ALMACEN')       cls += 'en-almacen';
  else if (t === 'ENVIADO')     cls += 'enviado';
  else if (t === 'RETIRADO')    cls += 'retirado';
  else if (t === 'EN_CAMINO' || t === 'EN TRANSITO' || t === 'EN_TRANSITO') cls += 'en-camino';
  else if (t === 'RESERVADO')   cls += 'reservado';
  else if (t === 'LLEGADO')     cls += 'llegado';
  else if (t === 'ENTREGADO')   cls += 'entregado';
  else if (t === 'CANCELADO')   cls += 'cancelado';
  else cls += 'en-almacen';
  return `<span class="${cls}">${text||'-'}</span>`;
}

/* Miniatura clicable: ahora es botón que abre el modal (no enlace) */
function thumb(url){
  const u = (url||'').trim();
  if (!u) return `<div class="thumb"><span class="muted">–</span></div>`;
  return `<button type="button" class="thumb" data-full="${u}" aria-label="Ampliar foto">
            <img src="${u}" alt="foto" loading="lazy"/>
          </button>`;
}

/* Delegación de eventos: abrir modal al click en .thumb */
document.addEventListener('click', (e)=>{
  const btn = e.target.closest('.thumb');
  if (!btn) return;
  const src = btn.dataset.full || btn.querySelector('img')?.src;
  if (src) openImgModal(src);
});

/* ---------------------------------
   Alertas de almacenaje
---------------------------------- */
const WARN_THRESHOLD = 10; // días restantes para advertir

function getRestantes(it, diasGratisGlobal) {
  if (it.dias_restantes != null) return Number(it.dias_restantes);
  const usados = Number(it.dias_en_almacen || 0);
  const gratis = Number(diasGratisGlobal || 0);
  return gratis ? (gratis - usados) : null;
}

function renderDaysBadge(it, diasGratisGlobal) {
  const restantes = getRestantes(it, diasGratisGlobal);
  let cls = 'badge days';
  let title = '';

  if (it.excedido || (restantes != null && restantes < 0)) {
    cls += ' danger';
    title = 'Almacenaje excedido';
  } else if (restantes != null && restantes <= WARN_THRESHOLD) {
    cls += ' warn';
    title = `Quedan ${Math.max(restantes, 0)} día(s)`;
  } else {
    cls += ' ok';
    title = restantes != null ? `Quedan ${restantes} día(s)` : '';
  }

  return `<span class="${cls}" title="${title}">${it.dias_en_almacen ?? '-'}</span>`;
}

/* ---------------------------------
   Carga de panel (status)
---------------------------------- */
async function loadStatus(){
  const token = getToken();
  if (!token){ showLogin(); return; }

  showPanel();
  clientCodeEl.textContent = localStorage.getItem(AUTH_KEYS.CLIENT)||'';
  clientNameEl.textContent = localStorage.getItem(AUTH_KEYS.NAME)||'';

  // placeholders
  almacenMsg.textContent = 'Cargando…';
  preMsg.textContent     = 'Cargando…';
  itemsTbody.innerHTML   = '';
  preTbody.innerHTML     = '';

  try{
    const res = await fetch(API_URL + '?route=status&token=' + encodeURIComponent(token));
    const data = await res.json();

    if (!data.ok){
      if (data.error === 'invalid_token'){ clearAuth(); showLogin(); return; }
      throw new Error(data.error||'error');
    }

    // KPIs
    diasGratisEl.textContent    = data.dias_gratis;
    diasUsadosEl.textContent    = data.dias_usados;
    diasRestantesEl.textContent = data.dias_restantes;
    diasExcedidosEl.textContent = data.dias_excedidos;

    /* ---------- ALMACÉN ---------- */
    const items = data.almacen || data.items || [];
    itemsTbody.innerHTML = '';

    const nearDue = []; // ítems por vencer (≤ WARN_THRESHOLD)
    items.forEach(it=>{
      const restantes = getRestantes(it, data.dias_gratis);
      if (!it.excedido && restantes != null && restantes <= WARN_THRESHOLD) {
        nearDue.push({ id: it.item_id, rest: Math.max(restantes, 0) });
      }

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${thumb(it.foto_url)}</td>
        <td>${it.item_id}</td>
        <td>${it.descripcion || '-'}</td>
        <td>${it.fecha_ingreso || '-'}</td>
        <td>${stateBadge(it.estado)}</td>
        <td class="right">${renderDaysBadge(it, data.dias_gratis)}</td>
      `;
      itemsTbody.appendChild(tr);
    });

    if (!items.length){
      almacenMsg.textContent = 'No tienes ítems en almacén.';
    } else if (nearDue.length){
      const lista = nearDue.map(x => `${x.id} (${x.rest}d)`).join(', ');
      almacenMsg.innerHTML = `⚠️ Los siguientes ítems están por vencer (≤ ${WARN_THRESHOLD} días): <strong>${lista}</strong>.`;
    } else {
      almacenMsg.textContent = '';
    }

    /* ---------- PREVENTAS ---------- */
    const prevs = data.preventas || [];
    preTbody.innerHTML = '';
    prevs.forEach(p=>{
      const pagado = (Number(p.deposito)||0) + (Number(p.pagos_adic)||0);
      const saldo  = Number(p.saldo_restante ?? (Number(p.monto_total||0) - pagado));
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${thumb(p.foto_url)}</td>
        <td>${p.pre_id}</td>
        <td>${p.descripcion || '-'}</td>
        <td class="right">${PEN.format(Number(p.monto_total||0))}</td>
        <td class="right">${PEN.format(Number(p.deposito||0))}</td>
        <td class="right">${PEN.format(Number(p.pagos_adic||0))}</td>
        <td class="right">${PEN.format(saldo)}</td>
        <td>${p.fecha_pedido || '-'}</td>
        <td>${p.fecha_aprox   || '-'}</td>
        <td>${stateBadge(p.estado)}</td>
      `;
      preTbody.appendChild(tr);
    });
    preMsg.textContent = prevs.length ? '' : 'No tienes preventas registradas.';
  }catch(err){
    const msg = 'No se pudo cargar el estado ('+(err.message||err)+')';
    almacenMsg.textContent = msg;
    preMsg.textContent     = msg;
  }
}

/* ---------------------------------
   Login
---------------------------------- */
loginForm.addEventListener('submit', async (ev)=>{
  ev.preventDefault();
  loginMsg.textContent = 'Verificando…';

  const client_id = document.getElementById('clientId').value.trim();
  const password  = document.getElementById('password').value;
  try{
    const res  = await fetch(API_URL + '?route=login', {
      method:'POST',
      headers:{ 'Content-Type':'text/plain;charset=utf-8' },
      body: JSON.stringify({ client_id, password })
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error||'login_failed');

    setAuth(data.token, data.client_id, data.name);
    loginMsg.textContent = '';
    await loadStatus();
  }catch(err){
    const map = {
      client_not_found   : 'Cliente no encontrado',
      invalid_password   : 'Contraseña incorrecta',
      missing_credentials: 'Completa ambos campos',
      too_many_attempts  : 'Demasiados intentos. Intenta más tarde'
    };
    loginMsg.textContent = map[err.message] || ('Error: ' + err.message);
  }
});

/* ---------------------------------
   Logout e inicio
---------------------------------- */
logoutBtn.addEventListener('click', ()=>{
  clearAuth();
  showLogin();
});

getToken() ? loadStatus() : showLogin();
