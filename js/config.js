// === js/config.js ===
export const API_URL = 'https://script.google.com/macros/s/AKfycbwyYBmqhFJSTzyGG22IF2OaUQlbImTeTZY3WzBBngaDC8qU0mCBzEyXqesQyK-J1J3m/exec';
export const CARRITO_LOCAL_KEY = 'carritoMardant';
export const PRODUCTOS_POR_PAGINA = 21;
export const WHATSAPP_NUMBER = '51985135331';
export const whatsappLink = (mensaje = '') =>
  `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(mensaje)}`;

// NUEVO: claves usadas por Mi Cuenta
export const AUTH_KEYS = { TOKEN:'mardant_token', CLIENT:'mardant_client', NAME:'mardant_name' };


