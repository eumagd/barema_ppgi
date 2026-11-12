/*
 * pages/recuperar-senha — pedido de link para redefinir a senha.
 */
(function (PPGI) {
  "use strict";

  const { PublicLayout, UI, Auth, Format } = PPGI;
  const { escapeHtml: esc, pageUrl } = Format;

  const state = { email: Format.queryParam("email") || "", error: "", sentTo: null };

  function requestForm() {
    return `<h1 class="text-2xl font-extrabold text-ppgi">Recuperar senha</h1>
      <p class="mt-1 text-[15px] text-muted">Informe o e-mail cadastrado e enviaremos um link para você criar uma nova senha.</p>
      <form data-submit="request" novalidate class="mt-6 space-y-4">
        ${UI.textField({ id: "email", label: "E-mail", type: "email", value: state.email, placeholder: "nome@ic.ufal.br", autocomplete: "username", error: state.error })}
        ${UI.button("Enviar link", { type: "submit", wide: true, size: "lg" })}
      </form>
      <p class="mt-6 text-[14px] text-muted">Lembrou a senha? <a href="login.html" class="font-semibold text-ppgi hover:underline">Voltar para o login</a></p>`;
  }

  function sentMessage() {
    const link = pageUrl("redefinir-senha", { email: state.sentTo, token: "demo" });
    return `<div class="flex h-14 w-14 items-center justify-center border border-ppgi bg-ppgi-tint text-2xl text-ppgi" aria-hidden="true">✉</div>
      <h1 class="mt-5 text-2xl font-extrabold text-ppgi">Verifique seu e-mail</h1>
      <p class="mt-2 text-[15px] leading-relaxed text-ink/80">Se <strong>${esc(state.sentTo)}</strong> estiver cadastrado, você receberá um link para redefinir a senha em alguns minutos. O link vale por 1 hora.</p>
      <div class="mt-6 space-y-3">
        ${UI.button("Abrir o link recebido (demonstração)", { href: link, wide: true, size: "lg" })}
        ${UI.button("Não recebi, enviar de novo", { variant: "outline", wide: true, action: "resend" })}
      </div>
      <p class="mt-6 text-[14px] text-muted"><a href="login.html" class="font-semibold text-ppgi hover:underline">Voltar para o login</a></p>`;
  }

  function submit(form) {
    state.email = form.elements.email.value;
    const result = Auth.requestPasswordReset(state.email);
    state.error = result.ok ? "" : result.error;
    state.sentTo = result.ok ? result.email : null;
    view.update();
    if (!result.ok) document.getElementById("email").focus();
  }

  const view = PublicLayout.startAuth({
    title: "Recuperar senha",
    render: () => (state.sentTo ? sentMessage() : requestForm()),
    actions: { resend: () => PPGI.Feedback.toast(`Link reenviado para ${state.sentTo}.`) },
    onSubmit: { request: submit },
  });
})(window.PPGI);
