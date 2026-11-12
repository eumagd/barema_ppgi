/*
 * domain/barema — regras de negócio: pontuação da produção e verificação de requisitos.
 * Funções puras sobre os dados do repository; não conhecem HTML.
 */
(function (PPGI) {
  "use strict";

  const { Catalog, Repository, Format } = PPGI;
  const { RULES, QUALIS_POINTS, UPPER_STRATA, TOP_STRATA } = Catalog;

  /* ---------- Cálculo da pontuação ---------- */
  function scoreLine(pub, teacher) {
    const raw = QUALIS_POINTS[pub.qualis];
    const ppgiAuthors = Repository.ppgiAuthorsOf(pub);
    const shouldSplit = Boolean(teacher.ppgi) && Repository.isCoauthorshipConfirmed(pub) && ppgiAuthors.length > 1;
    const divisor = shouldSplit ? ppgiAuthors.length : 1;
    return { pub, raw, ppgiAuthorsCount: Math.max(ppgiAuthors.length, 1), divisor, points: raw / divisor };
  }

  function sum(items, pick) {
    return items.reduce((total, item) => total + pick(item), 0);
  }

  function scoreByStratum(lines) {
    return Catalog.STRATA.map((stratum) => {
      const ofStratum = lines.filter((l) => l.pub.qualis === stratum);
      return { stratum, count: ofStratum.length, points: sum(ofStratum, (l) => l.points) };
    }).filter((row) => row.count > 0);
  }

  function computeScore(teacherId, period) {
    const teacher = Repository.findTeacher(teacherId);
    const lines = Repository.publicationsOf(teacherId, period).map((pub) => scoreLine(pub, teacher));
    const raw = sum(lines, (l) => l.raw);
    const total = sum(lines, (l) => l.points);
    return {
      lines,
      raw,
      total,
      coauthorshipDiscount: raw - total,
      splitCount: lines.filter((l) => l.divisor > 1).length,
      byStratum: scoreByStratum(lines),
    };
  }

  /* ---------- Verificação de requisitos ---------- */
  function requirement(req, expected, measured, slack, met) {
    return { req, expected, measured, slack, met };
  }

  function countLabel(n) {
    return Format.plural(n, "produção", "produções");
  }

  function productionRequirements(score, period) {
    const pubs = score.lines.map((l) => l.pub);
    const upper = pubs.filter((p) => UPPER_STRATA.includes(p.qualis)).length;
    const top = pubs.filter((p) => TOP_STRATA.includes(p.qualis)).length;
    const yearsWithOutput = period.years.filter((y) => pubs.some((p) => p.year === y)).length;
    const scoreSlack = Math.round((score.total - RULES.minScore) * 10) / 10;
    return [
      requirement("Publicações A4+ (estratos A1 a A4)", `≥ ${RULES.minUpperStrata} produções`, countLabel(upper), Format.formatSigned(upper - RULES.minUpperStrata), upper >= RULES.minUpperStrata),
      requirement("Publicações em estratos A1/A2", `≥ ${RULES.minTopStrata} produções`, countLabel(top), Format.formatSigned(top - RULES.minTopStrata), top >= RULES.minTopStrata),
      requirement("Pontuação mínima de Pesquisa", `≥ ${RULES.minScore} pts`, `${Format.formatNumber(score.total)} pts`, Format.formatSigned(scoreSlack), score.total >= RULES.minScore),
      requirement("Produção em todos os anos do período", "≥ 1 por ano", `${yearsWithOutput} de ${period.years.length} anos`, Format.formatSigned(yearsWithOutput - period.years.length), yearsWithOutput === period.years.length),
    ];
  }

  function teachingRequirements(teacher, period) {
    const perYear = period.years.map((y) => ({ year: y, count: teacher.undergradCourses[y] || 0 }));
    const yearsWithout = perYear.filter((y) => y.count < 1).length;
    const graduate = sum(period.years, (y) => teacher.gradCourses[y] || 0);
    return [
      requirement("Disciplinas na graduação (IC)", "≥ 1 por ano", perYear.map((y) => `${y.count} (${y.year})`).join(" · "), Format.formatSigned(-yearsWithout), yearsWithout === 0),
      requirement("Disciplinas na pós-graduação (PPGI)", "≥ 1 no período", Format.plural(graduate, "disciplina", "disciplinas"), Format.formatSigned(graduate - 1), graduate >= 1),
    ];
  }

  function advisingRequirements(teacher, period) {
    const finished = teacher.finishedAdvisingYears.filter((y) => period.years.includes(y)).length;
    return [
      requirement("Orientações em andamento", "≥ 1 orientação", `${teacher.ongoingAdvising} em andamento`, Format.formatSigned(teacher.ongoingAdvising - 1), teacher.ongoingAdvising >= 1),
      requirement("Orientações concluídas no período", "≥ 1 concluída", Format.plural(finished, "concluída", "concluídas"), Format.formatSigned(finished - 1), finished >= 1),
    ];
  }

  function registrationRequirements(teacher) {
    return [
      requirement("Vínculo efetivo com a UFAL", "Docente efetivo", teacher.employment, "—", teacher.employment === "Efetivo"),
      requirement("Currículo Lattes sincronizado", "Link informado e sincronizado", teacher.lattesSync ? `Sincronizado em ${teacher.lattesSync}` : "Link ausente no cadastro", "—", Boolean(teacher.lattesSync)),
    ];
  }

  function checkRequirements(teacherId, period) {
    const teacher = Repository.findTeacher(teacherId);
    const score = computeScore(teacherId, period);
    const groups = [
      { name: "Produção científica", items: productionRequirements(score, period) },
      { name: "Docência", items: teachingRequirements(teacher, period) },
      { name: "Orientação", items: advisingRequirements(teacher, period) },
      { name: "Vínculo e cadastro", items: registrationRequirements(teacher) },
    ];
    const items = groups.flatMap((g) => g.items.map((i) => Object.assign({ group: g.name }, i)));
    const metCount = items.filter((i) => i.met).length;
    return {
      groups,
      items,
      metCount,
      total: items.length,
      eligible: metCount === items.length,
      unmet: items.filter((i) => !i.met),
      production: groups[0].items,
      score,
    };
  }

  function upperStrataSurplus(result) {
    const upper = result.production[0];
    return upper.met ? parseInt(upper.slack.replace("+", ""), 10) || 0 : 0;
  }

  PPGI.Barema = { computeScore, checkRequirements, upperStrataSurplus };
})((window.PPGI = window.PPGI || {}));
