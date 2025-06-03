diff --git a/js/carrito-utils.js b/js/carrito-utils.js
index 67f915d752077ab50b42df58a5cba67e96ea557a..6e1687c78fcd652b0c9ee2d61641b14b2e0125f6 100644
--- a/js/carrito-utils.js
+++ b/js/carrito-utils.js
@@ -1,46 +1,46 @@
 import { CARRITO_LOCAL_KEY } from './config.js';
 /* ----------------------------------------------------------
  * js/carrito-utils.js — utilidades compartidas (inicio + catálogo)
  * ---------------------------------------------------------- */
 
 /* ====== API PÚBLICA (exportada) ====== */
 export function agregarAlCarrito(prod) {
   /*  prod es el objeto completo del producto  */
   const carrito = JSON.parse(localStorage.getItem(CARRITO_LOCAL_KEY) || '[]');
 
   carrito.push({
     nombre:  prod.nombre,
     precio:  parseFloat(
       prod.oferta && !isNaN(prod.oferta) ? prod.oferta : prod.precio
     ),
     imagen:  prod.imagen || 'https://via.placeholder.com/300x300?text=Sin+imagen',
   });
 
-  localStorage.setItem('carritoMardant', JSON.stringify(carrito));
+  localStorage.setItem(CARRITO_LOCAL_KEY, JSON.stringify(carrito));
   actualizarCarritoUI();
-  mostrarNotificacion('✅ Producto añadido al carrito');
+  notificar('✅ Producto añadido al carrito');
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
diff --git a/js/carrito-utils.js b/js/carrito-utils.js
index 67f915d752077ab50b42df58a5cba67e96ea557a..6e1687c78fcd652b0c9ee2d61641b14b2e0125f6 100644
--- a/js/carrito-utils.js
+++ b/js/carrito-utils.js
@@ -70,47 +70,47 @@ export function mostrarMiniCarrito() {
 
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
-  let carrito = JSON.parse(localStorage.getItem('carritoMardant') || '[]');
+  let carrito = JSON.parse(localStorage.getItem(CARRITO_LOCAL_KEY) || '[]');
   const idx   = carrito.findIndex((p) => p.nombre === nombre);
   if (idx !== -1) carrito.splice(idx, 1);
-  localStorage.setItem('carritoMardant', JSON.stringify(carrito));
+  localStorage.setItem(CARRITO_LOCAL_KEY, JSON.stringify(carrito));
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
