/*
 * domain/repository — acesso aos docentes e publicações carregados da API (domain/dados).
 * Mantém as mesmas funções que as telas já usavam com o catálogo de exemplo.
 */
(function (PPGI) {
  "use strict";

  const { Store, Catalog, Dados, Api } = PPGI;
  const KEYS = { period: "period" };
  const DECIDIDAS = ["AUTOMATICA", "CONFIRMADA"];

  /* ---------- Docentes ---------- */
  function allTeachers() {
    return Dados.docentes();
  }

  function findTeacher(id) {
    return allTeachers().find((t) => t.id === String(id)) || null;
  }

  /** Ajuste local imediato (a ação real vai para a API e os dados são recarregados depois). */
  function updateTeacher(id, patch) {
    const t = findTeacher(id);
    if (t) Object.assign(t, patch);
  }

  function ppgiTeachers() {
    return allTeachers().filter((t) => t.ppgi);
  }

  /* ---------- Publicações e coautorias (Fuzzy Match) ---------- */
  const porIdTela = new Map();

  const docentesDe = (pub) =>
    (pub ? pub.autorias : []).map((a) => a.autor.docente).filter(Boolean).map((d) => String(d.id_docente));

  function correspondenciasDo(teacherId) {
    return Dados.correspondencias().filter((c) => [...docentesDe(c.publicacao), ...docentesDe(c.publicacao_candidata)].includes(String(teacherId)));
  }

  /** Publicações do docente no período (do cálculo da API) + pares do Fuzzy Match ainda não mesclados. */
  function publicationsOf(teacherId, period) {
    const calculo = Dados.calculo(teacherId, period);
    if (!calculo) return [];
    const correspondencias = correspondenciasDo(teacherId);
    const mescladaEm = new Map(correspondencias.filter((c) => DECIDIDAS.includes(c.decisao)).map((c) => [c.id_publicacao_candidata, c]));

    const proprias = calculo.pesquisa.linhas.map((l) => {
      const ppgi = l.coautores.filter((c) => c.tipo === "DOCENTE" && c.ppgi).map((c) => String(c.id_docente));
      const pub = {
        id: String(l.id_publicacao),
        title: l.titulo,
        venue: l.veiculo || "—",
        year: l.ano,
        qualis: l.estrato || "N",
        authors: [String(teacherId), ...ppgi],
        coauthors: l.coautores,
        considered: l.considerada,
        confidence: 100,
        correspondencia: mescladaEm.get(l.id_publicacao) || null,
      };
      if (pub.correspondencia) pub.confidence = Number(pub.correspondencia.nota);
      porIdTela.set(pub.id, pub);
      return pub;
    });

    // Pendentes e rejeitadas: as duas publicações ainda estão separadas.
    const separadas = correspondencias
      .filter((c) => !DECIDIDAS.includes(c.decisao) && c.publicacao.ano_publicacao >= period.years[0] && c.publicacao.ano_publicacao <= period.years[period.years.length - 1])
      .map((c) => {
        const pub = {
          id: `c${c.id_correspondencia}`,
          title: c.publicacao.titulo,
          venue: `${c.publicacao.veiculo ? c.publicacao.veiculo.nome : "—"} ≈ “${c.publicacao_candidata.titulo}”`,
          year: c.publicacao.ano_publicacao,
          qualis: (calculo.pesquisa.linhas.find((l) => [c.id_publicacao, c.id_publicacao_candidata].includes(l.id_publicacao)) || {}).estrato || "N",
          authors: [...new Set([...docentesDe(c.publicacao), ...docentesDe(c.publicacao_candidata)])],
          confidence: Number(c.nota),
          correspondencia: c,
        };
        porIdTela.set(pub.id, pub);
        return pub;
      });

    return proprias.concat(separadas).sort(byStratumThenYear);
  }

  function isCoauthorshipDetected(pub) {
    return Boolean(pub.correspondencia) || pub.authors.length > 1;
  }

  function isCoauthorshipConfirmed(pub) {
    return pub.correspondencia ? DECIDIDAS.includes(pub.correspondencia.decisao) : true;
  }

  /** Marcar = confirmar a correspondência (mescla); desmarcar = rejeitar (desfaz a mescla). */
  function setCoauthorshipConfirmed(pubId, confirmed) {
    const pub = porIdTela.get(String(pubId));
    if (!pub || !pub.correspondencia) {
      PPGI.Feedback.toast("Esta coautoria veio igual nos dois currículos. Para corrigir, retire o coautor na publicação.", "error");
      if (PPGI.Shell.atual) PPGI.Shell.atual.refresh();
      return;
    }
    Dados.executar(() => Api.patch(`/correspondencias/${pub.correspondencia.id_correspondencia}`, { decisao: confirmed ? "CONFIRMADA" : "REJEITADA" }), {
      sucesso: confirmed ? "Coautoria confirmada: a pontuação será dividida." : "Coautoria rejeitada: as publicações ficam separadas.",
    });
  }

  function ppgiAuthorsOf(pub) {
    const ppgiIds = new Set(ppgiTeachers().map((t) => t.id));
    return pub.authors.filter((id) => ppgiIds.has(id));
  }

  function byStratumThenYear(a, b) {
    const ordem = (q) => (Catalog.STRATA.includes(q) ? Catalog.STRATA.indexOf(q) : 99);
    return ordem(a.qualis) - ordem(b.qualis) || b.year - a.year;
  }

  /* ---------- Período avaliativo escolhido (compartilhado entre telas) ---------- */
  function currentPeriod() {
    const id = Store.read(KEYS.period, Catalog.PERIODS[0].id);
    return Catalog.PERIODS.find((p) => p.id === id) || Catalog.PERIODS[0];
  }

  /** Troca o período e recarrega os cálculos (a tela é redesenhada quando chegam). */
  function setCurrentPeriod(id) {
    Store.write(KEYS.period, id);
    Dados.recarregar().catch((erro) => PPGI.Feedback.toast(erro.message, "error"));
  }

  PPGI.Repository = {
    allTeachers, findTeacher, updateTeacher, ppgiTeachers,
    isCoauthorshipDetected, isCoauthorshipConfirmed, setCoauthorshipConfirmed, ppgiAuthorsOf, publicationsOf,
    currentPeriod, setCurrentPeriod,
  };
})((window.PPGI = window.PPGI || {}));
