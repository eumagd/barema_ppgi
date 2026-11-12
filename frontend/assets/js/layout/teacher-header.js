/*
 * layout/teacher-header — identificação do docente + abas das funções individuais.
 *
 * É o ÚNICO caminho para Perfil, Cálculo, Requisitos, Relatório e Credenciamento
 * (antes havia abas + cartões com botões + itens no menu levando às mesmas telas).
 */
(function (PPGI) {
  "use strict";

  const { Repository, Format, UI } = PPGI;
  const { escapeHtml: esc, pageUrl } = Format;
  const DEFAULT_TEACHER = "bruno";

  const TABS = [
    { key: "perfil", label: "Perfil" },
    { key: "calculo", label: "Cálculo" },
    { key: "verificacao", label: "Requisitos" },
    { key: "relatorios", label: "Relatório" },
    { key: "credenciamento", label: "Credenciamento" },
  ];

  function resolveTeacherId() {
    const requested = Format.queryParam("d");
    return Repository.findTeacher(requested) ? requested : DEFAULT_TEACHER;
  }

  function teacherUrl(page, teacherId, extra) {
    return pageUrl(page, Object.assign({ d: teacherId }, extra));
  }

  function crumbs(teacher, current) {
    const base = [
      { label: "Painel", href: "painel.html" },
      { label: "Docentes", href: "professores.html" },
    ];
    if (!current) return base.concat({ label: teacher.name });
    return base.concat({ label: teacher.name, href: teacherUrl("perfil", teacher.id) }, { label: current });
  }

  function ppgiTag(teacher) {
    return teacher.ppgi ? UI.tag(`■ PPGI · ${teacher.ppgi}`, "yellow") : UI.tag("Não vinculado ao PPGI", "soft");
  }

  function processTag(teacher) {
    const tone = teacher.process.status === "andamento" ? "blue" : "soft";
    return UI.tag(`${teacher.process.status === "andamento" ? "◷ " : ""}${teacher.process.label}`, tone);
  }

  function infoItem(label, value) {
    return `<div><dt class="text-[12px] text-muted">${esc(label)}</dt><dd class="mt-0.5 text-[13px] font-semibold text-ink">${value}</dd></div>`;
  }

  function tabs(teacherId, activeKey) {
    const links = TABS.map((t) => {
      const active = t.key === activeKey;
      const cls = active ? "border-ppgi-yellow text-ppgi" : "border-transparent text-ink/65 hover:border-ppgi-soft hover:text-ppgi";
      return `<a href="${teacherUrl(t.key, teacherId)}" ${active ? 'aria-current="page"' : ""} class="-mb-px whitespace-nowrap border-b-4 px-4 py-2.5 text-[14px] font-semibold ${cls}">${t.label}</a>`;
    }).join("");
    return `<nav aria-label="Funções do docente" class="mb-6 flex overflow-x-auto border-b border-ppgi-soft">${links}</nav>`;
  }

  function render(teacher, activeKey) {
    const lattes = teacher.lattesSync
      ? `<span class="font-mono">${esc(teacher.lattesSync)}</span>`
      : `<span class="text-danger">Link ausente</span>`;
    return `<section class="mb-4 flex flex-wrap items-center justify-between gap-4 border border-ppgi-soft border-l-4 border-l-ppgi-yellow bg-white px-5 py-4">
        <div class="flex items-center gap-3">
          ${UI.avatar(teacher.name, "h-11 w-11 text-[13px]")}
          <div>
            <h2 class="text-xl font-extrabold text-ppgi">${esc(teacher.name)}</h2>
            <p class="text-[13px] text-muted">${esc(teacher.email)} · ${esc(teacher.department)}</p>
          </div>
        </div>
        <dl class="grid w-full grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2 lg:w-auto lg:grid-cols-4">
          ${infoItem("Vínculo institucional", `${esc(teacher.employment)} · IC`)}
          ${infoItem("Vínculo com o PPGI", ppgiTag(teacher))}
          ${infoItem("Credenciamento", processTag(teacher))}
          ${infoItem("Lattes sincronizado", lattes)}
        </dl>
      </section>
      ${tabs(teacher.id, activeKey)}`;
  }

  PPGI.TeacherHeader = { resolveTeacherId, teacherUrl, crumbs, render, ppgiTag, processTag };
})((window.PPGI = window.PPGI || {}));
