/*
 * pages/revisao — filas de revisão humana:
 *   • Coautorias: pares do Fuzzy Match (GET/PATCH /api/correspondencias). Confirmar mescla as
 *     publicações (a pontuação passa a ser dividida); rejeitar mantém separadas (e desfaz uma mescla).
 *   • Qualis "N": periódicos/eventos com publicações e sem estrato em nenhuma base
 *     (GET /api/qualis/pendentes, POST /api/qualis/classificacoes), classificados com justificativa.
 *
 * Atalho por URL: revisao.html?aba=qualis
 */
(function (PPGI) {
  "use strict";

  const { Shell, UI, Api, Dados, Feedback, Format, Catalog } = PPGI;
  const { escapeHtml: esc, formatNumber } = Format;

  const ABAS = [
    { value: "coautorias", label: "Coautorias (Fuzzy Match)" },
    { value: "qualis", label: "Qualis sem estrato" },
  ];
  const FAIXAS = [
    { value: "revisao", label: "Para revisar" },
    { value: "automatica", label: "Mescladas automaticamente" },
    { value: "decididas", label: "Já decididas" },
  ];
  const MOTIVOS = { DOI: "DOI idêntico", ISSN_TITULO: "Mesmo veículo e título", SIMILARIDADE_TITULO: "Títulos parecidos" };
  const DECISOES = {
    PENDENTE: ["Pendente", "yellow"],
    AUTOMATICA: ["Mesclada automaticamente", "blue"],
    CONFIRMADA: ["Confirmada", "blue"],
    REJEITADA: ["Rejeitada", "soft"],
  };
  const ESTRATOS = Catalog.STRATA.filter((e) => e !== "C").concat("C");

  const state = {
    aba: Format.queryParam("aba") === "qualis" ? "qualis" : "coautorias",
    faixa: "revisao",
    correspondencias: null,
    pendentes: null,
    rascunhos: {}, // id_veiculo → { estrato, justificativa }
    carregando: false,
    processando: false,
  };

  /* ---------- Dados ---------- */
  async function carregar() {
    state.carregando = true;
    view.refresh();
    try {
      if (state.aba === "coautorias") state.correspondencias = await Api.get(`/correspondencias?faixa=${state.faixa}`);
      else state.pendentes = await Api.get("/qualis/pendentes");
    } catch (erro) {
      Feedback.toast(erro.message, "error");
    }
    state.carregando = false;
    view.refresh();
  }

  /* ---------- Coautorias ---------- */
  function autores(pub) {
    const nomes = pub.autorias.map((a) => (a.autor.docente ? a.autor.docente.nome : a.autor.nome_citacao));
    return nomes.length ? nomes.map(esc).join(", ") : `<span class="text-muted">—</span>`;
  }

  function publicacao(pub, rotulo) {
    const veiculo = pub.veiculo ? `${esc(pub.veiculo.nome)} · ${esc(pub.veiculo.issn_sigla)}` : "Sem veículo";
    return `<div class="min-w-0">
      <p class="font-mono text-[11px] font-bold uppercase tracking-[0.1em] text-muted">${rotulo}</p>
      <p class="font-semibold text-ink">${esc(pub.titulo)}</p>
      <p class="text-[13px] text-muted">${pub.ano_publicacao} · ${veiculo}${pub.doi ? ` · DOI ${esc(pub.doi)}` : ""}</p>
      <p class="mt-1 text-[13px] text-ink/80">Autores: ${autores(pub)}</p>
    </div>`;
  }

  function cartaoCorrespondencia(c) {
    const [rotulo, tom] = DECISOES[c.decisao];
    const mesclada = c.decisao === "AUTOMATICA" || c.decisao === "CONFIRMADA";
    const acoes = [
      mesclada ? "" : UI.button("✓ É a mesma publicação", { action: "decidir", data: { id: c.id_correspondencia, decisao: "CONFIRMADA" } }),
      c.decisao === "REJEITADA" ? "" : UI.button(mesclada ? "Desfazer mescla" : "✗ São diferentes", { variant: mesclada ? "danger" : "outline", action: "decidir", data: { id: c.id_correspondencia, decisao: "REJEITADA" } }),
    ].join("");
    const quem = c.usuario ? ` por ${esc(c.usuario.nome)}` : "";
    return `<li class="border border-ppgi-soft bg-white">
      <div class="flex flex-wrap items-center justify-between gap-2 border-b border-ppgi-soft px-4 py-2">
        <span class="flex flex-wrap items-center gap-2">
          <span class="font-mono text-[18px] font-extrabold text-ppgi">${formatNumber(Number(c.nota))}</span>
          <span class="text-[13px] text-muted">${esc(MOTIVOS[c.motivo] || c.motivo)}</span>
        </span>
        ${UI.tag(rotulo + (c.decidido_em ? `${quem} em ${Dados.dataBr(c.decidido_em)}` : ""), tom)}
      </div>
      <div class="grid gap-4 px-4 py-3 md:grid-cols-2">
        ${publicacao(c.publicacao, "Publicação")}
        ${publicacao(c.publicacao_candidata, "Parecida com")}
      </div>
      ${c.justificativa ? `<p class="px-4 pb-2 text-[13px] text-ink/70">Justificativa: ${esc(c.justificativa)}</p>` : ""}
      <div class="flex flex-wrap justify-end gap-2 border-t border-ppgi-soft px-4 py-2">${acoes}</div>
    </li>`;
  }

  function painelCoautorias() {
    const lista = state.correspondencias;
    const corpo = !lista
      ? UI.emptyState("Carregando…")
      : lista.length
        ? `<ul class="space-y-3">${lista.map(cartaoCorrespondencia).join("")}</ul>`
        : UI.emptyState(state.faixa === "revisao" ? "Nenhuma coautoria aguardando revisão." : "Nada nesta faixa.");
    return UI.panel({
      title: "Coautorias identificadas pelo Fuzzy Match",
      actions: UI.button(state.processando ? "⟳ Reprocessando…" : "⟳ Reprocessar a base", { variant: "outline", action: "reprocessar", disabled: state.processando }),
      body: `<div class="mb-4 overflow-x-auto">${UI.segmented({ label: "Faixa", options: FAIXAS, value: state.faixa, action: "faixa" })}</div>
        <p class="mb-4 text-[14px] text-ink/80">Notas a partir do corte de confirmação mesclam sozinhas; as da faixa de revisão esperam sua decisão. Confirmar junta as duas publicações (a pontuação passa a ser dividida entre os docentes do PPGI); rejeitar mantém separadas — inclusive desfazendo uma mescla automática.</p>
        ${corpo}`,
    });
  }

  function decidir(el) {
    const { id, decisao } = el.dataset;
    const executar = () =>
      Dados.executar(() => Api.patch(`/correspondencias/${id}`, { decisao }), {
        sucesso: decisao === "CONFIRMADA" ? "Publicações mescladas: a coautoria passa a contar." : "Mantidas como publicações diferentes.",
      }).then(carregar);
    if (decisao === "REJEITADA" && el.textContent.includes("Desfazer")) {
      return Feedback.openModal({
        title: "Desfazer a mescla?",
        body: "As duas publicações voltam a ser separadas e cada docente fica com a sua. A pontuação dos envolvidos é recalculada.",
        actions: [{ text: "Cancelar", variant: "outline" }, { text: "Desfazer mescla", variant: "danger", onClick: executar }],
      });
    }
    return executar();
  }

  async function reprocessar() {
    state.processando = true;
    view.refresh();
    const r = await Dados.executar(() => Api.post("/correspondencias/processar"), {
      sucesso: (x) => `${x.analisadas} publicações analisadas: ${x.mescladas_automaticamente} mescladas, ${x.para_revisao} para revisar.`,
    });
    state.processando = false;
    if (r) await carregar();
    else view.refresh();
  }

  /* ---------- Qualis sem estrato ---------- */
  function linhaPendente(v) {
    const r = state.rascunhos[v.id_veiculo] || { estrato: "", justificativa: "" };
    const titulos = v.publicacoes.map((p) => `<li>${p.ano_publicacao} · ${esc(p.titulo)}</li>`).join("");
    const opcoes = ESTRATOS.map((e) => `<option value="${e}"${r.estrato === e ? " selected" : ""}>${e}</option>`).join("");
    return `<li class="border border-ppgi-soft bg-white px-4 py-3">
      <div class="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p class="font-semibold text-ppgi">${esc(v.nome)}</p>
          <p class="font-mono text-[12px] text-muted">${v.tipo === "CONFERENCIA" ? "Evento" : "Periódico"} · ${esc(v.issn_sigla.startsWith("SEMISSN") ? "sem ISSN" : v.issn_sigla)} · ${Format.plural(v._count.publicacoes, "publicação", "publicações")}</p>
        </div>
      </div>
      <ul class="mt-2 list-disc pl-5 text-[13px] text-ink/75">${titulos}</ul>
      <div class="mt-3 grid gap-3 md:grid-cols-[120px_1fr_auto] md:items-end">
        <label class="block" for="estrato-${v.id_veiculo}">
          <span class="mb-1 block text-[14px] font-semibold text-ppgi">Estrato</span>
          <select id="estrato-${v.id_veiculo}" class="field-input" data-change="estrato" data-id="${v.id_veiculo}"><option value="">—</option>${opcoes}</select>
        </label>
        <label class="block" for="just-${v.id_veiculo}">
          <span class="mb-1 block text-[14px] font-semibold text-ppgi">Justificativa</span>
          <input id="just-${v.id_veiculo}" class="field-input" value="${esc(r.justificativa)}" placeholder="Ex.: classificado pelo colegiado em 10/11/2026" data-input="justificativa" data-id="${v.id_veiculo}">
        </label>
        ${UI.button("Classificar", { action: "classificar", data: { id: v.id_veiculo } })}
      </div>
    </li>`;
  }

  function painelQualis() {
    const lista = state.pendentes;
    const corpo = !lista
      ? UI.emptyState("Carregando…")
      : lista.length
        ? `<ul class="space-y-3">${lista.map(linhaPendente).join("")}</ul>`
        : UI.emptyState("Todos os veículos com publicações têm estrato. Nada a classificar.");
    return UI.panel({
      title: "Veículos sem estrato Qualis",
      actions: lista ? UI.tag(Format.plural(lista.length, "pendente", "pendentes"), lista.length ? "yellow" : "blue") : "",
      body: `<p class="mb-4 text-[14px] text-ink/80">Publicações cujo periódico ou evento não aparece em nenhuma base carregada (CAPES, PUC-RS, Scopus, Qualis Eventos) valem 0 ponto até serem classificadas aqui. A classificação manual fica registrada com a justificativa e só vale enquanto nenhuma base oficial classificar o veículo.</p>${corpo}`,
    });
  }

  async function classificar(el) {
    const id = Number(el.dataset.id);
    const r = state.rascunhos[id] || {};
    if (!r.estrato) return Feedback.toast("Escolha o estrato.", "error");
    if (!r.justificativa || r.justificativa.trim().length < 10) return Feedback.toast("Explique a classificação (mínimo de 10 caracteres).", "error");
    const ok = await Dados.executar(() => Api.post("/qualis/classificacoes", { id_veiculo: id, estrato: r.estrato, justificativa: r.justificativa.trim() }), {
      sucesso: `Veículo classificado como ${r.estrato}.`,
    });
    if (ok) {
      delete state.rascunhos[id];
      await carregar();
    }
  }

  const rascunho = (id) => (state.rascunhos[id] = state.rascunhos[id] || { estrato: "", justificativa: "" });

  /* ---------- Tela ---------- */
  function render() {
    return `<div class="space-y-5">
      <div class="overflow-x-auto">${UI.segmented({ label: "Fila de revisão", options: ABAS, value: state.aba, action: "aba" })}</div>
      ${state.aba === "coautorias" ? painelCoautorias() : painelQualis()}
    </div>`;
  }

  const view = Shell.start(
    {
      nav: "revisao",
      title: "Revisão",
      crumbs: [{ label: "Painel", href: "painel.html" }, { label: "Revisão" }],
      lead: "O que a plataforma não decide sozinha: coautorias com títulos parecidos e veículos sem classificação Qualis.",
    },
    {
      render,
      actions: {
        aba: (el) => { state.aba = el.dataset.value; carregar(); },
        faixa: (el) => { state.faixa = el.dataset.value; state.correspondencias = null; carregar(); },
        decidir,
        reprocessar,
        classificar,
      },
      onChange: { estrato: (el) => { rascunho(el.dataset.id).estrato = el.value; } },
      onInput: { justificativa: (el) => { rascunho(el.dataset.id).justificativa = el.value; } },
    },
  );

  carregar();
})(window.PPGI);
