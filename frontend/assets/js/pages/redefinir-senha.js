/*
 * pages/redefinir-senha — criação de nova senha a partir do link enviado por e-mail.
 */
(function (PPGI) {
  "use strict";

  const { PublicLayout, UI, Auth, Format } = PPGI;
  const { escapeHtml: esc } = Format;

  const email = Format.queryParam("email") || "";
  const hasValidLink = Format.queryParam("token") === "demo" && Auth.isValidEmail(email);
  const state = { password: "", confirmation: "", error: "", done: false };

  function rulesList() {
    const items = Auth.passwordRules(state.password, state.confirmation)
      .map((r) => `<li class="flex items-center gap-2 ${r.ok ? "text-ppgi" : "text-muted"}"><span aria-hidden="true" class="font-mono font-bold">${r.ok ? "✓" : "○"}</span>${esc(r.label)}<span class="sr-only">${r.ok ? " (atendido)" : " (pendente)"}</span></li>`)
      .join("");
    return `<ul id="regras-senha" class="space-y-1 text-[13px]" aria-live="polite">${items}</ul>`;
  }

  function form() {
    return `<h1 class="text-2xl font-extrabold text-ppgi">Criar nova senha</h1>
      <p class="mt-1 text-[15px] text-muted">Para <strong class="text-ink">${esc(email)}</strong></p>
      <form data-submit="reset" novalidate class="mt-6 space-y-4">
        ${UI.textField({ id: "senha", label: "Nova senha", type: "password", value: state.password, autocomplete: "new-password", action: "typing" })}
        ${UI.textField({ id: "confirmacao", label: "Confirme a nova senha", type: "password", value: state.confirmation, autocomplete: "new-password", action: "typing" })}
        ${rulesList()}
        ${state.error ? UI.alert({ tone: "error", title: state.error }) : ""}
        ${UI.button("Salvar nova senha", { type: "submit", wide: true, size: "lg" })}
      </form>`;
  }

  function success() {
    return `<div class="flex h-14 w-14 items-center justify-center border border-ppgi bg-ppgi-tint text-2xl font-bold text-ppgi" aria-hidden="true">✓</div>
      <h1 class="mt-5 text-2xl font-extrabold text-ppgi">Senha alterada</h1>
      <p class="mt-2 text-[15px] leading-relaxed text-ink/80">Sua nova senha já pode ser usada para entrar na plataforma.</p>
      <div class="mt-6">${UI.button("Ir para o login", { href: "login.html", wide: true, size: "lg" })}</div>`;
  }

  function invalidLink() {
    return `<h1 class="text-2xl font-extrabold text-ppgi">Link inválido ou expirado</h1>
      <p class="mt-2 text-[15px] leading-relaxed text-ink/80">Peça um novo link de recuperação para criar sua senha.</p>
      <div class="mt-6">${UI.button("Pedir novo link", { href: "recuperar-senha.html", wide: true, size: "lg" })}</div>`;
  }

  function render() {
    if (!hasValidLink) return invalidLink();
    return state.done ? success() : form();
  }

  /* Atualiza só a lista de regras enquanto digita (sem redesenhar o formulário). */
  function typing() {
    state.password = document.getElementById("senha").value;
    state.confirmation = document.getElementById("confirmacao").value;
    document.getElementById("regras-senha").outerHTML = rulesList();
  }

  function submit(formEl) {
    state.password = formEl.elements.senha.value;
    state.confirmation = formEl.elements.confirmacao.value;
    const result = Auth.resetPassword(email, state.password, state.confirmation);
    state.error = result.ok ? "" : result.error;
    state.done = result.ok;
    view.update();
  }

  const view = PublicLayout.startAuth({
    title: "Redefinir senha",
    render,
    onInput: { typing },
    onSubmit: { reset: submit },
  });
})(window.PPGI);
