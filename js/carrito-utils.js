import { CARRITO_LOCAL_KEY } from './config.js';
/* ----------------------------------------------------------
 * js/carrito-utils.js — utilidades compartidas (inicio + catálogo)
 * ---------------------------------------------------------- */

/* ====== API PÚBLICA (exportada) ====== */
export function agregarAlCarrito(prod) {
  const carrito = JSON.parse(localStorage.getItem(CARRITO_LOCAL_KEY) || '[]');

  const precioUnit = Number(
    (prod.precio != null ? prod.precio :
      (prod.oferta && !isNaN(prod.oferta) ? prod.oferta : prod.precio)
    )
  ) || 0;

  carrito.push({
    id: String(prod.id ?? '').trim(), // <-- NUEVO (para link detalle)
    nombre: String(prod.nombre || '').trim(),
    precio: precioUnit,
    imagen: prod.imagen || 'https://via.placeholder.com/300x300?text=Sin+imagen',
  });

  localStorage.setItem(CARRITO_LOCAL_KEY, JSON.stringify(carrito));
  actualizarCarritoUI();
  notificar('✅ Producto añadido al carrito', 'success'); // (tu noti ya existe)
}

export function actualizarCarritoUI() {
  const carrito   = JSON.parse(localStorage.getItem(CARRITO_LOCAL_KEY) || '[]');
  const contador  = document.getElementById('contador-carrito');
  if (!contador) return;                         // la vista inicio.html no lo tiene

  contador.textContent   = carrito.length;
  contador.style.display = carrito.length ? 'inline-block' : 'none';
}

export function mostrarMiniCarrito() {
  const mini     = document.getElementById('mini-carrito');
  if (!mini) return;

  const carrito  = JSON.parse(localStorage.getItem(CARRITO_LOCAL_KEY) || '[]');
  mini.innerHTML = '';

  if (!carrito.length) {
    mini.innerHTML = "<p style='color:#fff;'>Tu carrito está vacío</p>";
    return;
  }

  /* agrupamos para mostrar cantidad × producto */
  const grup = {};
  carrito.forEach((i) => (grup[i.nombre] = (grup[i.nombre] || 0) + 1));

  Object.entries(grup).forEach(([nombre, cant]) => {
    const item = carrito.find((p) => p.nombre === nombre);     // sólo para precio / imagen
    const div  = document.createElement('div');
    div.className = 'mini-carrito-item';
    div.innerHTML = `
      <img src="${item.imagen}" alt="${nombre}">
      <div class="info">${nombre}<br>
        <strong>S/. ${item.precio} × ${cant}</strong>
      </div>
      <button onclick="eliminarProductoMini('${nombre}')">✕</button>
    `;
    mini.appendChild(div);
  });

  /* total opcional (no imprescindible) */
  const total = carrito.reduce((s, p) => s + p.precio, 0);
  const tot   = document.createElement('div');
  tot.style   = 'color:#fff;text-align:right;margin-top:10px;font-weight:bold;';
  tot.textContent = `🧾 Total: S/. ${total.toFixed(2)}`;
  mini.appendChild(tot);
}

/* ====== API PRIVADA (helpers internos) ====== */
export function notificar(mensaje, tipo = 'success') {
  const tipos = {
    success: '#4CAF50',
    error: '#F44336',
    warning: '#FFC107'
  };
  
  const noti = document.createElement('div');
  noti.className = 'notificacion-flotante';
  noti.textContent = mensaje;
  noti.style.backgroundColor = tipos[tipo] || tipos.success;
  
  document.body.appendChild(noti);
  
  setTimeout(() => {
    noti.style.opacity = '0';
    setTimeout(() => noti.remove(), 300);
  }, 3000);
}

/* ====== helpers globales (window.*) ====== */
/* – los necesita el botón ✕ de cada línea del mini-carrito */
window.eliminarProductoMini = function (nombre) {
  let carrito = JSON.parse(localStorage.getItem('carritoMardant') || '[]');
  const idx   = carrito.findIndex((p) => p.nombre === nombre);
  if (idx !== -1) carrito.splice(idx, 1);
  localStorage.setItem(CARRITO_LOCAL_KEY, JSON.stringify(carrito));
  actualizarCarritoUI();
  mostrarMiniCarrito();
};

export const carrito = {
  obtener: () => JSON.parse(localStorage.getItem(CARRITO_LOCAL_KEY)) || [],
  guardar: (items) => localStorage.setItem(CARRITO_LOCAL_KEY, JSON.stringify(items)),
  limpiar: () => localStorage.removeItem(CARRITO_LOCAL_KEY)
};

export function actualizarContador() {
  const contadores = document.querySelectorAll('#contador-carrito');
  const cantidad = carrito.obtener().length;
  contadores.forEach(c => {
    c.textContent = cantidad;
    c.style.display = cantidad ? 'inline-block' : 'none';
  });
}
