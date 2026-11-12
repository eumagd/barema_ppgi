/*
 * core/store — persistência das ações do usuário no navegador.
 * Usa localStorage quando disponível; em modo privado/bloqueado, mantém em memória.
 */
(function (PPGI) {
  "use strict";

  const PREFIX = "ppgi.v2.";
  const memory = {};

  function read(key, fallback) {
    try {
      const raw = localStorage.getItem(PREFIX + key);
      if (raw !== null) return JSON.parse(raw);
    } catch (e) {
      /* armazenamento indisponível: usa memória */
    }
    return key in memory ? memory[key] : fallback;
  }

  function write(key, value) {
    memory[key] = value;
    try {
      localStorage.setItem(PREFIX + key, JSON.stringify(value));
    } catch (e) {
      /* segue só em memória */
    }
  }

  /** Apaga tudo o que foi salvo, exceto as chaves em `keep`. */
  function clearAll(keep = []) {
    const kept = new Set(keep.map((k) => PREFIX + k));
    Object.keys(memory).filter((k) => !keep.includes(k)).forEach((k) => delete memory[k]);
    try {
      Object.keys(localStorage)
        .filter((k) => k.startsWith(PREFIX) && !kept.has(k))
        .forEach((k) => localStorage.removeItem(k));
    } catch (e) {
      /* nada a limpar */
    }
  }

  PPGI.Store = { read, write, clearAll };
})((window.PPGI = window.PPGI || {}));
