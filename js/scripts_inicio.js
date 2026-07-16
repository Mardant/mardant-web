// === js/scripts_inicio.js ===
import { AUTH_KEYS, whatsappLink } from './config.js';
import { API_CACHE_TTL, cachedFetchJSON } from './api-client.js';
import { actualizarCarritoUI } from './carrito-utils.js';
import { ensureAccountWidget } from './account-widget.js?v=3';

const $ = (sel) => document.querySelector(sel);
const MAX_HOME_ITEMS = 4;
const MAX_ULTIMAS_ROTACION = 15;
const ROTACION_ULTIMAS_MS = 15000;

let ultimasLista15 = [];
let ultimasIndiceInicio = 0;

const KEYS = {
  TOKEN: (AUTH_KEYS && AUTH_KEYS.TOKEN) || 'mardant_token',
  NAME: (AUTH_KEYS && AUTH_KEYS.NAME) || 'mardant_name',
  CLIENT: (AUTH_KEYS && AUTH_KEYS.CLIENT) || 'mardant_client'
};

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function numberValue(value) {
  const number = Number(String(value ?? '').replace(',', '.'));
  return Number.isFinite(number) ? number : 0;
}

function parsePrice(value) {
  const normalized = String(value ?? '')
    .replace(/\s/g, '')
    .replace(/s\/\.?/i, '')
    .replace(/,/g, '.')
    .replace(/[^\d.]/g, '');
  const number = Number(normalized);
  return Number.isFinite(number) ? number : 0;
}

function trackAttrs({ id = '', name = '', price = '', category = '', source = '', cta = '' } = {}) {
  return [
    ['data-track-item-id', id],
    ['data-track-item-name', name],
    ['data-track-price', price],
    ['data-track-category', category],
    ['data-track-source', source],
    ['data-track-cta', cta]
  ]
    .map(([key, value]) => value !== undefined && value !== null && value !== ''
      ? `${key}="${escapeHtml(String(value))}"`
      : '')
    .join(' ');
}

function marcarSoloDesktop(lista) {
  return lista.map((p, i) => ({ ...p, soloDesktop: i === lista.length - 1 }));
}

function elegirBloqueRotativo(lista, max = MAX_HOME_ITEMS, { modo = 'dia', clave = '' } = {}) {
  const total = lista.length;
  if (!total) return [];

  const ahora = new Date();
  const base = (modo === 'hora')
    ? `${ahora.getFullYear()}-${ahora.getMonth()}-${ahora.getDate()}-${ahora.getHours()}`
    : `${ahora.getFullYear()}-${ahora.getMonth()}-${ahora.getDate()}`;

  const strSeed = `${base}|${clave}`;
  let seed = 0;
  for (let i = 0; i < strSeed.length; i += 1) {
    seed = (seed * 31 + strSeed.charCodeAt(i)) >>> 0;
  }

  const start = seed % total;
  const cantidad = Math.min(max, total);
  const resultado = [];
  for (let i = 0; i < cantidad; i += 1) {
    resultado.push(lista[(start + i) % total]);
  }
  return marcarSoloDesktop(resultado);
}

function estadoClass(texto) {
  const estado = String(texto || '')
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

  if (estado.includes('AGOTADO') || estado.includes('SIN STOCK')) return 'estado-agotado';
  if (estado.includes('OFERTA')) return 'estado-oferta';
  if (estado.includes('PREVENTA')) return 'estado-preventa';
  if (estado.includes('DISPONIBLE')) return 'estado-disponible';
  return 'estado-neutro';
}

function productoAgotado(producto) {
  const estado = String(producto?.estado || '')
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  return estado.includes('AGOTADO') || estado.includes('SIN STOCK');
}

function loteNumber(value) {
  const match = String(value || '').match(/\d+/g);
  return match ? Number(match.join('')) || 0 : 0;
}

function costoCatalogoJapon(value) {
  const text = String(value || '').trim();
  if (!text) return 'Por confirmar';
  if (/^(S\/|\$)/i.test(text)) return text;
  return `S/ ${text}`;
}

function normalizarLista(data, key = 'productos') {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.[key])) return data[key];
  if (Array.isArray(data?.productos)) return data.productos;
  return [];
}

function ensureCuentaButton() {
  ensureAccountWidget();
}

