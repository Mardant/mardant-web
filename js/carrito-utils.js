/* ----------------------------------------------------------
 * js/carrito-utils.js — utilidades compartidas (inicio + catálogo)
 * ---------------------------------------------------------- */

/* ====== API PÚBLICA (exportada) ====== */
export function agregarAlCarrito(prod) {
  /*  prod es el objeto completo del producto  */
  const carrito = JSON.parse(localStorage.getItem('carritoMardant') || '[]');

  carrito.push({
    nombre:  prod.nombre,
    precio:  parseFloat(
      prod.oferta && !isNaN(prod.oferta) ? prod.oferta : prod.precio
    ),
    imagen:  prod.imagen || 'https://via.placeholder.com/300x300?text=Sin+imagen',
  });

  localStorage.setItem('carritoMardant', JSON.stringify(carrito));
  actualizarCarritoUI();
  mostrarNotificacion('✅ Producto añadido al carrito');
}

export function actualizarCarritoUI() {
  const carrito   = JSON.parse(localStorage.getItem('carritoMardant') || '[]');
  const contador  = document.getElementById('contador-carrito');
  if (!contador) return;                         // la vista inicio.html no lo tiene

  contador.textContent   = carrito.length;
  contador.style.display = carrito.length ? 'inline-block' : 'none';
}

export function mostrarMiniCarrito() {
  const mini     = document.getElementById('mini-carrito');
  if (!mini) return;

  const carrito  = JSON.parse(localStorage.getItem('carritoMardant') || '[]');
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
function mostrarNotificacion(msg) {
  const noti = document.getElementById('notificacion-carrito');
  if (!noti) return;
  noti.textContent  = msg;
  noti.style.display = 'block';
  noti.style.opacity = '1';
  setTimeout(() => {
    noti.style.opacity = '0';
    setTimeout(() => (noti.style.display = 'none'), 300);
  }, 2000);
}

/* ====== helpers globales (window.*) ====== */
/* – los necesita el botón ✕ de cada línea del mini-carrito */
window.eliminarProductoMini = function (nombre) {
  let carrito = JSON.parse(localStorage.getItem('carritoMardant') || '[]');
  const idx   = carrito.findIndex((p) => p.nombre === nombre);
  if (idx !== -1) carrito.splice(idx, 1);
  localStorage.setItem('carritoMardant', JSON.stringify(carrito));
  actualizarCarritoUI();
  mostrarMiniCarrito();
};
