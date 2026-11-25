/*
 * pages/qualis — Bases Qualis (RF-BE04): envio das tabelas (CAPES, PUC-RS, Scopus, Qualis
 * Eventos), histórico das cargas e consulta do estrato de um periódico ou evento.
 * Rotas: POST/GET /api/qualis/cargas, GET /api/qualis/veiculos.
 */
(function (PPGI) {
  "use strict";

  const { Shell, UI, Api, Dados, Feedback, Format, Formulario: F } = PPGI;
  const { escapeHtml: esc } = Format;

  const FONTES = [
    { value: "CAPES", label: "CAPES (Sucupira)", colunas: "ISSN; Título; Área de Avaliação; Estrato" },
    { value: "PUC_RS", label: "PUC-RS", colunas: "ISSN; Título; Estrato" },
    { value: "SCOPUS", label: "Scopus (percentil)", colunas: "ISSN; Título; Percentil (ou Estrato)" },
    { value: "EVENTOS", label: "Qualis Eventos da Computação", colunas: "Sigla; Nome; Estrato" },
  ];
  const ROTULO_FONTE = { CAPES: "CAPES", PUC_RS: "PUC-RS", SCOPUS: "Scopus", EVENTOS: "Eventos", MANUAL: "Manual" };
  const STATUS = { CONCLUIDO: ["Concluída", "blue"], FALHA: ["Falha", "fail"], PROCESSANDO: ["Processando", "yellow"], PENDENTE: ["Pendente", "soft"] };

  const state = { cargas: null, enviando: false, fonte: "CAPES", busca: "", veiculos: null, versao: 0, arquivo: null };

  document.addEventListener("change", (e) => {
    if (e.target && e.target.id === "arquivo-qualis") state.arquivo = e.target.files[0] || null;
  });

  async function carregarCargas() {
    try {
      state.cargas = await Api.get("/qualis/cargas");
    } catch (erro) {
      Feedback.toast(erro.message, "error");
    }
    view.refresh();
  }

  /* ---------- Envio ---------- */
  function painelEnvio() {
    const fonte = FONTES.find((f) => f.value === state.fonte);
    return UI.panel({
      title: "Enviar tabela",
      body: `<form data-submit="enviar" data-preservar="envio-${state.versao}" class="space-y-3" novalidate>
          ${F.escolha("fonte", "Base", FONTES, { value: state.fonte, change: "fonte" })}
          <div class="grid gap-3 sm:grid-cols-2">
            ${F.campo("ano_base", "Ano-base", { type: "number", value: state.fonte === "CAPES" ? 2020 : new Date().getFullYear() - 1, min: 2000, max: 2100, required: true, hint: "CAPES quadriênio 2017–2020 = 2020." })}
            ${F.campo("area", "Área", { value: "Ciência da Computação", required: true })}
          </div>
          <div>
            <label for="arquivo-qualis" class="mb-1 block text-[14px] font-semibold text-ppgi">Arquivo .csv <span class="text-danger" aria-hidden="true">*</span></label>
            <input id="arquivo-qualis" type="file" accept=".csv,.txt" class="block w-full border border-ppgi-soft p-2 text-[14px]">
            <p class="mt-1 text-[12px] text-muted">Colunas esperadas: <span class="font-mono">${esc(fonte.colunas)}</span>. Exporte a planilha como CSV (UTF-8 ou Latin-1, com ; ou ,).</p>
          </div>
          ${UI.button(state.enviando ? "⟳ Enviando…" : "⤒ Enviar tabela", { type: "submit", disabled: state.enviando })}
        </form>
        <p class="mt-3 text-[12px] text-muted">Uma nova carga substitui a anterior da mesma base, ano-base e área; reenviar o mesmo arquivo não duplica nada. O estrato que vale segue a ordem CAPES → PUC-RS → Scopus; eventos vêm da tabela de Eventos.</p>`,
    });
  }

  async function enviar(form) {
    const v = F.ler(form);
    if (!state.arquivo) return Feedback.toast("Escolha o arquivo .csv.", "error");
    const dados = new FormData();
    dados.append("arquivo", state.arquivo);
    dados.append("fonte", v.fonte);
    dados.append("ano_base", v.ano_base);
    dados.append("area", v.area);
    state.enviando = true;
    view.refresh();
    try {
      const r = await Api.enviarArquivo("/qualis/cargas", dados);
      const c = r.carga.contagens || {};
      Feedback.toast(
        r.reaproveitada
          ? "Este arquivo já tinha sido carregado: nada mudou."
          : `Carga concluída: ${c.veiculos || 0} veículo(s); ${(c.sem_estrato || 0) + (c.invalidas || 0)} linha(s) com problema; ${c.outras_areas || 0} de outras áreas ignoradas.`,
      );
      state.arquivo = null;
      state.versao++;
      await Dados.recarregar().catch(() => {});
    } catch (erro) {
      Feedback.toast(F.mensagemDeErro(erro), "error");
    }
    state.enviando = false;
    await carregarCargas();
  }

  /* ---------- Histórico ---------- */
  function painelHistorico() {
    const lista = state.cargas;
    const linhas = (lista || []).map((c) => {
      const [rotulo, tom] = STATUS[c.status] || [c.status, "soft"];
      const k = c.contagens || {};
      const problemas = c.erros && c.erros.total ? `${c.erros.total} linha(s) com problema` : c.erros && c.erros.mensagem ? esc(c.erros.mensagem) : "—";
      return [
        `${Dados.dataBr(c.criado_em)}<span class="block text-[12px] text-muted">${esc(c.usuario ? c.usuario.nome : "")}</span>`,
        `${esc(ROTULO_FONTE[c.fonte.replace("QUALIS_", "")] || c.fonte)} · ${k.ano_base ?? "—"}<span class="block max-w-[14rem] truncate text-[12px] text-muted" title="${esc(c.nome_arquivo)}">${esc(c.nome_arquivo)}</span>`,
        UI.tag(rotulo, tom),
        `<span class="font-mono">${k.veiculos ?? "—"}</span>`,
        `<span class="text-[13px]">${problemas}</span>`,
      ];
    });
    return UI.panel({
      title: "Histórico de cargas",
      body: !lista
        ? UI.emptyState("Carregando…")
        : linhas.length
          ? UI.table({ head: ["Data", "Base", "Situação", "Veículos", "Problemas"], rows: linhas, caption: "Cargas das tabelas Qualis" })
          : UI.emptyState("Nenhuma tabela carregada ainda. Sem as tabelas, as publicações ficam sem estrato (exceto o que veio classificado no CSV do QLattes)."),
    });
  }

  /* ---------- Consulta ---------- */
  let temporizador = null;
  function buscar(el) {
    state.busca = el.value;
    clearTimeout(temporizador);
    if (el.value.trim().length < 2) {
      state.veiculos = null;
      return view.refresh();
    }
    temporizador = setTimeout(async () => {
      try {
        state.veiculos = await Api.get(`/qualis/veiculos?busca=${encodeURIComponent(el.value.trim())}`);
      } catch (erro) {
        Feedback.toast(erro.message, "error");
      }
      view.refresh();
    }, 250);
  }

  function painelConsulta() {
    const lista = state.veiculos;
    const itens = (lista || []).map((v) => {
      const vig = v.estrato_vigente;
      const fontes = v.estratos.map((e) => `${ROTULO_FONTE[e.fonte]} ${e.ano_base}: <strong>${e.estrato}</strong>`).join(" · ");
      return `<li class="border border-ppgi-soft bg-white px-3 py-2">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <span><span class="font-semibold text-ppgi">${esc(v.nome)}</span> <span class="font-mono text-[12px] text-muted">${esc(v.issn_sigla.startsWith("SEMISSN") ? "sem ISSN" : v.issn_sigla)} · ${v.tipo === "CONFERENCIA" ? "evento" : "periódico"}</span></span>
          ${vig ? UI.tag(`${vig.estrato} · ${ROTULO_FONTE[vig.fonte]}`, "blue") : UI.tag("Sem estrato", "fail")}
        </div>
        ${fontes ? `<p class="mt-1 text-[12px] text-ink/70">${fontes}</p>` : ""}
      </li>`;
    });
    return UI.panel({
      title: "Consultar estrato",
      body: `${UI.searchField({ id: "busca-veiculo", label: "Periódico ou evento", placeholder: "Nome, ISSN (1234-5678) ou sigla (SBBD)…", value: state.busca, action: "buscar" })}
        <ul class="mt-3 space-y-2">${lista ? itens.join("") || `<li class="text-[13px] text-muted">Nada encontrado.</li>` : ""}</ul>
        <p class="mt-3 text-[12px] text-muted">Veículos sem estrato em nenhuma base podem ser classificados à mão na tela <a class="font-semibold text-ppgi underline" href="revisao.html?aba=qualis">Revisão</a>.</p>`,
    });
  }

  function render() {
    return `<div class="grid gap-5 xl:grid-cols-[400px_1fr]">
      <div class="space-y-5">${painelEnvio()}${painelConsulta()}</div>
      <div class="min-w-0">${painelHistorico()}</div>
    </div>`;
  }

  const view = Shell.start(
    {
      nav: "qualis",
      title: "Bases Qualis",
      crumbs: [{ label: "Painel", href: "painel.html" }, { label: "Bases Qualis" }],
      lead: "Carregue as tabelas que classificam periódicos e eventos. Toda nova carga reclassifica a base inteira, sem reabrir os currículos.",
    },
    {
      render,
      onChange: { fonte: (el) => { state.fonte = el.value; state.versao++; view.refresh(); } },
      onInput: { buscar },
      onSubmit: { enviar },
    },
  );

  carregarCargas();
})(window.PPGI);
