/*
 * Autenticação por JWT (cabeçalho Authorization: Bearer <token>) e controle de
 * acesso por perfil (RBAC, RNF-BE07): SECRETARIA e COORDENACAO.
 */
const jwt = require("jsonwebtoken");
const config = require("../config");
const { Erros } = require("../lib/erros");

const PERFIS = Object.freeze({ SECRETARIA: "SECRETARIA", COORDENACAO: "COORDENACAO" });

function emitirToken(usuario) {
  return jwt.sign({ perfil: usuario.perfil, nome: usuario.nome }, config.jwt.segredo, {
    subject: String(usuario.id_usuario),
    expiresIn: config.jwt.expiraEm,
  });
}

function autenticar(req, _res, next) {
  const [tipo, token] = String(req.headers.authorization || "").split(" ");
  if (tipo !== "Bearer" || !token) return next(Erros.naoAutenticado());
  try {
    const dados = jwt.verify(token, config.jwt.segredo);
    req.usuario = { id: Number(dados.sub), perfil: dados.perfil, nome: dados.nome };
    return next();
  } catch (erro) {
    const expirou = erro instanceof jwt.TokenExpiredError;
    return next(Erros.naoAutenticado(expirou ? "Sua sessão expirou. Faça login novamente." : "Sessão inválida. Faça login novamente."));
  }
}

/** Uso: router.put("/x", autenticar, exigirPerfil(PERFIS.COORDENACAO), handler). */
function exigirPerfil(...perfis) {
  return (req, _res, next) => {
    if (!req.usuario) return next(Erros.naoAutenticado());
    if (!perfis.includes(req.usuario.perfil)) return next(Erros.semPermissao());
    return next();
  };
}

module.exports = { PERFIS, emitirToken, autenticar, exigirPerfil };
