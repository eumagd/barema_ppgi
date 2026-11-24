/*
 * Hash de senha com scrypt (módulo nativo do Node). Formato: scrypt$<salt>$<hash>,
 * o mesmo usado pelo seed.
 */
const crypto = require("node:crypto");

const TAMANHO_CHAVE = 64;
const TAMANHO_MINIMO = 8;

function hashSenha(senha) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(senha, salt, TAMANHO_CHAVE).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

function verificarSenha(senha, armazenado) {
  const [algoritmo, salt, hash] = String(armazenado || "").split("$");
  if (algoritmo !== "scrypt" || !salt || !hash) return false;
  const esperado = Buffer.from(hash, "hex");
  const calculado = crypto.scryptSync(String(senha), salt, esperado.length);
  return esperado.length === calculado.length && crypto.timingSafeEqual(esperado, calculado);
}

/** Mesmas regras exibidas em redefinir-senha.html (domain/auth.js do front end). */
function regrasNaoAtendidas(senha) {
  const valor = String(senha || "");
  const regras = [
    { mensagem: `pelo menos ${TAMANHO_MINIMO} caracteres`, ok: valor.length >= TAMANHO_MINIMO },
    { mensagem: "ao menos uma letra", ok: /[A-Za-zÀ-ÿ]/.test(valor) },
    { mensagem: "ao menos um número", ok: /\d/.test(valor) },
  ];
  return regras.filter((r) => !r.ok).map((r) => r.mensagem);
}

module.exports = { hashSenha, verificarSenha, regrasNaoAtendidas };
