/*
 * pages/verificacao — W-07 · Verificação de requisitos: previsto × apurado, item a item.
 */
(function (PPGI) {
  "use strict";

  const { Shell, UI, Repository, UseCases, Feedback, Format, Barema, Export, Catalog, TeacherHeader, PeriodField } = PPGI;
  const { escapeHtml: esc } = Format;

  const teacherId = TeacherHeader.resolveTeacherId();
  const teacher = () => Repository.findTeacher(teacherId);

  function slackClass(slack) {
    if (slack.startsWith("+")) return "text-ppgi";
    if (slack.startsWith("−")) return "text-danger";
    return "text-muted";
  }

  function statusTag(met) {
    return met ? UI.tag("✓ Atende", "blue") : UI.tag("✗ Não atende", "fail");
  }

  function eligibleNotAccreditedBanner(t, check) {
    const canStart = check.eligible && !t.ppgi && t.process.status !== "andamento";
    if (!canStart) return "";
    return `<div class="mb-5">${UI.alert({
      tone: "highlight",
      title: `${t.name} está apto(a), mas ainda não é credenciado(a) no PPGI`,
      body: "Atende a todos os requisitos do período e não possui processo aberto.",
      actions: UI.button("Iniciar credenciamento", { href: TeacherHeader.teacherUrl("credenciamento", t.id) }),
    })}</div>`;
  }

  function matrixRows(check) {
    return check.groups.flatMap((g) => [{ group: g.name }].concat(
      g.items.map((i) => [
        `<span class="font-semibold text-ppgi">${esc(i.req)}</span>`,
        `<span class="font-mono text-[13px]">${esc(i.expected)}</span>`,
        `<span class="font-mono text-[13px]">${esc(i.measured)}</span>`,
        `<span class="font-mono text-[13px] font-bold ${slackClass(i.slack)}">${esc(i.slack)}</span>`,
        statusTag(i.met),
      ]),
    ));
  }

  function surplusCallout(check) {
    const surplus = Barema.upperStrataSurplus(check);
    if (surplus <= 0) return "";
    return `<div class="mt-4 flex items-start gap-3 border border-black/20 bg-ppgi-yellow px-4 py-3">
      <span aria-hidden="true" class="mt-1 h-3 w-3 shrink-0 bg-black ring-1 ring-black/20"></span>
      <p class="text-[14px] font-semibold leading-relaxed text-black">A4+ excedente: ${check.production[0].measured} em estratos A1–A4 contra ${Catalog.RULES.minUpperStrata} previstas, ${Format.plural(surplus, "produção", "produções")} acima do mínimo, computadas como folga no parecer.</p>
    </div>`;
  }

  function matrixPanel(check) {
    return UI.panel({
      title: "Matriz de requisitos do docente",
      actions: UI.button("⤓ Exportar matriz", { variant: "soft", action: "export" }),
      body: UI.table({
        head: ["Requisito", "Previsto na resolução", "Apurado no período", "Folga", "Situação"],
        rows: matrixRows(check),
        caption: "Requisitos previstos e apurados",
        footnote: `Dados fictícios. Requisitos conforme ${Catalog.CYCLE.resolution} do PPGI/UFAL.`,
      }) + surplusCallout(check),
    });
  }

  function verdictPanel(check) {
    const unmet = check.unmet.length
      ? `<div class="mt-4 space-y-2 border-t border-ppgi-soft pt-3">
          <p class="font-mono text-[11px] font-bold uppercase tracking-[0.1em] text-muted">Requisitos não atendidos</p>
          ${check.unmet.map((r) => `<p class="flex items-start gap-2 text-[13px] text-ink/80"><span aria-hidden="true" class="mt-1.5 h-2 w-2 shrink-0 bg-ppgi-yellow ring-1 ring-ink/20"></span>${esc(r.group)} · ${esc(r.req)}</p>`).join("")}
        </div>`
      : "";
    return UI.panel({
      title: "Parecer",
      body: `<p class="text-[14px] text-muted">Requisitos atendidos</p>
        <p class="mt-1 text-5xl font-extrabold text-ppgi">${check.metCount}<span class="text-ink/30">/${check.total}</span></p>
        <p class="mt-3 text-[14px] font-semibold text-ink">Situação: ${check.eligible ? UI.tag("✓ Apto", "blue") : UI.tag("✗ Não apto", "fail")}</p>
        ${unmet}`,
    });
  }

  function legend() {
    return UI.help("Como ler a matriz", `<ul class="space-y-2.5">
      <li class="flex flex-wrap items-center gap-2">${UI.tag("✓ Atende", "blue")} apurado igual ou superior ao previsto</li>
      <li class="flex flex-wrap items-center gap-2">${UI.tag("✗ Não atende", "fail")} apurado abaixo do mínimo previsto</li>
      <li class="flex flex-wrap items-center gap-2"><span class="font-mono font-bold text-ppgi">+N</span> excedente · <span class="font-mono font-bold text-danger">−N</span> quanto falta</li>
    </ul>`);
  }

  function nextStep(check) {
    const notify = check.unmet.length
      ? UI.button("Notificar docente sobre pendências", { wide: true, action: "notify" })
      : "";
    return `<div>
      ${UI.sectionTitle("Próximo passo")}
      <p class="text-[14px] text-ink/70">${check.unmet.length ? "Avise o docente sobre o que falta ou gere o relatório com o parecer." : "Gere o relatório do docente com o parecer da verificação."}</p>
      <div class="mt-3 grid gap-2">
        ${notify}
        ${UI.button("Gerar relatório com parecer", { variant: check.unmet.length ? "outline" : "primary", wide: true, action: "generate-report" })}
      </div>
    </div>`;
  }

  function render() {
    const t = teacher();
    const check = Barema.checkRequirements(teacherId, Repository.currentPeriod());
    return `${TeacherHeader.render(t, "verificacao")}
      ${eligibleNotAccreditedBanner(t, check)}
      <div class="mb-6 flex flex-wrap items-end gap-3">
        <div class="w-full sm:w-56">${PeriodField.render()}</div>
        ${UI.button("⟳ Reavaliar requisitos", { variant: "outline", action: "reevaluate" })}
      </div>
      <div class="grid gap-5 xl:grid-cols-[1fr_320px]">
        <div class="min-w-0">${matrixPanel(check)}</div>
        <div class="space-y-5">${verdictPanel(check)}${legend()}${nextStep(check)}</div>
      </div>`;
  }

  function exportCsv() {
    const period = Repository.currentPeriod();
    const check = Barema.checkRequirements(teacherId, period);
    const rows = check.items.map((i) => [i.group, i.req, i.expected, i.measured, i.slack, i.met ? "Atende" : "Não atende"]);
    Export.downloadCsv(`requisitos-${teacherId}-${period.id}.csv`, ["Grupo", "Requisito", "Previsto", "Apurado", "Folga", "Situação"], rows);
    Feedback.toast("Matriz exportada.");
  }

  function confirmNotify() {
    const t = teacher();
    const check = Barema.checkRequirements(teacherId, Repository.currentPeriod());
    const list = check.unmet.map((r) => `<li>${esc(r.req)}</li>`).join("");
    Feedback.openModal({
      title: "Notificar docente sobre pendências?",
      body: `Será enviado um e-mail para <strong>${esc(t.email)}</strong> listando ${Format.plural(check.unmet.length, "requisito não atendido", "requisitos não atendidos")}:<ul class="mt-2 list-disc pl-5">${list}</ul>`,
      actions: [
        { text: "Cancelar", variant: "outline" },
        { text: "Enviar notificação", onClick: () => Feedback.toast(`Notificação enviada para ${t.email}.`) },
      ],
    });
  }

  const view = Shell.start(
    () => ({
      nav: "docentes",
      title: "Verificação de requisitos",
      crumbs: TeacherHeader.crumbs(teacher(), "Requisitos"),
      lead: "Confronta, requisito a requisito, o que a resolução prevê com o que foi apurado do docente no período, assinalando o que atende e o que não atende.",
    }),
    {
      render,
      actions: {
        reevaluate: () => { view.refresh(); Feedback.toast("Requisitos reavaliados."); },
        export: exportCsv,
        notify: confirmNotify,
        "generate-report": () => { UseCases.generateReport(teacherId); window.location.href = TeacherHeader.teacherUrl("relatorios", teacherId); },
      },
      onChange: PeriodField.handler(() => view.refresh()),
    },
  );
})(window.PPGI);
