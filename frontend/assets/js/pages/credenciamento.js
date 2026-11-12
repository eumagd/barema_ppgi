/*
 * pages/credenciamento — Credenciamento / recredenciamento, individual ou em lote.
 *
 * Antes de iniciar, a tela mostra a conferência dos requisitos de cada docente
 * selecionado (apto ou com pendências) e a revisão das coautorias identificadas.
 *
 * Entradas: credenciamento.html (menu) · ?d=<id> (aba do docente) · ?modo=lote
 */
(function (PPGI) {
  "use strict";

  const { Shell, UI, Repository, UseCases, Feedback, Format, Barema, Catalog, TeacherHeader, PeriodField } = PPGI;
  const { escapeHtml: esc, formatNumber } = Format;

  const MODES = [
    { value: "individual", label: "Individual" },
    { value: "lote", label: "Em lote" },
  ];

  const contextId = Repository.findTeacher(Format.queryParam("d")) ? Format.queryParam("d") : null;
  const initialMode = Format.queryParam("modo") === "lote" ? "lote" : "individual";
  const initialType = contextId ? UseCases.processTypeFor(Repository.findTeacher(contextId)) : "Recredenciamento";

  const state = {
    mode: initialMode,
    teacherId: contextId,
    type: initialType,
    batch: UseCases.candidatesFor(initialType).map((t) => t.id),
    started: null,
  };

  const isBatch = () => state.mode === "lote";
  const showsTeacherHeader = () => !isBatch() && Boolean(contextId);
  const currentTeacher = () => (state.teacherId ? Repository.findTeacher(state.teacherId) : null);
  const processType = () => (isBatch() ? state.type : currentTeacher() ? UseCases.processTypeFor(currentTeacher()) : "—");

  function selectedIds() {
    if (isBatch()) return state.batch;
    return state.teacherId ? [state.teacherId] : [];
  }

  function checks() {
    const period = Repository.currentPeriod();
    return selectedIds().map((id) => ({ teacher: Repository.findTeacher(id), result: Barema.checkRequirements(id, period) }));
  }

  /* ---------- Coautorias ---------- */
  function detectedPublications() {
    const period = Repository.currentPeriod();
    const byId = new Map();
    selectedIds().forEach((id) =>
      Repository.publicationsOf(id, period).filter(Repository.isCoauthorshipDetected).forEach((p) => byId.set(p.id, p)),
    );
    return Array.from(byId.values());
  }

  function coauthorNames(pub) {
    const names = pub.authors
      .filter((id) => isBatch() || id !== state.teacherId)
      .map((id) => Repository.findTeacher(id))
      .filter((t) => t && t.ppgi)
      .map((t) => esc(t.name));
    if (pub.suspect) names.push(`${esc(pub.suspect.name)} <span class="text-muted">(nome parecido, possível externo)</span>`);
    return names.join(", ") || `<span class="text-muted">—</span>`;
  }

  function confidenceCell(pub) {
    const confidence = pub.suspect ? pub.suspect.confidence : pub.confidence;
    const review = confidence < Catalog.RULES.minCoauthorConfidence ? UI.tag("⚠ revisar", "yellow") : "";
    return `<span class="flex flex-wrap items-center gap-2 font-mono text-[13px]">${confidence}% ${review}</span>`;
  }

  function coauthorshipRow(pub) {
    const checked = Repository.isCoauthorshipConfirmed(pub);
    return [
      `<input type="checkbox" class="h-5 w-5 accent-ppgi" data-change="toggle-coauthorship" data-id="${pub.id}" aria-label="Dividir a pontuação de ${esc(pub.title)}"${checked ? " checked" : ""}>`,
      `<span class="block min-w-[14rem] font-semibold text-ppgi">${esc(pub.title)}</span><span class="text-[13px] text-muted">${esc(pub.venue)} · ${pub.year}</span>`,
      UI.tag(pub.qualis, "blue"),
      coauthorNames(pub),
      confidenceCell(pub),
    ];
  }

  /* ---------- Configuração ---------- */
  function teacherPicker() {
    if (contextId) return "";
    const options = Repository.allTeachers().map((t) => ({ value: t.id, label: `${t.name}${t.ppgi ? ` · PPGI ${t.ppgi}` : ""}` }));
    return `<div class="mt-4 md:max-w-md">${UI.selectField({ id: "docente", label: "Docente", options, value: state.teacherId || "", action: "set-teacher", placeholder: "Selecione um docente…" })}</div>`;
  }

  function typeField() {
    if (isBatch()) {
      return UI.selectField({ id: "tipo", label: "Tipo", options: UseCases.PROCESS_TYPES.map((t) => ({ value: t, label: t })), value: state.type, action: "set-type" });
    }
    const hint = currentTeacher() ? (currentTeacher().ppgi ? "Docente já vinculado ao PPGI" : "Docente ainda fora do PPGI") : "Definido pelo docente escolhido";
    return `<div>
      <span class="mb-1 block text-[14px] font-semibold text-ppgi">Tipo</span>
      <p class="border border-ppgi-soft bg-ppgi-tint/50 px-3 py-2 text-[15px] font-semibold text-ink">${esc(processType())}</p>
      <p class="mt-1 text-[12px] text-muted">${hint}</p>
    </div>`;
  }

  function batchList() {
    if (!isBatch()) return "";
    const candidates = UseCases.candidatesFor(state.type);
    const audience = state.type === "Recredenciamento" ? "docentes já vinculados ao PPGI" : "docentes do IC ainda fora do PPGI";
    const items = candidates.map((t) => {
      const on = state.batch.includes(t.id);
      return `<div class="border px-3 py-2 ${on ? "border-ppgi bg-ppgi-tint" : "border-ppgi-soft bg-white"}">
        ${UI.checkbox({ checked: on, text: `${esc(t.name)} <span class="text-[12px] text-muted">· ${esc(t.ppgi || t.department)}</span>`, action: "toggle-batch", data: { id: t.id } })}
      </div>`;
    }).join("");
    const allSelected = candidates.length && state.batch.length === candidates.length;
    return `<div class="mt-5">
      <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
        ${UI.sectionTitle(`Docentes do lote (${state.batch.length} de ${candidates.length})`)}
        ${UI.button(allSelected ? "Limpar seleção" : "Selecionar todos", { variant: "ghost", action: allSelected ? "clear-batch" : "select-all" })}
      </div>
      <p class="mb-3 text-[13px] text-muted">${state.type}: lista os ${audience}.</p>
      <div class="grid gap-2 sm:grid-cols-2">${items || UI.emptyState("Nenhum docente disponível para este tipo de processo.")}</div>
    </div>`;
  }

  function configuration() {
    return UI.panel({
      title: "Configuração",
      body: `<div class="grid gap-4 md:grid-cols-3">
          <div>
            <span class="mb-1 block text-[14px] font-semibold text-ppgi">Modo</span>
            ${UI.segmented({ label: "Modo do processo", options: MODES, value: state.mode, action: "set-mode" })}
          </div>
          ${typeField()}
          ${PeriodField.render()}
        </div>
        ${isBatch() ? batchList() : teacherPicker()}`,
    });
  }

  /* ---------- Conferência dos requisitos ---------- */
  function reviewRow({ teacher, result }) {
    const pending = result.unmet.map((r) => esc(r.req)).join("; ");
    return [
      `<a href="${TeacherHeader.teacherUrl("verificacao", teacher.id)}" class="flex items-center gap-2 whitespace-nowrap font-semibold text-ppgi underline decoration-ppgi-soft underline-offset-2 hover:decoration-ppgi">${UI.avatar(teacher.name)}${esc(teacher.name)}</a>`,
      `<span class="font-mono">${formatNumber(result.score.total)}</span>`,
      `<span class="font-mono">${result.metCount}/${result.total}</span>`,
      result.eligible ? UI.tag("✓ Apto", "blue") : UI.tag("✗ Não apto", "fail"),
      pending ? `<span class="block min-w-[12rem] text-[13px] text-ink/80">${pending}</span>` : `<span class="text-muted">—</span>`,
    ];
  }

  function requirementsReview(list) {
    const eligible = list.filter((c) => c.result.eligible).length;
    const blocked = list.length - eligible;
    const summary = `${UI.tag(`${eligible} apto${eligible === 1 ? "" : "s"}`, "blue")} ${blocked ? UI.tag(`${blocked} com pendências`, "fail") : ""}`;
    const removeAction = isBatch() && blocked
      ? `<div class="mt-4">${UI.button(`Remover ${Format.plural(blocked, "docente não apto", "docentes não aptos")} do lote`, { variant: "outline", action: "remove-ineligible" })}</div>`
      : "";
    return UI.panel({
      title: "Conferência dos requisitos",
      actions: summary,
      body: `<p class="mb-3 text-[14px] text-ink/80">Confira se ${isBatch() ? "cada docente atende" : "o docente atende"} aos requisitos da ${esc(Catalog.CYCLE.resolution)} no período ${Repository.currentPeriod().label}. O nome abre a verificação completa.</p>
        ${UI.table({ head: ["Docente", "Pontos", "Requisitos", "Situação", "Pendências"], rows: list.map(reviewRow), caption: "Conferência dos requisitos dos docentes selecionados" })}
        ${removeAction}`,
    });
  }

  function coauthorshipPanel(pubs) {
    const body = pubs.length
      ? UI.table({
          head: ["Dividir", "Publicação", "Estrato", "Coautor(es) do PPGI", "Confiança"],
          rows: pubs.map(coauthorshipRow),
          caption: "Coautorias identificadas",
          footnote: "Baixa confiança = nome parecido, possível autor externo.",
        })
      : UI.emptyState("Nenhuma coautoria entre docentes do PPGI encontrada no período.");
    return UI.panel({
      title: "Coautorias identificadas",
      body: `<p class="mb-3 text-[14px] text-ink/80">A identificação usa a semelhança dos nomes e pode errar. Desmarque as publicações identificadas por engano: só as marcadas terão a pontuação dividida entre os coautores do programa.</p>${body}`,
    });
  }

  function summary(list, pubs) {
    const eligible = list.filter((c) => c.result.eligible).length;
    const included = pubs.filter(Repository.isCoauthorshipConfirmed).length;
    const row = (label, value) => `<li class="flex justify-between gap-3">${label}<strong class="text-right text-ppgi">${value}</strong></li>`;
    return UI.panel({
      title: "Resumo",
      body: `<ul class="space-y-2 text-[14px] text-ink/80">
        ${row("Modo", isBatch() ? "Em lote" : "Individual")}
        ${row("Tipo", esc(processType()))}
        ${row("Docentes", list.length)}
        ${row("Aptos", `${eligible} de ${list.length}`)}
        ${row("Período", Repository.currentPeriod().label)}
        ${row("Coautorias divididas", `${included} de ${pubs.length}`)}
        ${row("Prazo", `<span class="font-mono">${Catalog.CYCLE.deadline}</span>`)}
      </ul>`,
    });
  }

  function statusBanner() {
    if (state.started) {
      const link = !isBatch() && state.teacherId ? UI.button("Ver cálculo", { variant: "outline", href: TeacherHeader.teacherUrl("calculo", state.teacherId) }) : "";
      return `<div class="mb-5">${UI.alert({ tone: "ok", title: state.started, body: "O cálculo usa as coautorias marcadas na revisão.", actions: link })}</div>`;
    }
    const t = currentTeacher();
    if (isBatch() || !t) return "";
    if (t.declinedOn) return `<div class="mb-5">${UI.alert({ tone: "highlight", title: "O docente sinalizou que não deseja participar neste ciclo", body: "Confirme com o docente antes de iniciar o processo." })}</div>`;
    if (t.process.status === "andamento") return `<div class="mb-5">${UI.alert({ tone: "info", title: `${t.process.label}`, body: "Você pode revisar as coautorias e confirmar novamente para atualizar o processo." })}</div>`;
    return "";
  }

  function render() {
    const list = checks();
    const pubs = detectedPublications();
    const cancelHref = contextId ? TeacherHeader.teacherUrl("perfil", contextId) : "painel.html";
    const main = list.length
      ? `${requirementsReview(list)}${coauthorshipPanel(pubs)}`
      : UI.emptyState(isBatch() ? "Selecione ao menos um docente para o lote." : "Selecione um docente para conferir os requisitos e as coautorias.");
    return `${showsTeacherHeader() ? TeacherHeader.render(currentTeacher(), "credenciamento") : ""}
      ${statusBanner()}
      <div class="grid gap-5 xl:grid-cols-[1fr_300px]">
        <div class="min-w-0 space-y-5">
          ${configuration()}
          ${main}
          <div class="flex flex-wrap gap-3">
            ${UI.button(`Iniciar ${processType() === "—" ? "processo" : processType().toLowerCase()}`, { action: "confirm-start", disabled: !list.length })}
            ${UI.button("Cancelar", { variant: "outline", href: cancelHref })}
          </div>
        </div>
        <div>${summary(list, pubs)}</div>
      </div>`;
  }

  /* ---------- Ações ---------- */
  function start() {
    const ids = selectedIds();
    UseCases.startProcess(ids, processType());
    state.started = isBatch()
      ? `${processType()} iniciado para ${Format.plural(ids.length, "docente", "docentes")}`
      : `${processType()} iniciado para ${currentTeacher().name}`;
    view.refresh();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function confirmStart() {
    const list = checks();
    const blocked = list.filter((c) => !c.result.eligible);
    const who = isBatch() ? Format.plural(list.length, "docente", "docentes") : esc(currentTeacher().name);
    const warning = blocked.length
      ? `<p class="mb-3 border-l-4 border-danger bg-danger/5 px-3 py-2 text-danger"><strong>Atenção:</strong> ${blocked.map((c) => esc(c.teacher.name)).join(", ")} ${blocked.length === 1 ? "não atende" : "não atendem"} a todos os requisitos. O processo será iniciado mesmo assim.</p>`
      : "";
    const pubs = detectedPublications().filter(Repository.isCoauthorshipConfirmed).length;
    Feedback.openModal({
      title: `Iniciar ${processType().toLowerCase()}?`,
      body: `${warning}<strong>${who}</strong> · período ${Repository.currentPeriod().label} · ${Format.plural(pubs, "coautoria dividida", "coautorias divididas")}.`,
      actions: [
        { text: "Revisar", variant: "outline" },
        { text: "Confirmar", onClick: start },
      ],
    });
  }

  function setType(type) {
    state.type = type;
    state.batch = UseCases.candidatesFor(type).map((t) => t.id);
    state.started = null;
  }

  function toggleBatch(el) {
    const id = el.dataset.id;
    state.batch = el.checked ? state.batch.concat(id) : state.batch.filter((x) => x !== id);
    view.refresh();
  }

  function removeIneligible() {
    const removed = checks().filter((c) => !c.result.eligible).map((c) => c.teacher.id);
    state.batch = state.batch.filter((id) => !removed.includes(id));
    Feedback.toast(`${Format.plural(removed.length, "docente removido", "docentes removidos")} do lote.`);
    view.refresh();
  }

  const view = Shell.start(
    () => ({
      nav: showsTeacherHeader() ? "docentes" : "credenciamento",
      title: "Credenciamento",
      crumbs: showsTeacherHeader()
        ? TeacherHeader.crumbs(currentTeacher(), "Credenciamento")
        : [{ label: "Painel", href: "painel.html" }, { label: "Credenciamento" }],
      lead: "Escolha o modo, confira os requisitos dos docentes e revise as coautorias antes de iniciar o processo.",
    }),
    {
      render,
      actions: {
        "set-mode": (el) => { state.mode = el.dataset.value; state.started = null; view.refresh(); },
        "select-all": () => { setType(state.type); view.refresh(); },
        "clear-batch": () => { state.batch = []; view.refresh(); },
        "remove-ineligible": removeIneligible,
        "confirm-start": confirmStart,
      },
      onChange: Object.assign(
        {
          "set-type": (el) => { setType(el.value); view.refresh(); },
          "set-teacher": (el) => { state.teacherId = el.value || null; state.started = null; view.refresh(); },
          "toggle-batch": toggleBatch,
          "toggle-coauthorship": (el) => { Repository.setCoauthorshipConfirmed(el.dataset.id, el.checked); view.refresh(); },
        },
        PeriodField.handler(() => view.refresh()),
      ),
    },
  );
})(window.PPGI);
