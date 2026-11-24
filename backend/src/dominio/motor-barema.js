/*
 * Motor de cálculo de Credenciamento e Recredenciamento (Resolução nº 1/2025, RF-BE12).
 *
 * Funções puras: recebem os dados já carregados e os parâmetros (tabela `parametro`)
 * e devolvem cada critério com o exigido, o obtido e se foi atendido. Não conhecem
 * banco nem HTTP, o que permite testar cada regra isoladamente.
 *
 * Regras:
 *  Pesquisa (janela de 36 meses)
 *   - pontos do artigo = peso do estrato ÷ nº de docentes do PPGI entre os autores
 *     (discentes e externos não entram no divisor; o próprio avaliado sempre conta);
 *   - Credenciamento: ≥ 3,5 pontos e ≥ 2 periódicos A3 ou superior;
 *   - Recredenciamento: ≥ 2,5 pontos, ≥ 1 periódico A4 ou superior e
 *     ≥ 1 produção em coautoria com discente do PPGI.
 *  Orientação (Recredenciamento, 24 meses): ≥ 2 orientações em andamento ou concluídas
 *   na janela; coorientação vale 0,5.
 *  Docência (Recredenciamento, 24 meses): ≥ 1 disciplina, sem contar "Estudo Dirigido".
 *  Exceções
 *   - recém-credenciado (< 24 meses de vínculo): isento de Orientação e Docência;
 *   - credenciamento bloqueado se a produção for subconjunto da de outro docente do PPGI;
 *   - progressão Colaborador → Permanente: 1 ano como Colaborador + 1 publicação com
 *     discente + 1 disciplina;
 *   - teto de 30% de Colaboradores: ranking por pontuação de Pesquisa.
 */

const ESTRATOS = ["A1", "A2", "A3", "A4", "B1", "B2", "B3", "B4", "C"];
const arredondar = (n, casas = 4) => Math.round(n * 10 ** casas) / 10 ** casas;
const noMinimo = (estrato, minimo) => estrato != null && ESTRATOS.indexOf(estrato) <= ESTRATOS.indexOf(minimo);

/** Data `meses` antes de `referencia` (mesmo dia do mês). */
function mesesAntes(referencia, meses) {
  const d = new Date(referencia);
  d.setUTCMonth(d.getUTCMonth() - meses);
  return d;
}

const mesesEntre = (inicio, fim) =>
  (fim.getUTCFullYear() - inicio.getUTCFullYear()) * 12 + (fim.getUTCMonth() - inicio.getUTCMonth()) - (fim.getUTCDate() < inicio.getUTCDate() ? 1 : 0);

/** Anos da janela de Pesquisa: por padrão os N anos completos anteriores ao da referência. */
function periodoPesquisa(referencia, janelaMeses, inicio, fim) {
  const anoFim = fim ?? referencia.getUTCFullYear() - 1;
  const anoInicio = inicio ?? anoFim - Math.ceil(janelaMeses / 12) + 1;
  return { inicio: anoInicio, fim: anoFim };
}

function requisito(codigo, descricao, exigido, obtido, atendido, detalhe) {
  return { codigo, descricao, exigido, obtido, atendido, ...(detalhe ? { detalhe } : {}) };
}

/* ------------------------------------------------------------------ Pesquisa */

/**
 * @param publicacoes [{ id_publicacao, titulo, ano, tipo_veiculo, veiculo, estrato, fonte_estrato,
 *                       considerada, autores: [{ tipo, id_docente?, ppgi? }] }]
 * @param idDocente   docente avaliado (sempre conta no divisor)
 */
