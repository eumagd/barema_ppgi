/*
 * layout/public — estrutura das páginas abertas (sem login): página inicial do site
 * e telas de acesso (entrar, recuperar e redefinir senha).
 */
(function (PPGI) {
  "use strict";

  const { escapeHtml: esc } = PPGI.Format;
  const { View, Catalog, Auth, Theme, UI } = PPGI;

  const SITE_LINKS = [
    { href: "#sobre", label: "O sistema" },
    { href: "#funcionalidades", label: "Funcionalidades" },
    { href: "#como-funciona", label: "Como funciona" },
    { href: "#equipe", label: "Quem somos" },
  ];

  function brand(size = "h-10") {
    return `<a href="index.html" class="flex items-center gap-3" aria-label="${esc(Catalog.APP.name)} — página inicial">
      ${UI.logo(`${size} w-auto`)}
      <span class="hidden border-l border-ppgi-soft pl-3 text-[13px] font-bold leading-tight text-ppgi sm:block">Gerenciamento<br>de Baremas</span>
    </a>`;
  }

  /** CTA de acesso: quem já entrou vai direto ao painel. */
  function accessButton(opts = {}) {
    return Auth.currentUser()
      ? UI.button("Ir para o painel →", Object.assign({ href: "painel.html" }, opts))
      : UI.button("Entrar", Object.assign({ href: "login.html" }, opts));
  }

  /* ---------- Site (página inicial) ---------- */
  function siteHeader() {
    const links = SITE_LINKS.map((l) => `<a href="${l.href}" class="px-3 py-2 text-[15px] font-semibold text-ink/80 hover:text-ppgi">${l.label}</a>`).join("");
    const mobileLinks = SITE_LINKS.map((l) => `<a href="${l.href}" data-action="close-site-menu" class="block border-b border-ppgi-soft px-4 py-3 text-[15px] font-semibold text-ppgi">${l.label}</a>`).join("");
    return `<header class="sticky top-0 z-30 border-b border-ppgi-soft bg-white/95 backdrop-blur">
      <div class="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        ${brand()}
        <nav aria-label="Seções da página" class="hidden items-center lg:flex">${links}</nav>
        <div class="flex items-center gap-2">
          ${UI.themeToggle()}
          ${accessButton()}
          <button type="button" data-action="toggle-site-menu" class="inline-flex h-10 w-10 items-center justify-center border border-ppgi-soft text-ppgi lg:hidden" aria-label="Abrir seções" aria-controls="site-menu">☰</button>
        </div>
      </div>
      <nav id="site-menu" aria-label="Seções da página" class="hidden border-t border-ppgi-soft bg-white lg:hidden">${mobileLinks}</nav>
    </header>`;
  }

  function siteFooter() {
    return `<footer class="border-t border-ppgi-soft bg-white">
      <div class="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          ${brand("h-9")}
          <p class="mt-4 max-w-sm text-[14px] leading-relaxed text-muted">${esc(Catalog.APP.name)} do ${esc(Catalog.APP.program)} da UFAL.</p>
        </div>
        <div>
          <p class="mb-2 font-mono text-[12px] font-bold uppercase tracking-[0.14em] text-muted">Navegação</p>
          <ul class="space-y-1.5 text-[14px]">${SITE_LINKS.map((l) => `<li><a href="${l.href}" class="text-ppgi hover:underline">${l.label}</a></li>`).join("")}</ul>
        </div>
        <div>
          <p class="mb-2 font-mono text-[12px] font-bold uppercase tracking-[0.14em] text-muted">Acesso</p>
          <ul class="space-y-1.5 text-[14px]">
            <li><a href="login.html" class="text-ppgi hover:underline">Entrar na plataforma</a></li>
            <li><a href="recuperar-senha.html" class="text-ppgi hover:underline">Esqueci minha senha</a></li>
          </ul>
        </div>
      </div>
      <div class="border-t border-ppgi-soft">
        <p class="mx-auto max-w-6xl px-4 py-4 text-[13px] text-muted sm:px-6">© ${Catalog.CYCLE.year} ${esc(Catalog.APP.institution)}. Regras conforme ${esc(Catalog.CYCLE.resolution)}.</p>
      </div>
    </footer>`;
  }

  function toggleSiteMenu(open) {
    const menu = document.getElementById("site-menu");
    menu.classList.toggle("hidden", open === undefined ? !menu.classList.contains("hidden") : !open);
  }

  /** Página do site. page: { title, render, actions } */
  function startSite(page) {
    document.title = page.title;
    return View.createView(document.getElementById("app"), {
      render: () => `<a href="#inicio" class="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[70] focus:bg-ppgi-yellow focus:px-4 focus:py-2 focus:text-black">Pular para o conteúdo</a>
        ${siteHeader()}<main id="inicio">${page.render()}</main>${siteFooter()}`,
      actions: Object.assign({
        "toggle-theme": Theme.toggle,
        "toggle-site-menu": () => toggleSiteMenu(),
      }, page.actions),
    });
  }

  /* ---------- Telas de acesso ---------- */
  /* Painel da marca: azul institucional fixo nos dois temas (classe .brand-panel). */
  function authAside() {
    return `<aside class="brand-panel relative hidden flex-col justify-between overflow-hidden p-10 lg:flex">
      <div aria-hidden="true" class="brand-ring absolute -right-24 -top-24 h-72 w-72 rounded-full"></div>
      <div aria-hidden="true" class="absolute -bottom-16 right-16 h-40 w-40 bg-ppgi-yellow/90"></div>
      <p class="relative font-mono text-[12px] font-bold uppercase tracking-[0.2em] opacity-80">${esc(Catalog.APP.institution)}</p>
      <div class="relative max-w-md">
        <h2 class="text-3xl font-extrabold leading-tight">${esc(Catalog.APP.name)}</h2>
        <p class="mt-4 text-[16px] leading-relaxed opacity-90">Pontuação da produção científica, verificação de requisitos, relatórios e credenciamento dos docentes do programa em um só lugar.</p>
      </div>
      <p class="relative text-[13px] opacity-75">Ciclo ${Catalog.CYCLE.year} · ${esc(Catalog.CYCLE.resolution)}</p>
    </aside>`;
  }

  /** Tela de acesso. page: { title, render, actions, onSubmit, onInput } */
  function startAuth(page) {
    document.title = `${page.title} — ${Catalog.APP.name}`;
    return View.createView(document.getElementById("app"), {
      render: () => `<div class="grid min-h-screen lg:grid-cols-[1fr_minmax(0,560px)]">
          ${authAside()}
          <div class="flex min-h-screen flex-col bg-white">
            <div class="flex items-center justify-between gap-3 px-6 py-4">
              <a href="index.html" class="text-[14px] font-semibold text-ppgi hover:underline">← Voltar ao site</a>
              ${UI.themeToggle()}
            </div>
            <main class="flex flex-1 items-center justify-center px-6 pb-12">
              <div class="w-full max-w-sm">
                <div class="mb-6">${UI.logo("h-14 w-auto")}</div>
                ${page.render()}
              </div>
            </main>
          </div>
        </div>`,
      actions: Object.assign({ "toggle-theme": Theme.toggle }, page.actions),
      onSubmit: page.onSubmit,
      onInput: page.onInput,
    });
  }

  PPGI.PublicLayout = { startSite, startAuth, toggleSiteMenu };
})((window.PPGI = window.PPGI || {}));
