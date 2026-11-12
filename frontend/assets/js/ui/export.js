/*
 * ui/export — exportação de tabelas para CSV (abre no Excel/LibreOffice) e impressão em PDF.
 */
(function (PPGI) {
  "use strict";

  function toCsvCell(value) {
    const text = String(value ?? "");
    return /[;"\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  }

  /** rows: array de arrays de texto simples. Usa ";" (padrão de planilhas em pt-BR). */
  function downloadCsv(filename, head, rows) {
    const csv = [head, ...rows].map((r) => r.map(toCsvCell).join(";")).join("\r\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  /** Imprime só o elemento #print-area (o navegador oferece "Salvar como PDF"). */
  function printReport() {
    document.body.classList.add("printing-report");
    window.addEventListener("afterprint", () => document.body.classList.remove("printing-report"), { once: true });
    window.print();
  }

  PPGI.Export = { downloadCsv, printReport };
})((window.PPGI = window.PPGI || {}));
