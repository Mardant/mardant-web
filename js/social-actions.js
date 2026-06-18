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
