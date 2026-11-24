/*
 * Parâmetros da Resolução nº 1/2025 do PPGI/UFAL.
 * São gravados na tabela `parametro` (seed) e podem ser ajustados pela
 * coordenação sem novo deploy (RNF-BE05). Este arquivo é só o valor inicial.
 */

/** Pontos por estrato (Arts. 3º e 4º). Abaixo de B1 = 0. A planilha antiga usava 0,675 para A4. */
const PESOS_ESTRATO = { A1: 1.0, A2: 0.875, A3: 0.75, A4: 0.625, B1: 0.5, B2: 0, B3: 0, B4: 0, C: 0 };

const PARAMETROS = [
  { chave: "pesos_estrato", valor: PESOS_ESTRATO, descricao: "Pontos por estrato Qualis (Arts. 3º e 4º)." },

  { chave: "pesquisa.janela_meses", valor: 36, descricao: "Janela da produção considerada no critério de Pesquisa." },

  { chave: "credenciamento.pontuacao_minima", valor: 3.5, descricao: "Pontuação mínima de Pesquisa para credenciamento (Art. 3º)." },
  { chave: "credenciamento.periodicos_minimos", valor: { quantidade: 2, estrato_minimo: "A3" }, descricao: "Mínimo de periódicos em estrato A3 ou superior (Art. 3º)." },

  { chave: "recredenciamento.pontuacao_minima", valor: 2.5, descricao: "Pontuação mínima de Pesquisa para recredenciamento (Art. 4º)." },
  { chave: "recredenciamento.periodicos_minimos", valor: { quantidade: 1, estrato_minimo: "A4" }, descricao: "Mínimo de periódicos em estrato A4 ou superior (Art. 4º)." },
  { chave: "recredenciamento.coautoria_discente_minima", valor: 1, descricao: "Produções em coautoria com discente do PPGI (Art. 4º)." },

  { chave: "orientacao.janela_meses", valor: 24, descricao: "Janela do critério de Orientação." },
  { chave: "orientacao.minimo", valor: 2, descricao: "Orientações em andamento ou concluídas na janela." },
  { chave: "orientacao.peso_coorientacao", valor: 0.5, descricao: "Valor de cada coorientação." },
  { chave: "orientacao.teto_permanente", valor: 8, descricao: "Máximo de orientandos por docente Permanente." },

  { chave: "docencia.janela_meses", valor: 24, descricao: "Janela do critério de Docência." },
  { chave: "docencia.minimo_disciplinas", valor: 1, descricao: "Disciplinas lecionadas na janela, excluindo Estudo Dirigido." },

  { chave: "recem_credenciado.meses", valor: 24, descricao: "Até quantos meses de vínculo o docente fica isento de Orientação e Docência (Art. 4º, parágrafo único)." },
  { chave: "progressao_colaborador.meses_vinculo", valor: 12, descricao: "Vínculo mínimo como Colaborador para virar Permanente (Art. 3º, §3º)." },
  { chave: "colaboradores.teto_percentual", valor: 30, descricao: "Teto de Colaboradores no corpo docente (Art. 8º)." },

  { chave: "fuzzy.corte_confirmacao", valor: 92, descricao: "Nota a partir da qual a correspondência é confirmada automaticamente." },
  { chave: "fuzzy.corte_revisao", valor: 80, descricao: "Nota a partir da qual a correspondência vai para revisão humana (abaixo: descartada)." },
  { chave: "fuzzy.janela_ano", valor: 1, descricao: "Diferença máxima de ano entre publicações comparadas por similaridade." },
];

module.exports = { PESOS_ESTRATO, PARAMETROS };
