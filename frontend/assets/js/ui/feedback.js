/*
 * ui/feedback — modal de confirmação e notificações rápidas (toasts).
 * Modal: fecha com Esc ou clique fora, mantém o foco dentro e o devolve ao fechar.
 */
(function (PPGI) {
  "use strict";

  const { escapeHtml: esc } = PPGI.Format;
  const { button, marker } = PPGI.UI;
  const FOCUSABLE = "a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex='-1'])";

  let modalRoot = null;
  let lastFocus = null;

  /**
   * actions: [{ text, variant, onClick }] — onClick roda depois de fechar o modal.
   */
  function openModal({ title, body, actions }) {
    closeModal();
    lastFocus = document.activeElement;
    modalRoot = document.createElement("div");
    modalRoot.className = "fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4";
    modalRoot.innerHTML = `
      <div role="dialog" aria-modal="true" aria-labelledby="modal-title" class="modal-enter w-full max-w-md border border-ppgi bg-white shadow-xl shadow-black/30">
        <header class="flex items-center justify-between border-b border-ppgi-soft px-5 py-3">
          <div class="flex items-center gap-2.5">${marker()}<h2 id="modal-title" class="text-[15px] font-bold text-ppgi">${esc(title)}</h2></div>
          <button type="button" data-modal-close aria-label="Fechar" class="px-2 py-1 text-ppgi hover:bg-ppgi-tint">✕</button>
        </header>
        <div class="px-5 py-4 text-[14px] leading-relaxed text-ink/80">${body}</div>
        <footer class="flex flex-wrap justify-end gap-2 border-t border-ppgi-soft px-5 py-3">
          ${actions.map((a, i) => button(esc(a.text), { variant: a.variant, data: { "modal-action": i } })).join("")}
        </footer>
      </div>`;
    document.body.appendChild(modalRoot);

    modalRoot.addEventListener("click", (event) => {
      if (event.target === modalRoot || event.target.closest("[data-modal-close]")) return closeModal();
      const trigger = event.target.closest("[data-modal-action]");
      if (!trigger) return;
      const action = actions[Number(trigger.dataset.modalAction)];
      closeModal();
      if (action.onClick) action.onClick();
    });
    modalRoot.addEventListener("keydown", trapKeys);

    const footerButtons = modalRoot.querySelectorAll("footer button");
    footerButtons[footerButtons.length - 1].focus();
  }

  function trapKeys(event) {
    if (event.key === "Escape") return closeModal();
    if (event.key !== "Tab") return;
    const items = Array.from(modalRoot.querySelectorAll(FOCUSABLE));
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function closeModal() {
    if (!modalRoot) return;
    modalRoot.remove();
    modalRoot = null;
    if (lastFocus && document.contains(lastFocus)) lastFocus.focus();
  }

  /* ---------- Toasts ---------- */
  let toastRoot = null;

  function toast(message, tone = "ok") {
    if (!toastRoot) {
      toastRoot = document.createElement("div");
      toastRoot.setAttribute("aria-live", "polite");
      toastRoot.className = "pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[calc(100%-2rem)] max-w-sm flex-col gap-2";
      document.body.appendChild(toastRoot);
    }
    const icon = tone === "error" ? "✗" : "✓";
    const color = tone === "error" ? "border-danger text-danger" : "border-ppgi text-ppgi";
    const el = document.createElement("div");
    el.className = `toast-enter pointer-events-auto flex items-start gap-3 border-l-4 bg-white px-4 py-3 text-[14px] font-semibold shadow-lg shadow-black/20 ${color}`;
    el.innerHTML = `<span aria-hidden="true" class="font-mono">${icon}</span><span class="flex-1 text-ink">${esc(message)}</span>`;
    toastRoot.appendChild(el);
    setTimeout(() => el.remove(), 3800);
  }

  PPGI.Feedback = { openModal, closeModal, toast };
})((window.PPGI = window.PPGI || {}));
