/*
 * domain/repository — acesso aos docentes e publicações, aplicando as alterações
 * feitas pelo usuário (persistidas no Store) sobre o catálogo de exemplo.
 */
(function (PPGI) {
  "use strict";

  const { Store, Catalog } = PPGI;
  const KEYS = { teachers: "teachers", coauthorship: "coauthorship", period: "period" };

  /* ---------- Docentes ---------- */
  function teacherPatches() {
    return Store.read(KEYS.teachers, {});
  }

  function allTeachers() {
    const patches = teacherPatches();
    return Catalog.TEACHERS.map((t) => Object.assign({}, t, patches[t.id]));
  }

  function findTeacher(id) {
    return allTeachers().find((t) => t.id === id) || null;
  }

  function updateTeacher(id, patch) {
    const patches = teacherPatches();
    patches[id] = Object.assign({}, patches[id], patch);
    Store.write(KEYS.teachers, patches);
  }

  function ppgiTeachers() {
    return allTeachers().filter((t) => t.ppgi);
  }

  /* ---------- Decisão de dividir a pontuação (revisão de coautorias) ---------- */
  function coauthorshipDecisions() {
    return Store.read(KEYS.coauthorship, {});
  }

  function isCoauthorshipDetected(pub) {
    return pub.authors.length > 1 || Boolean(pub.suspect);
  }

  function isCoauthorshipConfirmed(pub) {
    const decisions = coauthorshipDecisions();
    if (pub.id in decisions) return decisions[pub.id];
    if (pub.suspect) return false;
    return pub.authors.length > 1 && (pub.confidence || 0) >= Catalog.RULES.minCoauthorConfidence;
  }

  function setCoauthorshipConfirmed(pubId, confirmed) {
    const decisions = coauthorshipDecisions();
    decisions[pubId] = confirmed;
    Store.write(KEYS.coauthorship, decisions);
  }

  function effectiveAuthors(pub) {
    const confirmedSuspect = pub.suspect && isCoauthorshipConfirmed(pub);
    return confirmedSuspect ? pub.authors.concat(pub.suspect.id) : pub.authors;
  }

  function ppgiAuthorsOf(pub) {
    const ppgiIds = new Set(ppgiTeachers().map((t) => t.id));
    return effectiveAuthors(pub).filter((id) => ppgiIds.has(id));
  }

  function publicationsOf(teacherId, period) {
    return Catalog.PUBLICATIONS.filter(
      (pub) => effectiveAuthors(pub).includes(teacherId) && period.years.includes(pub.year),
    ).sort(byStratumThenYear);
  }

  function byStratumThenYear(a, b) {
    return Catalog.STRATA.indexOf(a.qualis) - Catalog.STRATA.indexOf(b.qualis) || b.year - a.year;
  }

  /* ---------- Período avaliativo escolhido (compartilhado entre telas) ---------- */
  function currentPeriod() {
    const id = Store.read(KEYS.period, Catalog.PERIODS[0].id);
    return Catalog.PERIODS.find((p) => p.id === id) || Catalog.PERIODS[0];
  }

  function setCurrentPeriod(id) {
    Store.write(KEYS.period, id);
  }

  PPGI.Repository = {
    allTeachers, findTeacher, updateTeacher, ppgiTeachers,
    isCoauthorshipDetected, isCoauthorshipConfirmed, setCoauthorshipConfirmed, ppgiAuthorsOf, publicationsOf,
    currentPeriod, setCurrentPeriod,
  };
})((window.PPGI = window.PPGI || {}));
