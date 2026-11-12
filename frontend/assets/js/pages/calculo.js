/*
 * pages/calculo — W-06 · Cálculo do barema: pontos por estrato e divisão das coautorias.
 */
(function (PPGI) {
  "use strict";

  const { Shell, UI, Repository, UseCases, Feedback, Format, Barema, Export, Catalog, TeacherHeader, PeriodField } = PPGI;
  const { escapeHtml: esc, formatNumber } = Format;

  const teacherId = TeacherHeader.resolveTeacherId();
  const teacher = () => Repository.findTeacher(teacherId);
  const state = { calculatedAt: Format.nowStamp().time };

  function mono(text, extra = "") {
    return `<span class="font-mono text-[13px] ${extra}">${text}</span>`;
  }

  function scoreRow(line) {
    const top = Catalog.TOP_STRATA.includes(line.pub.qualis);
    return [
      `<span class="block min-w-[15rem] font-semibold text-ink">${esc(line.pub.title)}</span><span class="text-[13px] text-muted">${esc(line.pub.venue)}</span>`,
      mono(line.pub.year),
      UI.tag(line.pub.qualis, top ? "solid" : "blue"),
      mono(line.ppgiAuthorsCount),
      mono(formatNumber(line.raw)),
      mono(line.divisor > 1 ? `÷ ${line.divisor}` : "—", "text-muted"),
      mono(formatNumber(line.points), "font-bold text-ppgi"),
    ];
  }

  function totalRow(score) {
    return [
      `<strong class="text-ppgi">Total do docente no período</strong>`, "", "", "",
      mono(formatNumber(score.raw), "font-bold text-ppgi"), "",
      mono(formatNumber(score.total), "font-bold text-ppgi"),
    ];
  }

  function productionPanel(score) {
    const body = score.lines.length
      ? UI.table({
          head: ["Publicação", "Ano", "Qualis", "Coautores PPGI", "Pontos brutos", "Divisão", "Pontos do docente"],
          rows: score.lines.map(scoreRow).concat([totalRow(score)]),
          caption: "Produção científica e pontuação",
          footnote: `Dados fictícios. Pontos por estrato conforme ${Catalog.CYCLE.resolution} do PPGI/UFAL.`,
        })
      : UI.emptyState("Nenhuma publicação do docente no período selecionado.");
    return UI.panel({
      title: "Produção científica do docente",
      actions: UI.button("⤓ Exportar planilha", { variant: "soft", action: "export", disabled: !score.lines.length }),
      body: body,
    });
  }

  function resultPanel(score) {
    return UI.panel({
      title: "Resultado",
      body: `<p class="text-[14px] text-muted">Pontuação final do docente</p>
        <p class="mt-1 text-5xl font-extrabold text-ppgi">${formatNumber(score.total)}<span class="ml-2 text-sm font-semibold text-muted">pts</span></p>
        <dl class="mt-4 space-y-2 border-t border-ppgi-soft pt-3 text-[14px] text-ink/75">
          <div class="flex justify-between"><dt>Bruto do período</dt><dd class="font-mono">${formatNumber(score.raw)}</dd></div>
          <div class="flex justify-between"><dt>Divisão em coautorias</dt><dd class="font-mono text-danger">−${formatNumber(score.coauthorshipDiscount)}</dd></div>
          <div class="flex justify-between font-semibold text-ppgi"><dt>Final</dt><dd class="font-mono">${formatNumber(score.total)}</dd></div>
        </dl>
        <p class="mt-3 font-mono text-[12px] text-muted">Calculado às ${state.calculatedAt}</p>`,
    });
  }

  function criteriaPanel(production) {
    const items = production
      .map((r) => `<li class="flex items-start justify-between gap-3 text-[14px]">
        <span>${esc(r.req)}</span>${r.met ? UI.tag("✓ Atende", "blue") : UI.tag("✗ Não atende", "fail")}
      </li>`)
      .join("");
    return UI.panel({ title: "Critérios mínimos de produção", body: `<ul class="space-y-3">${items}</ul>` });
  }

  function nextStep() {
    return `<div>
      ${UI.sectionTitle("Próximo passo")}
      <p class="text-[14px] text-ink/70">Com o cálculo conferido, gere o relatório do docente para conferência e envio.</p>
      <div class="mt-3">${UI.button("Gerar relatório do docente", { wide: true, action: "generate-report" })}</div>
    </div>`;
  }

  function render() {
    const period = Repository.currentPeriod();
    const check = Barema.checkRequirements(teacherId, period);
    return `${TeacherHeader.render(teacher(), "calculo")}
      <div class="mb-6 flex flex-wrap items-end gap-3">
        <div class="w-full sm:w-56">${PeriodField.render()}</div>
        ${UI.button("⟳ Recalcular", { variant: "outline", action: "recalculate" })}
      </div>
      <div class="grid gap-5 xl:grid-cols-[1fr_320px]">
        <div class="min-w-0">${productionPanel(check.score)}</div>
        <div class="space-y-5">
          ${resultPanel(check.score)}
          ${criteriaPanel(check.production)}
          ${nextStep()}
        </div>
      </div>`;
  }

  function exportCsv() {
    const period = Repository.currentPeriod();
    const score = Barema.computeScore(teacherId, period);
    const rows = score.lines.map((l) => [l.pub.title, l.pub.venue, l.pub.year, l.pub.qualis, l.ppgiAuthorsCount, formatNumber(l.raw), l.divisor, formatNumber(l.points)]);
    rows.push(["Total", "", "", "", "", formatNumber(score.raw), "", formatNumber(score.total)]);
    Export.downloadCsv(`calculo-${teacherId}-${period.id}.csv`, ["Publicação", "Veículo", "Ano", "Qualis", "Coautores PPGI", "Pontos brutos", "Divisor", "Pontos do docente"], rows);
    Feedback.toast("Planilha exportada.");
  }

  function generateReport() {
    UseCases.generateReport(teacherId);
    window.location.href = TeacherHeader.teacherUrl("relatorios", teacherId);
  }

  const view = Shell.start(
    () => ({
      nav: "docentes",
      title: "Cálculo do barema",
      crumbs: TeacherHeader.crumbs(teacher(), "Cálculo"),
      lead: "Cada publicação recebe pontos pelo estrato Qualis e, quando em coautoria com outros docentes do PPGI, a pontuação é dividida entre os coautores do programa.",
    }),
    {
      render,
      actions: {
        recalculate: () => { state.calculatedAt = Format.nowStamp().time; view.refresh(); Feedback.toast("Cálculo atualizado com os dados mais recentes."); },
        export: exportCsv,
        "generate-report": generateReport,
      },
      onChange: PeriodField.handler(() => view.refresh()),
    },
  );
})(window.PPGI);