function renderUltimas() {
  const cont = $('#ultimas-importaciones');
  if (!cont) return;

  cont.innerHTML = '';
  if (!ultimasLista15.length) return;

  const total = ultimasLista15.length;
  const cantidad = Math.min(MAX_HOME_ITEMS, total);
  const visibles = [];

  for (let i = 0; i < cantidad; i += 1) {
    visibles.push({ ...ultimasLista15[(ultimasIndiceInicio + i) % total], soloDesktop: i === cantidad - 1 });
  }

  visibles.forEach((p) => {
    const nombre = String(p.nombre || '').trim();
    const precio = numberValue(p.precio);
    const estado = productoAgotado(p) ? 'AGOTADO' : 'DISPONIBLE';
    const cta = 'COMPRAR AHORA';
    const div = document.createElement('div');
    div.className = `producto${p.soloDesktop ? ' mostrar-solo-desktop' : ''}`;
    div.innerHTML = `
      <img src="${escapeHtml(p.imagen)}" alt="${escapeHtml(nombre)}" class="img" loading="lazy" referrerpolicy="no-referrer">
      <div class="nombre">${escapeHtml(nombre)}</div>
      <div class="precio">S/. ${precio.toFixed(2)}</div>
      <div class="estado ${estadoClass(estado)}">${estado}</div>
      <a href="${whatsappLink(`Hola, quiero comprar ahora este producto: ${nombre}`)}"
         class="boton"
         target="_blank"
         rel="noopener noreferrer"
         ${trackAttrs({ id: p.id, name: nombre, price: precio, category: p.categoria, source: 'home_ultimas', cta })}>${cta}</a>`;
    cont.appendChild(div);
  });
}

function setupUltimas(lista) {
  ultimasIndiceInicio = 0;
  ultimasLista15 = [...lista]
    .sort((a, b) => Number(b.id ?? 0) - Number(a.id ?? 0))
    .slice(0, MAX_ULTIMAS_ROTACION);
  renderUltimas();

  if (ultimasLista15.length > MAX_HOME_ITEMS) {
    setInterval(() => {
      ultimasIndiceInicio = (ultimasIndiceInicio + MAX_HOME_ITEMS) % ultimasLista15.length;
      renderUltimas();
    }, ROTACION_ULTIMAS_MS);
  }
}

function renderOfertas(lista) {
  const cont = $('#productos-oferta');
  if (!cont) return;
  cont.innerHTML = '';

  elegirBloqueRotativo(lista, MAX_HOME_ITEMS, { modo: 'hora', clave: 'ofertas' }).forEach((p) => {
    const nombre = String(p.nombre || '').trim();
    const precio = numberValue(p.precio);
    const oferta = numberValue(p.oferta);
    const agotado = productoAgotado(p);
    const estadoTexto = agotado ? 'AGOTADO' : 'OFERTA';
    const precioFinal = oferta || precio;
    const mensaje = agotado
      ? `Hola, quiero cotizar este producto agotado: ${nombre}`
      : `Hola, quiero aprovechar esta oferta: ${nombre}`;
    const cta = agotado ? 'COTIZAR PRODUCTO AGOTADO' : 'APROVECHAR OFERTA';
    const div = document.createElement('div');
    div.className = `producto${p.soloDesktop ? ' mostrar-solo-desktop' : ''}`;
    div.innerHTML = `
      <img src="${escapeHtml(p.imagen)}" alt="${escapeHtml(nombre)}" class="img" loading="lazy" referrerpolicy="no-referrer">
      <div class="nombre">${escapeHtml(nombre)}</div>
      <div class="precio">
        <span style="text-decoration:line-through;color:#bbb;">S/. ${precio.toFixed(2)}</span><br>
        <span class="precio-oferta">S/. ${precioFinal.toFixed(2)}</span>
      </div>
      <div class="estado ${estadoClass(estadoTexto)}">${estadoTexto}</div>
      <a href="${whatsappLink(mensaje)}"
         class="boton"
         target="_blank"
         rel="noopener noreferrer"
         ${trackAttrs({ id: p.id, name: nombre, price: precioFinal, category: p.categoria, source: 'home_ofertas', cta })}>${cta}</a>`;
    cont.appendChild(div);
  });
}

