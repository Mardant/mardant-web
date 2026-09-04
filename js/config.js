// === js/config.js ===
export const PUBLIC_API_URL = 'https://script.google.com/macros/s/AKfycbwyYBmqhFJSTzyGG22IF2OaUQlbImTeTZY3WzBBngaDC8qU0mCBzEyXqesQyK-J1J3m/exec';
// Alias temporal para los modulos publicos existentes.
export const API_URL = PUBLIC_API_URL;
export const ACCOUNT_API_URL = 'https://script.google.com/macros/s/AKfycbzk5GW4u9SKUnHy33FF-x0VLSWkXKAxkPlQPncMmvl5u1lbNy9PE70XEjsVb77tTUW4/exec';
export const JAPAN_API_URL = 'https://script.google.com/macros/s/AKfycbxlkEHhnfu7GYwe-xImozbFf9LL8yYxlcNYAfD6s3Uajs7UJ83E2k0Pk2YtXYWJL4GWqg/exec';
// Deshabilitado: ya no existe un backend legacy funcional para Japon.
export const JAPAN_LEGACY_API_URL = '';
export const CARRITO_LOCAL_KEY = 'carritoMardant';
export const PRODUCTOS_POR_PAGINA = 21;
export const WHATSAPP_NUMBER = '51985135331';
export const whatsappLink = (mensaje = '') =>
  `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(mensaje)}`;

// NUEVO: claves usadas por Mi Cuenta
export const AUTH_KEYS = { TOKEN:'mardant_token', CLIENT:'mardant_client', NAME:'mardant_name' };


