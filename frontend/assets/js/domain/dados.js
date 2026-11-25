/*
 * domain/dados — dados vindos da API, guardados em memória para as telas.
 *
 * As telas foram feitas para ler os dados na hora (Repository.allTeachers(),
 * Barema.checkRequirements(...)). Por isso, antes de a página rodar, o core/boot chama
 * Dados.carregar(): busca o resumo dos docentes, as correspondências do Fuzzy Match e o
 * cálculo de cada docente no período escolhido, e converte tudo para o formato das telas.
 * Toda ação que altera dados chama a API e depois recarrega (Dados.executar).
 */
(function (PPGI) {
  "use strict";

  const { Api, Format } = PPGI;

  const VINCULOS = { PERMANENTE: "Permanente", COLABORADOR: "Colaborador" };
  const SITUACOES = { EFETIVO: "Efetivo", SUBSTITUTO: "Substituto", VISITANTE: "Visitante", APOSENTADO: "Aposentado" };
  const TIPOS = { CREDENCIAMENTO: "Credenciamento", RECREDENCIAMENTO: "Recredenciamento" };
  const RELATORIOS = { RASCUNHO: "Rascunho", GERADO: "Gerado", ENVIADO: "Enviado" };
  const CONCORRENCIA = 6;

  const cache = { docentes: [], calculos: new Map(), correspondencias: [], periodo: null, carregado: false };

  const dataBr = (iso) => (iso ? String(iso).slice(0, 10).split("-").reverse().join("/") : null);
  const mesAno = (iso) => (iso ? String(iso).slice(0, 7).split("-").reverse().join("/") : "");

  function processo(av) {
    if (!av) return { status: "nenhum", label: "Sem processo" };
    const tipo = TIPOS[av.tipo];
    const base = { id_processo: av.id_processo, tipo };
    if (av.status === "EM_ANDAMENTO") return { ...base, status: "andamento", label: `${tipo} em andamento` };
    if (av.status === "DEFERIDO") return { ...base, status: "credenciado", label: `${tipo} deferido${av.valido_ate ? ` · válido até ${mesAno(av.valido_ate)}` : ""}` };
    if (av.status === "INDEFERIDO") return { ...base, status: "indeferido", label: `${tipo} indeferido` };
    return { ...base, status: "nenhum", label: `${tipo} cancelado` };
  }

  function contarTurmas(turmas, nivel) {
    return turmas
      .filter((t) => t.nivel === nivel && !t.estudo_dirigido)
      .reduce((porAno, t) => Object.assign(porAno, { [t.ano]: (porAno[t.ano] || 0) + 1 }), {});
  }

  /** Docente da API → formato das telas (o mesmo do antigo catálogo de exemplo). */
  function paraTela(d) {
    const av = d.ultima_avaliacao;
    return {
      id: String(d.id_docente),
      id_docente: d.id_docente,
      name: d.nome,
      email: d.email,
      department: d.departamento || "—",
      employment: SITUACOES[d.situacao_funcional] || d.situacao_funcional,
      ppgi: VINCULOS[d.vinculo] || null,
      vinculo: d.vinculo,
      id_lattes: d.id_lattes,
      // Sem ID nem link do Lattes, o docente fica fora da importação em lote.
      lattesSync: d.data_ultima_atualizacao ? dataBr(d.data_ultima_atualizacao) : d.id_lattes || d.url_lattes ? "não importado" : null,
      process: processo(av),
      report: av ? { status: RELATORIOS[av.status_relatorio], date: dataBr(av.data_envio_relatorio), id_processo: av.id_processo } : null,
      declinedOn: dataBr(d.data_recusa_participacao),
      undergradCourses: contarTurmas(d.turmas, "GRADUACAO"),
      gradCourses: contarTurmas(d.turmas, "POS_GRADUACAO"),
      ongoingAdvising: d.orientandos_em_andamento,
      finishedAdvisingYears: d.anos_conclusao_orientacoes,
    };
  }

  const chave = (id, periodo) => `${id}|${periodo.id}`;

  async function emParalelo(itens, tarefa) {
    const fila = [...itens];
    const trabalhadores = Array.from({ length: Math.min(CONCORRENCIA, fila.length) }, async () => {
      while (fila.length) await tarefa(fila.shift());
    });
    await Promise.all(trabalhadores);
  }

  /** Carrega tudo o que as telas internas usam, para o período indicado. */
  async function carregar(periodo) {
    const [docentes, correspondencias] = await Promise.all([Api.get("/docentes/resumo"), Api.get("/correspondencias?faixa=todas")]);
    cache.docentes = docentes.map(paraTela);
    cache.correspondencias = correspondencias;
    cache.calculos = new Map();
    cache.periodo = periodo;
    await emParalelo(cache.docentes, async (t) => {
      const calculo = await Api.get(`/docentes/${t.id}/calculo?inicio=${periodo.years[0]}&fim=${periodo.years[periodo.years.length - 1]}`);
      cache.calculos.set(chave(t.id, periodo), calculo);
    });
    cache.carregado = true;
  }

  /** Recarrega e redesenha a tela atual (depois de uma ação). */
  async function recarregar() {
    await carregar(PPGI.Repository.currentPeriod());
    if (PPGI.Shell && PPGI.Shell.atual) PPGI.Shell.atual.refresh();
  }

  /**
   * Roda uma ação na API, mostra o resultado e recarrega os dados.
   * Devolve o resultado da ação, ou null se ela falhar (o erro vira um aviso na tela).
   */
  async function executar(acao, { sucesso, recarregarDepois = true } = {}) {
    try {
      const resultado = await acao();
      if (sucesso) PPGI.Feedback.toast(typeof sucesso === "function" ? sucesso(resultado) : sucesso);
      return resultado;
    } catch (erro) {
      PPGI.Feedback.toast(erro.message || "Não foi possível concluir a ação.", "error");
      return null;
    } finally {
      if (recarregarDepois) await recarregar().catch(() => {});
    }
  }

  PPGI.Dados = {
    carregar,
    recarregar,
    executar,
    docentes: () => cache.docentes,
    calculo: (id, periodo) => cache.calculos.get(chave(id, periodo)) || null,
    correspondencias: () => cache.correspondencias,
    carregado: () => cache.carregado,
    dataBr,
    agora: Format.nowStamp,
  };
})((window.PPGI = window.PPGI || {}));
