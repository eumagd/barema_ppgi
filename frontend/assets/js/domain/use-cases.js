/*
 * domain/use-cases — ações que alteram o estado do sistema.
 * As telas chamam estes casos de uso; nunca escrevem no Store diretamente.
 */
(function (PPGI) {
  "use strict";

  const { Repository, Store, Format } = PPGI;

  /* ---------- Vínculo com o PPGI ---------- */
  function unlinkFromPpgi(teacherId) {
    const teacher = Repository.findTeacher(teacherId);
    Repository.updateTeacher(teacherId, { ppgi: null });
    return { id: teacherId, previousCategory: teacher.ppgi };
  }

  function restorePpgiLink(snapshot) {
    Repository.updateTeacher(snapshot.id, { ppgi: snapshot.previousCategory });
  }

  /* ---------- Participação no ciclo ---------- */
  function flagNotParticipating(teacherId) {
    Repository.updateTeacher(teacherId, { declinedOn: Format.nowStamp().date });
  }

  function unflagNotParticipating(teacherId) {
    Repository.updateTeacher(teacherId, { declinedOn: null });
  }

  /* ---------- Sincronização do Lattes (em lote) ---------- */
  function syncAllLattes() {
    const { date, time } = Format.nowStamp();
    const teachers = Repository.allTeachers();
    const hasLattesLink = (t) => Boolean(t.lattesSync);
    const failed = teachers.filter((t) => !hasLattesLink(t));
    teachers.filter(hasLattesLink).forEach((t) => Repository.updateTeacher(t.id, { lattesSync: date }));
    return { date, time, total: teachers.length, synced: teachers.length - failed.length, failed };
  }

  /* ---------- Credenciamento ---------- */
  const PROCESS_TYPES = ["Credenciamento", "Recredenciamento"];

  function processTypeFor(teacher) {
    return teacher.ppgi ? "Recredenciamento" : "Credenciamento";
  }

  /** Recredenciamento é para quem já está no PPGI; credenciamento, para quem ainda não está. */
  function candidatesFor(type) {
    return Repository.allTeachers().filter((t) => processTypeFor(t) === type);
  }

  function startProcess(teacherIds, type) {
    teacherIds.forEach((id) =>
      Repository.updateTeacher(id, { process: { status: "andamento", label: `${type} em andamento` } }),
    );
  }

  /* ---------- Relatório individual ---------- */
  function generateReport(teacherId) {
    const teacher = Repository.findTeacher(teacherId);
    if (teacher.report && teacher.report.status === "Enviado") return teacher.report;
    const report = { status: "Gerado", date: Format.nowStamp().date };
    Repository.updateTeacher(teacherId, { report });
    return report;
  }

  function sendReport(teacherId) {
    const { date, time } = Format.nowStamp();
    const report = { status: "Enviado", date, time };
    Repository.updateTeacher(teacherId, { report });
    return report;
  }

  /* ---------- Demonstração ---------- */
  function resetSampleData() {
    Store.clearAll([PPGI.Auth.SESSION_KEY]);
  }

  PPGI.UseCases = {
    unlinkFromPpgi, restorePpgiLink, flagNotParticipating, unflagNotParticipating, syncAllLattes,
    PROCESS_TYPES, processTypeFor, candidatesFor, startProcess, generateReport, sendReport, resetSampleData,
  };
})((window.PPGI = window.PPGI || {}));
