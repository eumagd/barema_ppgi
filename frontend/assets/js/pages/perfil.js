/*
 * pages/perfil — W-01P · Perfil do docente.
 *
 * Feedback do monitor: os cartões "Cálculo / Requisitos / Relatório / Credenciamento"
 * tinham botões que levavam às mesmas páginas das abas logo acima. Agora as abas são o
 * único caminho e o perfil mostra apenas um resumo de leitura do ciclo, sem botões repetidos.
 */
(function (PPGI) {
  "use strict";

  const { Shell, UI, Repository, UseCases, Feedback, Format, Barema, Catalog, TeacherHeader } = PPGI;
  const { escapeHtml: esc, formatNumber } = Format;

  const teacherId = TeacherHeader.resolveTeacherId();
  const teacher = () => Repository.findTeacher(teacherId);

  function declinedBanner(t) {
    if (!t.declinedOn) return "";
    return `<div class="mb-5">${UI.alert({
      tone: "highlight",
      title: "Sinalizado: o docente não deseja participar do processo neste ciclo",
      body: `Registrado em ${esc(t.declinedOn)}. Esta sinalização é diferente de pendência ou de não atender aos requisitos.`,
      actions: UI.button("Desfazer sinalização", { variant: "outline", action: "unflag" }),
    })}</div>`;
  }

  function cycleSummary(t) {
    const period = Repository.currentPeriod();
    const check = Barema.checkRequirements(t.id, period);
    const report = t.report ? `${t.report.status}${t.report.date ? ` · ${t.report.date}` : ""}` : "Não gerado";
    return UI.panel({
      title: `Resumo do ciclo ${Catalog.CYCLE.year}`,
      body: `<div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          ${UI.stat({ label: "Pontuação no período", value: `${formatNumber(check.score.total)} <span class="text-sm font-semibold text-muted">pts</span>`, hint: period.label })}
          ${UI.stat({ label: "Requisitos atendidos", value: `${check.metCount}<span class="text-base text-muted">/${check.total}</span>`, hint: check.eligible ? "Apto" : "Não apto", tone: check.eligible ? "default" : "fail" })}
          ${UI.stat({ label: "Relatório", value: `<span class="text-base">${esc(report)}</span>` })}
          ${UI.stat({ label: "Processo", value: `<span class="text-base">${esc(t.process.label)}</span>`, hint: `prazo ${Catalog.CYCLE.deadline}` })}
        </div>
        <p class="mt-3 text-[13px] text-muted">Os detalhes de cada item estão nas abas acima.</p>`,
    });
  }

  function infoRow(label, value) {
    return `<div class="flex flex-wrap justify-between gap-2 py-2"><dt class="text-muted">${esc(label)}</dt><dd class="text-right font-semibold text-ink">${value}</dd></div>`;
  }

  function teacherData(t) {
    return UI.panel({
      title: "Dados do docente",
      body: `<dl class="divide-y divide-ppgi-soft text-[14px]">
        ${infoRow("E-mail", esc(t.email))}
        ${infoRow("Departamento", esc(t.department))}
        ${infoRow("Vínculo institucional", `${esc(t.employment)} · IC/UFAL`)}
        ${infoRow("Categoria no PPGI", t.ppgi ? esc(t.ppgi) : "Não vinculado")}
        ${infoRow("Currículo Lattes", t.lattesSync ? `sincronizado em <span class="font-mono">${esc(t.lattesSync)}</span>` : `<span class="text-danger">link ausente no cadastro</span>`)}
      </dl>`,
    });
  }

  function participation(t) {
    const body = t.declinedOn
      ? `<p class="text-[14px] text-ink/80">A recusa do docente já está registrada. Para revertê-la, use “Desfazer sinalização” no aviso acima.</p>`
      : `<p class="text-[14px] text-ink/80">Use quando o docente informar que não deseja se cadastrar ou se recadastrar neste ciclo.</p>
         <div class="mt-4">${UI.button("⚑ Sinalizar “não deseja participar”", { variant: "danger", action: "confirm-flag" })}</div>`;
    return UI.panel({ title: "Participação no processo", body });
  }

  /* ---------- Importação do CSV do QLattes ---------- */
  let arquivoCsv = null;
  document.addEventListener("change", (e) => {
    if (e.target && e.target.id === "csv-qlattes") arquivoCsv = e.target.files[0] || null;
  });

  function importPanel(t) {
    return UI.panel({
      title: "Importar CSV do QLattes",
      body: `<p class="text-[14px] text-ink/80">No Currículo Lattes do docente, abra a visualização do QLattes e clique em <strong>Exportar dados</strong>. Envie aqui o arquivo gerado.</p>
        <label for="csv-qlattes" class="mt-3 block text-[14px] font-semibold text-ppgi">Arquivo .csv</label>
        <input id="csv-qlattes" type="file" accept=".csv" class="mt-1 block w-full border border-ppgi-soft p-2 text-[14px]">
        <div class="mt-3">${UI.button("⤒ Importar produção", { variant: "outline", action: "import-csv" })}</div>
        <p class="mt-2 text-[12px] text-muted">${t.id_lattes ? `ID Lattes: <span class="font-mono">${esc(t.id_lattes)}</span>. ` : "O ID Lattes é gravado na primeira importação. "}Reimportar um CSV atualizado só acrescenta publicações.</p>`,
    });
  }

  /* ---------- OpenAlex (Conector 2) ---------- */
  const openalex = { orcid: null, importando: false };

  function openAlexPanel(t) {
    const valor = openalex.orcid ?? t.orcid ?? "";
    return UI.panel({
      title: "Importar do OpenAlex",
      body: `<p class="text-[14px] text-ink/80">Busca a produção do docente na API aberta do <strong>OpenAlex</strong>, sem CAPTCHA, incluindo <strong>eventos</strong> e <strong>coautores</strong> (que o CSV do QLattes não traz). O docente é identificado pelo ORCID.</p>
        <div class="mt-3 grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
          ${UI.textField({ id: "orcid", label: "ORCID", value: valor, placeholder: "0000-0002-1825-0097", action: "orcid" })}
          ${UI.button("Salvar ORCID", { variant: "outline", action: "save-orcid" })}
        </div>
        <div class="mt-3">${UI.button(openalex.importando ? "⟳ Importando…" : "⤒ Importar do OpenAlex", { variant: "outline", action: "import-openalex", disabled: openalex.importando || !(t.orcid || t.id_openalex) })}</div>
        <p class="mt-2 text-[12px] text-muted">${t.id_openalex ? `Autor no OpenAlex: <span class="font-mono">${esc(t.id_openalex)}</span>. ` : ""}Coautores que não estão cadastrados entram como membros externos; o Fuzzy Match junta o que já veio do QLattes.</p>`,
    });
  }

  async function saveOrcid() {
    try {
      await UseCases.saveOrcid(teacherId, openalex.orcid ?? teacher().orcid ?? "");
      openalex.orcid = null;
      Feedback.toast("ORCID salvo.");
    } catch (erro) {
      Feedback.toast(erro.message, "error");
    }
    view.refresh();
  }

  async function importOpenAlex() {
    openalex.importando = true;
    view.refresh();
    try {
      const r = await UseCases.importOpenAlex(teacherId);
      const c = r.importacao.contagens || {};
      const fuzzy = c.correspondencias || {};
      Feedback.toast(
        r.reaproveitada
          ? "Nada de novo no OpenAlex desde a última importação."
          : `${c.novas || 0} nova(s) (${c.periodicos || 0} periódico(s), ${c.eventos || 0} evento(s)), ${c.coautores_externos_criados || 0} coautor(es) externo(s) cadastrado(s), ${fuzzy.para_revisao || 0} para revisar.`,
      );
    } catch (erro) {
      Feedback.toast(erro.message, "error");
    }
    openalex.importando = false;
    view.refresh();
  }

  async function importCsv(confirmName = false) {
    const arquivo = arquivoCsv;
    if (!arquivo) return Feedback.toast("Escolha o arquivo .csv exportado pelo QLattes.", "error");
    try {
      const r = await UseCases.importCsv(teacherId, arquivo, { confirmName });
      const c = r.importacao.contagens || {};
      const fuzzy = c.correspondencias || {};
      Feedback.toast(
        r.reaproveitada
          ? "Este arquivo já tinha sido importado."
          : `${c.novas || 0} publicação(ões) nova(s), ${c.ja_importadas || 0} já existente(s), ${fuzzy.para_revisao || 0} para revisar.`,
      );
      arquivoCsv = null;
      view.refresh();
    } catch (erro) {
      if (/confirmar_nome/.test(erro.message)) {
        return Feedback.openModal({
          title: "O nome do CSV não bate com o docente",
          body: esc(erro.message.replace(/ Se estiver certo.*$/, "")) + "<br><br>Importar mesmo assim?",
          actions: [
            { text: "Cancelar", variant: "outline" },
            { text: "Importar mesmo assim", onClick: () => importCsv(true) },
          ],
        });
      }
      Feedback.toast(erro.message, "error");
    }
  }

  function glossary() {
    return UI.help("O que significa cada campo", `<ul class="space-y-1.5">
      <li><strong class="text-ppgi">Vínculo institucional</strong>: relação do docente com o IC/UFAL (efetivo ou substituto).</li>
      <li><strong class="text-ppgi">Vínculo com o PPGI</strong>: categoria no programa (Permanente ou Colaborador).</li>
      <li><strong class="text-ppgi">Credenciamento</strong>: situação do processo do docente no ciclo vigente.</li>
      <li><strong class="text-ppgi">Pontuação</strong>: soma dos pontos por estrato Qualis no período, já com a divisão das coautorias.</li>
    </ul>`);
  }

  function render() {
    const t = teacher();
    return `${TeacherHeader.render(t, "perfil")}
      ${declinedBanner(t)}
      <div class="space-y-5">
        ${cycleSummary(t)}
        <div class="grid gap-5 lg:grid-cols-2">
          ${teacherData(t)}
          <div class="space-y-5">${importPanel(t)}${openAlexPanel(t)}${participation(t)}${glossary()}</div>
        </div>
      </div>`;
  }

  function confirmFlag() {
    const t = teacher();
    Feedback.openModal({
      title: "Sinalizar que o docente não deseja participar?",
      body: `Será registrado que <strong>${esc(t.name)}</strong> não deseja participar do processo do ciclo ${Catalog.CYCLE.year}. A sinalização pode ser desfeita depois. As consequências administrativas dependem das regras do programa (a confirmar com a coordenação).`,
      actions: [
        { text: "Cancelar", variant: "outline" },
        { text: "Confirmar sinalização", onClick: () => { UseCases.flagNotParticipating(t.id); view.refresh(); } },
      ],
    });
  }

  const view = Shell.start(
    () => ({
      nav: "docentes",
      title: `Perfil · ${teacher().name}`,
      crumbs: TeacherHeader.crumbs(teacher()),
    }),
    {
      render,
      onInput: { orcid: (el) => { openalex.orcid = el.value; } },
      actions: {
        "confirm-flag": confirmFlag,
        "import-csv": () => importCsv(false),
        "save-orcid": saveOrcid,
        "import-openalex": importOpenAlex,
        unflag: () => { UseCases.unflagNotParticipating(teacherId); Feedback.toast("Sinalização desfeita."); view.refresh(); },
      },
    },
  );
})(window.PPGI);
