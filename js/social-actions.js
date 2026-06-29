import { whatsappLink } from './config.js';

export function shareIcon(){
  return `
    <svg class="social-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7"></path>
      <path d="M16 6l-4-4-4 4"></path>
      <path d="M12 2v14"></path>
    </svg>
  `;
}

export function likeIcon(){
  return `
    <svg class="social-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 10v11"></path>
      <path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2h.5a2.5 2.5 0 0 1 2.5 3.88Z"></path>
    </svg>
  `;
}

export function bookmarkIcon(){
  return `
    <svg class="social-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M19 21l-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2Z"></path>
    </svg>
  `;
}

export function loadStoredSet(key){
  try {
    const raw = localStorage.getItem(key);
    const values = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(values) ? values.map(String) : []);
  } catch (_) {
    return new Set();
  }
}

export function saveStoredSet(key, set){
  try {
    localStorage.setItem(key, JSON.stringify([...set]));
  } catch (_) {}
}

export function getVisitorId(){
  const key = 'mardant_social_visitor_id_v1';
  try {
    let visitorId = localStorage.getItem(key);
    if (!visitorId) {
      const random = (crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`).replace(/[^\w-]/g, '');
      visitorId = `vs-${random}`;
      localStorage.setItem(key, visitorId);
    }
    return visitorId;
  } catch (_) {
    return `vs-${Date.now()}`;
  }
}

export function buildShareUrl(params = {}){
  const url = new URL(location.href);
  Object.entries(params).forEach(([key, value]) => {
    if (value != null && String(value).trim()) url.searchParams.set(key, String(value).trim());
  });
  url.hash = '';
  return url.toString();
}

export async function shareItem({ title, text, url }){
  const shareText = text || title || 'Mardant';
  const shareUrl = url || location.href;

  if (navigator.share) {
    try {
      await navigator.share({ title: title || 'Mardant', text: shareText, url: shareUrl });
      return;
    } catch (error) {
      if (error?.name === 'AbortError') return;
    }
  }

  window.open(whatsappLink(`${shareText}\n${shareUrl}`), '_blank', 'noopener');
}

function roundedRect(ctx, x, y, width, height, radius){
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function loadImageForCanvas(src){
  return new Promise((resolve, reject) => {
    if (!src) {
      reject(new Error('empty_image'));
      return;
    }
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.referrerPolicy = 'no-referrer';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('image_load_error'));
    image.src = src;
  });
}

function drawContainedImage(ctx, image, x, y, width, height){
  const imageWidth = image.naturalWidth || image.width;
  const imageHeight = image.naturalHeight || image.height;
  const scale = Math.min(width / imageWidth, height / imageHeight);
  const drawWidth = imageWidth * scale;
  const drawHeight = imageHeight * scale;
  const drawX = x + (width - drawWidth) / 2;
  const drawY = y + (height - drawHeight) / 2;
  ctx.drawImage(image, drawX, drawY, drawWidth, drawHeight);
}

function canvasToBlob(canvas){
  return new Promise((resolve, reject) => {
    try {
      canvas.toBlob(blob => {
        if (blob) resolve(blob);
        else reject(new Error('canvas_blob_error'));
      }, 'image/png', 0.95);
    } catch (error) {
      reject(error);
    }
  });
}

function wrapCanvasText(ctx, text, maxWidth, maxLines){
  const words = String(text || '').trim().split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';

  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width <= maxWidth) {
      line = test;
      continue;
    }
    if (line) lines.push(line);
    line = word;
    if (lines.length >= maxLines) break;
  }
  if (line && lines.length < maxLines) lines.push(line);
  if (lines.length === maxLines && words.length) {
    const last = lines[lines.length - 1];
    let shortened = last;
    while (shortened.length > 4 && ctx.measureText(`${shortened}...`).width > maxWidth) {
      shortened = shortened.slice(0, -1);
    }
    lines[lines.length - 1] = `${shortened}...`;
  }
  return lines;
}

function drawTextLines(ctx, lines, x, y, lineHeight){
  lines.forEach((line, index) => {
    ctx.fillText(line, x, y + (index * lineHeight));
  });
}

async function createShareCardBlob({
  imageUrl = '',
  eyebrow = 'MARDANT',
  title = 'Producto Mardant',
  subtitle = '',
  price = '',
  oldPrice = '',
  badge = '',
  note = '',
  cta = 'Ver en mardant.com'
} = {}){
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1920;
  const ctx = canvas.getContext('2d');

  const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, '#fffdf8');
  gradient.addColorStop(0.58, '#f6eee3');
  gradient.addColorStop(1, '#efe1ce');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.globalAlpha = 0.10;
  ctx.fillStyle = '#a8322a';
  ctx.font = '900 56px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('MARDANT', 540, 166);
  ctx.restore();

  ctx.save();
  roundedRect(ctx, 70, 112, 940, 1034, 42);
  ctx.fillStyle = '#fffdf8';
  ctx.shadowColor = 'rgba(23, 20, 17, .20)';
  ctx.shadowBlur = 34;
  ctx.shadowOffsetY = 18;
  ctx.fill();
  ctx.restore();

  let drewExternalImage = false;
  if (imageUrl) {
    try {
      const image = await loadImageForCanvas(imageUrl);
      drawContainedImage(ctx, image, 110, 152, 860, 954);
      drewExternalImage = true;
    } catch (_) {
      drewExternalImage = false;
    }
  }

  if (!drewExternalImage) {
    ctx.save();
    roundedRect(ctx, 110, 152, 860, 954, 28);
    ctx.fillStyle = '#efe3d2';
    ctx.fill();
    ctx.fillStyle = '#7c6a55';
    ctx.font = '900 54px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Mardant Peru', 540, 604);
    ctx.font = '800 34px Arial, sans-serif';
    ctx.fillText('Imagen no disponible para compartir', 540, 662);
    ctx.restore();
  }

  ctx.save();
  roundedRect(ctx, 70, 1196, 940, 510, 42);
  ctx.fillStyle = '#15110e';
  ctx.shadowColor = 'rgba(23, 20, 17, .20)';
  ctx.shadowBlur = 20;
  ctx.shadowOffsetY = 14;
  ctx.fill();
  ctx.restore();

  ctx.textAlign = 'left';
  ctx.fillStyle = '#d8c6aa';
  ctx.font = '900 32px Arial, sans-serif';
  ctx.fillText(String(eyebrow || 'MARDANT').toUpperCase(), 120, 1288);

  ctx.fillStyle = '#f6cf56';
  ctx.font = '900 58px Arial, sans-serif';
  const titleLines = wrapCanvasText(ctx, title, 840, 3);
  drawTextLines(ctx, titleLines, 120, 1364, 68);

  let y = 1364 + (titleLines.length * 68) + 20;

  if (badge) {
    ctx.save();
    const badgeText = String(badge).toUpperCase();
    const badgeWidth = Math.min(380, Math.max(190, ctx.measureText(badgeText).width + 62));
    roundedRect(ctx, 120, y, badgeWidth, 62, 31);
    const isBad = /AGOTADO|SIN STOCK/i.test(badgeText);
    const isOffer = /OFERTA/i.test(badgeText);
    ctx.fillStyle = isBad ? '#3a1814' : isOffer ? '#4f3510' : '#113d31';
    ctx.fill();
    ctx.strokeStyle = isBad ? '#ff9d92' : isOffer ? '#f4d06f' : '#77d9b4';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = isBad ? '#ffb0a7' : isOffer ? '#f4d06f' : '#a9efd4';
    ctx.font = '900 28px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(badgeText, 120 + badgeWidth / 2, y + 40);
    ctx.restore();
    y += 96;
  }

  if (subtitle) {
    ctx.fillStyle = '#d8c6aa';
    ctx.font = '800 32px Arial, sans-serif';
    const subtitleLines = wrapCanvasText(ctx, subtitle, 840, 2);
    drawTextLines(ctx, subtitleLines, 120, y, 40);
    y += subtitleLines.length * 40 + 18;
  }

  if (oldPrice) {
    ctx.save();
    ctx.fillStyle = '#b9aa94';
    ctx.font = '800 42px Arial, sans-serif';
    ctx.fillText(oldPrice, 120, y);
    const w = ctx.measureText(oldPrice).width;
    ctx.strokeStyle = '#b9aa94';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(120, y - 15);
    ctx.lineTo(120 + w, y - 15);
    ctx.stroke();
    ctx.restore();
    y += 62;
  }

  if (price) {
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 78px Arial, sans-serif';
    ctx.fillText(price, 120, y);
    y += 82;
  }

  if (note) {
    ctx.fillStyle = '#d8c6aa';
    ctx.font = '800 31px Arial, sans-serif';
    const noteLines = wrapCanvasText(ctx, note, 840, 2);
    drawTextLines(ctx, noteLines, 120, y, 40);
  }

  ctx.fillStyle = '#a8322a';
  roundedRect(ctx, 120, 1760, 840, 94, 47);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = '900 38px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(cta, 540, 1820);

  return canvasToBlob(canvas);
}

export async function shareVisualItem(options = {}){
  const {
    button,
    fileName = 'mardant-producto.png',
    title = 'Mardant',
    text = 'Mira este producto en Mardant',
    url = location.href
  } = options;

  button?.classList.add('is-loading');
  if (button) button.disabled = true;

  try {
    let blob;
    try {
      blob = await createShareCardBlob(options);
    } catch (error) {
      console.warn('No se pudo generar la imagen con la foto del producto:', error);
      blob = await createShareCardBlob({ ...options, imageUrl: '' });
    }

    if (navigator.share && typeof File !== 'undefined') {
      const file = new File([blob], fileName.replace(/[^\w.-]+/g, '-'), { type: 'image/png' });
      if (!navigator.canShare || navigator.canShare({ files: [file] })) {
        await navigator.share({ title, text, files: [file] });
        return;
      }
    }

    await shareItem({ title, text, url });
  } catch (error) {
    if (error?.name !== 'AbortError') {
      window.open(whatsappLink(`${text}\n${url}`), '_blank', 'noopener');
    }
  } finally {
    button?.classList.remove('is-loading');
    if (button) button.disabled = false;
  }
}
