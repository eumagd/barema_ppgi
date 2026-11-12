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

  function createView(container, { render, actions = {}, onChange = {}, onInput = {}, onSubmit = {} }) {
    function update() {
      const saved = captureFocus(container);
      container.innerHTML = render();
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
