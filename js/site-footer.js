const FOOTER_STYLE_ID = 'mardant-footer-style';

function injectFooterStyles() {
  if (document.getElementById(FOOTER_STYLE_ID)) return;

  const style = document.createElement('style');
  style.id = FOOTER_STYLE_ID;
  style.textContent = `
    .mardant-footer{
      margin-top:48px;
      padding:32px 18px calc(32px + env(safe-area-inset-bottom, 0px));
      background:#050403;
      color:#d8cbb9;
      border-top:1px solid rgba(216,198,170,.22);
      font-family:'Nunito Sans',system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;
    }
    .mardant-footer__inner{
      width:min(1180px,100%);
      margin:0 auto;
      display:grid;
      grid-template-columns:minmax(230px,1.05fr) minmax(260px,1.6fr) minmax(220px,.9fr);
      gap:24px;
      align-items:start;
    }
    .mardant-footer h2,
    .mardant-footer h3{
      margin:0 0 12px;
      color:#fffaf2;
      text-align:left;
      line-height:1.15;
      letter-spacing:0;
    }
    .mardant-footer h2{font-size:24px}
    .mardant-footer h3{font-size:15px;text-transform:uppercase;letter-spacing:.08em;color:#c9b18e}
    .mardant-footer p,
    .mardant-footer li{
      margin:0;
      color:#d8cbb9;
      font-size:14px;
      line-height:1.55;
      font-weight:800;
    }
    .mardant-footer__meta{
      display:grid;
      gap:7px;
      list-style:none;
      padding:0;
      margin:0;
    }
    .mardant-footer a{
      color:#f3ddbf;
      text-decoration:none;
      font-weight:900;
    }
    .mardant-footer a:hover{color:#fff;border-color:#fff}
    .mardant-footer__links{
      display:grid;
      grid-template-columns:repeat(2,minmax(0,1fr));
      gap:8px 18px;
    }
    .mardant-footer__links a{
      display:inline-flex;
      width:max-content;
      max-width:100%;
      border-bottom:1px solid rgba(243,221,191,.28);
      font-size:14px;
      line-height:1.35;
    }
    .mardant-footer__claim{
      display:inline-flex;
      align-items:center;
      justify-content:center;
      width:100%;
      min-height:46px;
      padding:10px 14px;
      border-radius:999px;
      background:linear-gradient(180deg,#b13a31,#8f2722);
      color:#fff !important;
      box-shadow:0 12px 24px rgba(168,50,42,.24);
      text-align:center;
    }
    .mardant-footer__claim:hover{
      transform:translateY(-1px);
      box-shadow:0 16px 30px rgba(168,50,42,.28);
    }
    .mardant-footer__copy{
      width:min(1180px,100%);
      margin:24px auto 0;
      padding-top:16px;
      border-top:1px solid rgba(216,198,170,.16);
      color:#9f8f80;
      font-size:13px;
      font-weight:800;
      text-align:center;
    }
    @media (max-width:860px){
      .mardant-footer__inner{grid-template-columns:1fr}
      .mardant-footer__links{grid-template-columns:1fr}
      .mardant-footer__links a{width:100%}
      .mardant-footer h2{font-size:22px}
      .mardant-footer{padding-bottom:calc(120px + env(safe-area-inset-bottom, 0px))}
    }
  `;
  document.head.appendChild(style);
}

function renderSiteFooter() {
  if (document.body.dataset.noMardantFooter === 'true') return;
  if (document.querySelector('.mardant-footer')) return;

  document
    .querySelectorAll('.pie, .site-footer, .legal-footer, .tracking-footer, .japan-footer')
    .forEach((footer) => footer.remove());

  injectFooterStyles();

  const pagePrefix = window.location.pathname.includes('/views/') ? './' : 'views/';
  const footer = document.createElement('footer');
  footer.className = 'mardant-footer';
  footer.innerHTML = `
    <div class="mardant-footer__inner">
      <section aria-labelledby="footer-brand-title">
        <h2 id="footer-brand-title">Mardant Perú</h2>
        <ul class="mardant-footer__meta">
          <li>RUC: 15615825481</li>
          <li>WhatsApp: <a href="https://wa.me/51985135331" target="_blank" rel="noopener">+51 985 135 331</a></li>
          <li>Correo: <a href="mailto:gamesmardant@gmail.com">gamesmardant@gmail.com</a></li>
          <li>Ubicación: Lima, Perú</li>
        </ul>
      </section>

      <nav aria-label="Enlaces del pie de página">
        <h3>Información</h3>
        <div class="mardant-footer__links">
          <a href="${pagePrefix}inicio.html">Inicio</a>
          <a href="${pagePrefix}catalogo.html">Catálogo</a>
          <a href="${pagePrefix}preventa.html">Preventa</a>
          <a href="${pagePrefix}pedidos.html">Productos a pedido</a>
          <a href="${pagePrefix}catalogo-japon.html">Catálogo Japón</a>
          <a href="${pagePrefix}como.html">Cómo comprar</a>
          <a href="${pagePrefix}envios-entregas.html">Envíos y entregas</a>
          <a href="${pagePrefix}cambios-devoluciones.html">Cambios y devoluciones</a>
          <a href="${pagePrefix}terminos-condiciones.html">Términos y condiciones</a>
          <a href="${pagePrefix}terminos-importacion.html">Términos de importación</a>
          <a href="${pagePrefix}politica-privacidad.html">Política de privacidad</a>
          <a href="${pagePrefix}informacion-legal.html">Información legal</a>
        </div>
      </nav>

      <section aria-labelledby="footer-claims-title">
        <h3 id="footer-claims-title">Atención al consumidor</h3>
        <p>Para quejas o reclamos relacionados con una compra o atención recibida.</p>
        <p style="margin-top:12px">
          <a class="mardant-footer__claim" href="${pagePrefix}libro-reclamaciones.html">Libro de Reclamaciones</a>
        </p>
      </section>
    </div>
    <p class="mardant-footer__copy">© 2026 Mardant Perú. Todos los derechos reservados.</p>
  `;

  document.body.appendChild(footer);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', renderSiteFooter, { once: true });
} else {
  renderSiteFooter();
}
