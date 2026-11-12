/*
 * layout/shell — estrutura das telas internas (após o login): menu lateral de
 * navegação, cabeçalho com trilha, tema e usuário, e a área de conteúdo.
 *
 * O menu tem só as seções do sistema. As funções do docente (cálculo, requisitos,
 * relatório, credenciamento individual) ficam nas abas do docente.
 */
(function (PPGI) {
  "use strict";

  const { escapeHtml: esc } = PPGI.Format;
  const { View, Feedback, UseCases, Catalog, Auth, Theme, UI } = PPGI;

  const NAV_ITEMS = [
    { key: "painel", label: "Painel", href: "painel.html", icon: '<path d="M3 13h8V3H3zM13 21h8V11h-8zM3 21h8v-6H3zM13 3v6h8V3z"/>' },
    { key: "docentes", label: "Docentes", href: "professores.html", icon: '<circle cx="9" cy="8" r="4"/><path d="M2 21c0-4 3-6 7-6s7 2 7 6M16 4a4 4 0 0 1 0 8M22 21c0-3-2-5-4-6"/>' },
    { key: "credenciamento", label: "Credenciamento", href: "credenciamento.html", icon: '<path d="M9 12l2 2 4-4"/><path d="M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7z"/>' },
  ];

  /* ---------- Acesso ---------- */
  function redirectToLogin() {
    const here = window.location.pathname.split("/").pop() + window.location.search;
    window.location.replace(`login.html?next=${encodeURIComponent(here)}`);
  }

  /* ---------- Partes do layout ---------- */
  function navLink(item, activeKey) {
    const active = item.key === activeKey;
    const cls = active ? "border-ppgi-yellow bg-ppgi font-semibold text-white" : "border-transparent text-ppgi hover:bg-ppgi-tint";
    return `<a href="${item.href}" ${active ? 'aria-current="page"' : ""} class="flex items-center gap-3 border-l-4 px-4 py-3 text-[15px] ${cls}">
      <svg aria-hidden="true" viewBox="0 0 24 24" class="h-5 w-5 shrink-0" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round">${item.icon}</svg>
      ${esc(item.label)}
    </a>`;
  }

  function sidebar(activeKey) {
    return `<aside id="sidebar" class="drawer fixed inset-y-0 left-0 z-40 flex w-64 -translate-x-full flex-col border-r border-ppgi-soft bg-white lg:translate-x-0" aria-label="Menu principal">
      <div class="flex items-center justify-between gap-2 border-b border-ppgi-soft px-5 py-4">
        <a href="painel.html" class="flex items-center gap-2.5" aria-label="Ir para o painel">
          ${UI.logo("h-9 w-auto")}
          <span class="text-[12px] font-bold leading-tight text-ppgi">Gerenciamento<br>de Baremas</span>
        </a>
        <button type="button" data-shell="close-menu" class="px-2 py-1 text-ppgi lg:hidden" aria-label="Fechar menu">✕</button>
      </div>
      <nav class="flex-1 overflow-y-auto py-3">${NAV_ITEMS.map((i) => navLink(i, activeKey)).join("")}</nav>
      <div class="space-y-2 border-t border-ppgi-soft px-4 py-3">
        <p class="text-[12px] leading-snug text-muted">Ciclo ${Catalog.CYCLE.year} · prazo ${Catalog.CYCLE.deadline}<br>${esc(Catalog.CYCLE.resolution)}</p>
        <button type="button" data-shell="reset" class="text-[12px] text-muted underline underline-offset-2 hover:text-ppgi">Restaurar dados de demonstração</button>
      </div>
    </aside>
    <div id="sidebar-backdrop" data-shell="close-menu" class="fixed inset-0 z-30 hidden bg-black/50 lg:hidden"></div>`;
  }

  function breadcrumbs(crumbs) {
    if (!crumbs || !crumbs.length) return "";
    const items = crumbs
      .map((c, i) => {
        const sep = i > 0 ? `<span aria-hidden="true" class="text-muted">›</span>` : "";
        const content = c.href
          ? `<a href="${esc(c.href)}" class="text-muted underline-offset-2 hover:text-ppgi hover:underline">${esc(c.label)}</a>`
          : `<span aria-current="page" class="font-semibold text-ppgi">${esc(c.label)}</span>`;
        return `<li class="flex items-center gap-1.5">${sep}${content}</li>`;
      })
      .join("");
    return `<nav aria-label="Você está em"><ol class="mb-0.5 flex flex-wrap items-center gap-1.5 text-[13px]">${items}</ol></nav>`;
  }

  function userMenu(user) {
    return `<div class="flex items-center gap-2 border-l border-ppgi-soft pl-3">
      ${UI.avatar(user.name, "h-9 w-9 text-[11px]")}
      <div class="hidden leading-tight md:block">
        <p class="text-[13px] font-semibold text-ink">${esc(user.name)}</p>
        <p class="text-[12px] text-muted">${esc(user.role)}</p>
      </div>
      <button type="button" data-shell="logout" class="ml-1 inline-flex min-h-10 items-center border border-ppgi-soft bg-white px-3 text-[13px] font-semibold text-ppgi hover:border-ppgi">Sair</button>
    </div>`;
  }

  function header(meta, user) {
    return `<header class="sticky top-0 z-20 border-b border-ppgi-soft bg-white/95 backdrop-blur">
      <div class="flex items-center justify-between gap-3 px-4 py-3 sm:px-8">
        <div class="flex min-w-0 items-center gap-3">
          <button type="button" data-shell="open-menu" class="inline-flex h-10 w-10 shrink-0 items-center justify-center border border-ppgi-soft text-ppgi lg:hidden" aria-label="Abrir menu" aria-controls="sidebar">☰</button>
          <div class="min-w-0">
            ${breadcrumbs(meta.crumbs)}
            <h1 class="truncate text-lg font-extrabold text-ppgi sm:text-xl">${esc(meta.title)}</h1>
          </div>
        </div>
        <div class="flex shrink-0 items-center gap-2">
          ${UI.themeToggle("data-shell")}
          ${userMenu(user)}
        </div>
      </div>
    </header>`;
  }

  function lead(text) {
    return text ? `<p class="mx-4 mt-5 max-w-4xl text-[15px] leading-relaxed text-muted sm:mx-8">${text}</p>` : "";
  }

  /* ---------- Comportamento ---------- */
  function setMenuOpen(open) {
    document.getElementById("sidebar").classList.toggle("-translate-x-full", !open);
    document.getElementById("sidebar-backdrop").classList.toggle("hidden", !open);
  }

  function confirmReset() {
    Feedback.openModal({
      title: "Restaurar dados de demonstração?",
      body: "As ações feitas nesta demonstração (desvínculos, envios, sinalizações, coautorias revisadas, processos iniciados) serão desfeitas. Você continua conectado.",
      actions: [
        { text: "Cancelar", variant: "outline" },
        { text: "Restaurar", onClick: () => { UseCases.resetSampleData(); window.location.reload(); } },
      ],
    });
  }

  function logout() {
    Auth.logout();
    window.location.href = "index.html";
  }

  /**
   * Monta uma tela interna. Sem sessão ativa, redireciona para o login.
   * meta: { nav, title, lead, crumbs } (ou função que os devolve) — page: { render, actions, onChange, onInput, onSubmit }
   */
  function start(meta, page) {
    const user = Auth.currentUser();
    if (!user) {
      redirectToLogin();
      return { refresh() {} };
    }
    const resolveMeta = () => (typeof meta === "function" ? meta() : meta);
    const app = document.getElementById("app");
    app.innerHTML = `
      <a href="#conteudo" class="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[70] focus:bg-ppgi-yellow focus:px-4 focus:py-2 focus:text-black">Pular para o conteúdo</a>
      <div id="shell-sidebar"></div>
      <div class="min-h-screen lg:ml-64">
        <div id="shell-header"></div>
        <div id="shell-lead"></div>
        <main id="conteudo" tabindex="-1" class="px-4 py-6 outline-none sm:px-8"></main>
      </div>`;

    const view = View.createView(document.getElementById("conteudo"), page);

    function renderChrome() {
      const m = resolveMeta();
      document.title = `${m.title} — ${Catalog.APP.name}`;
      document.getElementById("shell-sidebar").innerHTML = sidebar(m.nav);
      document.getElementById("shell-header").innerHTML = header(m, user);
      document.getElementById("shell-lead").innerHTML = lead(m.lead);
    }

    const handlers = {
      "open-menu": () => setMenuOpen(true),
      "close-menu": () => setMenuOpen(false),
      "toggle-theme": Theme.toggle,
      reset: confirmReset,
      logout,
    };
    app.addEventListener("click", (event) => {
      const el = event.target.closest("[data-shell]");
      if (el) handlers[el.dataset.shell]();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") setMenuOpen(false);
    });

    renderChrome();
    return {
      refresh() {
        renderChrome();
        view.update();
      },
    };
  }

  PPGI.Shell = { start };
})((window.PPGI = window.PPGI || {}));
