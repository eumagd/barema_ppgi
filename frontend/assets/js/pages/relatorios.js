/*
 * pages/relatorios — W-05 · Relatório do docente: prévia, checagem, PDF e envio por e-mail.
 */
(function (PPGI) {
  "use strict";

  const { Shell, UI, Repository, UseCases, Feedback, Format, Barema, Export, Catalog, TeacherHeader } = PPGI;
  const { escapeHtml: esc, formatNumber } = Format;

  const teacherId = TeacherHeader.resolveTeacherId();
  const teacher = () => Repository.findTeacher(teacherId);
  const COORDINATION_EMAIL = "coordenacao.ppgi@ic.ufal.br";

  const state = { includeCoauthorship: true, copyCoordination: false, verified: false, justSent: null };

  const STATUS_TONE = { Enviado: "blue", Gerado: "soft", Rascunho: "yellow", "Não gerado": "soft" };

  function reportStatus(t) {
    return t.report ? t.report.status : "Não gerado";
  }

  function currentCheck() {
    return Barema.checkRequirements(teacherId, Repository.currentPeriod());
  }

  /* ---------- Coluna lateral ---------- */
  function cycleList() {
    const items = Repository.ppgiTeachers().map((t) => {
      const current = t.id === teacherId;
      const status = reportStatus(t);
      const cls = current ? "border-ppgi bg-ppgi-tint" : "border-ppgi-soft bg-white hover:border-ppgi";
      return `<li><a href="${TeacherHeader.teacherUrl("relatorios", t.id)}" ${current ? 'aria-current="true"' : ""} class="flex items-center justify-between gap-2 border px-3 py-2.5 ${cls}">
        <span>
          <span class="block text-[14px] font-bold text-ppgi">${esc(t.name)}</span>
          <span class="font-mono text-[11px] text-muted">ciclo ${Catalog.CYCLE.year} · ${t.report && t.report.date ? esc(t.report.date) : "—"}</span>
        </span>
        ${UI.tag(status, STATUS_TONE[status])}
      </a></li>`;
    }).join("");
    return UI.panel({ title: `Relatórios do ciclo ${Catalog.CYCLE.year}`, body: `<ul class="space-y-2">${items}</ul>` });
  }

  function verificationResult() {
    if (!state.verified) return "";
    const check = currentCheck();
    const production = check.production.filter((r) => !r.met);
    return `<div class="mt-4">${production.length
      ? UI.alert({ tone: "error", title: `${Format.plural(production.length, "critério mínimo não atendido", "critérios mínimos não atendidos")}`, body: production.map((r) => esc(r.req)).join("; ") })
      : UI.alert({ tone: "ok", title: "Critérios mínimos de produção atendidos", body: "O relatório pode ser enviado ao docente." })}</div>`;
  }

  function optionsPanel(t) {
    const sent = reportStatus(t) === "Enviado";
    return UI.panel({
      title: "Ações",
      body: `<div class="space-y-3">
          ${UI.checkbox({ checked: state.includeCoauthorship, text: "Incluir divisão das coautorias no relatório", action: "toggle-coauthorship" })}
          ${UI.checkbox({ checked: state.copyCoordination, text: "Enviar cópia à coordenação do PPGI", action: "toggle-copy" })}
        </div>
        <div class="mt-5 space-y-2">
          ${UI.button("Verificar critérios mínimos", { variant: "outline", wide: true, action: "verify" })}
          ${UI.button("⎙ Gerar PDF do relatório", { variant: "outline", wide: true, action: "print" })}
          ${UI.button(sent ? "Reenviar por e-mail" : "Disparar por e-mail ao docente", { variant: "yellow", wide: true, action: "confirm-send" })}
        </div>
        ${verificationResult()}`,
    });
  }

  /* ---------- Prévia do relatório ---------- */
  function criteriaList(check) {
    const teachingAndAdvising = check.groups.filter((g) => g.name === "Docência" || g.name === "Orientação").flatMap((g) => g.items);
    const teachingOk = teachingAndAdvising.every((i) => i.met);
    const rows = check.production.slice(0, 3).map((r) => [r.req, r.met ? UI.tag(`Atende · ${r.measured}`, "blue") : UI.tag(`Não atende · ${r.measured}`, "fail")]);
    rows.push(["Orientação e docência", teachingOk ? UI.tag("Atende", "blue") : UI.tag(`Pendente · ${teachingAndAdvising.filter((i) => !i.met).length}`, "yellow")]);
    return `<ul class="space-y-2 text-[14px] text-ink/80">${rows.map(([label, tag]) => `<li class="flex flex-wrap items-center justify-between gap-2">${esc(label)}${tag}</li>`).join("")}</ul>`;
  }

  function coauthorshipSection(score) {
    if (!state.includeCoauthorship) return "";
    const text = score.splitCount
      ? `${Format.plural(score.splitCount, "publicação compartilhada", "publicações compartilhadas")} com docentes do programa: pontuação dividida entre os coautores. Impacto no total: <span class="font-mono font-bold text-ppgi">−${formatNumber(score.coauthorshipDiscount)} pts</span>.`
      : "Nenhuma publicação em coautoria com outros docentes do PPGI no período.";
    return `<div class="mt-5">${UI.sectionTitle("Coautorias entre docentes do PPGI")}<p class="text-[14px] text-ink/80">${text}</p></div>`;
  }

  function preview(t) {
    const period = Repository.currentPeriod();
    const check = currentCheck();
    const score = check.score;
    const stratumRows = score.byStratum.map((s) => [s.stratum, s.count, formatNumber(s.points)]);
    stratumRows.push(["<strong>Total</strong>", `<strong>${score.lines.length}</strong>`, `<strong>${formatNumber(score.total)}</strong>`]);
    const issued = t.report && t.report.date ? t.report.date : Format.nowStamp().date;
    const draft = reportStatus(t) === "Rascunho" || reportStatus(t) === "Não gerado";
    return UI.panel({
      title: "Prévia do relatório",
      actions: UI.tag(reportStatus(t), STATUS_TONE[reportStatus(t)]),
      body: `<article id="print-area" class="mx-auto max-w-2xl border border-ppgi-soft bg-white p-6 shadow-sm sm:p-8">
          <header class="flex items-start justify-between gap-4 border-b-2 border-ppgi pb-4">
            <div>
              <p class="flex flex-wrap items-center gap-2 font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-ppgi">
                PPGI/UFAL · Relatório individual
                ${draft ? `<span class="border border-muted px-1.5 text-muted">Rascunho</span>` : ""}
              </p>
              <h2 class="mt-1 text-lg font-extrabold text-ppgi">Produção científica — Ciclo ${Catalog.CYCLE.year}</h2>
            </div>
            ${UI.logo("h-10 w-auto")}
          </header>
          <dl class="mt-4 grid gap-3 text-[14px] text-ink/80 sm:grid-cols-2">
            <div><dt class="inline font-semibold text-ppgi">Docente:</dt> <dd class="inline">${esc(t.name)}</dd></div>
            <div><dt class="inline font-semibold text-ppgi">Categoria:</dt> <dd class="inline">${t.ppgi ? esc(t.ppgi) : "Não vinculado"}</dd></div>
            <div><dt class="inline font-semibold text-ppgi">Período avaliativo:</dt> <dd class="inline font-mono">${period.label}</dd></div>
            <div><dt class="inline font-semibold text-ppgi">Emitido em:</dt> <dd class="inline font-mono">${esc(issued)}</dd></div>
          </dl>
          <div class="mt-6">
            ${UI.sectionTitle("Produção por estrato Qualis")}
            ${score.lines.length ? UI.table({ head: ["Estrato", "Produções", "Pontos"], rows: stratumRows, caption: "Produção por estrato" }) : UI.emptyState("Sem produção no período.")}
          </div>
          ${coauthorshipSection(score)}
          <div class="mt-5">${UI.sectionTitle("Critérios mínimos")}${criteriaList(check)}</div>
          <p class="mt-6 border-t border-ppgi-soft pt-3 font-mono text-[11px] text-muted">Dados fictícios, apenas para ilustração. Regras conforme ${Catalog.CYCLE.resolution} do PPGI/UFAL.</p>
        </article>`,
    });
  }

  function sentBanner() {
    if (!state.justSent) return "";
    return `<div class="mb-5">${UI.alert({
      tone: "ok",
      title: `Relatório enviado para ${state.justSent.to}`,
      body: `Envio registrado em ${state.justSent.date} às ${state.justSent.time}.`,
      actions: UI.button("Fechar", { variant: "outline", action: "dismiss-sent" }),
    })}</div>`;
  }

  function render() {
    const t = teacher();
    return `${TeacherHeader.render(t, "relatorios")}
      ${sentBanner()}
      <div class="grid gap-5 xl:grid-cols-[320px_1fr]">
        <div class="space-y-5">${optionsPanel(t)}${cycleList()}</div>
        <div class="min-w-0">${preview(t)}</div>
      </div>`;
  }

  /* ---------- Ações ---------- */
  function send() {
    const t = teacher();
    const report = UseCases.sendReport(t.id);
    const to = state.copyCoordination ? `${t.email} (cópia: ${COORDINATION_EMAIL})` : t.email;
    state.justSent = { to, date: report.date, time: report.time };
    view.refresh();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function confirmSend() {
    const t = teacher();
    const unmet = currentCheck().production.filter((r) => !r.met);
    const warning = unmet.length
      ? `<p class="mb-3 border-l-4 border-danger bg-danger/5 px-3 py-2 text-danger"><strong>Atenção:</strong> ${Format.plural(unmet.length, "critério mínimo não está atendido", "critérios mínimos não estão atendidos")}. O relatório será enviado mesmo assim.</p>`
      : "";
    const copy = state.copyCoordination ? `, com cópia para ${COORDINATION_EMAIL}` : "";
    Feedback.openModal({
      title: "Enviar relatório por e-mail?",
      body: `${warning}O relatório de <strong>${esc(t.name)}</strong> será enviado para ${esc(t.email)}${copy}. Depois de enviado, não é possível cancelar.`,
      actions: [
        { text: "Cancelar", variant: "outline" },
        { text: "Enviar agora", onClick: send },
      ],
    });
  }

  function printPdf() {
    UseCases.generateReport(teacherId);
    view.refresh();
    Export.printReport();
  }

  const view = Shell.start(
    () => ({
      nav: "docentes",
      title: "Relatório do docente",
      crumbs: TeacherHeader.crumbs(teacher(), "Relatório"),
      lead: "Geração, checagem e envio do relatório individual de produção científica. O sistema verifica os critérios mínimos antes do envio e registra a situação de cada relatório do ciclo.",
    }),
    {
      render,
      actions: {
        verify: () => { state.verified = true; view.refresh(); },
        print: printPdf,
        "confirm-send": confirmSend,
        "dismiss-sent": () => { state.justSent = null; view.refresh(); },
      },
      onChange: {
        "toggle-coauthorship": (el) => { state.includeCoauthorship = el.checked; view.refresh(); },
        "toggle-copy": (el) => { state.copyCoordination = el.checked; view.refresh(); },
      },
    },
  );
})(window.PPGI);
