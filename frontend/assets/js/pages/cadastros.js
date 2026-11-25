/*
 * pages/cadastros — cadastro e edição do que alimenta o barema:
 *   Docentes · Discentes (orientador e coorientações) · Membros externos ·
 *   Disciplinas e turmas (critério de Docência) · Publicações manuais (eventos e coautores
 *   que o CSV do QLattes não traz).
 *
 * Usa as rotas /api/docentes, /api/discentes, /api/externos, /api/disciplinas, /api/turmas,
 * /api/publicacoes e /api/autores. Atalho por URL: cadastros.html?aba=discentes
 */
(function (PPGI) {
  "use strict";

  const { Shell, UI, Api, Dados, Feedback, Format, Formulario: F, Auth } = PPGI;
  const { escapeHtml: esc } = Format;

  const ABAS = [
    { value: "docentes", label: "Docentes" },
    { value: "discentes", label: "Discentes" },
    { value: "externos", label: "Membros externos" },
    { value: "disciplinas", label: "Disciplinas e turmas" },
    { value: "publicacoes", label: "Publicação manual" },
  ];
  const VINCULOS = [{ value: "PERMANENTE", label: "Permanente" }, { value: "COLABORADOR", label: "Colaborador" }];
  const SITUACOES = [
    { value: "EFETIVO", label: "Efetivo" },
    { value: "SUBSTITUTO", label: "Substituto" },
    { value: "VISITANTE", label: "Visitante" },
    { value: "APOSENTADO", label: "Aposentado" },
  ];
  const NIVEIS = [{ value: "POS_GRADUACAO", label: "Pós-graduação (PPGI)" }, { value: "GRADUACAO", label: "Graduação" }];
  const ANO = new Date().getFullYear();
  const dataIso = (d) => (d ? String(d).slice(0, 10) : "");

  const pedida = Format.queryParam("aba");
  const state = {
    aba: ABAS.some((a) => a.value === pedida) ? pedida : "docentes",
    listas: { docentes: null, discentes: null, externos: null, disciplinas: null, turmas: null },
    editando: null, // registro em edição na aba atual (null = novo)
    busca: "",
    pub: { autores: [], resultados: [], termo: "" },
    versao: 0, // muda depois de salvar/editar: o formulário volta a ser montado do zero
  };

  /** Chave do data-preservar: o que foi digitado se mantém até salvar ou trocar o registro. */
  const chaveForm = (nome) => `${nome}-${state.versao}`;

  /* ---------- Carregamento ---------- */
  const ROTAS = { docentes: "/docentes", discentes: "/discentes", externos: "/externos", disciplinas: "/disciplinas", turmas: "/turmas" };

  async function carregar(...nomes) {
    try {
      const respostas = await Promise.all(nomes.map((n) => Api.get(ROTAS[n])));
      nomes.forEach((n, i) => (state.listas[n] = respostas[i]));
    } catch (erro) {
      Feedback.toast(erro.message, "error");
    }
    view.refresh();
  }

  function carregarAba() {
    const precisa = {
      docentes: ["docentes"],
      discentes: ["discentes", "docentes", "externos"],
      externos: ["externos"],
      disciplinas: ["disciplinas", "turmas", "docentes"],
      publicacoes: [],
    }[state.aba];
    return precisa.length ? carregar(...precisa) : view.refresh();
  }

  /** Chama a API, avisa e recarrega a aba (e os dados das outras telas). */
  async function salvar(acao, mensagem) {
    try {
      const r = await acao();
      Feedback.toast(mensagem);
      state.editando = null;
      state.versao++;
      await Promise.all([carregarAba(), Dados.recarregar().catch(() => {})]);
      return r;
    } catch (erro) {
      Feedback.toast(F.mensagemDeErro(erro), "error");
      return null;
    }
  }

  function confirmarExclusao(titulo, corpo, acao, mensagem) {
    Feedback.openModal({
      title: titulo,
      body: corpo,
      actions: [{ text: "Cancelar", variant: "outline" }, { text: "Excluir", variant: "danger", onClick: () => salvar(acao, mensagem) }],
    });
  }

  /* ---------- Peças comuns ---------- */
  const carregando = () => UI.emptyState("Carregando…");
  const filtrar = (lista, campos) => {
    const q = Format.normalize(state.busca.trim());
    return !q ? lista : lista.filter((r) => campos.some((c) => Format.normalize(String(r[c] ?? "")).includes(q)));
  };
  const botoesLinha = (id, rotuloExcluir) =>
    `<span class="flex flex-wrap gap-2">${UI.button("Editar", { variant: "outline", action: "editar", data: { id } })}${UI.button("Excluir", { variant: "danger", action: "excluir", data: { id }, label: rotuloExcluir })}</span>`;
  const rodapeFormulario = (textoSalvar) =>
    `<div class="flex flex-wrap gap-2 pt-1">${UI.button(textoSalvar, { type: "submit" })}${state.editando ? UI.button("Cancelar edição", { variant: "outline", action: "novo" }) : ""}</div>`;
  const busca = (placeholder) => `<div class="mb-3">${UI.searchField({ id: "busca", label: "Buscar", placeholder, value: state.busca, action: "buscar" })}</div>`;

  function layout(lista, formulario) {
    return `<div class="grid gap-5 xl:grid-cols-[1fr_380px]"><div class="min-w-0">${lista}</div><div>${formulario}</div></div>`;
  }

  /* ---------- Docentes ---------- */
  function abaDocentes() {
    const lista = state.listas.docentes;
    const linhas = lista
      ? filtrar(lista, ["nome", "email", "matricula"]).map((d) => [
          `<span class="font-semibold text-ppgi">${esc(d.nome)}</span><span class="block text-[12px] text-muted">${esc(d.email)} · ${esc(d.matricula)}</span>`,
          esc(d.departamento || "—"),
          d.vinculo ? UI.tag(d.vinculo === "PERMANENTE" ? "Permanente" : "Colaborador", "yellow") : `<span class="text-[13px] text-muted">—</span>`,
          d.id_lattes ? `<span class="font-mono text-[12px]">${esc(d.id_lattes)}</span>` : `<span class="text-[13px] text-danger">sem ID</span>`,
          botoesLinha(d.id_docente, `Excluir ${d.nome}`),
        ])
      : null;
    const tabela = !lista
      ? carregando()
      : linhas.length
        ? UI.table({ head: ["Docente", "Departamento", "PPGI", "ID Lattes", ""], rows: linhas, caption: "Docentes cadastrados" })
        : UI.emptyState("Nenhum docente encontrado.");

    const d = state.editando || {};
    const form = `<form data-submit="salvar-docente" data-preservar="${chaveForm("salvar-docente")}" class="space-y-3" novalidate>
      ${F.campo("nome", "Nome", { value: d.nome, required: true })}
      ${F.campo("email", "E-mail", { type: "email", value: d.email, required: true, placeholder: "nome@ic.ufal.br" })}
      <div class="grid gap-3 sm:grid-cols-2">
        ${F.campo("matricula", "Matrícula (SIAPE)", { value: d.matricula, required: true })}
        ${F.escolha("situacao_funcional", "Situação", SITUACOES, { value: d.situacao_funcional || "EFETIVO" })}
      </div>
      ${F.campo("departamento", "Departamento", { value: d.departamento, placeholder: "Ciência da Computação" })}
      <div class="grid gap-3 sm:grid-cols-2">
        ${F.escolha("vinculo", "Vínculo com o PPGI", VINCULOS, { value: d.vinculo, placeholder: "Não vinculado" })}
        ${F.campo("data_vinculo", "Início do vínculo", { type: "date", value: dataIso(d.data_vinculo), hint: "Vazio = hoje, ao vincular." })}
      </div>
      ${F.campo("id_lattes", "ID Lattes (16 dígitos)", { value: d.id_lattes, placeholder: "1234567890123456", hint: "Está no fim do link do currículo; liga o CSV do QLattes ao docente." })}
      ${F.campo("url_lattes", "Link do Currículo Lattes", { type: "url", value: d.url_lattes, placeholder: "http://lattes.cnpq.br/1234567890123456" })}
      ${rodapeFormulario(state.editando ? "Salvar alterações" : "Cadastrar docente")}
    </form>`;
    return layout(
      UI.panel({ title: "Docentes", actions: UI.button("+ Novo docente", { variant: "outline", action: "novo" }), body: busca("Nome, e-mail ou matrícula…") + tabela }),
      UI.panel({ title: state.editando ? `Editar · ${state.editando.nome}` : "Novo docente", body: form }),
    );
  }

  function salvarDocente(form) {
    const v = F.ler(form);
    // Sem vínculo, não há data de início; com vínculo e sem data, a API usa hoje.
    if (!v.vinculo) v.data_vinculo = null;
    else if (!v.data_vinculo) delete v.data_vinculo;
    if (state.editando) {
      return salvar(() => Api.patch(`/docentes/${state.editando.id_docente}`, v), "Docente atualizado.");
    }
    for (const k of ["url_lattes", "id_lattes"]) if (v[k] === null) delete v[k];
    return salvar(() => Api.post("/docentes", v), "Docente cadastrado (e incluído como autor).");
  }

  /* ---------- Discentes ---------- */
  const nomeDocente = (id) => ((state.listas.docentes || []).find((d) => d.id_docente === id) || {}).nome || "—";

  function abaDiscentes() {
    const lista = state.listas.discentes;
    const linhas = lista
      ? filtrar(lista, ["nome", "matricula"]).map((d) => [
          `<span class="font-semibold text-ppgi">${esc(d.nome)}</span><span class="block text-[12px] text-muted">${esc(d.matricula)} · ingresso ${d.ano_ingresso}</span>`,
          esc(d.orientador ? d.orientador.nome : "—"),
          d.coorientacoes.length ? d.coorientacoes.map((c) => esc(c.docente ? c.docente.nome : c.externo.nome)).join(", ") : "—",
          d.data_conclusao ? UI.tag(`Defendeu em ${Dados.dataBr(d.data_conclusao)}`, "soft") : UI.tag("Em andamento", "blue"),
          botoesLinha(d.id_discente, `Excluir ${d.nome}`),
        ])
      : null;
    const tabela = !lista
      ? carregando()
      : linhas.length
        ? UI.table({ head: ["Discente", "Orientador", "Coorientação", "Situação", ""], rows: linhas, caption: "Discentes do PPGI" })
        : UI.emptyState("Nenhum discente encontrado.");

    const permanentes = (state.listas.docentes || []).filter((d) => d.vinculo === "PERMANENTE").map((d) => ({ value: d.id_docente, label: d.nome }));
    const d = state.editando || {};
    let coorientacao = "";
    if (state.editando) {
      const atuais = d.coorientacoes
        .map((c) => `<li class="flex items-center justify-between gap-2 border-b border-ppgi-soft py-1.5 last:border-0">
            <span>${esc(c.docente ? c.docente.nome : `${c.externo.nome} (externo)`)}</span>
            ${UI.button("Retirar", { variant: "ghost", action: "retirar-coorientacao", data: { id: c.id_coorientacao } })}
          </li>`)
        .join("");
      const opcoes = (state.listas.docentes || [])
        .filter((x) => x.id_docente !== d.id_orientador)
        .map((x) => ({ value: `d${x.id_docente}`, label: `${x.nome}${x.vinculo ? "" : " (sem vínculo)"}` }))
        .concat((state.listas.externos || []).map((x) => ({ value: `e${x.id_externo}`, label: `${x.nome} (externo${x.inst_origem ? ` · ${x.inst_origem}` : ""})` })));
      coorientacao = `<div class="mt-5 border-t border-ppgi-soft pt-4">
        ${UI.sectionTitle("Coorientação (vale 0,5)")}
        ${atuais ? `<ul class="mb-3 text-[14px]">${atuais}</ul>` : `<p class="mb-3 text-[13px] text-muted">Sem coorientadores.</p>`}
        <form data-submit="adicionar-coorientacao" data-preservar="${chaveForm("adicionar-coorientacao")}" class="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
          ${F.escolha("coorientador", "Adicionar coorientador", opcoes, { placeholder: "Escolha…", required: true })}
          ${UI.button("Adicionar", { type: "submit", variant: "outline" })}
        </form>
      </div>`;
    }
    const form = `<form data-submit="salvar-discente" data-preservar="${chaveForm("salvar-discente")}" class="space-y-3" novalidate>
      ${F.campo("nome", "Nome", { value: d.nome, required: true })}
      <div class="grid gap-3 sm:grid-cols-2">
        ${F.campo("matricula", "Matrícula", { value: d.matricula, required: true })}
        ${F.campo("ano_ingresso", "Ano de ingresso", { type: "number", value: d.ano_ingresso || ANO, min: 1980, max: 2100, required: true })}
      </div>
      ${F.escolha("id_orientador", "Orientador (só Permanente)", permanentes, { value: d.id_orientador, placeholder: "Sem orientador" })}
      ${F.campo("data_conclusao", "Data da defesa", { type: "date", value: dataIso(d.data_conclusao), hint: "Vazio = orientação em andamento." })}
      ${rodapeFormulario(state.editando ? "Salvar alterações" : "Cadastrar discente")}
    </form>${coorientacao}`;
    return layout(
      UI.panel({ title: "Discentes", actions: UI.button("+ Novo discente", { variant: "outline", action: "novo" }), body: busca("Nome ou matrícula…") + tabela }),
      UI.panel({ title: state.editando ? `Editar · ${state.editando.nome}` : "Novo discente", body: form }),
    );
  }

  function salvarDiscente(form) {
    const v = F.ler(form);
    v.ano_ingresso = Number(v.ano_ingresso);
    v.id_orientador = v.id_orientador ? Number(v.id_orientador) : null;
    if (state.editando) return salvar(() => Api.patch(`/discentes/${state.editando.id_discente}`, v), "Discente atualizado.");
    if (!v.data_conclusao) delete v.data_conclusao;
    return salvar(() => Api.post("/discentes", v), "Discente cadastrado (e incluído como autor).");
  }

  async function adicionarCoorientacao(form) {
    const escolhido = F.ler(form).coorientador;
    if (!escolhido) return Feedback.toast("Escolha o coorientador.", "error");
    const corpo = escolhido[0] === "d" ? { id_docente: Number(escolhido.slice(1)) } : { id_externo: Number(escolhido.slice(1)) };
    const id = state.editando.id_discente;
    const ok = await salvar(() => Api.post(`/discentes/${id}/coorientacoes`, corpo), "Coorientação registrada.");
    if (ok) reabrir("discentes", id, "id_discente");
  }

  async function retirarCoorientacao(el) {
    const id = state.editando.id_discente;
    const ok = await salvar(() => Api.del(`/discentes/${id}/coorientacoes/${el.dataset.id}`).then(() => true), "Coorientação retirada.");
    if (ok) reabrir("discentes", id, "id_discente");
  }

  /** Volta a editar o mesmo registro depois de recarregar a lista. */
  function reabrir(lista, id, chave) {
    state.editando = (state.listas[lista] || []).find((r) => r[chave] === id) || null;
    state.versao++;
    view.refresh();
  }

  /* ---------- Externos ---------- */
  function abaExternos() {
    const lista = state.listas.externos;
    const linhas = lista
      ? filtrar(lista, ["nome", "inst_origem"]).map((x) => [`<span class="font-semibold text-ppgi">${esc(x.nome)}</span>`, esc(x.inst_origem || "—"), botoesLinha(x.id_externo, `Excluir ${x.nome}`)])
      : null;
    const tabela = !lista
      ? carregando()
      : linhas.length
        ? UI.table({ head: ["Nome", "Instituição", ""], rows: linhas, caption: "Membros externos" })
        : UI.emptyState("Nenhum membro externo encontrado.");
    const x = state.editando || {};
    const form = `<form data-submit="salvar-externo" data-preservar="${chaveForm("salvar-externo")}" class="space-y-3" novalidate>
      ${F.campo("nome", "Nome", { value: x.nome, required: true })}
      ${F.campo("inst_origem", "Instituição de origem", { value: x.inst_origem, placeholder: "UFPE" })}
      ${rodapeFormulario(state.editando ? "Salvar alterações" : "Cadastrar membro externo")}
    </form>
    <p class="mt-3 text-[12px] text-muted">Coorientadores e coautores de fora do PPGI. Coautores importados do OpenAlex que não estavam cadastrados aparecem aqui; se algum for discente do PPGI, cadastre-o como discente.</p>`;
    return layout(
      UI.panel({ title: "Membros externos", actions: UI.button("+ Novo", { variant: "outline", action: "novo" }), body: busca("Nome ou instituição…") + tabela }),
      UI.panel({ title: state.editando ? `Editar · ${state.editando.nome}` : "Novo membro externo", body: form }),
    );
  }

  function salvarExterno(form) {
    const v = F.ler(form);
    if (state.editando) return salvar(() => Api.patch(`/externos/${state.editando.id_externo}`, v), "Membro externo atualizado.");
    return salvar(() => Api.post("/externos", v), "Membro externo cadastrado.");
  }

  /* ---------- Disciplinas e turmas ---------- */
  function abaDisciplinas() {
    const lista = state.listas.disciplinas;
    const linhas = lista
      ? filtrar(lista, ["codigo", "nome"]).map((x) => [
          `<span class="font-mono text-[13px]">${esc(x.codigo)}</span>`,
          `${esc(x.nome)}${x.estudo_dirigido ? ` ${UI.tag("Estudo Dirigido · não conta", "soft")}` : ""}`,
          x.nivel === "POS_GRADUACAO" ? "Pós" : "Graduação",
          String(x._count.turmas),
          botoesLinha(x.id_disciplina, `Excluir ${x.nome}`),
        ])
      : null;
    const tabela = !lista
      ? carregando()
      : linhas.length
        ? UI.table({ head: ["Código", "Disciplina", "Nível", "Turmas", ""], rows: linhas, caption: "Disciplinas" })
        : UI.emptyState("Nenhuma disciplina cadastrada.");

    const turmas = state.listas.turmas;
    const linhasTurmas = (turmas || []).map((t) => [
      `${t.ano}.${t.semestre}`,
      `<span class="font-mono text-[12px]">${esc(t.disciplina.codigo)}</span> ${esc(t.disciplina.nome)}`,
      esc(t.docente.nome),
      UI.button("Excluir", { variant: "ghost", action: "excluir-turma", data: { id: t.id_turma } }),
    ]);
    const painelTurmas = UI.panel({
      title: "Turmas (disciplinas ministradas)",
      body: `<form data-submit="salvar-turma" data-preservar="${chaveForm("salvar-turma")}" class="mb-4 grid gap-3 md:grid-cols-[1fr_1fr_100px_90px_auto] md:items-end" novalidate>
          ${F.escolha("id_disciplina", "Disciplina", (lista || []).map((x) => ({ value: x.id_disciplina, label: `${x.codigo} · ${x.nome}` })), { placeholder: "Escolha…", required: true })}
          ${F.escolha("id_docente", "Docente", (state.listas.docentes || []).map((x) => ({ value: x.id_docente, label: x.nome })), { placeholder: "Escolha…", required: true })}
          ${F.campo("ano", "Ano", { type: "number", value: ANO, min: 1980, max: 2100, required: true })}
          ${F.escolha("semestre", "Semestre", [{ value: 1, label: "1º" }, { value: 2, label: "2º" }], { value: 1 })}
          ${UI.button("Adicionar", { type: "submit" })}
        </form>
        ${!turmas ? carregando() : linhasTurmas.length ? UI.table({ head: ["Semestre", "Disciplina", "Docente", ""], rows: linhasTurmas, caption: "Turmas" }) : UI.emptyState("Nenhuma turma registrada.")}`,
    });

    const x = state.editando || {};
    const form = `<form data-submit="salvar-disciplina" data-preservar="${chaveForm("salvar-disciplina")}" class="space-y-3" novalidate>
      ${F.campo("codigo", "Código", { value: x.codigo, required: true, placeholder: "PPGI101" })}
      ${F.campo("nome", "Nome", { value: x.nome, required: true })}
      ${F.escolha("nivel", "Nível", NIVEIS, { value: x.nivel || "POS_GRADUACAO" })}
      ${F.caixa("estudo_dirigido", "É Estudo Dirigido (não conta para a Docência)", x.estudo_dirigido)}
      ${rodapeFormulario(state.editando ? "Salvar alterações" : "Cadastrar disciplina")}
    </form>
    <p class="mt-3 text-[12px] text-muted">Disciplinas com “Estudo Dirigido” no nome são marcadas automaticamente.</p>`;
    return `<div class="space-y-5">${layout(
      UI.panel({ title: "Disciplinas", actions: UI.button("+ Nova disciplina", { variant: "outline", action: "novo" }), body: busca("Código ou nome…") + tabela }),
      UI.panel({ title: state.editando ? `Editar · ${state.editando.codigo}` : "Nova disciplina", body: form }),
    )}${painelTurmas}</div>`;
  }

  function salvarDisciplina(form) {
    const v = F.ler(form);
    if (state.editando) return salvar(() => Api.patch(`/disciplinas/${state.editando.id_disciplina}`, v), "Disciplina atualizada.");
    if (!v.estudo_dirigido) delete v.estudo_dirigido; // deixa a API marcar pelo nome
    return salvar(() => Api.post("/disciplinas", v), "Disciplina cadastrada.");
  }

  function salvarTurma(form) {
    const v = F.ler(form);
    if (!v.id_disciplina || !v.id_docente) return Feedback.toast("Escolha a disciplina e o docente.", "error");
    const corpo = { id_disciplina: Number(v.id_disciplina), id_docente: Number(v.id_docente), ano: Number(v.ano), semestre: Number(v.semestre) };
    return salvar(() => Api.post("/turmas", corpo), "Turma registrada.");
  }

  /* ---------- Publicação manual ---------- */
  function abaPublicacoes() {
    const p = state.pub;
    const escolhidos = p.autores.length
      ? `<ol class="space-y-1.5">${p.autores
          .map((a, i) => `<li class="flex items-center justify-between gap-2 border border-ppgi-soft bg-white px-3 py-1.5 text-[14px]">
              <span><span class="font-mono text-[12px] text-muted">${i + 1}.</span> ${esc(a.nome)} <span class="text-[12px] text-muted">· ${esc(a.tipo.toLowerCase())}</span></span>
              ${UI.button("Retirar", { variant: "ghost", action: "retirar-autor", data: { id: a.id_autor } })}
            </li>`)
          .join("")}</ol>`
      : `<p class="text-[13px] text-muted">Nenhum autor escolhido ainda.</p>`;
    const resultados = p.resultados
      .filter((r) => !p.autores.some((a) => a.id_autor === r.id_autor))
      .map((r) => `<li>${UI.button(`+ ${esc(r.nome)} · ${esc(r.tipo.toLowerCase())}${r.detalhe ? ` · ${esc(r.detalhe)}` : ""}`, { variant: "ghost", action: "adicionar-autor", data: { id: r.id_autor } })}</li>`)
      .join("");

    const form = `<form data-submit="salvar-publicacao" data-preservar="${chaveForm("salvar-publicacao")}" class="space-y-3" novalidate>
      ${F.campo("titulo", "Título", { required: true })}
      <div class="grid gap-3 sm:grid-cols-2">
        ${F.campo("ano", "Ano", { type: "number", value: ANO - 1, min: 1950, max: 2100, required: true })}
        ${F.campo("doi", "DOI (opcional)", { placeholder: "10.5753/sbbd.2024.123" })}
      </div>
      <div class="grid gap-3 sm:grid-cols-[180px_1fr]">
        ${F.escolha("tipo", "Tipo de veículo", [{ value: "CONFERENCIA", label: "Evento" }, { value: "PERIODICO", label: "Periódico" }], { value: "CONFERENCIA" })}
        ${F.campo("chave", "Sigla do evento ou ISSN", { placeholder: "SBBD  ou  1234-5678", hint: "Evento: a sigla casa com a tabela Qualis Eventos. Periódico: o ISSN casa com CAPES/PUC-RS/Scopus." })}
      </div>
      ${F.campo("nome_veiculo", "Nome do evento ou periódico", { required: true, placeholder: "Simpósio Brasileiro de Banco de Dados" })}
      <div>
        <span class="mb-1 block text-[14px] font-semibold text-ppgi">Autores, na ordem <span class="text-danger" aria-hidden="true">*</span></span>
        ${escolhidos}
      </div>
      ${UI.button("Cadastrar publicação", { type: "submit" })}
    </form>`;
    const buscaAutores = UI.panel({
      title: "Escolher autores",
      body: `${UI.searchField({ id: "busca-autor", label: "Buscar docente, discente ou externo", placeholder: "Digite ao menos 2 letras…", value: p.termo, action: "buscar-autor" })}
        <ul class="mt-3 space-y-1">${resultados || `<li class="text-[13px] text-muted">${p.termo.length >= 2 ? "Nenhum autor encontrado. Cadastre-o nas abas Discentes ou Membros externos." : ""}</li>`}</ul>`,
    });
    return layout(
      UI.panel({
        title: "Publicação manual",
        body: `<p class="mb-4 text-[14px] text-ink/80">Para o que o CSV do QLattes não traz: artigos em <strong>eventos</strong> e <strong>coautores discentes ou externos</strong>. A publicação passa pelo Fuzzy Match; se o DOI já existir, ela é juntada à existente.</p>${form}`,
      }),
      buscaAutores,
    );
  }

  let temporizadorBusca = null;
  function buscarAutor(el) {
    state.pub.termo = el.value;
    clearTimeout(temporizadorBusca);
    if (el.value.trim().length < 2) {
      state.pub.resultados = [];
      return view.refresh();
    }
    temporizadorBusca = setTimeout(async () => {
      try {
        state.pub.resultados = await Api.get(`/autores?busca=${encodeURIComponent(el.value.trim())}`);
      } catch (erro) {
        Feedback.toast(erro.message, "error");
      }
      view.refresh();
    }, 250);
  }

  async function salvarPublicacao(form) {
    const v = F.ler(form);
    if (!state.pub.autores.length) return Feedback.toast("Escolha ao menos um autor.", "error");
    const veiculo = v.tipo === "CONFERENCIA" ? { tipo: "CONFERENCIA", sigla: v.chave || "", nome: v.nome_veiculo || "" } : { tipo: "PERIODICO", nome: v.nome_veiculo || "", ...(v.chave ? { issn: v.chave } : {}) };
    if (v.tipo === "CONFERENCIA" && !v.chave) return Feedback.toast("Informe a sigla do evento.", "error");
    const corpo = { titulo: v.titulo, ano: Number(v.ano), ...(v.doi ? { doi: v.doi } : {}), veiculo, autores: state.pub.autores.map((a) => a.id_autor) };
    const r = await salvar(() => Api.post("/publicacoes", corpo), "Publicação cadastrada.");
    if (r) {
      const juntou = r.correspondencias && r.correspondencias.mescladas_automaticamente;
      if (juntou) Feedback.toast("Ela já existia: foi juntada à publicação existente.");
      state.pub = { autores: [], resultados: [], termo: "" };
      view.refresh();
    }
  }

  /* ---------- Ações por aba ---------- */
  const CHAVES = { docentes: "id_docente", discentes: "id_discente", externos: "id_externo", disciplinas: "id_disciplina" };
  const ENDPOINT = { docentes: "/docentes", discentes: "/discentes", externos: "/externos", disciplinas: "/disciplinas" };

  function editar(el) {
    const chave = CHAVES[state.aba];
    state.editando = (state.listas[state.aba] || []).find((r) => String(r[chave]) === el.dataset.id) || null;
    state.versao++;
    view.refresh();
    const primeiro = document.querySelector("#conteudo form input, #conteudo form select");
    if (primeiro) primeiro.focus();
  }

  function excluir(el) {
    const chave = CHAVES[state.aba];
    const registro = (state.listas[state.aba] || []).find((r) => String(r[chave]) === el.dataset.id);
    if (!registro) return;
    const nome = registro.nome;
    const aviso =
      state.aba === "docentes"
        ? Auth.isCoordination()
          ? "Só é possível excluir quem não tem avaliações; para quem saiu do programa, prefira desvincular na tela Docentes."
          : "Só a coordenação pode excluir docentes."
        : "A exclusão não pode ser desfeita.";
    confirmarExclusao(`Excluir ${nome}?`, `<p>${esc(aviso)}</p>`, () => Api.del(`${ENDPOINT[state.aba]}/${el.dataset.id}`).then(() => true), `${nome} excluído(a).`);
  }

  function render() {
    const conteudo = { docentes: abaDocentes, discentes: abaDiscentes, externos: abaExternos, disciplinas: abaDisciplinas, publicacoes: abaPublicacoes }[state.aba]();
    return `<div class="space-y-5">
      <div class="overflow-x-auto">${UI.segmented({ label: "Cadastro", options: ABAS, value: state.aba, action: "aba" })}</div>
      ${conteudo}
    </div>`;
  }

  const view = Shell.start(
    {
      nav: "cadastros",
      title: "Cadastros",
      crumbs: [{ label: "Painel", href: "painel.html" }, { label: "Cadastros" }],
      lead: "Docentes, discentes, membros externos, disciplinas e publicações que entram no cálculo do barema. Campos com * são obrigatórios.",
    },
    {
      render,
      actions: {
        aba: (el) => { state.aba = el.dataset.value; state.editando = null; state.busca = ""; carregarAba(); },
        novo: () => { state.editando = null; state.versao++; view.refresh(); },
        editar,
        excluir,
        "retirar-coorientacao": retirarCoorientacao,
        "excluir-turma": (el) => confirmarExclusao("Excluir a turma?", "<p>A disciplina deixa de contar para a Docência do docente nesse semestre.</p>", () => Api.del(`/turmas/${el.dataset.id}`).then(() => true), "Turma excluída."),
        "adicionar-autor": (el) => {
          const autor = state.pub.resultados.find((r) => String(r.id_autor) === el.dataset.id);
          if (autor) state.pub.autores.push(autor);
          view.refresh();
        },
        "retirar-autor": (el) => { state.pub.autores = state.pub.autores.filter((a) => String(a.id_autor) !== el.dataset.id); view.refresh(); },
      },
      onInput: {
        buscar: (el) => { state.busca = el.value; view.refresh(); },
        "buscar-autor": buscarAutor,
      },
      onSubmit: {
        "salvar-docente": salvarDocente,
        "salvar-discente": salvarDiscente,
        "adicionar-coorientacao": adicionarCoorientacao,
        "salvar-externo": salvarExterno,
        "salvar-disciplina": salvarDisciplina,
        "salvar-turma": salvarTurma,
        "salvar-publicacao": salvarPublicacao,
      },
    },
  );

  carregarAba();
})(window.PPGI);
