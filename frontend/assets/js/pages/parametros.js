/*
 * pages/parametros — parâmetros da resolução vigente (RNF-BE05): pesos por estrato,
 * mínimos de credenciamento/recredenciamento, Orientação, Docência e cortes do Fuzzy Match.
 * Todos leem; só a coordenação altera (PUT /api/resolucoes/:id/parametros/:chave).
 */
(function (PPGI) {
  "use strict";

  const { Shell, UI, Api, Dados, Feedback, Format, Formulario: F, Auth } = PPGI;
  const { escapeHtml: esc } = Format;

  const ESTRATOS = ["A1", "A2", "A3", "A4", "B1", "B2", "B3", "B4", "C"];
  const GRUPOS = [
    { titulo: "Pesquisa", chaves: ["pesquisa.janela_meses", "credenciamento.pontuacao_minima", "credenciamento.periodicos_minimos", "recredenciamento.pontuacao_minima", "recredenciamento.periodicos_minimos", "recredenciamento.coautoria_discente_minima"] },
    { titulo: "Orientação", chaves: ["orientacao.janela_meses", "orientacao.minimo", "orientacao.peso_coorientacao", "orientacao.teto_permanente"] },
    { titulo: "Docência", chaves: ["docencia.janela_meses", "docencia.minimo_disciplinas", "docencia.niveis"] },
    { titulo: "Exceções e transições", chaves: ["recem_credenciado.meses", "progressao_colaborador.meses_vinculo", "colaboradores.teto_percentual"] },
    { titulo: "Fuzzy Match", chaves: ["fuzzy.corte_confirmacao", "fuzzy.corte_revisao", "fuzzy.janela_ano"] },
  ];
  const ROTULOS = {
    "pesquisa.janela_meses": "Janela da Pesquisa (meses)",
    "credenciamento.pontuacao_minima": "Credenciamento: pontuação mínima",
    "credenciamento.periodicos_minimos": "Credenciamento: periódicos mínimos",
    "recredenciamento.pontuacao_minima": "Recredenciamento: pontuação mínima",
    "recredenciamento.periodicos_minimos": "Recredenciamento: periódicos mínimos",
    "recredenciamento.coautoria_discente_minima": "Recredenciamento: produções com discente",
    "orientacao.janela_meses": "Janela (meses)",
    "orientacao.minimo": "Mínimo de orientações",
    "orientacao.peso_coorientacao": "Peso da coorientação",
    "orientacao.teto_permanente": "Teto de orientandos por Permanente",
    "docencia.janela_meses": "Janela (meses)",
    "docencia.minimo_disciplinas": "Mínimo de disciplinas",
    "docencia.niveis": "Níveis que contam",
    "recem_credenciado.meses": "Recém-credenciado até (meses)",
    "progressao_colaborador.meses_vinculo": "Progressão: meses como Colaborador",
    "colaboradores.teto_percentual": "Teto de Colaboradores (%)",
    "fuzzy.corte_confirmacao": "Junta automaticamente a partir da nota",
    "fuzzy.corte_revisao": "Vai para revisão a partir da nota",
    "fuzzy.janela_ano": "Diferença máxima de ano",
  };

  const state = { resolucao: null, parametros: null, salvando: false, versao: 0 };

  /** "0,875" ou "0.875" → 0.875; vazio ou inválido → NaN (nunca vira 0 sem querer). */
  function numero(texto) {
    const t = String(texto ?? "").trim().replace(",", ".");
    return t === "" || !/^-?\d+(\.\d+)?$/.test(t) ? NaN : Number(t);
  }
  const campoNumero = (cid, rotulo, valor, dica) =>
    F.campo(cid, rotulo, { value: String(valor).replace(".", ","), placeholder: "0,0", hint: dica }).replace('type="text"', 'type="text" inputmode="decimal"');
  const podeEditar = () => Auth.isCoordination();

  async function carregar() {
    try {
      const [resolucao] = await Api.get("/resolucoes");
      state.resolucao = resolucao || null;
      state.parametros = resolucao ? await Api.get(`/resolucoes/${resolucao.id_resolucao}/parametros`) : {};
    } catch (erro) {
      Feedback.toast(erro.message, "error");
    }
    view.refresh();
  }

  /* ---------- Campos ---------- */
  const id = (chave, sufixo = "") => `p-${chave.replace(/\./g, "-")}${sufixo}`;

  function campoDe(chave) {
    const p = state.parametros[chave];
    if (!p) return "";
    const v = p.valor;
    const rotulo = ROTULOS[chave] || chave;
    if (chave.endsWith("periodicos_minimos")) {
      return `<div class="grid grid-cols-[1fr_110px] gap-2">
        ${F.campo(id(chave, "-q"), `${rotulo} (quantidade)`, { type: "number", value: v.quantidade, min: 0 })}
        ${F.escolha(id(chave, "-e"), "Estrato mínimo", ESTRATOS.map((e) => ({ value: e, label: e })), { value: v.estrato_minimo })}
      </div>`;
    }
    if (chave === "docencia.niveis") {
      return `<div><span class="mb-1 block text-[14px] font-semibold text-ppgi">${esc(rotulo)}</span>
        <div class="flex flex-wrap gap-4">${F.caixa(id(chave, "-POS_GRADUACAO"), "Pós-graduação (PPGI)", v.includes("POS_GRADUACAO"))}${F.caixa(id(chave, "-GRADUACAO"), "Graduação", v.includes("GRADUACAO"))}</div></div>`;
    }
    return campoNumero(id(chave), rotulo, v, p.descricao || "");
  }

  function lerValor(form, chave) {
    const el = (s) => form.elements[id(chave, s)];
    if (chave.endsWith("periodicos_minimos")) return { quantidade: Number(el("-q").value), estrato_minimo: el("-e").value };
    if (chave === "docencia.niveis") return ["POS_GRADUACAO", "GRADUACAO"].filter((n) => el(`-${n}`).checked);
    return numero(el("").value);
  }

  const pesoId = (e) => `peso-${e}`;

  /* ---------- Salvar ---------- */
  async function salvar(form) {
    if (!podeEditar()) return Feedback.toast("Só a coordenação pode alterar os parâmetros.", "error");
    const mudancas = [];
    const pesosAtuais = state.parametros.pesos_estrato.valor;
    const pesos = Object.fromEntries(ESTRATOS.map((e) => [e, numero(form.elements[pesoId(e)].value)]));
    const invalidos = ESTRATOS.filter((e) => Number.isNaN(pesos[e])).map((e) => `peso ${e}`);
    if (JSON.stringify(pesos) !== JSON.stringify(Object.fromEntries(ESTRATOS.map((e) => [e, Number(pesosAtuais[e])])))) mudancas.push(["pesos_estrato", pesos]);
    for (const g of GRUPOS) {
      for (const chave of g.chaves) {
        if (!state.parametros[chave]) continue;
        const novo = lerValor(form, chave);
        const temNaN = typeof novo === "number" ? Number.isNaN(novo) : novo && typeof novo === "object" && !Array.isArray(novo) && Number.isNaN(novo.quantidade);
        if (temNaN) invalidos.push(ROTULOS[chave] || chave);
        if (JSON.stringify(novo) !== JSON.stringify(state.parametros[chave].valor)) mudancas.push([chave, novo]);
      }
    }
    if (invalidos.length) return Feedback.toast(`Valor vazio ou inválido em: ${invalidos.join(", ")}. Use números (ex.: 0,875).`, "error");
    if (!mudancas.length) return Feedback.toast("Nada foi alterado.");

    // Cortes do Fuzzy Match: o de revisão vai antes ou depois, para nunca ficar acima do de confirmação no meio.
    mudancas.sort(([a], [b]) => (a === "fuzzy.corte_revisao" ? -1 : 0) - (b === "fuzzy.corte_revisao" ? -1 : 0));
    const confirmacao = mudancas.find(([k]) => k === "fuzzy.corte_confirmacao");
    if (confirmacao && confirmacao[1] > Number(state.parametros["fuzzy.corte_confirmacao"].valor)) mudancas.reverse();

    state.salvando = true;
    view.refresh();
    const idRes = state.resolucao.id_resolucao;
    let feitos = 0;
    try {
      for (const [chave, valor] of mudancas) {
        await Api.put(`/resolucoes/${idRes}/parametros/${chave}`, { valor });
        feitos++;
      }
      Feedback.toast(`${Format.plural(feitos, "parâmetro atualizado", "parâmetros atualizados")}. Os cálculos já usam os novos valores.`);
      state.versao++;
      if (mudancas.some(([k]) => k.startsWith("fuzzy."))) {
        Feedback.openModal({
          title: "Reprocessar o Fuzzy Match?",
          body: "Os cortes mudaram. Reprocessar compara de novo toda a base com os novos cortes (as decisões já tomadas são mantidas).",
          actions: [{ text: "Agora não", variant: "outline" }, { text: "Reprocessar", onClick: reprocessar }],
        });
      }
    } catch (erro) {
      Feedback.toast(`${feitos ? `${feitos} salvo(s); ` : ""}${F.mensagemDeErro(erro)}`, "error");
    }
    state.salvando = false;
    await Promise.all([carregar(), Dados.recarregar().catch(() => {})]);
  }

  async function reprocessar() {
    await Dados.executar(() => Api.post("/correspondencias/processar"), {
      sucesso: (r) => `${r.analisadas} publicações analisadas: ${r.mescladas_automaticamente} juntadas, ${r.para_revisao} para revisar.`,
    });
  }

  /* ---------- Tela ---------- */
  function render() {
    if (!state.parametros) return UI.emptyState("Carregando…");
    if (!state.resolucao) return UI.emptyState("Nenhuma resolução cadastrada. Rode “npm run preparar” na pasta backend.");
    const editar = podeEditar();
    const pesos = state.parametros.pesos_estrato ? state.parametros.pesos_estrato.valor : {};
    const painelPesos = UI.panel({
      title: "Pontos por estrato",
      body: `<div class="grid grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-9">${ESTRATOS.map((e) => campoNumero(pesoId(e), e, pesos[e])).join("")}</div>
        <p class="mt-2 text-[12px] text-muted">Use ponto ou vírgula para decimais (ex.: 0,875).</p>`,
    });
    const grupos = GRUPOS.map((g) => UI.panel({ title: g.titulo, body: `<div class="space-y-3">${g.chaves.map(campoDe).join("")}</div>` })).join("");
    return `${editar ? "" : `<div class="mb-5">${UI.alert({ tone: "info", title: "Somente leitura", body: "Só a coordenação pode alterar os parâmetros." })}</div>`}
      <form data-submit="salvar" data-preservar="parametros-${state.versao}" novalidate>
        <fieldset ${editar ? "" : "disabled"} class="space-y-5">
          ${painelPesos}
          <div class="grid gap-5 lg:grid-cols-2">${grupos}</div>
          ${editar ? `<div class="flex flex-wrap gap-2">${UI.button(state.salvando ? "Salvando…" : "Salvar alterações", { type: "submit", disabled: state.salvando })}${UI.button("Reprocessar Fuzzy Match", { variant: "outline", action: "reprocessar" })}</div>` : ""}
        </fieldset>
      </form>`;
  }

  const view = Shell.start(
    () => ({
      nav: "parametros",
      title: "Parâmetros da resolução",
      crumbs: [{ label: "Painel", href: "painel.html" }, { label: "Parâmetros" }],
      lead: state.resolucao ? `Valores usados no cálculo, conforme a Resolução nº ${esc(state.resolucao.numero_ano)}. Mudanças valem na hora para os cálculos ao vivo e para quem recalcular um processo.` : "",
    }),
    { render, actions: { reprocessar }, onSubmit: { salvar } },
  );

  carregar();
})(window.PPGI);
