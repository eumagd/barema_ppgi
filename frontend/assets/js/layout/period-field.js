/*
 * layout/period-field — seletor do período avaliativo, compartilhado entre as telas
 * do docente (a escolha vale para cálculo, requisitos, relatório e credenciamento).
 */
(function (PPGI) {
  "use strict";

  const { Catalog, Repository, UI } = PPGI;
  const ACTION = "change-period";

  function render() {
    return UI.selectField({
      id: "periodo",
      label: "Período avaliativo",
      options: Catalog.PERIODS.map((p) => ({ value: p.id, label: p.label })),
      value: Repository.currentPeriod().id,
      action: ACTION,
    });
  }

  /** Devolve o handler para registrar em onChange da página. */
  function handler(afterChange) {
    return {
      [ACTION]: (el) => {
        Repository.setCurrentPeriod(el.value);
        afterChange();
      },
    };
  }

  PPGI.PeriodField = { render, handler };
})((window.PPGI = window.PPGI || {}));
