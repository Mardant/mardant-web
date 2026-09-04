import { AUTH_KEYS } from './config.js?v=5';

const ACCOUNT_WIDGET_ID = 'btnCuenta';
const MOBILE_CONTROLS_CLASS = 'floating-controls-clear-content';

function getAccountHref() {
  return new URL('../views/cuenta.html', import.meta.url).href;
}

function getAccountState() {
  const storage = (() => {
    try { return sessionStorage; } catch (_) { return null; }
  })();
  const hasToken = !!storage?.getItem(AUTH_KEYS.TOKEN);
  const name = (storage?.getItem(AUTH_KEYS.NAME) || '').trim();
  const shortName = name ? name.split(/\s+/)[0] : '';

  return {
    hasToken,
    title: hasToken ? 'Abrir mi cuenta' : 'Ingresar a mi cuenta',
    label: 'Mi cuenta',
    status: hasToken ? (shortName || 'Sesión activa') : 'Ingresar / seguimiento'
  };
}

export function ensureAccountWidget() {
  if (window.location.pathname.endsWith('/cuenta.html')) {
    document.getElementById(ACCOUNT_WIDGET_ID)?.remove();
    return;
  }

  let btn = document.getElementById(ACCOUNT_WIDGET_ID);
  if (!btn) {
    btn = document.createElement('a');
    btn.id = ACCOUNT_WIDGET_ID;
    btn.className = 'boton-cuenta-flotante';
    document.body.appendChild(btn);
  }

  const state = getAccountState();
  btn.href = getAccountHref();
  btn.title = state.title;
  btn.setAttribute('aria-label', state.title);
  btn.innerHTML = `
    <span class="cuenta-icon" aria-hidden="true">👤</span>
    <span class="cuenta-copy">
      <span class="cuenta-label">${state.label}</span>
      <span class="cuenta-status">${state.status}</span>
    </span>
  `;
}

function watchMobileControlZones() {
  const zones = [...document.querySelectorAll('#filtros, .japan-filters')];
  if (!zones.length || !('IntersectionObserver' in window)) return;

  const visibleZones = new Set();
  const update = () => {
    const isMobile = window.matchMedia('(max-width: 560px)').matches;
    document.body.classList.toggle(MOBILE_CONTROLS_CLASS, isMobile && visibleZones.size > 0);
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) visibleZones.add(entry.target);
      else visibleZones.delete(entry.target);
    });
    update();
  }, { threshold: 0.08 });

  zones.forEach((zone) => observer.observe(zone));
  window.addEventListener('resize', update, { passive: true });
}

document.addEventListener('DOMContentLoaded', () => {
  ensureAccountWidget();
  watchMobileControlZones();
});

window.addEventListener('storage', (ev) => {
  if ([AUTH_KEYS.TOKEN, AUTH_KEYS.NAME, AUTH_KEYS.CLIENT].includes(ev.key)) {
    ensureAccountWidget();
  }
});
