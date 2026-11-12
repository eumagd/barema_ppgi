/*
 * pages/painel — tela inicial após o login: situação do ciclo e o que precisa de atenção.
 */
(function (PPGI) {
  "use strict";

  const { Shell, UI, Repository, Barema, Catalog, Auth, Format, TeacherHeader } = PPGI;
  const { escapeHtml: esc, formatNumber } = Format;

  const DAY_MS = 24 * 60 * 60 * 1000;

  function daysUntilDeadline() {
    const deadline = new Date(`${Catalog.CYCLE.deadlineIso}T23:59:59`);
    return Math.max(0, Math.ceil((deadline - new Date()) / DAY_MS));
  }

  function greeting() {
    const hour = new Date().getHours();
    if (hour < 12) return "Bom dia";
    if (hour < 18) return "Boa tarde";
    return "Boa noite";
  }

  function cycleStats(teachers) {
    const ppgi = teachers.filter((t) => t.ppgi);
    const inProgress = teachers.filter((t) => t.process.status === "andamento").length;
    const sent = ppgi.filter((t) => t.report && t.report.status === "Enviado").length;
    return `<div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      ${UI.stat({ label: "Docentes do IC", value: teachers.length, hint: `${ppgi.length} vinculados ao PPGI` })}
      ${UI.stat({ label: "Processos em andamento", value: inProgress })}
      ${UI.stat({ label: "Relatórios enviados", value: `${sent}<span class="text-base text-muted">/${ppgi.length}</span>`, hint: `ciclo ${Catalog.CYCLE.year}` })}
      ${UI.stat({ label: "Dias até o prazo", value: daysUntilDeadline(), hint: Catalog.CYCLE.deadline })}
    </div>`;
  }

  function teacherLink(t, page) {
    return `<a href="${TeacherHeader.teacherUrl(page, t.id)}" class="flex items-center gap-2 font-semibold text-ppgi hover:underline">${UI.avatar(t.name)}${esc(t.name)}</a>`;
  }

  function processesPanel(teachers) {
    const period = Repository.currentPeriod();
    const rows = teachers
      .filter((t) => t.process.status === "andamento")
      .map((t) => {
        const check = Barema.checkRequirements(t.id, period);
        return [
          teacherLink(t, "verificacao"),
          esc(t.process.label.replace(" em andamento", "")),
          `<span class="font-mono">${formatNumber(check.score.total)}</span>`,
          `<span class="font-mono">${check.metCount}/${check.total}</span>`,
          check.eligible ? UI.tag("✓ Apto", "blue") : UI.tag("✗ Pendências", "fail"),
        ];
      });
    return UI.panel({
      title: "Processos em andamento",
      actions: UI.button("Novo processo", { variant: "outline", href: "credenciamento.html" }),
      body: rows.length
        ? UI.table({ head: ["Docente", "Tipo", "Pontos", "Requisitos", "Situação"], rows, caption: "Processos em andamento", footnote: `Período avaliativo ${period.label}.` })
        : UI.emptyState("Nenhum processo em andamento neste ciclo."),
    });
  }

  function pendingReportsPanel(teachers) {
    const pending = teachers.filter((t) => t.ppgi && (!t.report || t.report.status !== "Enviado"));
    const items = pending.map((t) => `<li class="flex flex-wrap items-center justify-between gap-2 border-b border-ppgi-soft py-2.5 last:border-0">
        ${teacherLink(t, "relatorios")}
        ${UI.tag(t.report ? t.report.status : "Não gerado", t.report && t.report.status === "Gerado" ? "soft" : "yellow")}
      </li>`).join("");
    return UI.panel({
      title: "Relatórios a enviar",
      body: pending.length ? `<ul>${items}</ul>` : UI.emptyState("Todos os relatórios do ciclo foram enviados."),
    });
  }

  function lattesPanel(teachers) {
    const missing = teachers.filter((t) => !t.lattesSync);
    const body = missing.length
      ? `<p class="text-[14px] text-ink/80">${Format.plural(missing.length, "docente está", "docentes estão")} sem o link do Currículo Lattes e ficam fora da sincronização:</p>
         <ul class="mt-3 space-y-2">${missing.map((t) => `<li>${teacherLink(t, "perfil")}</li>`).join("")}</ul>`
      : `<p class="text-[14px] text-ink/80">Todos os docentes têm o Currículo Lattes vinculado.</p>`;
    return UI.panel({ title: "Currículo Lattes", actions: UI.button("Ver docentes", { variant: "ghost", href: "professores.html" }), body });
  }

  function render() {
    const teachers = Repository.allTeachers();
    return `<div class="space-y-6">
      ${cycleStats(teachers)}
      <div class="grid gap-5 xl:grid-cols-[1fr_360px]">
        <div class="min-w-0">${processesPanel(teachers)}</div>
        <div class="space-y-5">${pendingReportsPanel(teachers)}${lattesPanel(teachers)}</div>
      </div>
    </div>`;
  }

  const user = Auth.currentUser();
  Shell.start(
    {
      nav: "painel",
      title: "Painel",
      lead: user ? `${greeting()}, ${esc(user.name)}. Esta é a situação do ciclo ${Catalog.CYCLE.year} de credenciamento e recredenciamento.` : "",
    },
    { render },
  );
})(window.PPGI);