function calcularPesquisa({ publicacoes, idDocente, tipo, p }) {
  const pesos = p.pesos_estrato;
  const linhas = publicacoes.map((pub) => {
    const docentesPpgi = new Set(pub.autores.filter((a) => a.tipo === "DOCENTE" && a.ppgi).map((a) => a.id_docente));
    docentesPpgi.add(idDocente);
    const peso = pub.estrato ? Number(pesos[pub.estrato] ?? 0) : 0;
    const divisor = docentesPpgi.size;
    const considerada = pub.considerada !== false;
    return {
      id_publicacao: pub.id_publicacao,
      titulo: pub.titulo,
      ano: pub.ano,
      veiculo: pub.veiculo,
      tipo_veiculo: pub.tipo_veiculo,
      estrato: pub.estrato,
      fonte_estrato: pub.fonte_estrato,
      considerada,
      peso,
      divisor,
      pontos: considerada ? arredondar(peso / divisor) : 0,
      coautores_ppgi: divisor - 1,
      coautores: pub.autores.filter((a) => !a.avaliado).map((a) => ({ tipo: a.tipo, nome: a.nome, id_docente: a.id_docente ?? null, ppgi: Boolean(a.ppgi) })),
      com_discente: pub.autores.some((a) => a.tipo === "DISCENTE"),
    };
  });

  const validas = linhas.filter((l) => l.considerada);
  const total = arredondar(validas.reduce((s, l) => s + l.pontos, 0));
  const bruto = arredondar(validas.reduce((s, l) => s + l.peso, 0));
  const porEstrato = ESTRATOS.map((e) => {
    const doEstrato = validas.filter((l) => l.estrato === e);
    return { estrato: e, quantidade: doEstrato.length, pontos: arredondar(doEstrato.reduce((s, l) => s + l.pontos, 0)) };
  }).filter((r) => r.quantidade > 0);

  const prefixo = tipo === "CREDENCIAMENTO" ? "credenciamento" : "recredenciamento";
  const minimo = Number(p[`${prefixo}.pontuacao_minima`]);
  const { quantidade, estrato_minimo: estratoMinimo } = p[`${prefixo}.periodicos_minimos`];
  const periodicos = validas.filter((l) => l.tipo_veiculo === "PERIODICO" && noMinimo(l.estrato, estratoMinimo)).length;

  const requisitos = [
    requisito("PESQUISA_PONTUACAO", "Pontuação mínima de Pesquisa", `≥ ${minimo} pontos`, total, total >= minimo),
    requisito("PESQUISA_PERIODICOS", `Periódicos em estrato ${estratoMinimo} ou superior`, `≥ ${quantidade}`, periodicos, periodicos >= quantidade),
  ];
  let comDiscente = validas.filter((l) => l.com_discente).length;
  if (tipo === "RECREDENCIAMENTO") {
    const exigido = Number(p["recredenciamento.coautoria_discente_minima"]);
    requisitos.push(requisito("PESQUISA_COAUTORIA_DISCENTE", "Produção em coautoria com discente do PPGI", `≥ ${exigido}`, comDiscente, comDiscente >= exigido));
  }

  return { total, bruto, desconto_coautoria: arredondar(bruto - total), por_estrato: porEstrato, linhas, com_discente: comDiscente, requisitos };
}

/* ---------------------------------------------------------------- Orientação */

/**
 * @param orientacoes   [{ id_discente, nome, ano_ingresso, data_conclusao }]  (orientador principal)
 * @param coorientacoes mesmo formato (coorientador)
 */
function calcularOrientacao({ orientacoes, coorientacoes, referencia, p }) {
  const inicioJanela = mesesAntes(referencia, Number(p["orientacao.janela_meses"]));
  const naJanela = (d) => d.ano_ingresso <= referencia.getUTCFullYear() && (!d.data_conclusao || new Date(d.data_conclusao) >= inicioJanela);
  const situacao = (d) => (d.data_conclusao ? "CONCLUIDA" : "EM_ANDAMENTO");

  const principais = orientacoes.filter(naJanela).map((d) => ({ ...d, situacao: situacao(d), valor: 1 }));
  const peso = Number(p["orientacao.peso_coorientacao"]);
  const coorientadas = coorientacoes.filter(naJanela).map((d) => ({ ...d, situacao: situacao(d), valor: peso }));
  const total = arredondar(principais.length + coorientadas.length * peso, 2);
  const minimo = Number(p["orientacao.minimo"]);
  const emAndamento = orientacoes.filter((d) => !d.data_conclusao).length;
  const teto = Number(p["orientacao.teto_permanente"]);

  return {
    total,
    orientacoes: principais,
    coorientacoes: coorientadas,
    em_andamento: emAndamento,
    teto,
    requisitos: [
      requisito("ORIENTACAO_MINIMA", "Orientações em andamento ou concluídas (coorientação vale " + String(peso).replace(".", ",") + ")", `≥ ${minimo}`, total, total >= minimo),
      requisito("ORIENTACAO_TETO", "Orientandos em andamento dentro do teto", `≤ ${teto}`, emAndamento, emAndamento <= teto),
    ],
  };
}

/* ------------------------------------------------------------------ Docência */

/** Início aproximado do semestre letivo: 1 → janeiro, 2 → julho. */
const inicioSemestre = (ano, semestre) => new Date(Date.UTC(ano, semestre === 2 ? 6 : 0, 1));

