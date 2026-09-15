// === js/config.js ===
// Backends de producción en Cloudflare Workers + D1.
export const PUBLIC_API_URL = 'https://mardant-core.gamesmardant.workers.dev/';
export const API_URL = PUBLIC_API_URL;
export const ACCOUNT_API_URL = 'https://mardant-cuenta.gamesmardant.workers.dev/';
export const JAPAN_API_URL = 'https://mardant-japon.gamesmardant.workers.dev/';
export const JAPAN_LEGACY_API_URL = '';
export const CARRITO_LOCAL_KEY = 'carritoMardant';
export const PRODUCTOS_POR_PAGINA = 21;
export const WHATSAPP_NUMBER = '51985135331';
export const whatsappLink = (mensaje = '') =>
  `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(mensaje)}`;

export const AUTH_KEYS = { TOKEN:'mardant_token', CLIENT:'mardant_client', NAME:'mardant_name' };


