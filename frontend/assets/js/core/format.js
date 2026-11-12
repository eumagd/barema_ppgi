/*
 * core/format — formatação de valores e helpers de texto/URL sem dependências.
 */
(function (PPGI) {
  "use strict";

  const HTML_ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch]);
  }

  function formatNumber(n) {
    return Number(n).toLocaleString("pt-BR", { maximumFractionDigits: 1 });
  }

  function formatSigned(n) {
    if (n > 0) return "+" + formatNumber(n);
    if (n < 0) return "−" + formatNumber(-n);
    return "0";
  }

  function plural(n, singular, pluralForm) {
    return `${n} ${n === 1 ? singular : pluralForm}`;
  }

  function normalize(text) {
    return String(text).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  }

  function initials(name) {
    return name
      .split(" ")
      .filter((p) => p.length > 1 || /[A-ZÀ-Ú]/.test(p))
      .slice(0, 2)
      .map((p) => p[0])
      .join("")
      .toUpperCase();
  }

  function nowStamp() {
    const d = new Date();
    const pad = (x) => String(x).padStart(2, "0");
    return { date: `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`, time: `${pad(d.getHours())}:${pad(d.getMinutes())}` };
  }

  function queryParam(name) {
    return new URLSearchParams(window.location.search).get(name);
  }

  function pageUrl(page, params) {
    const qs = new URLSearchParams(params || {}).toString();
    return `${page}.html${qs ? "?" + qs : ""}`;
  }

  PPGI.Format = { escapeHtml, formatNumber, formatSigned, plural, normalize, initials, nowStamp, queryParam, pageUrl };
})((window.PPGI = window.PPGI || {}));
