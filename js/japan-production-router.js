// Corte de produccion del Catalogo Japon hacia Cloudflare.
// Se instala antes de los modulos existentes para evitar que versiones cacheadas
// de config/japan-api vuelvan a tocar el backend legacy de Google Apps Script.
(() => {
  const nativeFetch = window.fetch.bind(window);
  const JAPAN_API = 'https://mardant-japon.gamesmardant.workers.dev/';

  function jsonResponse(data, status = 200) {
    return Promise.resolve(new Response(JSON.stringify(data), {
      status,
      headers: { 'Content-Type': 'application/json; charset=utf-8' }
    }));
  }

  window.fetch = (input, init) => {
    const raw = typeof input === 'string' ? input : input?.url;

    try {
      const source = new URL(raw, location.href);
      const accion = String(source.searchParams.get('accion') || '').trim();
      const route = String(source.searchParams.get('route') || '').trim();

      if (accion === 'catalogoPreventasJaponPage') {
        const target = new URL(JAPAN_API);
        source.searchParams.forEach((value, key) => target.searchParams.set(key, value));
        target.searchParams.set('accion', 'catalogoPreventasJaponPage');
        return nativeFetch(target.toString(), init);
      }

      // La portada antigua solicita catalogoJaponHome. El Worker D1 usa el mismo
      // endpoint paginado, por lo que traducimos la peticion sin tocar la UI.
      if (accion === 'catalogoJaponHome') {
        const target = new URL(JAPAN_API);
        target.searchParams.set('accion', 'catalogoPreventasJaponPage');
        target.searchParams.set('page', '1');
        target.searchParams.set('page_size', '15');
        target.searchParams.set('sort', 'newest');
        target.searchParams.set('include_meta', '0');
        return nativeFetch(target.toString(), init);
      }

      // El proxy de imagen era una capacidad legacy de Apps Script. El frontend
      // ya tiene fallback a imagen_url, asi que evitamos tocar Google.
      if (accion === 'catalogoJaponImage') {
        return jsonResponse({ ok:false, error:'image_proxy_unavailable' });
      }

      // Hasta el cutover de Core, no enviamos la telemetria de busquedas de Japon
      // al Apps Script legacy. La busqueda funcional sigue operando en D1.
      if (route === 'registrar_busqueda_catalogo') {
        return jsonResponse({ ok:true, skipped:true, backend:'cloudflare-cutover' });
      }
    } catch (_) {}

    return nativeFetch(input, init);
  };
})();
