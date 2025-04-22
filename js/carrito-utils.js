/* ------------------------------------------------
 * js/carrito-utils.js   (compartido inicio + catálogo)
 * ------------------------------------------------ */
export function agregarAlCarrito(prod) {
  const carrito = JSON.parse(localStorage.getItem('carritoMardant') || '[]');
  carrito.push({
    nombre: prod.nombre,
    precio: parseFloat(
      prod.oferta && !isNaN(prod.oferta) ? prod.oferta : prod.precio
    ),
    imagen: prod.imagen || 'https://via.placeholder.com/300x300?text=Sin+imagen',
  });
  localStorage.setItem('carritoMardant', JSON.stringify(carrito));
  actualizarCarritoUI();
  mostrarNotificacion('✅ Producto añadido al carrito');
}

export function actualizarCarritoUI() {
  const carrito = JSON.parse(localStorage.getItem('carritoMardant') || '[]');
  const total = carrito.length;
  const contador = document.getElementById('contador-carrito');
  if (!contador) return;            // si el HTML no tiene contador
  contador.textContent = total;
  contador.style.display = total ? 'inline-block' : 'none';
}

export function mostrarMiniCarrito() {
  const mini = document.getElementById('mini-carrito');
  if (!mini) return;
  const carrito = JSON.parse(localStorage.getItem('carritoMardant') || '[]');
  mini.innerHTML = '';
  if (!carrito.length) {
    mini.innerHTML = "<p style='color:#fff;'>Tu carrito está vacío</p>";
    return;
  }
  const grup = {};
  carrito.forEach((i) => (grup[i.nombre] = (grup[i.nombre] || 0) + 1));
  Object.entries(grup).forEach(([nombre, cant]) => {
    const item = carrito.find((p) => p.nombre === nombre);
    const div = document.createElement('div');
    div.className = 'mini-carrito-item';
    div.innerHTML = `
      <img src="${item.imagen}" alt="${nombre}">
      <div class="info">${nombre}<br><strong>S/. ${item.precio} × ${cant}</strong></div>
      <button onclick="eliminarProductoMini('${nombre}')">✕</button>`;
    mini.appendChild(div);
  });
}

window.eliminarProductoMini = function (nombre) {
  let carrito = JSON.parse(localStorage.getItem('carritoMardant') || '[]');
  const idx = carrito.findIndex((p) => p.nombre === nombre);
  if (idx !== -1) carrito.splice(idx, 1);
  localStorage.setItem('carritoMardant', JSON.stringify(carrito));
  actualizarCarritoUI();
  mostrarMiniCarrito();
};

function mostrarNotificacion(msg) {
  const noti = document.getElementById('notificacion-carrito');
  if (!noti) return;
  noti.textContent = msg;
  noti.style.display = 'block';
  noti.style.opacity = '1';
  setTimeout(() => {
    noti.style.opacity = '0';
    setTimeout(() => (noti.style.display = 'none'), 300);
  }, 2000);
}
