/* Facebook Pixel + GA4 + eventos comerciales de Mardant */

const FB_PIXEL_ID = '1010912193870942';
const GA4_ID = 'G-MJ9XGF9EZ8';

function initFacebookPixel() {
  if (window.fbq) return;

  (function (f, b, e, v, n, t, s) {
    if (f.fbq) return;
    n = f.fbq = function () {
      n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
    };
    if (!f._fbq) f._fbq = n;
    n.push = n;
    n.loaded = true;
    n.version = '2.0';
    n.queue = [];
    t = b.createElement(e);
    t.async = true;
    t.src = v;
    s = b.getElementsByTagName(e)[0];
    s.parentNode.insertBefore(t, s);
  })(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
}

function initGA4() {
  if (!document.querySelector(`script[src*="${GA4_ID}"]`)) {
    const gaScript = document.createElement('script');
    gaScript.async = true;
    gaScript.src = `https://www.googletagmanager.com/gtag/js?id=${GA4_ID}`;
    document.head.appendChild(gaScript);
  }

  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function () {
    window.dataLayer.push(arguments);
  };
}

export function trackGA(eventName, params = {}) {
  try {
    if (typeof window.gtag === 'function') {
      window.gtag('event', eventName, params);
    }
  } catch (_) {}
}

export function trackFB(eventName, params = {}) {
  try {
    if (typeof window.fbq === 'function') {
      window.fbq('track', eventName, params);
    }
  } catch (_) {}
}

function parseMoney(value) {
  const normalized = String(value ?? '')
    .replace(/\s/g, '')
    .replace(/s\/\.?/i, '')
    .replace(/,/g, '.')
    .replace(/[^\d.]/g, '');
  if (!normalized) return 0;

  const parts = normalized.split('.');
  const safe = parts.length > 2 ? `${parts[0]}.${parts.slice(1).join('')}` : normalized;
  const number = Number(safe);
  return Number.isFinite(number) ? number : 0;
}

function closestWithData(element, attr) {
  return element?.closest?.(`[${attr}]`);
}

function textFrom(element, selectors) {
  for (const selector of selectors) {
    const found = element?.closest?.('.producto, .japan-card, .pdp, .carrito-item')?.querySelector(selector)
      || document.querySelector(selector);
    const text = found?.textContent?.trim();
    if (text) return text;
  }
  return '';
}

function datasetValue(element, name) {
  const attr = `data-track-${name}`;
  return element?.dataset?.[`track${name.charAt(0).toUpperCase()}${name.slice(1)}`]
    || closestWithData(element, attr)?.getAttribute(attr)
    || '';
}

function itemFromElement(element) {
  const itemId = datasetValue(element, 'item-id') || datasetValue(element, 'itemId');
  const itemName = datasetValue(element, 'item-name') || datasetValue(element, 'itemName')
    || textFrom(element, ['.nombre', '.pdp-title', 'h2']);
  const priceRaw = datasetValue(element, 'price') || textFrom(element, ['.precio', '.pdp-precio', '.japan-price-box strong']);
  const category = datasetValue(element, 'category') || textFrom(element, ['.categoria']);
  const source = datasetValue(element, 'source') || location.pathname;
  const cta = datasetValue(element, 'cta') || element?.textContent?.trim() || '';
  const price = parseMoney(priceRaw);

  return {
    item_id: String(itemId || '').trim(),
    item_name: String(itemName || '').trim(),
    item_category: String(category || '').trim(),
    price,
    source_section: String(source || '').trim(),
    cta_text: String(cta || '').trim()
  };
}

function gaItem(item) {
  return {
    item_id: item.item_id,
    item_name: item.item_name,
    item_category: item.item_category,
    price: item.price,
    quantity: item.quantity || 1
  };
}

export function trackAddToCart(item = {}) {
  const value = Number(item.price || 0) * Number(item.quantity || 1);
  const payload = {
    currency: 'PEN',
    value,
    items: [gaItem(item)]
  };

  trackGA('add_to_cart', payload);
  trackFB('AddToCart', {
    content_ids: item.item_id ? [item.item_id] : [],
    content_name: item.item_name || '',
    value,
    currency: 'PEN'
  });
}

export function trackSelectItem(item = {}) {
  trackGA('select_item', {
    item_list_name: item.source_section || location.pathname,
    source_section: item.source_section || location.pathname,
    items: [gaItem(item)]
  });
}

export function trackViewItem(item = {}) {
  trackGA('view_item', {
    currency: 'PEN',
    value: Number(item.price || 0),
    items: [gaItem(item)]
  });
  trackFB('ViewContent', {
    content_ids: item.item_id ? [item.item_id] : [],
    content_name: item.item_name || '',
    value: Number(item.price || 0),
    currency: 'PEN'
  });
}

export function trackBeginCheckout({ value = 0, items = [] } = {}) {
  const gaItems = items.map(gaItem);
  trackGA('begin_checkout', {
    currency: 'PEN',
    value: Number(value || 0),
    items: gaItems
  });
  trackFB('InitiateCheckout', {
    value: Number(value || 0),
    currency: 'PEN',
    content_ids: items.map(item => item.item_id).filter(Boolean),
    num_items: items.reduce((sum, item) => sum + Number(item.quantity || 1), 0)
  });
}

function trackWhatsAppClick(link) {
  const item = itemFromElement(link);
  trackGA('click_whatsapp', {
    page_location: location.href,
    link_url: link.href,
    item_id: item.item_id,
    item_name: item.item_name,
    price: item.price,
    category: item.item_category,
    source_section: item.source_section,
    cta_text: item.cta_text
  });
  trackFB('Contact', {
    content_name: item.item_name || item.cta_text || 'WhatsApp Mardant',
    content_category: item.item_category || item.source_section || location.pathname,
    value: item.price || undefined,
    currency: 'PEN'
  });
}

function bindDelegatedEvents() {
  document.body?.addEventListener('click', (event) => {
    const whatsapp = event.target.closest('a[href*="wa.me"], a[href*="api.whatsapp.com"]');
    if (whatsapp) trackWhatsAppClick(whatsapp);

    const addButton = event.target.closest('.agregar-carrito, [data-track-action="add_to_cart"]');
    if (addButton && !addButton.disabled) {
      trackAddToCart(itemFromElement(addButton));
    }

    const detailLink = event.target.closest('[data-track-action="select_item"], .ver-detalle[data-track-item-id]');
    if (detailLink) {
      trackSelectItem(itemFromElement(detailLink));
    }
  });
}

initFacebookPixel();
initGA4();

try {
  window.fbq('init', FB_PIXEL_ID);
  window.fbq('track', 'PageView');
} catch (_) {}

try {
  window.gtag('js', new Date());
  window.gtag('config', GA4_ID);
} catch (_) {}

window.MardantTracking = {
  trackGA,
  trackFB,
  trackAddToCart,
  trackSelectItem,
  trackViewItem,
  trackBeginCheckout
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bindDelegatedEvents, { once: true });
} else {
  bindDelegatedEvents();
}

import('./site-footer.js?v=4');
