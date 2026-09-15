// Compatibilidad de produccion para Catalogo Japon sobre Cloudflare.
// Se carga antes de los modulos existentes para mantener compatibilidad con
// clientes que aun tengan versiones anteriores del frontend en cache.
(() => {
  const nativeFetch = window.fetch.bind(window);
  const JAPAN_API = 'https://mardant-japon.gamesmardant.workers.dev/';
  const CORE_API = 'https://mardant-core.gamesmardant.workers.dev/';

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

      // La portada solicita catalogoJaponHome; el Worker Japon usa el endpoint
      // paginado, asi que traducimos la peticion sin cambiar la UI.
      if (accion === 'catalogoJaponHome') {
        const target = new URL(JAPAN_API);
        target.searchParams.set('accion', 'catalogoPreventasJaponPage');
        target.searchParams.set('page', '1');
        target.searchParams.set('page_size', '15');
        target.searchParams.set('sort', 'newest');
        target.searchParams.set('include_meta', '0');
        return nativeFetch(target.toString(), init);
      }

      // El proxy de imagen no forma parte del Worker Japon. El frontend ya
      // dispone de fallback directo a imagen_url.
      if (accion === 'catalogoJaponImage') {
        return jsonResponse({ ok:false, error:'image_proxy_unavailable' });
      }

      // Las busquedas de Japon se registran en Core D1.
      if (route === 'registrar_busqueda_catalogo') {
        const target = new URL(CORE_API);
        target.searchParams.set('route', 'registrar_busqueda_catalogo');
        return nativeFetch(target.toString(), init);
      }
    } catch (_) {}

    return nativeFetch(input, init);
  };
})();