/** @param turmas [{ ano, semestre, codigo, nome, nivel, estudo_dirigido }] */
function calcularDocencia({ turmas, referencia, p }) {
  const inicioJanela = mesesAntes(referencia, Number(p["docencia.janela_meses"]));
  const niveis = p["docencia.niveis"];
  const naJanela = turmas.filter((t) => {
    const inicio = inicioSemestre(t.ano, t.semestre);
    // A turma conta se o semestre terminou (ou está em curso) dentro da janela.
    const fim = new Date(Date.UTC(t.ano, t.semestre === 2 ? 11 : 5, t.semestre === 2 ? 31 : 30));
    return inicio <= referencia && fim >= inicioJanela;
  });
  const validas = naJanela.filter((t) => !t.estudo_dirigido && niveis.includes(t.nivel));
  const minimo = Number(p["docencia.minimo_disciplinas"]);
  const disciplinas = new Set(validas.map((t) => `${t.codigo}|${t.ano}|${t.semestre}`)).size;
  return {
    total: disciplinas,
    turmas: naJanela.map((t) => ({ ...t, conta: validas.includes(t), motivo: t.estudo_dirigido ? "Estudo Dirigido não conta" : niveis.includes(t.nivel) ? null : "Nível não considerado" })),
    requisitos: [requisito("DOCENCIA_MINIMA", "Disciplinas lecionadas (sem Estudo Dirigido)", `≥ ${minimo}`, disciplinas, disciplinas >= minimo)],
  };
}

/* ------------------------------------------------------------------ Exceções */

/** Recém-credenciado: vínculo atual há menos de N meses. */
function ehRecemCredenciado(docente, referencia, p) {
  if (!docente.vinculo || !docente.data_vinculo) return false;
  return mesesEntre(new Date(docente.data_vinculo), referencia) < Number(p["recem_credenciado.meses"]);
}

/**
 * Art. 3º, §2º: o credenciamento é bloqueado se TODA a produção considerada do candidato
 * também é de um mesmo docente do PPGI. Devolve esse docente (ou null).
 */
function subconjuntoDeOutroDocente(linhasPesquisa, publicacoes) {
  const consideradas = new Set(linhasPesquisa.filter((l) => l.considerada && l.pontos > 0).map((l) => l.id_publicacao));
  if (!consideradas.size) return null;
  const docentesPorPub = publicacoes
    .filter((p) => consideradas.has(p.id_publicacao))
    .map((p) => new Map(p.autores.filter((a) => a.tipo === "DOCENTE" && a.ppgi && !a.avaliado).map((a) => [a.id_docente, a.nome])));
  const [primeira, ...demais] = docentesPorPub;
  for (const [id, nome] of primeira) {
    if (demais.every((m) => m.has(id))) return { id_docente: id, nome };
  }
  return null;
}

/** Art. 3º, §3º: Colaborador pode passar a Permanente. */
function avaliarProgressao({ docente, referencia, pesquisa, turmas, p }) {
  const meses = docente.data_vinculo ? mesesEntre(new Date(docente.data_vinculo), referencia) : 0;
  const exigidos = Number(p["progressao_colaborador.meses_vinculo"]);
  const disciplinas = turmas.filter((t) => !t.estudo_dirigido).length;
  const requisitos = [
    requisito("PROGRESSAO_VINCULO", "Tempo de vínculo como Colaborador", `≥ ${exigidos} meses`, meses, meses >= exigidos),
    requisito("PROGRESSAO_DISCENTE", "Publicação com discente do PPGI", "≥ 1", pesquisa.com_discente, pesquisa.com_discente >= 1),
    requisito("PROGRESSAO_DISCIPLINA", "Disciplina ministrada", "≥ 1", disciplinas, disciplinas >= 1),
  ];
  return { elegivel: requisitos.every((r) => r.atendido), requisitos };
}

/* --------------------------------------------------------------- Avaliação */

/**
 * Avaliação completa de um docente.
 * @param dados { docente, publicacoes, orientacoes, coorientacoes, turmas }
 * @param opcoes { tipo?, referencia?, inicio?, fim? }
 */
