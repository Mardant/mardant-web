import { AUTH_KEYS } from './config.js';

const ACCOUNT_WIDGET_ID = 'btnCuenta';

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

document.addEventListener('DOMContentLoaded', ensureAccountWidget);

window.addEventListener('storage', (ev) => {
  if ([AUTH_KEYS.TOKEN, AUTH_KEYS.NAME, AUTH_KEYS.CLIENT].includes(ev.key)) {
    ensureAccountWidget();
  }
});
