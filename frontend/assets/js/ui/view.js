/*
 * ui/view — liga uma função render() a um contêiner e despacha eventos por delegação.
 *
 * Marcação esperada nos componentes:
 *   data-action="nome"  → clique chama actions.nome(elemento, evento)
 *   data-change="nome"  → change chama onChange.nome(elemento, evento)
 *   data-input="nome"   → input  chama onInput.nome(elemento, evento)
 *   data-submit="nome"  → envio de <form> chama onSubmit.nome(formulário, evento)
 *
 * Ao redesenhar, o foco do teclado é devolvido ao mesmo controle (acessibilidade).
 * Formulários com data-preservar="chave" mantêm o que foi digitado enquanto a chave não
 * mudar (troque a chave para limpar, por exemplo depois de salvar).
 */
(function (PPGI) {
  "use strict";

  const IDENTITY_ATTRS = ["action", "change", "input", "id", "value"];

  function focusSelector(el) {
    if (!el || el === document.body) return null;
    if (el.id) return `#${CSS.escape(el.id)}`;
    const parts = IDENTITY_ATTRS.filter((a) => el.dataset[a] !== undefined).map(
      (a) => `[data-${a}="${CSS.escape(el.dataset[a])}"]`,
    );
    return parts.length ? parts.join("") : null;
  }

  function captureFocus(container) {
    const el = document.activeElement;
    if (!container.contains(el)) return null;
    const hasCaret = el.tagName === "INPUT" && typeof el.selectionStart === "number";
    return { selector: focusSelector(el), caret: hasCaret ? el.selectionStart : null };
  }

  function restoreFocus(container, saved) {
    if (!saved || !saved.selector) return;
    const el = container.querySelector(saved.selector);
    if (!el) return;
    el.focus({ preventScroll: true });
    if (saved.caret !== null && el.setSelectionRange) el.setSelectionRange(saved.caret, saved.caret);
  }

  function delegate(container, eventName, attr, handlers) {
    container.addEventListener(eventName, (event) => {
      const el = event.target.closest(`[data-${attr}]`);
      if (!el || !container.contains(el)) return;
      const handler = handlers[el.dataset[attr]];
      if (!handler) return;
      const isLink = el.matches("a[href]");
      if (eventName === "submit" || (eventName === "click" && !isLink)) event.preventDefault();
      handler(el, event);
    });
  }

  function captureForms(container) {
    const saved = {};
    container.querySelectorAll("form[data-preservar]").forEach((form) => {
      saved[form.dataset.preservar] = Array.from(form.elements)
        .filter((el) => el.name && el.type !== "file")
        .map((el) => [el.name, el.type === "checkbox" ? el.checked : el.value]);
    });
    return saved;
  }

  function restoreForms(container, saved) {
    container.querySelectorAll("form[data-preservar]").forEach((form) => {
      const values = saved[form.dataset.preservar];
      if (!values) return;
      for (const [name, value] of values) {
        const el = form.elements[name];
        if (!el || el.type === "file") continue;
        if (el.type === "checkbox") el.checked = value;
        else el.value = value;
      }
    });
  }

  function createView(container, { render, actions = {}, onChange = {}, onInput = {}, onSubmit = {} }) {
    function update() {
      const saved = captureFocus(container);
      const forms = captureForms(container);
      container.innerHTML = render();
      restoreForms(container, forms);
      restoreFocus(container, saved);
    }
    delegate(container, "click", "action", actions);
    delegate(container, "change", "change", onChange);
    delegate(container, "input", "input", onInput);
    delegate(container, "submit", "submit", onSubmit);
    update();
    return { update };
  }

  PPGI.View = { createView };
})((window.PPGI = window.PPGI || {}));
