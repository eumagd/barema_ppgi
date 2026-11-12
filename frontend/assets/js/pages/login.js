/*
 * pages/login — Entrar na plataforma.
 */
(function (PPGI) {
  "use strict";

  const { PublicLayout, UI, Auth, Catalog, Format } = PPGI;
  const { escapeHtml: esc } = Format;

  const DEFAULT_DESTINATION = "painel.html";
  const SAFE_DESTINATION = /^[a-z-]+\.html(\?[\w=&%.-]*)?$/;
  const DEMO = Catalog.DEMO_USERS[0];

  /** Só aceita páginas internas como destino (evita redirecionar para outro site). */
  function destination() {
    const next = Format.queryParam("next");
    return next && SAFE_DESTINATION.test(next) ? next : DEFAULT_DESTINATION;
  }

  if (Auth.currentUser()) {
    window.location.replace(destination());
    return;
  }

  const state = { email: "", password: "", showPassword: false, errors: {}, loading: false };

  function passwordToggle() {
    return `<button type="button" data-action="toggle-password" aria-pressed="${state.showPassword}" class="px-3 py-1 text-[13px] font-semibold text-ppgi hover:underline">${state.showPassword ? "Ocultar" : "Mostrar"}</button>`;
  }

  function demoBox() {
    return `<div class="mt-8 border border-dashed border-ppgi-soft bg-ppgi-tint/50 px-4 py-3 text-[13px] text-ink/80">
      <p class="font-semibold text-ppgi">Acesso de demonstração</p>
      <p class="mt-1 font-mono">${esc(DEMO.email)} · ${esc(DEMO.password)}</p>
      <button type="button" data-action="fill-demo" class="mt-2 font-semibold text-ppgi underline underline-offset-2">Preencher automaticamente</button>
    </div>`;
  }

  function render() {
    const nextNotice = Format.queryParam("next")
      ? `<div class="mb-5">${UI.alert({ tone: "info", title: "Entre para continuar", body: "A página que você abriu exige acesso à plataforma." })}</div>`
      : "";
    return `<h1 class="text-2xl font-extrabold text-ppgi">Entrar</h1>
      <p class="mt-1 text-[15px] text-muted">Use seu e-mail institucional da UFAL.</p>
      <div class="mt-6">${nextNotice}</div>
      <form data-submit="login" novalidate class="space-y-4">
        ${UI.textField({ id: "email", label: "E-mail", type: "email", value: state.email, placeholder: "nome@ic.ufal.br", autocomplete: "username", error: state.errors.email })}
        ${UI.textField({ id: "senha", label: "Senha", type: state.showPassword ? "text" : "password", value: state.password, autocomplete: "current-password", error: state.errors.password, trailing: passwordToggle() })}
        <div class="flex justify-end">
          <a href="recuperar-senha.html" class="text-[14px] font-semibold text-ppgi hover:underline">Esqueci minha senha</a>
        </div>
        ${UI.button(state.loading ? "Entrando…" : "Entrar", { type: "submit", wide: true, size: "lg", disabled: state.loading })}
      </form>
      ${demoBox()}`;
  }

  function readForm(form) {
    state.email = form.elements.email.value;
    state.password = form.elements.senha.value;
  }

  function submit(form) {
    readForm(form);
    const result = Auth.login(state.email, state.password);
    if (!result.ok) {
      state.errors = { [result.field]: result.error };
      view.update();
      document.getElementById(result.field === "email" ? "email" : "senha").focus();
      return;
    }
    state.errors = {};
    state.loading = true;
    view.update();
    setTimeout(() => window.location.replace(destination()), 500);
  }

  const view = PublicLayout.startAuth({
    title: "Entrar",
    render,
    actions: {
      "toggle-password": () => {
        readForm(document.querySelector("form"));
        state.showPassword = !state.showPassword;
        view.update();
      },
      "fill-demo": () => {
        state.email = DEMO.email;
        state.password = DEMO.password;
        state.errors = {};
        view.update();
      },
    },
    onSubmit: { login: submit },
  });
})(window.PPGI);