function renderPreventasHome(lista) {
  const cont = $('#productos-preventa');
  if (!cont) return;
  cont.innerHTML = '';

  elegirBloqueRotativo(lista, MAX_HOME_ITEMS, { modo: 'hora', clave: 'preventas' }).forEach((p) => {
    const nombre = String(p.nombre || p.descripcion || 'Preventa Mardant').trim();
    const img = String(p.imagen || '').trim() || 'https://via.placeholder.com/300x300?text=Sin+imagen';
    const precio = numberValue(p.precio);
    const llegada = p['fecha aprox llegada peru'] || 'Próximamente';
    const cta = 'RESERVAR CON S/ 15';
    const div = document.createElement('div');
    div.className = `producto${p.soloDesktop ? ' mostrar-solo-desktop' : ''}`;
    div.innerHTML = `
      <img src="${escapeHtml(img)}" alt="${escapeHtml(nombre)}" class="img" loading="lazy" referrerpolicy="no-referrer">
      <div class="nombre">${escapeHtml(nombre)}</div>
      <div class="precio">S/. ${precio.toFixed(2)}</div>
      <div class="estado estado-preventa">Llega: ${escapeHtml(llegada)}</div>
      <a href="${whatsappLink(`Hola, quiero reservar esta preventa con S/ 15: ${nombre}`)}"
         target="_blank"
         rel="noopener noreferrer"
         class="boton"
         ${trackAttrs({ id: p.id || nombre, name: nombre, price: precio, category: 'Preventa', source: 'home_preventas', cta })}>${cta}</a>`;
    cont.appendChild(div);
  });
}

function renderPedidosHome(lista) {
  const cont = $('#pedidos-disponibles');
  if (!cont) return;
  cont.innerHTML = '';

  const disponibles = lista
    .filter((p) => {
      const est = String(p.estado || '')
        .toUpperCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim();
      return !est || est === 'DISPONIBLE' || est === 'DISPONIBLE A PEDIDO';
    })
    .sort((a, b) => Number(b.id ?? b.ID ?? 0) - Number(a.id ?? a.ID ?? 0));

  elegirBloqueRotativo(disponibles, MAX_HOME_ITEMS, { modo: 'hora', clave: 'pedidos' }).forEach((p) => {
    const id = String(p.id ?? p.ID ?? '').trim();
    const nombre = String(p.nombre || '').trim() || (id ? `Figura N° ${id}` : 'Figura sin nombre');
    const mensaje = p.nombre && String(p.nombre).trim()
      ? `Deseo pedir desde Japón este producto: ${nombre}`
      : `Deseo pedir desde Japón la figura N° ${id || 'sin ID'}`;
    const cta = 'PEDIR DESDE JAPÓN';
    const div = document.createElement('div');
    div.className = `producto${p.soloDesktop ? ' mostrar-solo-desktop' : ''}`;
    div.innerHTML = `
      <img src="${escapeHtml(p.imagen)}" alt="${escapeHtml(nombre)}" class="img" loading="lazy" referrerpolicy="no-referrer">
      <div class="nombre">${escapeHtml(nombre)}</div>
      <div class="estado ${estadoClass(p.estado || 'DISPONIBLE A PEDIDO')}">${escapeHtml(p.estado || 'DISPONIBLE A PEDIDO')}</div>
      <a href="${whatsappLink(mensaje)}"
         class="boton"
         target="_blank"
         rel="noopener noreferrer"
         ${trackAttrs({ id, name: nombre, category: 'Producto a pedido', source: 'home_pedidos', cta })}>${cta}</a>`;
    cont.appendChild(div);
  });
}

