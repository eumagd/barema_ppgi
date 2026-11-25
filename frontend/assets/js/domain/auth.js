/*
 * domain/auth — acesso à plataforma pela API (login com JWT, recuperação de senha).
 * A sessão (usuário + token) fica no Store; as regras de senha são as mesmas do back end.
 */
(function (PPGI) {
  "use strict";

  const { Store, Api } = PPGI;
  const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const MIN_PASSWORD_LENGTH = 8;
  const ROLES = { SECRETARIA: "Secretaria", COORDENACAO: "Coordenação" };

  function normalizeEmail(email) {
    return String(email || "").trim().toLowerCase();
  }

  function isValidEmail(email) {
    return EMAIL_PATTERN.test(normalizeEmail(email));
  }

  /** Resultado: { ok: true } ou { ok: false, field: "email"|"password", error }. */
  async function login(email, password) {
    if (!normalizeEmail(email)) return { ok: false, field: "email", error: "Informe seu e-mail institucional." };
    if (!isValidEmail(email)) return { ok: false, field: "email", error: "E-mail em formato inválido. Exemplo: nome@ic.ufal.br" };
    if (!password) return { ok: false, field: "password", error: "Informe sua senha." };
    try {
      const { token, usuario } = await Api.post("/auth/login", { email: normalizeEmail(email), senha: password });
      Store.write(Api.SESSION_KEY, { token, email: usuario.email, name: usuario.nome, role: ROLES[usuario.perfil] || usuario.perfil, perfil: usuario.perfil });
      return { ok: true };
    } catch (erro) {
      return { ok: false, field: erro.status === 0 ? "email" : "password", error: erro.message };
    }
  }

  function logout() {
    Store.write(Api.SESSION_KEY, null);
  }

  function currentUser() {
    const sessao = Store.read(Api.SESSION_KEY, null);
    return sessao && sessao.token ? sessao : null;
  }

  const isCoordination = () => (currentUser() || {}).perfil === "COORDENACAO";

  /** A API responde igual com ou sem cadastro, para não revelar quem tem conta. */
  async function requestPasswordReset(email) {
    if (!isValidEmail(email)) return { ok: false, error: "Informe um e-mail válido. Exemplo: nome@ic.ufal.br" };
    try {
      await Api.post("/auth/recuperar-senha", { email: normalizeEmail(email) });
      return { ok: true, email: normalizeEmail(email) };
    } catch (erro) {
      return { ok: false, error: erro.message };
    }
  }

  function passwordRules(password, confirmation) {
    const value = String(password || "");
    return [
      { label: `Pelo menos ${MIN_PASSWORD_LENGTH} caracteres`, ok: value.length >= MIN_PASSWORD_LENGTH },
      { label: "Ao menos uma letra", ok: /[A-Za-zÀ-ÿ]/.test(value) },
      { label: "Ao menos um número", ok: /\d/.test(value) },
      { label: "As duas senhas são iguais", ok: value.length > 0 && value === confirmation },
    ];
  }

  /** token: o do link recebido por e-mail (redefinir-senha.html?token=...&email=...). */
  async function resetPassword(token, password, confirmation) {
    const unmet = passwordRules(password, confirmation).filter((r) => !r.ok);
    if (unmet.length) return { ok: false, error: `Revise a senha: ${unmet.map((r) => r.label.toLowerCase()).join("; ")}.` };
    try {
      await Api.post("/auth/redefinir-senha", { token, senha: password });
      return { ok: true };
    } catch (erro) {
      return { ok: false, error: erro.message };
    }
  }

  PPGI.Auth = {
    SESSION_KEY: Api.SESSION_KEY,
    isValidEmail, login, logout, currentUser, isCoordination, requestPasswordReset, passwordRules, resetPassword,
  };
})((window.PPGI = window.PPGI || {}));
