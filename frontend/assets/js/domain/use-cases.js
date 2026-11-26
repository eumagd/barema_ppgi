/*
 * domain/use-cases — ações que alteram o estado do sistema, agora pela API.
 * As telas chamam estes casos de uso; cada um ajusta a tela na hora, chama a API e
 * recarrega os dados (Dados.executar), mostrando o erro da API se algo der errado.
 */
(function (PPGI) {
  "use strict";

  const { Repository, Dados, Api, Format } = PPGI;

  /* ---------- Vínculo com o PPGI ---------- */
  /** Devolve o vínculo anterior (para "desfazer") ou null se a API recusar. */
  async function unlinkFromPpgi(teacherId) {
    const teacher = Repository.findTeacher(teacherId);
    const snapshot = { id: teacherId, previousCategory: teacher.ppgi, previousVinculo: teacher.vinculo };
    const ok = await Dados.executar(() => Api.post(`/docentes/${teacherId}/desvincular`));
    return ok ? snapshot : null;
  }

  function restorePpgiLink(snapshot) {
    Repository.updateTeacher(snapshot.id, { ppgi: snapshot.previousCategory, vinculo: snapshot.previousVinculo });
    Dados.executar(() => Api.patch(`/docentes/${snapshot.id}`, { vinculo: snapshot.previousVinculo }));
  }

  /* ---------- Participação no ciclo (RF16) ---------- */
  function flagNotParticipating(teacherId) {
    Repository.updateTeacher(teacherId, { declinedOn: Format.nowStamp().date });
    Dados.executar(() => Api.put(`/docentes/${teacherId}/recusa`), { sucesso: "Sinalização registrada." });
  }

  function unflagNotParticipating(teacherId) {
    Repository.updateTeacher(teacherId, { declinedOn: null });
    Dados.executar(() => Api.del(`/docentes/${teacherId}/recusa`));
  }

  /* ---------- Importação do QLattes ---------- */
  /** CSV de um docente. Devolve a resposta da API; lança o erro (ex.: nome que não bate). */
  async function importCsv(teacherId, file, { confirmName = false } = {}) {
    const form = new FormData();
    form.append("arquivo", file);
    form.append("id_docente", teacherId);
    if (confirmName) form.append("confirmar_nome", "true");
    const resposta = await Api.enviarArquivo("/importacoes", form);
    await Dados.recarregar();
    return resposta;
  }

  /** Salva o ORCID do docente (aceita a URL https://orcid.org/...). Lança o erro da API. */
  async function saveOrcid(teacherId, orcid) {
    await Api.patch(`/docentes/${teacherId}`, { orcid: orcid ? orcid.trim() : null });
    await Dados.recarregar();
  }

  /** Importa a produção do docente pelo OpenAlex (Conector 2). Lança o erro da API. */
  async function importOpenAlex(teacherId) {
    const resposta = await Api.post(`/importacoes/openalex/${teacherId}`, {});
    await Dados.recarregar();
    return resposta;
  }

  /** .zip com vários CSVs: devolve o lote e chama onProgress(lote) até terminar. */
  async function importZip(file, onProgress) {
    const form = new FormData();
    form.append("arquivo", file);
    let lote = await Api.enviarArquivo("/importacoes", form);
    onProgress(lote);
    while (!["CONCLUIDO", "FALHA"].includes(lote.status)) {
      await new Promise((r) => setTimeout(r, 1000));
      lote = await Api.get(`/importacoes/lotes/${lote.id_lote}`);
      onProgress(lote);
    }
    await Dados.recarregar();
    return lote;
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

  /** Abre os processos na API (em lote). Devolve os resultados por docente. */
  async function startProcess(teacherIds, type) {
    const resposta = await Dados.executar(() =>
      Api.post("/avaliacoes/lote", { ids_docentes: teacherIds.map(Number), tipo: type.toUpperCase() }),
    );
    const resultados = resposta ? resposta.resultados : [];
    const falhas = resultados.filter((r) => r.status === "FALHA");
    if (falhas.length) {
      PPGI.Feedback.toast(falhas.map((f) => `${(Repository.findTeacher(f.id_docente) || {}).name || f.id_docente}: ${f.erro}`).join(" · "), "error");
    }
    return resultados;
  }

  /* ---------- Relatório individual ---------- */
  function latestProcessId(teacherId) {
    const t = Repository.findTeacher(teacherId);
    return t && t.process.id_processo;
  }

  /** Marca o parecer como gerado (precisa de um processo aberto para o docente). */
  function generateReport(teacherId) {
    const t = Repository.findTeacher(teacherId);
    const id = latestProcessId(teacherId);
    if (!id) return t.report;
    if (t.report && t.report.status === "Enviado") return t.report;
    const report = { status: "Gerado", date: Format.nowStamp().date, id_processo: id };
    Repository.updateTeacher(teacherId, { report });
    Dados.executar(() => Api.post(`/avaliacoes/${id}/relatorio`));
    return report;
  }

  /** Envia o parecer por e-mail. Devolve { date, time } ou lança o erro da API. */
  async function sendReport(teacherId, { copyTo } = {}) {
    const id = latestProcessId(teacherId);
    if (!id) throw new Error("Abra o processo do docente (aba Credenciamento) antes de enviar o relatório.");
    await Api.post(`/avaliacoes/${id}/relatorio/enviar`, {});
    if (copyTo) await Api.post(`/avaliacoes/${id}/relatorio/enviar`, { para: copyTo });
    await Dados.recarregar();
    return Format.nowStamp();
  }

  /** Parecer em texto/HTML gerado pelo back end. */
  function fetchReport(teacherId) {
    const id = latestProcessId(teacherId);
    return id ? Api.get(`/avaliacoes/${id}/relatorio`) : Promise.resolve(null);
  }

  /* ---------- Exportações ---------- */
  function exportProduction(format, { teacherId, period } = {}) {
    const p = new URLSearchParams();
    if (teacherId) p.set("id_docente", teacherId);
    if (period) {
      p.set("inicio", period.years[0]);
      p.set("fim", period.years[period.years.length - 1]);
    }
    return Api.baixar(`/exportacoes/producao.${format}?${p}`, `producao.${format}`).catch((e) => PPGI.Feedback.toast(e.message, "error"));
  }

  function exportEvaluations(format) {
    return Api.baixar(`/exportacoes/avaliacoes.${format}`, `avaliacoes.${format}`).catch((e) => PPGI.Feedback.toast(e.message, "error"));
  }

  /** Antes: apagava os dados de demonstração. Agora os dados vêm do servidor: só recarrega. */
  function resetSampleData() {
    return Dados.recarregar();
  }

  PPGI.UseCases = {
    unlinkFromPpgi, restorePpgiLink, flagNotParticipating, unflagNotParticipating, importCsv, importZip, saveOrcid, importOpenAlex,
    PROCESS_TYPES, processTypeFor, candidatesFor, startProcess, generateReport, sendReport, fetchReport,
    exportProduction, exportEvaluations, resetSampleData,
  };
})((window.PPGI = window.PPGI || {}));
