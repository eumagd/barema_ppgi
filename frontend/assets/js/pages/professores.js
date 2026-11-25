/*
 * pages/professores — Docentes: listagem única do IC com filtro de vínculo com o PPGI.
 *
 * A antiga tela "Vínculo com o PPGI" virou um filtro desta: ao escolher PPGI,
 * Permanentes ou Colaboradores, aparece a ação de desvincular.
 * Atalho por URL: professores.html?vinculo=ppgi
 */
(function (PPGI) {
  "use strict";

  const { Shell, UI, Repository, UseCases, Feedback, Format, Catalog, TeacherHeader } = PPGI;
  const { escapeHtml: esc, normalize } = Format;


  const LINK_FILTERS = [
    { value: "todos", label: "Todos do IC", accepts: () => true },
    { value: "ppgi", label: "PPGI", accepts: (t) => Boolean(t.ppgi) },
    { value: "Permanente", label: "Permanentes", accepts: (t) => t.ppgi === "Permanente" },
    { value: "Colaborador", label: "Colaboradores", accepts: (t) => t.ppgi === "Colaborador" },
    { value: "fora", label: "Fora do PPGI", accepts: (t) => !t.ppgi },
  ];
  const PPGI_FILTERS = ["ppgi", "Permanente", "Colaborador"];

  const requestedFilter = Format.queryParam("vinculo");
  const state = {
    query: "",
    link: LINK_FILTERS.some((f) => f.value === requestedFilter) ? requestedFilter : "todos",
    department: "todos",
    sync: { phase: "idle", result: null },
    lastUnlinked: null,
  };

  const showsPpgiActions = () => PPGI_FILTERS.includes(state.link);

  /* ---------- Filtragem ---------- */
  function matchesQuery(t) {
    const q = normalize(state.query.trim());
    return !q || normalize(t.name).includes(q) || normalize(t.email).includes(q);
  }

  function visibleTeachers() {
    const linkFilter = LINK_FILTERS.find((f) => f.value === state.link);
    return Repository.allTeachers().filter(
      (t) => linkFilter.accepts(t) && matchesQuery(t) && (state.department === "todos" || t.department === state.department),
    );
  }

  /* ---------- Blocos da tela ---------- */
  function syncBanner() {
    if (state.sync.phase === "running") {
      return `<div class="mb-5">${UI.alert({
        tone: "info",
        title: "Importando os currículos do QLattes…",
        body: `Você pode continuar usando o sistema; avisaremos quando terminar.
          <div class="mt-2 h-2 w-full border border-ppgi bg-white" role="progressbar" aria-label="Progresso da sincronização" aria-valuemin="0" aria-valuemax="100">
            <div id="sync-progress" class="progress-fill h-full bg-ppgi" style="width:0%"></div>
          </div>`,
      })}</div>`;
    }
    if (state.sync.phase !== "done") return "";
    const r = state.sync.result;
    const failure = r.failed.length
      ? UI.alert({
          tone: "error",
          title: Format.plural(r.failed.length, "docente não foi sincronizado", "docentes não foram sincronizados"),
          body: `${r.failed.map((t) => esc(t.name)).join("<br>")}`,
          actions: UI.button("Fechar", { variant: "outline", action: "dismiss-sync" }),
        })
      : "";
    return `<div class="mb-5 space-y-2">
      ${UI.alert({ tone: "ok", title: `Importação concluída em ${r.date} às ${r.time} — ${r.synced} de ${r.total} currículos` })}
      ${failure}
    </div>`;
  }

  function undoBanner() {
    if (!state.lastUnlinked) return "";
    const teacher = Repository.findTeacher(state.lastUnlinked.id);
    return `<div class="mb-5">${UI.alert({
      tone: "ok",
      title: `${teacher.name} foi desvinculado(a) do PPGI`,
      body: "O docente continua na base do IC e o histórico de processos é mantido.",
      actions: UI.button("Desfazer", { variant: "outline", action: "undo-unlink" }),
    })}</div>`;
  }

  function filterBar() {
    const doBanco = [...new Set(Repository.allTeachers().map((t) => t.department).filter((d) => d && d !== "—"))].sort();
    const departments = [{ value: "todos", label: "Todos os departamentos" }].concat(doBanco.map((d) => ({ value: d, label: d })));
    return `<div class="mb-4 space-y-3">
      <div>
        <span class="mb-1 block text-[14px] font-semibold text-ppgi">Vínculo</span>
        <div class="overflow-x-auto">${UI.segmented({ label: "Vínculo com o PPGI", options: LINK_FILTERS, value: state.link, action: "set-link" })}</div>
      </div>
      <div class="grid gap-3 md:grid-cols-[1fr_260px]">
        ${UI.searchField({ id: "busca", label: "Buscar docente", placeholder: "Nome ou e-mail…", value: state.query, action: "search" })}
        ${UI.selectField({ id: "departamento", label: "Departamento", options: departments, value: state.department, action: "set-department" })}
      </div>
    </div>`;
  }

  function teacherRow(t) {
    const stripe = t.ppgi ? "border-ppgi-yellow" : "border-transparent";
    const row = [
      `<span class="-mx-3 -my-2 flex items-center gap-2 border-l-4 px-3 py-2 ${stripe}">
        ${UI.avatar(t.name)}
        <a href="${TeacherHeader.teacherUrl("perfil", t.id)}" class="font-semibold text-ppgi underline decoration-ppgi-soft underline-offset-2 hover:decoration-ppgi">${esc(t.name)}</a>
      </span>`,
      esc(t.department),
      esc(t.employment),
      t.ppgi ? UI.tag(`■ PPGI · ${t.ppgi}`, t.ppgi === "Permanente" ? "yellow" : "blue") : `<span class="text-[13px] text-muted">Não vinculado</span>`,
    ];
    if (showsPpgiActions()) {
      row.push(UI.button("Desvincular", { variant: "danger", action: "confirm-unlink", data: { id: t.id }, label: `Desvincular ${t.name} do PPGI` }));
    }
    return row;
  }

  function teacherTable() {
    const teachers = visibleTeachers();
    const total = Repository.allTeachers().length;
    const head = ["Docente", "Departamento", "Vínculo institucional", "PPGI"].concat(showsPpgiActions() ? ["Ação"] : []);
    const list = teachers.length
      ? UI.table({ head, rows: teachers.map(teacherRow), caption: "Docentes do Instituto de Computação", footnote: "Dados do servidor do PPGI." })
      : total
        ? UI.emptyState("Nenhum docente encontrado com esses critérios. Revise a busca ou os filtros.")
        : `${UI.emptyState("Nenhum docente cadastrado ainda.")}<div class="mt-3">${UI.button("+ Cadastrar o primeiro docente", { href: "cadastros.html?aba=docentes" })}</div>`;
    return `<p class="mb-2 text-[13px] text-muted" aria-live="polite">Mostrando ${teachers.length} de ${total} docentes</p>${list}`;
  }

  function render() {
    const syncing = state.sync.phase === "running";
    const title = showsPpgiActions() ? "Docentes vinculados ao PPGI" : "Docentes do Instituto de Computação";
    return `${syncBanner()}
      ${undoBanner()}
      ${UI.panel({
        title,
        actions: UI.button(syncing ? "⟳ Importando…" : "⤒ Importar currículos (QLattes)", { variant: "outline", action: "confirm-sync", disabled: syncing }),
        body: filterBar() + teacherTable(),
      })}`;
  }

  /* ---------- Importação do QLattes (.zip com um CSV por docente) ---------- */
  let arquivoEscolhido = null;
  document.addEventListener("change", (e) => {
    if (e.target && e.target.id === "arquivo-qlattes") arquivoEscolhido = e.target.files[0] || null;
  });

  async function runSync() {
    const arquivo = arquivoEscolhido;
    arquivoEscolhido = null;
    if (!arquivo) return Feedback.toast("Escolha o arquivo .zip (ou .csv) exportado pelo QLattes.", "error");
    if (/\.csv$/i.test(arquivo.name)) {
      return Feedback.toast("Para um CSV de um docente só, use “Importar CSV do QLattes” no perfil dele.", "error");
    }
    state.sync = { phase: "running", result: null };
    view.refresh();
    try {
      const lote = await UseCases.importZip(arquivo, (andamento) => {
        const feitos = andamento.itens.filter((i) => !["PENDENTE", "PROCESSANDO"].includes(i.status)).length;
        const bar = document.getElementById("sync-progress");
        if (bar) bar.style.width = `${Math.round((feitos / Math.max(1, andamento.total)) * 100)}%`;
      });
      const { date, time } = Format.nowStamp();
      const failed = lote.itens.filter((i) => i.status === "FALHA").map((i) => ({ name: `${i.arquivo} (${i.erro})` }));
      state.sync = { phase: "done", result: { date, time, total: lote.total, synced: lote.total - failed.length, failed } };
      Feedback.toast("Importação do QLattes concluída.");
    } catch (erro) {
      state.sync = { phase: "idle", result: null };
      Feedback.toast(erro.message, "error");
    }
    view.refresh();
  }

  function confirmSync() {
    arquivoEscolhido = null;
    Feedback.openModal({
      title: "Importar currículos do QLattes",
      body: `<p>No Currículo Lattes de cada docente, use o botão <strong>Exportar dados</strong> do QLattes e junte os CSVs num arquivo <strong>.zip</strong>. Cada arquivo é ligado ao docente pelo ID Lattes (ou pelo nome).</p>
        <label for="arquivo-qlattes" class="mt-3 block text-[14px] font-semibold text-ppgi">Arquivo .zip</label>
        <input id="arquivo-qlattes" type="file" accept=".zip" class="mt-1 block w-full border border-ppgi-soft p-2 text-[14px]">
        <p class="mt-2 text-[13px] text-muted">O processamento continua em segundo plano; o Fuzzy Match roda ao fim de cada currículo.</p>`,
      actions: [
        { text: "Cancelar", variant: "outline" },
        { text: "Importar", onClick: runSync },
      ],
    });
  }

  /* ---------- Vínculo ---------- */
  function confirmUnlink(el) {
    const teacher = Repository.findTeacher(el.dataset.id);
    Feedback.openModal({
      title: "Desvincular docente do PPGI?",
      body: `<strong>${esc(teacher.name)}</strong> deixará de aparecer como docente do PPGI. Os dados do Lattes e o histórico de credenciamento continuam guardados. Você poderá desfazer logo em seguida.`,
      actions: [
        { text: "Cancelar", variant: "outline" },
        { text: "Sim, desvincular", variant: "danger", onClick: async () => { state.lastUnlinked = await UseCases.unlinkFromPpgi(teacher.id); view.refresh(); } },
      ],
    });
  }

  function undoUnlink() {
    UseCases.restorePpgiLink(state.lastUnlinked);
    state.lastUnlinked = null;
    Feedback.toast("Vínculo com o PPGI restaurado.");
    view.refresh();
  }

  const view = Shell.start(
    {
      nav: "docentes",
      title: "Docentes",
      crumbs: [{ label: "Painel", href: "painel.html" }, { label: "Docentes" }],
      lead: "Encontre um docente e clique no nome para abrir o perfil. Use os filtros de vínculo para ver só quem está no PPGI e, se preciso, desvincular.",
    },
    {
      render,
      actions: {
        "confirm-sync": confirmSync,
        "dismiss-sync": () => { state.sync = { phase: "idle", result: null }; view.refresh(); },
        "set-link": (el) => { state.link = el.dataset.value; view.refresh(); },
        "confirm-unlink": confirmUnlink,
        "undo-unlink": undoUnlink,
      },
      onChange: { "set-department": (el) => { state.department = el.value; view.refresh(); } },
      onInput: { search: (el) => { state.query = el.value; view.refresh(); } },
    },
  );
})(window.PPGI);
