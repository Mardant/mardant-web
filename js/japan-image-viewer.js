const MAX_ZOOM = 4;

export function catalogImageCandidates(value, base = 'https://mardant.com/') {
  try {
    const url = new URL(String(value || '').trim(), base);
    if (!value || !['https:', 'http:'].includes(url.protocol)) return [];
    const thumbnail = url.hostname === 'static.mercdn.net'
      && url.pathname.match(/^\/thumb\/item\/webp\/(m\d+_\d+\.(?:jpe?g|png))$/i);
    if (!thumbnail) return [url.href];
    const original = new URL(url.href);
    original.pathname = `/item/detail/orig/photos/${thumbnail[1]}`;
    return [original.href, url.href];
  } catch (_) {
    return [];
  }
}

export function createJapanImageViewer(modal) {
  if (!modal) return { open() {}, close() {} };
  // Old cached HTML can request the new JS at its previous query-string URL.
  // Upgrade the viewer markup in place so that it cannot break the catalog.
  const oldStage = modal.querySelector('.japan-modal-stage');
  const oldImage = modal.querySelector('#catalogoJaponModalImage');
  const oldPanel = modal.querySelector('.japan-modal-panel');
  if (!oldStage || !oldImage || !oldPanel) return { open() {}, close() {} };
  if (!modal.querySelector('.japan-modal-tools')) {
    const tools = document.createElement('div');
    tools.className = 'japan-modal-tools';
    tools.innerHTML = '<div class="japan-modal-controls" role="group" aria-label="Ampliar imagen">'
      + '<button type="button" data-image-zoom="out" aria-label="Alejar imagen" disabled>−</button>'
      + '<output class="japan-modal-zoom-level" aria-label="Nivel de ampliación">1×</output>'
      + '<button type="button" data-image-zoom="in" aria-label="Ampliar imagen" disabled>+</button>'
      + '<button type="button" data-image-zoom="fit" disabled>Ajustar</button>'
      + '<a class="japan-modal-original" target="_blank" rel="noopener noreferrer" hidden>Ver imagen</a></div>'
      + '<p class="japan-modal-image-status" role="status" aria-live="polite"></p>';
    oldPanel.insertBefore(tools, oldStage);
    const sheet = document.querySelector('link[href*="catalogo-japon.css"]');
    if (sheet) {
      const href = new URL(sheet.href);
      href.searchParams.set('v', '13');
      sheet.href = href.href;
    }
  }
  if (!oldStage.querySelector('.japan-modal-canvas')) {
    const wrapper = document.createElement('div');
    wrapper.className = 'japan-modal-canvas';
    oldStage.appendChild(wrapper);
    wrapper.appendChild(oldImage);
  }
  oldStage.tabIndex = 0;
  oldImage.draggable = false;
  const panel = modal.querySelector('.japan-modal-panel');
  const stage = modal.querySelector('.japan-modal-stage');
  const canvas = modal.querySelector('.japan-modal-canvas');
  const image = modal.querySelector('#catalogoJaponModalImage');
  const title = modal.querySelector('#catalogoJaponModalTitle');
  const closeButton = modal.querySelector('#catalogoJaponClose');
  const zoomIn = modal.querySelector('[data-image-zoom="in"]');
  const zoomOut = modal.querySelector('[data-image-zoom="out"]');
  const fitButton = modal.querySelector('[data-image-zoom="fit"]');
  const zoomLabel = modal.querySelector('.japan-modal-zoom-level');
  const status = modal.querySelector('.japan-modal-image-status');
  const originalLink = modal.querySelector('.japan-modal-original');
  let generation = 0;
  let cancelLoad = null;
  let previousFocus = null;
  let naturalWidth = 0;
  let naturalHeight = 0;
  let zoom = 1;
  let layout = null;
  let pan = null;
  let pinch = null;
  let moved = false;
  let pointerType = '';
  const pointers = new Map();
  const isOpen = () => modal.classList.contains('open');

  function controls() {
    const ready = naturalWidth > 0;
    zoomIn.disabled = !ready || zoom >= MAX_ZOOM;
    zoomOut.disabled = !ready || zoom <= 1;
    fitButton.disabled = !ready || zoom <= 1;
    zoomLabel.textContent = `${Number(zoom.toFixed(1)).toLocaleString('es')}×`;
    stage.classList.toggle('is-zoomed', ready && zoom > 1);
  }

  function point(clientX, clientY) {
    const rect = stage.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  }

  function imagePoint(focal) {
    if (!layout) return { x: 0.5, y: 0.5 };
    return {
      x: (stage.scrollLeft + focal.x - layout.left) / layout.width,
      y: (stage.scrollTop + focal.y - layout.top) / layout.height
    };
  }

  function render(focal = null, anchor = null) {
    if (!isOpen() || !naturalWidth) return;
    controls();
    const width = stage.clientWidth;
    const height = stage.clientHeight;
    if (!width || !height) return;
    const fit = Math.min(Math.max(1, width - 24) / naturalWidth, Math.max(1, height - 24) / naturalHeight);
    const imageWidth = naturalWidth * fit * zoom;
    const imageHeight = naturalHeight * fit * zoom;
    const canvasWidth = Math.max(width, imageWidth + 24);
    const canvasHeight = Math.max(height, imageHeight + 24);
    const left = (canvasWidth - imageWidth) / 2;
    const top = (canvasHeight - imageHeight) / 2;
    canvas.style.width = `${canvasWidth}px`;
    canvas.style.height = `${canvasHeight}px`;
    image.style.width = `${imageWidth}px`;
    image.style.height = `${imageHeight}px`;
    image.style.left = `${left}px`;
    image.style.top = `${top}px`;
    layout = { width: imageWidth, height: imageHeight, left, top };
    const target = focal || { x: width / 2, y: height / 2 };
    const source = anchor || { x: 0.5, y: 0.5 };
    stage.scrollLeft = left + source.x * imageWidth - target.x;
    stage.scrollTop = top + source.y * imageHeight - target.y;
  }

  function setZoom(value, focal = null, anchor = null) {
    if (!naturalWidth) return;
    const target = focal || { x: stage.clientWidth / 2, y: stage.clientHeight / 2 };
    const source = anchor || imagePoint(target);
    zoom = Math.max(1, Math.min(MAX_ZOOM, value));
    render(target, zoom === 1 ? { x: 0.5, y: 0.5 } : source);
  }

  function fit() {
    zoom = 1;
    render();
  }

  function close() {
    generation += 1;
    cancelLoad?.();
    cancelLoad = null;
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('modal-open');
    stage.classList.remove('is-dragging', 'is-zoomed');
    pointers.clear();
    pan = pinch = null;
    naturalWidth = naturalHeight = 0;
    layout = null;
    image.hidden = true;
    image.removeAttribute('src');
    originalLink.removeAttribute('href');
    originalLink.hidden = true;
    stage.setAttribute('aria-busy', 'false');
    previousFocus?.isConnected && previousFocus.focus({ preventScroll: true });
    previousFocus = null;
  }

  function open(url, id) {
    const candidates = catalogImageCandidates(url);
    if (!candidates.length) return;
    if (!isOpen()) previousFocus = document.activeElement;
    generation += 1;
    cancelLoad?.();
    const request = generation;
    pointers.clear();
    pan = pinch = null;
    moved = false;
    naturalWidth = naturalHeight = 0;
    zoom = 1;
    layout = null;
    image.hidden = true;
    image.removeAttribute('src');
    image.referrerPolicy = 'no-referrer';
    title.textContent = `Lote #${id}`;
    image.alt = `Imagen del lote #${id}`;
    originalLink.hidden = true;
    originalLink.removeAttribute('href');
    status.textContent = 'Cargando imagen…';
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');
    stage.setAttribute('aria-busy', 'true');
    stage.classList.remove('is-dragging');
    controls();
    closeButton.focus({ preventScroll: true });

    function attempt(index) {
      if (request !== generation || !isOpen()) return;
      if (index >= candidates.length) {
        status.textContent = 'No se pudo cargar la imagen. Cierra y vuelve a intentarlo.';
        stage.setAttribute('aria-busy', 'false');
        controls();
        return;
      }
      const probe = new Image();
      probe.decoding = 'async';
      probe.referrerPolicy = 'no-referrer';
      const clear = () => {
        clearTimeout(timer);
        probe.onload = probe.onerror = null;
      };
      cancelLoad = () => { clear(); probe.removeAttribute('src'); };
      const fail = () => {
        clear();
        probe.removeAttribute('src');
        if (request === generation) attempt(index + 1);
      };
      const timer = setTimeout(fail, 10000);
      probe.onerror = fail;
      probe.onload = () => {
        clear();
        if (request !== generation || !isOpen()) return;
        naturalWidth = probe.naturalWidth;
        naturalHeight = probe.naturalHeight;
        if (!naturalWidth || !naturalHeight) { fail(); return; }
        image.src = candidates[index];
        image.hidden = false;
        originalLink.href = candidates[index];
        originalLink.hidden = false;
        stage.setAttribute('aria-busy', 'false');
        status.textContent = index > 0
          ? 'Vista previa: la foto original no está disponible.'
          : matchMedia('(pointer: coarse)').matches
            ? 'Amplía con + o con dos dedos.'
            : 'Haz clic en la foto o usa + para ampliar.';
        fit();
      };
      probe.src = candidates[index];
    }
    attempt(0);
  }

  function beginGesture() {
    const values = [...pointers.values()];
    if (values.length === 2) {
      const [a, b] = values;
      const center = point((a.x + b.x) / 2, (a.y + b.y) / 2);
      pinch = { distance: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)), zoom, anchor: imagePoint(center) };
      pan = null;
      moved = true;
    } else if (values.length === 1) {
      pan = { ...values[0], left: stage.scrollLeft, top: stage.scrollTop };
      pinch = null;
    }
  }

  stage.addEventListener('pointerdown', event => {
    if (!naturalWidth || (event.pointerType === 'mouse' && event.button !== 0)) return;
    pointerType = event.pointerType;
    if (!pointers.size) moved = false;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    try { stage.setPointerCapture(event.pointerId); } catch (_) {}
    beginGesture();
    stage.classList.toggle('is-dragging', zoom > 1);
  });

  stage.addEventListener('pointermove', event => {
    if (!pointers.has(event.pointerId)) return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pinch && pointers.size >= 2) {
      const [a, b] = [...pointers.values()];
      const center = point((a.x + b.x) / 2, (a.y + b.y) / 2);
      setZoom(pinch.zoom * Math.hypot(a.x - b.x, a.y - b.y) / pinch.distance, center, pinch.anchor);
    } else if (pan) {
      const dx = event.clientX - pan.x;
      const dy = event.clientY - pan.y;
      if (Math.hypot(dx, dy) > 5) moved = true;
      stage.scrollLeft = pan.left - dx;
      stage.scrollTop = pan.top - dy;
    }
  });

  function endPointer(event) {
    pointers.delete(event.pointerId);
    stage.classList.remove('is-dragging');
    pan = pinch = null;
    if (pointers.size) beginGesture();
  }
  stage.addEventListener('pointerup', endPointer);
  stage.addEventListener('pointercancel', endPointer);
  stage.addEventListener('lostpointercapture', endPointer);
  stage.addEventListener('click', event => {
    if (pointerType === 'mouse' && !moved && naturalWidth) setZoom(zoom > 1 ? 1 : 2, point(event.clientX, event.clientY));
  });
  stage.addEventListener('wheel', event => {
    if (!naturalWidth || !event.ctrlKey) return;
    event.preventDefault();
    setZoom(zoom * Math.exp(-event.deltaY * 0.002), point(event.clientX, event.clientY));
  }, { passive: false });
  function bindControl(element, action = null) {
    let start = null;
    let lastTouch = -Infinity;
    element.addEventListener('pointerdown', event => {
      start = event.pointerType === 'touch'
        ? { id: event.pointerId, x: event.clientX, y: event.clientY } : null;
    });
    element.addEventListener('pointercancel', () => { start = null; });
    element.addEventListener('pointerup', event => {
      const origin = start;
      start = null;
      if (!origin || origin.id !== event.pointerId || element.disabled
        || Math.hypot(event.clientX - origin.x, event.clientY - origin.y) > 10) return;
      // A browser can suppress the synthetic click immediately after a pinch.
      // Handle a stationary touch release and ignore its later duplicate click.
      lastTouch = performance.now();
      event.preventDefault();
      if (action) action();
      else element.click();
    });
    element.addEventListener('click', event => {
      if (event.isTrusted && event.detail !== 0 && performance.now() - lastTouch < 800) {
        event.preventDefault();
        return;
      }
      action?.();
    });
  }
  bindControl(zoomIn, () => setZoom(zoom * 1.5));
  bindControl(zoomOut, () => setZoom(zoom / 1.5));
  bindControl(fitButton, fit);
  bindControl(closeButton, close);
  bindControl(originalLink);
  modal.addEventListener('click', event => { if (!panel.contains(event.target)) close(); });
  document.addEventListener('keydown', event => {
    if (!isOpen()) return;
    if (event.key === 'Escape') { event.preventDefault(); close(); }
    else if (['+', '='].includes(event.key)) { event.preventDefault(); setZoom(zoom * 1.5); }
    else if (event.key === '-') { event.preventDefault(); setZoom(zoom / 1.5); }
    else if (event.key === '0') { event.preventDefault(); fit(); }
    else if (event.key === 'Tab') {
      const buttons = [...panel.querySelectorAll('button:not(:disabled), a[href], [tabindex="0"]')].filter(el => !el.hidden);
      const index = buttons.indexOf(document.activeElement);
      if (event.shiftKey && index <= 0) { event.preventDefault(); buttons.at(-1)?.focus(); }
      else if (!event.shiftKey && (index === buttons.length - 1 || index < 0)) { event.preventDefault(); buttons[0]?.focus(); }
    }
  });
  const resize = () => {
    if (!isOpen() || !naturalWidth) return;
    const center = { x: stage.clientWidth / 2, y: stage.clientHeight / 2 };
    render(center, zoom === 1 ? { x: 0.5, y: 0.5 } : imagePoint(center));
  };
  if (typeof ResizeObserver === 'function') new ResizeObserver(resize).observe(stage);
  else window.addEventListener('resize', resize);
  return { open, close };
}
