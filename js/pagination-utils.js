export function pageFromUrl() {
  const page = Math.floor(Number(new URLSearchParams(location.search).get('pagina')));
  return Number.isFinite(page) && page > 0 ? page : 1;
}

export function updateCatalogUrl(values, mode = 'replace') {
  const url = new URL(location.href);
  Object.entries(values || {}).forEach(([key, value]) => {
    const text = String(value ?? '').trim();
    if (!text || (key === 'pagina' && text === '1')) url.searchParams.delete(key);
    else url.searchParams.set(key, text);
  });

  const state = { catalogPage: Number(values?.pagina) || 1 };
  if (mode === 'push') history.pushState(state, '', url);
  else history.replaceState(state, '', url);
}

export function renderCatalogPagination(container, options = {}) {
  if (!container) return;
  const current = Math.max(1, Number(options.current) || 1);
  const total = Math.max(1, Number(options.total) || 1);
  const onSelect = typeof options.onSelect === 'function' ? options.onSelect : () => {};
  const buttonClass = options.buttonClass || 'boton';
  const activeClass = options.activeClass || 'active';

  container.innerHTML = '';
  if (total <= 1) return;

  const appendButton = (page, label, disabled = false) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `${buttonClass}${page === current ? ` ${activeClass}` : ''}`;
    button.textContent = label ?? String(page);
    button.disabled = disabled;
    button.dataset.page = String(page);
    button.setAttribute('aria-label', `Pagina ${page}`);
    if (page === current) button.setAttribute('aria-current', 'page');
    button.addEventListener('click', () => {
      if (!button.disabled && page !== current) onSelect(page);
    });
    container.appendChild(button);
  };

  const appendEllipsis = () => {
    const ellipsis = document.createElement('span');
    ellipsis.className = 'page-ellipsis';
    ellipsis.textContent = '...';
    ellipsis.setAttribute('aria-hidden', 'true');
    container.appendChild(ellipsis);
  };

  appendButton(Math.max(1, current - 1), '\u00ab', current === 1);

  let pages;
  if (total <= 7) {
    pages = Array.from({ length: total }, (_, index) => index + 1);
  } else if (current <= 3) {
    pages = [1, 2, 3, 4, 'ellipsis', total];
  } else if (current >= total - 2) {
    pages = [1, 'ellipsis', total - 3, total - 2, total - 1, total];
  } else {
    pages = [1, 'ellipsis', current - 1, current, current + 1, 'ellipsis', total];
  }

  pages.forEach(page => page === 'ellipsis' ? appendEllipsis() : appendButton(page));
  appendButton(Math.min(total, current + 1), '\u00bb', current === total);
}
