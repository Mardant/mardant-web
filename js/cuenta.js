// === js/cuenta.js ===
import { API_URL, AUTH_KEYS } from './config.js';

// Storage helpers
const TOKEN_KEY  = AUTH_KEYS?.TOKEN  || 'mardant_token';
const CLIENT_KEY = AUTH_KEYS?.CLIENT || 'mardant_client';
const NAME_KEY   = AUTH_KEYS?.NAME   || 'mardant_name';
const PEN = new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' });

// Elements
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

// UI helpers
const getToken = () => localStorage.getItem(TOKEN_KEY);
const setAuth  = (t,id,name)=>{ localStorage.setItem(TOKEN_KEY,t); localStorage.setItem(CLIENT_KEY,id||''); localStorage.setItem(NAME_KEY,name||''); };
const clearAuth= ()=>{ localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(CLIENT_KEY); localStorage.removeItem(NAME_KEY); };
const showLogin= ()=>{ statusSection.style.display='none'; loginSection.style.display='block'; };
const showPanel= ()=>{ loginSection.style.display='none'; statusSection.style.display='block'; };

// Uppercase clientId
document.getElementById('clientId').addEventListener('input', (e)=>{
  e.target.value = e.target.value.toUpperCase().trim();
});

// Toggle password visibility
togglePassBtn.addEventListener('click', ()=>{
  const input = document.getElementById('password');
  const to = input.type === 'password' ? 'text' : 'password';
  input.type = to;
  togglePassBtn.textContent = (to === 'text') ? 'Ocultar' : 'Mostrar';
});

// Tabs
tabBtns.forEach(btn=>{
  btn.addEventListener('click', ()=>{
    tabBtns.forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    const t = btn.dataset.tab;
    tabAlmacen.style.display   = (t === 'almacen')   ? 'block' : 'none';
    tabPreventas.style.display = (t === 'preventas') ? 'block' : 'none';
  });
});

// Badges
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
function thumb(url){
  const u = (url||'').trim();
  if (!u) return `<div class="thumb"><span class="muted">–</span></div>`;
  return `<a class="thumb" href="${u}" target="_blank" rel="noopener"><img src="${u}" alt="foto"/></a>`;
}

// Load status
async function loadStatus(){
  const token = getToken();
  if (!token){ showLogin(); return; }

  showPanel();
  clientCodeEl.textContent = localStorage.getItem(CLIENT_KEY)||'';
  clientNameEl.textContent = localStorage.getItem(NAME_KEY)||'';

  // placeholders
  almacenMsg.textContent = 'Cargando…';
  preMsg.textContent     = 'Cargando…';
  itemsTbody.innerHTML   = '';
  preTbody.innerHTML     = '';

  try{
    const res = await fetch(`${API_URL}?route=status&token=${encodeURIComponent(token)}`);
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

    // ALMACÉN
    const items = data.almacen || data.items || [];
    itemsTbody.innerHTML = '';
    items.forEach(it=>{
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${thumb(it.foto_url)}</td>
        <td>${it.item_id}</td>
        <td>${it.descripcion || '-'}</td>
        <td>${it.fecha_ingreso || '-'}</td>
        <td>${stateBadge(it.estado)}</td>
        <td class="right"><span class="badge days ${it.excedido?'danger':''}">${it.dias_en_almacen ?? '-'}</span></td>
      `;
      itemsTbody.appendChild(tr);
    });
    almacenMsg.textContent = items.length ? '' : 'No tienes ítems en almacén.';

    // PREVENTAS
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

// Submit login
loginForm.addEventListener('submit', async (ev)=>{
  ev.preventDefault();
  loginMsg.textContent = 'Verificando…';

  const client_id = document.getElementById('clientId').value.trim();
  const password  = document.getElementById('password').value;
  try{
    const res  = await fetch(`${API_URL}?route=login`, {
      method:'POST', headers:{ 'Content-Type':'text/plain;charset=utf-8' },
      body: JSON.stringify({ client_id, password })
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error||'login_failed');

    setAuth(data.token, data.client_id, data.name);
    loginMsg.textContent = '';
    await loadStatus();
  }catch(err){
    const map = {
      client_not_found:'Cliente no encontrado',
      invalid_password:'Contraseña incorrecta',
      missing_credentials:'Completa ambos campos',
      too_many_attempts:'Demasiados intentos. Intenta más tarde'
    };
    loginMsg.textContent = map[err.message] || ('Error: ' + err.message);
  }
});

logoutBtn.addEventListener('click', ()=>{ clearAuth(); showLogin(); });

// Init
getToken() ? loadStatus() : showLogin();