function renderCatalogoJaponHome(lista) {
  const cont = $('#catalogo-japon-home');
  if (!cont) return;
  cont.innerHTML = '';

  const ordenada = lista
    .filter((p) => p && p.id_lote && p.imagen_url)
    .sort((a, b) => loteNumber(b.id_lote) - loteNumber(a.id_lote));

  elegirBloqueRotativo(ordenada, 3, { modo: 'hora', clave: 'catalogo-japon' }).forEach((p) => {
    const id = String(p.id_lote || '').trim();
    const etiqueta = String(p.etiqueta || 'disponible').trim().toLowerCase();
    const estadoTexto = etiqueta === 'preventa' ? 'PREVENTA' : 'DISPONIBLE';
    const estadoClase = etiqueta === 'preventa' ? 'estado-preventa' : 'estado-disponible';
    const precio = costoCatalogoJapon(p.precio_producto);
    const cta = 'SOLICITAR';
    const div = document.createElement('div');
    div.className = 'producto';
    div.innerHTML = `
      <img src="${escapeHtml(p.imagen_url)}" alt="Lote #${escapeHtml(id)}" class="img" loading="lazy" referrerpolicy="no-referrer">
      <div class="nombre">Lote #${escapeHtml(id)}</div>
      <div class="precio precio-japon-producto">
        <span class="precio-ruta precio-unico"><span>Precio</span><strong>${escapeHtml(precio)}</strong></span>
        <span class="precio-nota">No incluye envío de Japón 🇯🇵 a Perú 🇵🇪</span>
      </div>
      <div class="estado ${estadoClase}">${estadoTexto}</div>
      <a href="${whatsappLink(`Hola, quiero consultar el lote #${id}`)}"
         class="boton"
         target="_blank"
         rel="noopener noreferrer"
         ${trackAttrs({ id, name: `Lote #${id}`, price: parsePrice(precio), category: 'Catálogo Japón', source: 'home_catalogo_japon', cta })}>${cta}</a>`;
    cont.appendChild(div);
  });
}

async function fetchHomeFallback() {
  const [productosRes, preventasRes, pedidosRes, japonRes] = await Promise.allSettled([
    cachedFetchJSON('productos', { ttl: API_CACHE_TTL.PRODUCTOS }),
    cachedFetchJSON('preventas', { ttl: API_CACHE_TTL.PREVENTAS }),
    cachedFetchJSON('pedidosDisponibles', { ttl: API_CACHE_TTL.PEDIDOS_DISPONIBLES }),
    cachedFetchJSON('catalogoPreventasJapon', { ttl: API_CACHE_TTL.CATALOGO_PREVENTAS_JAPON })
  ]);

  const productos = productosRes.status === 'fulfilled' ? normalizarLista(productosRes.value) : [];
  return {
    productos,
    ultimas: productos,
    ofertas: productos.filter((p) => p.oferta && !Number.isNaN(Number(p.oferta))),
    preventas: preventasRes.status === 'fulfilled' ? normalizarLista(preventasRes.value) : [],
    pedidosDisponibles: pedidosRes.status === 'fulfilled' ? normalizarLista(pedidosRes.value) : [],
    catalogoJapon: japonRes.status === 'fulfilled' ? normalizarLista(japonRes.value) : []
  };
}

async function loadHomeData() {
  try {
    const data = await cachedFetchJSON('homeData', { ttl: API_CACHE_TTL.HOME_DATA });
    if (data && data.ok !== false && !data.error) {
      const productos = normalizarLista(data);
      const ultimas = normalizarLista(data.ultimas, 'ultimas');
      const ofertas = normalizarLista(data.ofertas, 'ofertas');
      return {
        productos,
        ultimas: ultimas.length ? ultimas : productos,
        ofertas: ofertas.length
          ? ofertas
          : productos.filter((p) => p.oferta && !Number.isNaN(Number(p.oferta))),
        preventas: normalizarLista(data.preventas || data, 'preventas'),
        pedidosDisponibles: normalizarLista(data.pedidosDisponibles || data, 'pedidosDisponibles'),
        catalogoJapon: normalizarLista(data.catalogoJapon || data, 'catalogoJapon')
      };
    }
  } catch (error) {
    console.warn('homeData no disponible, usando endpoints actuales:', error);
  }

  return fetchHomeFallback();
}

function renderHome(data) {
  const productosOrdenados = [...(data.productos || [])].sort((a, b) => Number(b.id ?? 0) - Number(a.id ?? 0));
  const ofertasOrdenadas = [...(data.ofertas || [])].sort((a, b) => Number(b.id ?? 0) - Number(a.id ?? 0));

  setupUltimas((data.ultimas || productosOrdenados).length ? data.ultimas : productosOrdenados);
  renderOfertas(ofertasOrdenadas);
  renderPreventasHome(data.preventas || []);
  renderPedidosHome(data.pedidosDisponibles || []);
  renderCatalogoJaponHome(data.catalogoJapon || []);
}

document.addEventListener('DOMContentLoaded', () => {
  ensureCuentaButton();
  if (typeof actualizarCarritoUI === 'function') {
    try { actualizarCarritoUI(); } catch (error) { console.error(error); }
  }

  loadHomeData()
    .then(renderHome)
    .catch((error) => console.error('Error cargando portada:', error));
});

const slides = document.querySelectorAll('.carrusel img');
const ind = $('#indicadores');
if (ind && slides.length) {
  slides.forEach((_, i) => {
    const dot = document.createElement('div');
    dot.className = 'punto';
    dot.addEventListener('click', () => { idx = i; show(); });
    ind.appendChild(dot);
  });

  const puntos = document.querySelectorAll('.punto');
  let idx = 0;
  const show = () => {
    slides.forEach((slide, j) => slide.classList.toggle('activo', j === idx));
    puntos.forEach((dot, j) => dot.classList.toggle('activo', j === idx));
  };

  setInterval(() => { idx = (idx + 1) % slides.length; show(); }, 8000);
  show();
}

window.addEventListener('storage', (event) => {
  if ([KEYS.TOKEN, KEYS.NAME].includes(event.key)) ensureCuentaButton();
});
