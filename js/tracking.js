/* js/tracking.js  –  Facebook Pixel + GA4 + eventos personalizados
   =============================================================== */

/* ---------- 1. Facebook Pixel ---------- */
(function (f, b, e, v, n, t, s) {
  if (f.fbq) return;
  n = f.fbq = function () {
    n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
  };
  if (!f._fbq) f._fbq = n;
  n.push = n;
  n.loaded = !0;
  n.version = '2.0';
  n.queue = [];
  t = b.createElement(e);
  t.async = !0;
  t.src = v;
  s = b.getElementsByTagName(e)[0];
  s.parentNode.insertBefore(t, s);
})(
  window,
  document,
  'script',
  'https://connect.facebook.net/en_US/fbevents.js'
);

fbq('init', '1010912193870942');
fbq('track', 'PageView');

/*  ---------- 2. Google Analytics 4 ---------- */
const gaScript = document.createElement('script');
gaScript.async = true;
gaScript.src =
  'https://www.googletagmanager.com/gtag/js?id=G-MJ9XGF9EZ8';
document.head.appendChild(gaScript);

window.dataLayer = window.dataLayer || [];
function gtag() {
  dataLayer.push(arguments);
}
gtag('js', new Date());
gtag('config', 'G-MJ9XGF9EZ8');

/* ---------- 3. Eventos personalizados ---------- */
document.addEventListener('DOMContentLoaded', () => {
  /* clic en enlaces WhatsApp */
  document.querySelectorAll('a[href*="wa.me"]').forEach((link) => {
    link.addEventListener('click', () => {
      fbq('track', 'Contact');
      gtag('event', 'click_whatsapp', {
        event_category: 'Interacción',
        event_label: 'Clic en botón de WhatsApp',
      });
    });
  });

  /* clic en “Añadir al carrito” */
  document.body.addEventListener('click', (e) => {
    if (e.target.matches('.agregar-carrito')) {
      fbq('track', 'AddToCart');
      gtag('event', 'add_to_cart', {
        event_category: 'Carrito',
        event_label: 'Añadir al carrito',
      });
    }
  });

  /* impresión de productos (opcional) */
  document.querySelectorAll('.producto .nombre').forEach((el) => {
    gtag('event', 'view_item', {
      event_category: 'Producto',
      event_label: el.textContent.trim() || 'Producto sin nombre',
    });
  });
});

