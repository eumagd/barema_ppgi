/*
 * pages/landing — página inicial do site: o que é a plataforma, funcionalidades,
 * como funciona, quem somos e acesso.
 */
(function (PPGI) {
  "use strict";

  const { PublicLayout, UI, Catalog } = PPGI;
  const { escapeHtml: esc } = PPGI.Format;

  const FEATURES = [
    { title: "Cálculo do barema", text: "Pontos por estrato Qualis aplicados automaticamente a cada publicação do período, com total do docente e exportação em planilha.", icon: '<path d="M4 4h16v16H4z"/><path d="M8 8h8M8 12h3M13 12h3M8 16h3M13 16h3"/>' },
    { title: "Coautorias entre docentes", text: "Artigos em coautoria com outros docentes do programa são identificados e têm a pontuação dividida, sempre com revisão humana antes do cálculo.", icon: '<circle cx="8" cy="9" r="3"/><circle cx="16" cy="9" r="3"/><path d="M3 20c0-3 2-5 5-5s5 2 5 5M11 20c0-3 2-5 5-5s5 2 5 5"/>' },
    { title: "Verificação de requisitos", text: "Previsto na resolução × apurado do docente: produção, docência, orientação e vínculo, com o que falta para cada item.", icon: '<path d="M9 11l2 2 4-4"/><path d="M4 4h16v16H4z"/>' },
    { title: "Relatórios individuais", text: "Prévia do relatório de cada docente, geração em PDF e envio por e-mail com checagem dos critérios mínimos antes do disparo.", icon: '<path d="M6 2h9l5 5v15H6z"/><path d="M14 2v6h6M9 13h8M9 17h8"/>' },
    { title: "Credenciamento e recredenciamento", text: "Processos individuais ou em lote, com conferência dos requisitos de cada docente antes de iniciar.", icon: '<path d="M9 12l2 2 4-4"/><path d="M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7z"/>' },
    { title: "Sincronização com o Lattes", text: "Produção atualizada a partir do Currículo Lattes de todos os docentes de uma vez, com aviso de quem não pôde ser sincronizado.", icon: '<path d="M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5"/>' },
  ];

  const STEPS = [
    { title: "Sincronize", text: "Atualize a produção dos docentes a partir do Currículo Lattes." },
    { title: "Calcule", text: "A plataforma pontua cada publicação e divide as coautorias do programa." },
    { title: "Verifique", text: "Confira, docente a docente, os requisitos atendidos e as pendências." },
    { title: "Conclua", text: "Inicie o credenciamento ou recredenciamento e envie os relatórios." },
  ];

  function icon(paths) {
    return `<span class="inline-flex h-11 w-11 items-center justify-center border border-ppgi-soft bg-ppgi-tint text-ppgi">
      <svg aria-hidden="true" viewBox="0 0 24 24" class="h-6 w-6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round">${paths}</svg>
    </span>`;
  }

  function sectionHeading(kicker, title, text = "") {
    return `<div class="max-w-2xl">
      <p class="flex items-center gap-2 font-mono text-[12px] font-bold uppercase tracking-[0.18em] text-muted">${UI.marker()}${esc(kicker)}</p>
      <h2 class="mt-3 text-3xl font-extrabold leading-tight text-ppgi">${esc(title)}</h2>
      ${text ? `<p class="mt-3 text-[16px] leading-relaxed text-ink/75">${text}</p>` : ""}
    </div>`;
  }

  /* Cartão ilustrativo do hero (dados de exemplo) */
  function heroIllustration() {
    const rows = [["A1", "2 artigos", "100"], ["A2", "1 artigo", "28,3"], ["A3/A4", "3 artigos", "145"], ["B1–B3", "2 artigos", "52,5"]];
    return `<figure class="relative">
      <div aria-hidden="true" class="absolute -right-4 -top-4 h-full w-full border-2 border-ppgi-yellow"></div>
      <div class="relative border border-ppgi-soft bg-white p-6 shadow-xl shadow-black/10">
        <div class="flex items-start justify-between gap-3 border-b-2 border-ppgi pb-3">
          <div>
            <p class="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-muted">Barema · Ciclo ${Catalog.CYCLE.year}</p>
            <p class="mt-1 text-[17px] font-extrabold text-ppgi">Docente permanente</p>
          </div>
          ${UI.tag("■ PPGI", "yellow")}
        </div>
        <table class="mt-3 w-full text-[14px]">
          <caption class="sr-only">Exemplo de pontuação por estrato</caption>
          <tbody>${rows.map(([s, n, p]) => `<tr class="border-b border-ppgi-soft"><td class="py-1.5 font-mono font-bold text-ppgi">${s}</td><td class="py-1.5 text-muted">${n}</td><td class="py-1.5 text-right font-mono">${p}</td></tr>`).join("")}</tbody>
        </table>
        <div class="mt-4 flex items-end justify-between gap-4">
          <div>
            <p class="text-[13px] text-muted">Pontuação final</p>
            <p class="text-4xl font-extrabold text-ppgi">325,8 <span class="text-sm font-semibold text-muted">pts</span></p>
          </div>
          <div class="w-36">
            <p class="text-right text-[13px] text-muted">Requisitos <strong class="text-ink">8/10</strong></p>
            <div class="mt-1 h-2 w-full border border-ppgi bg-white"><div class="h-full w-4/5 bg-ppgi"></div></div>
          </div>
        </div>
      </div>
      <figcaption class="relative mt-3 text-right font-mono text-[11px] text-muted">Exemplo ilustrativo</figcaption>
    </figure>`;
  }

  function hero() {
    return `<section class="hero-dots border-b border-ppgi-soft">
      <div class="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[1.2fr_1fr] lg:py-24">
        <div>
          <p class="inline-flex items-center gap-2 border border-ppgi-soft bg-white px-3 py-1 font-mono text-[12px] font-bold uppercase tracking-[0.14em] text-ppgi">${UI.marker("h-2 w-2")}${esc(Catalog.APP.institution)}</p>
          <h1 class="mt-5 text-4xl font-extrabold leading-[1.1] text-ppgi sm:text-5xl">${esc(Catalog.APP.name)}</h1>
          <p class="mt-5 max-w-xl text-[17px] leading-relaxed text-ink/80">Calcule a pontuação da produção científica, confira os requisitos da ${esc(Catalog.CYCLE.resolution)} e conduza o credenciamento e o recredenciamento dos docentes do PPGI, tudo a partir dos mesmos dados.</p>
          <div class="mt-8 flex flex-wrap gap-3">
            ${UI.button("Entrar na plataforma →", { href: "login.html", size: "lg" })}
            ${UI.button("Conheça o sistema", { href: "#sobre", variant: "outline", size: "lg" })}
          </div>
        </div>
        ${heroIllustration()}
      </div>
    </section>`;
  }

  function about() {
    const points = [
      "Importa a produção de cada docente a partir do Currículo Lattes.",
      "Aplica os pontos por estrato Qualis definidos no barema do programa.",
      "Divide a pontuação de artigos escritos em coautoria entre docentes do PPGI.",
      "Compara o resultado com os requisitos mínimos e aponta o que falta.",
    ];
    return `<section id="sobre" class="scroll-mt-20">
      <div class="mx-auto grid max-w-6xl gap-10 px-4 py-20 sm:px-6 lg:grid-cols-2">
        ${sectionHeading("O sistema", "Mais do que credenciar: gerenciar o barema do programa", "O barema é a tabela de pontuação que o PPGI usa para avaliar a produção dos seus docentes a cada ciclo. Sem um sistema, esse trabalho depende de planilhas, conferência manual de coautorias e troca de e-mails. A plataforma reúne essas etapas e mantém tudo coerente: o que muda no cálculo se reflete nos requisitos, nos relatórios e nos processos.")}
        <ul class="space-y-3 self-center">
          ${points.map((p) => `<li class="flex items-start gap-3 border border-ppgi-soft bg-white px-4 py-3 text-[15px] text-ink/85"><span aria-hidden="true" class="mt-0.5 font-mono font-bold text-ppgi">✓</span>${esc(p)}</li>`).join("")}
        </ul>
      </div>
    </section>`;
  }

  function features() {
    const cards = FEATURES.map((f) => `<article class="border border-ppgi-soft bg-white p-6">
      ${icon(f.icon)}
      <h3 class="mt-4 text-[17px] font-extrabold text-ppgi">${esc(f.title)}</h3>
      <p class="mt-2 text-[15px] leading-relaxed text-ink/75">${esc(f.text)}</p>
    </article>`).join("");
    return `<section id="funcionalidades" class="scroll-mt-20 border-y border-ppgi-soft bg-ppgi-tint/50">
      <div class="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        ${sectionHeading("Funcionalidades", "Tudo o que o ciclo de avaliação precisa")}
        <div class="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">${cards}</div>
      </div>
    </section>`;
  }

  function howItWorks() {
    const steps = STEPS.map((s, i) => `<li class="relative border-t-4 border-ppgi bg-white p-6 shadow-sm shadow-black/5">
      <span class="font-mono text-[13px] font-bold text-muted">0${i + 1}</span>
      <h3 class="mt-2 text-[18px] font-extrabold text-ppgi">${esc(s.title)}</h3>
      <p class="mt-2 text-[15px] leading-relaxed text-ink/75">${esc(s.text)}</p>
    </li>`).join("");
    return `<section id="como-funciona" class="scroll-mt-20">
      <div class="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        ${sectionHeading("Como funciona", "Do Lattes ao relatório em quatro passos")}
        <ol class="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">${steps}</ol>
      </div>
    </section>`;
  }

  function team() {
    const person = (name, role) => `<li class="flex items-center gap-4 border border-ppgi-soft bg-white px-5 py-4">
      ${UI.avatar(name, "h-12 w-12 text-[14px]")}
      <div><p class="text-[16px] font-bold text-ink">${esc(name)}</p><p class="text-[14px] text-muted">${esc(role)}</p></div>
    </li>`;
    return `<section id="equipe" class="scroll-mt-20 border-t border-ppgi-soft bg-white">
      <div class="mx-auto grid max-w-6xl gap-10 px-4 py-20 sm:px-6 lg:grid-cols-[1fr_1.2fr]">
        ${sectionHeading("Quem somos", "Feito no Instituto de Computação da UFAL", `Projeto desenvolvido por estudantes do Instituto de Computação da Universidade Federal de Alagoas para apoiar a secretaria e a coordenação do ${esc(Catalog.APP.program)} (PPGI).`)}
        <ul class="grid gap-3 sm:grid-cols-2">
          ${Catalog.TEAM.members.map((m) => person(m, "Desenvolvimento")).join("")}
          ${person(Catalog.TEAM.advisor, "Orientação")}
        </ul>
      </div>
    </section>`;
  }

  function callToAction() {
    return `<section class="bg-ppgi-yellow">
      <div class="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-6 px-4 py-12 sm:px-6">
        <div>
          <h2 class="text-2xl font-extrabold text-black">Pronto para o ciclo ${Catalog.CYCLE.year}?</h2>
          <p class="mt-1 text-[16px] text-black/75">O acesso é restrito à secretaria e à coordenação do PPGI.</p>
        </div>
        <a href="login.html" class="inline-flex min-h-12 items-center border border-black bg-black px-6 text-[15px] font-semibold text-[#FFDE59] hover:bg-black/85">Entrar na plataforma →</a>
      </div>
    </section>`;
  }

  PublicLayout.startSite({
    title: `${Catalog.APP.name} — PPGI/UFAL`,
    render: () => hero() + about() + features() + howItWorks() + team() + callToAction(),
    actions: { "close-site-menu": () => PublicLayout.toggleSiteMenu(false) },
  });
})(window.PPGI);
