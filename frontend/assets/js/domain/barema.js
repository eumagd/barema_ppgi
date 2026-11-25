/*
 * domain/barema — pontuação e requisitos de cada docente.
 *
 * O cálculo é feito no back end (motor da Resolução nº 1/2025, GET /api/docentes/:id/calculo);
 * aqui só convertemos o resultado para o formato que as telas usam.
 */
(function (PPGI) {
  "use strict";

  const { Dados, Format } = PPGI;

  const GRUPOS = [
    { prefixo: "PESQUISA", nome: "Produção científica" },
    { prefixo: "ORIENTACAO", nome: "Orientação" },
    { prefixo: "DOCENCIA", nome: "Docência" },
    { prefixo: "", nome: "Regras da resolução" },
  ];

  /** Enquanto o cálculo do período não chega da API. */
  const VAZIO = {
    pesquisa: { total: 0, bruto: 0, desconto_coautoria: 0, por_estrato: [], linhas: [] },
    requisitos: [],
    atendidos: 0,
    apto: false,
    avisos: ["Carregando o cálculo do período…"],
    excecoes: [],
  };

  const obter = (teacherId, period) => Dados.calculo(teacherId, period) || VAZIO;

  function computeScore(teacherId, period) {
    const c = obter(teacherId, period);
    const lines = c.pesquisa.linhas
      .filter((l) => l.considerada)
      .map((l) => ({
        pub: { id: String(l.id_publicacao), title: l.titulo, venue: l.veiculo || "—", year: l.ano, qualis: l.estrato || "N", coauthors: l.coautores || [] },
        raw: l.peso,
        ppgiAuthorsCount: l.divisor,
        divisor: l.divisor,
        points: l.pontos,
        withStudent: l.com_discente,
      }));
    return {
      lines,
      raw: c.pesquisa.bruto,
      total: c.pesquisa.total,
      coauthorshipDiscount: c.pesquisa.desconto_coautoria,
      splitCount: lines.filter((l) => l.divisor > 1).length,
      byStratum: c.pesquisa.por_estrato.map((s) => ({ stratum: s.estrato, count: s.quantidade, points: s.pontos })),
    };
  }

  /** "≥ 2.5 pontos" → 2.5 */
  const numeroExigido = (texto) => Number((String(texto).match(/-?\d+(?:[.,]\d+)?/) || [])[0]?.replace(",", "."));

  function item(r) {
    const exigido = numeroExigido(r.exigido);
    const obtido = typeof r.obtido === "number" ? r.obtido : null;
    const folga = obtido != null && Number.isFinite(exigido) ? Math.round((obtido - exigido) * 1000) / 1000 : null;
    const sinalInvertido = String(r.exigido).trim().startsWith("≤");
    return {
      code: r.codigo,
      req: r.descricao,
      expected: String(r.exigido).replace(/(\d)\.(\d)/g, "$1,$2"),
      measured: obtido != null ? Format.formatNumber(obtido) : String(r.obtido),
      slack: folga == null ? "—" : Format.formatSigned(sinalInvertido ? -folga : folga),
      met: r.atendido,
    };
  }

  function checkRequirements(teacherId, period) {
    const c = obter(teacherId, period);
    const groups = GRUPOS.map((g) => ({
      name: g.nome,
      items: c.requisitos.filter((r) => (g.prefixo ? r.codigo.startsWith(g.prefixo) : !GRUPOS.some((x) => x.prefixo && r.codigo.startsWith(x.prefixo)))).map(item),
    })).filter((g) => g.items.length);
    const items = groups.flatMap((g) => g.items.map((i) => Object.assign({ group: g.name }, i)));
    const metCount = items.filter((i) => i.met).length;
    return {
      groups,
      items,
      metCount,
      total: items.length,
      eligible: c.apto,
      unmet: items.filter((i) => !i.met),
      production: (groups.find((g) => g.name === "Produção científica") || { items: [] }).items,
      score: computeScore(teacherId, period),
      type: c.tipo,
      warnings: c.avisos || [],
      exceptions: c.excecoes || [],
      progression: c.progressao || null,
    };
  }

  /** Folga no requisito de periódicos (quantos acima do mínimo). */
  function upperStrataSurplus(result) {
    const periodicos = result.production.find((r) => r.code === "PESQUISA_PERIODICOS");
    return periodicos && periodicos.met ? parseInt(periodicos.slack.replace("+", ""), 10) || 0 : 0;
  }

  PPGI.Barema = { computeScore, checkRequirements, upperStrataSurplus };
})((window.PPGI = window.PPGI || {}));