function avaliar(dados, { tipo, referencia = new Date(), inicio, fim } = {}, p) {
  const { docente } = dados;
  const tipoFinal = tipo ?? (docente.vinculo ? "RECREDENCIAMENTO" : "CREDENCIAMENTO");
  const periodo = periodoPesquisa(referencia, Number(p["pesquisa.janela_meses"]), inicio, fim);
  const noPeriodo = dados.publicacoes.filter((x) => x.ano >= periodo.inicio && x.ano <= periodo.fim);

  const pesquisa = calcularPesquisa({ publicacoes: noPeriodo, idDocente: docente.id_docente, tipo: tipoFinal, p });
  const avisos = [];
  const excecoes = [];
  let orientacao = null;
  let docencia = null;
  const requisitos = [...pesquisa.requisitos];

  if (tipoFinal === "RECREDENCIAMENTO") {
    const recem = ehRecemCredenciado(docente, referencia, p);
    orientacao = calcularOrientacao({ ...dados, referencia, p });
    docencia = calcularDocencia({ ...dados, referencia, p });
    if (recem) {
      excecoes.push({ codigo: "RECEM_CREDENCIADO", descricao: `Vínculo há menos de ${p["recem_credenciado.meses"]} meses: isento de Orientação e Docência (Art. 4º, parágrafo único).` });
      orientacao.isento = docencia.isento = true;
    } else {
      requisitos.push(...orientacao.requisitos, ...docencia.requisitos);
    }
  } else {
    const dono = subconjuntoDeOutroDocente(pesquisa.linhas, noPeriodo);
    if (dono) {
      requisitos.push(
        requisito("CREDENCIAMENTO_SUBCONJUNTO", "Produção não pode ser subconjunto da de outro docente do PPGI (Art. 3º, §2º)", "Produção própria", `Toda a produção também é de ${dono.nome}`, false, dono),
      );
    }
  }

  if (!noPeriodo.length) avisos.push(`Nenhuma publicação entre ${periodo.inicio} e ${periodo.fim}. Importe o CSV do QLattes ou cadastre a produção.`);
  const semEstrato = noPeriodo.filter((x) => !x.estrato).length;
  if (semEstrato) avisos.push(`${semEstrato} publicação(ões) do período sem estrato Qualis: valem 0 até serem classificadas (fila manual).`);
  if (docente.data_recusa_participacao) avisos.push("O docente sinalizou que não participará deste ciclo (RF16).");

  const progressao = docente.vinculo === "COLABORADOR" ? avaliarProgressao({ docente, referencia, pesquisa, turmas: docencia?.turmas?.filter((t) => t.conta) ?? [], p }) : null;

  return {
    tipo: tipoFinal,
    referencia: referencia.toISOString().slice(0, 10),
    periodo,
    docente: { id_docente: docente.id_docente, nome: docente.nome, vinculo: docente.vinculo, data_vinculo: docente.data_vinculo },
    pesquisa,
    orientacao,
    docencia,
    excecoes,
    progressao,
    requisitos,
    atendidos: requisitos.filter((r) => r.atendido).length,
    apto: requisitos.every((r) => r.atendido),
    avisos,
  };
}

/**
 * Art. 8º: no máximo N% do corpo docente pode ser Colaborador. Os colaboradores aptos são
 * ordenados pela pontuação de Pesquisa (decrescente) e entram até o limite
 * floor(N% × (permanentes aptos + colaboradores aptos)).
 * @param resultados [{ docente: { id_docente, nome, vinculo }, apto, pesquisa: { total } }]
 */
function aplicarTetoColaboradores(resultados, p) {
  const percentual = Number(p["colaboradores.teto_percentual"]);
  const aptos = resultados.filter((r) => r.apto);
  const permanentes = aptos.filter((r) => r.docente.vinculo === "PERMANENTE").length;
  const colaboradores = aptos.filter((r) => r.docente.vinculo === "COLABORADOR").sort((a, b) => b.pesquisa.total - a.pesquisa.total);
  const limite = Math.floor((percentual / 100) * (permanentes + colaboradores.length));
  return {
    percentual,
    permanentes_aptos: permanentes,
    colaboradores_aptos: colaboradores.length,
    limite,
    ranking: colaboradores.map((r, i) => ({ posicao: i + 1, id_docente: r.docente.id_docente, nome: r.docente.nome, pontuacao: r.pesquisa.total, dentro_do_teto: i < limite })),
  };
}

module.exports = {
  ESTRATOS,
  avaliar,
  calcularPesquisa,
  calcularOrientacao,
  calcularDocencia,
  ehRecemCredenciado,
  subconjuntoDeOutroDocente,
  avaliarProgressao,
  aplicarTetoColaboradores,
  periodoPesquisa,
  mesesAntes,
  mesesEntre,
};
