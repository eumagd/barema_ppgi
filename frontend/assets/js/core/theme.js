/*
 * core/theme — tema claro/escuro. Carregado no <head> para aplicar o tema antes da
 * primeira pintura (sem "piscar"). Sem escolha salva, segue o sistema operacional.
 */
(function (PPGI) {
  "use strict";

  const KEY = "ppgi.theme";
  const root = document.documentElement;

  function savedChoice() {
    try {
      return localStorage.getItem(KEY);
    } catch (e) {
      return null;
    }
  }

  function systemPrefersDark() {
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  }

  function isDark() {
    return root.classList.contains("dark");
  }

  function apply(dark) {
    root.classList.toggle("dark", dark);
  }

  function toggle() {
    const dark = !isDark();
    apply(dark);
    try {
      localStorage.setItem(KEY, dark ? "dark" : "light");
    } catch (e) {
      /* preferência vale só nesta página */
    }
  }

  const choice = savedChoice();
  apply(choice ? choice === "dark" : systemPrefersDark());

  PPGI.Theme = { isDark, toggle };
})((window.PPGI = window.PPGI || {}));
