// --- Helpers globales
const { TOKEN, CLIENT, NAME } = window.AUTH_KEYS || { TOKEN:'mardant_token', CLIENT:'mardant_client', NAME:'mardant_name' };
const PEN = new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' });

const $ = (s)=>document.querySelector(s);
const $$ = (s)=>document.querySelectorAll(s);

const loginSection  = $('#loginSection');
const statusSection = $('#statusSection');
const loginForm     = $('#loginForm');
const loginMsg      = $('#loginMsg');
const togglePassBtn = $('#togglePass');

const clientNameEl    = $('#clientName');
const clientCodeEl    = $('#clientCode');

const diasGratisEl    = $('#diasGratis');
const diasUsadosEl    = $('#diasUsados');
const diasRestantesEl = $('#diasRestantes');
const diasExcedidosEl = $('#diasExcedidos');

const itemsTbody      = document.querySelector('#itemsTable tbody');
const preTbody        = document.querySelector('#preTable tbody');

const almacenMsg      = $('#almacenMsg');
const preMsg          = $('#preMsg');

const logoutBtn       = $('#logoutBtn');

const tabBtns         = $$('.tab-btn');
const tabAlmacen      = $('#tab-almacen');
const tabPreventas    = $('#tab-preventas');

const toast           = $('#toast');

// --- UI helpers
const getToken = () => localStorage.getItem(TOKEN);
const setAuth  = (t,id,name)=>{ localStorage.setItem(TOKEN,t); localStorage.setItem(CLIENT,id||''); localStorage.setItem(NAME,name||''); };
const clearAuth= ()=>{ localStorage.removeItem(TOKEN); localStorage.removeItem(CLIENT); localStorage.removeItem(NAME); };
const showLogin= ()=>{ statusSection.style.display='none'; loginSection.style.display='block'; };
const showPanel= ()=>{ loginSection.style.display='none'; statusSection.style.display='block'; };

function showToast(msg, variant='warn') {
  if (!toast) return;
  toast.textContent = msg;
  toast.className = `toast ${variant}`;
  toast.hidden = false;
  requestAnimationFrame(()=> toast.classList.add('show'));
  setTimeout(()=> toast.classList.remove('show'), 6000);
  setTimeout(()=> toast.hidden = true, 6500);
}

// Uppercase clientId
$('#clientId').addEventListener('input', (e)=>{ e.target.value = e.target.value.toUpperCase().trim(); });

// Toggle password
togglePassBtn.addEventListener('click', ()=>{
  const input = $('#password');
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
    tabAlmacen.style.display  = (t === 'almacen')  ? 'block' : 'none';
    tabPreventas.style.display= (t === 'preventas')? 'block' : 'none';
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

// --- Carga de estado
async function loadStatus(){
  const token = getToken();
  if (!token){ showLogin(); return; }

  showPanel();
  clientCodeEl.textContent = localStorage.getItem(CLIENT)||'';
  clientNameEl.textContent = localStorage.getItem(NAME)||'';

  almacenMsg.textContent = 'Cargando…';
  preMsg.textContent     = 'Cargando…';
  itemsTbody.innerHTML   = '';
  preTbody.innerHTML     = '';

  try{
    const res = await fetch(window.BASE_API + '?route=status&token=' + encodeURIComponent(token));
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

    // Avisos (7 días)
    if (Array.isArray(data.avisos) && data.avisos.length){
      // ejemplo: “ID PKM-0001: solo te quedan 7 días de almacenaje…”
      showToast(data.avisos.join('  •  '), 'warn');
    }

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
    almacenMsg.textContent = 'No se pudo cargar el estado ('+(err.message||err)+')';
    preMsg.textContent     = 'No se pudo cargar el estado ('+(err.message||err)+')';
  }
}

// --- Login
loginForm.addEventListener('submit', async (ev)=>{
  ev.preventDefault();
  loginMsg.textContent = 'Verificando…';

  const client_id = $('#clientId').value.trim();
  const password  = $('#password').value;
  try{
    const res  = await fetch(window.BASE_API + '?route=login', {
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
      client_not_found:'Cliente no encontrado',
      invalid_password:'Contraseña incorrecta',
      missing_credentials:'Completa ambos campos',
      too_many_attempts:'Demasiados intentos. Intenta más tarde'
    };
    loginMsg.textContent = map[err.message] || ('Error: ' + err.message);
  }
});

// --- Logout
logoutBtn.addEventListener('click', ()=>{ clearAuth(); showLogin(); });

// Entrada
(function init(){
  // Si vienes desde el botón del home, directo al estado si hay token
  getToken() ? loadStatus() : showLogin();
})();
