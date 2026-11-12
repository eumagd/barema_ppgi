/*
 * domain/auth — acesso à plataforma (simulado no navegador para o protótipo).
 * Valida credenciais dos usuários de demonstração, mantém a sessão e trata a
 * recuperação de senha. NÃO oferece segurança real: é só para navegação.
 */
(function (PPGI) {
  "use strict";

  const { Store, Catalog } = PPGI;
  const KEYS = { session: "session", passwords: "passwords" };
  const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const MIN_PASSWORD_LENGTH = 8;

  function normalizeEmail(email) {
    return String(email || "").trim().toLowerCase();
  }

  function isValidEmail(email) {
    return EMAIL_PATTERN.test(normalizeEmail(email));
  }

  function findUser(email) {
    return Catalog.DEMO_USERS.find((u) => u.email === normalizeEmail(email)) || null;
  }

  function passwordOf(user) {
    const changed = Store.read(KEYS.passwords, {});
    return changed[user.email] || user.password;
  }

  /** Resultado: { ok: true } ou { ok: false, field: "email"|"password", error } */
  function login(email, password) {
    if (!normalizeEmail(email)) return { ok: false, field: "email", error: "Informe seu e-mail institucional." };
    if (!isValidEmail(email)) return { ok: false, field: "email", error: "E-mail em formato inválido. Exemplo: nome@ic.ufal.br" };
    if (!password) return { ok: false, field: "password", error: "Informe sua senha." };
    const user = findUser(email);
    if (!user || passwordOf(user) !== password) {
      return { ok: false, field: "password", error: "E-mail ou senha incorretos. Confira os dados ou recupere sua senha." };
    }
    Store.write(KEYS.session, { email: user.email, name: user.name, role: user.role });
    return { ok: true };
  }

  function logout() {
    Store.write(KEYS.session, null);
  }

  function currentUser() {
    return Store.read(KEYS.session, null);
  }

  /** Sempre responde igual para e-mails válidos, para não revelar quem tem cadastro. */
  function requestPasswordReset(email) {
    if (!isValidEmail(email)) return { ok: false, error: "Informe um e-mail válido. Exemplo: nome@ic.ufal.br" };
    return { ok: true, email: normalizeEmail(email) };
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

  function resetPassword(email, password, confirmation) {
    const unmet = passwordRules(password, confirmation).filter((r) => !r.ok);
    if (unmet.length) return { ok: false, error: `Revise a senha: ${unmet.map((r) => r.label.toLowerCase()).join("; ")}.` };
    const user = findUser(email);
    if (user) {
      const changed = Store.read(KEYS.passwords, {});
      changed[user.email] = password;
      Store.write(KEYS.passwords, changed);
    }
    return { ok: true };
  }

  PPGI.Auth = {
    SESSION_KEY: KEYS.session,
    isValidEmail, login, logout, currentUser, requestPasswordReset, passwordRules, resetPassword,
  };
})((window.PPGI = window.PPGI || {}));
