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

/**
 * Valida o token e confere se o usuário ainda existe (e com o mesmo perfil): um usuário
 * removido ou com perfil alterado não continua usando uma sessão antiga.
 * O Prisma vem de app.locals.prisma (definido em criarApp).
 */
async function autenticar(req, _res, next) {
  const [tipo, token] = String(req.headers.authorization || "").split(" ");
  if (tipo !== "Bearer" || !token) return next(Erros.naoAutenticado());
  let dados;
  try {
    dados = jwt.verify(token, config.jwt.segredo);
  } catch (erro) {
    const expirou = erro instanceof jwt.TokenExpiredError;
    return next(Erros.naoAutenticado(expirou ? "Sua sessão expirou. Faça login novamente." : "Sessão inválida. Faça login novamente."));
  }
  try {
    const usuario = await req.app.locals.prisma.usuario.findUnique({ where: { id_usuario: Number(dados.sub) } });
    if (!usuario || usuario.perfil !== dados.perfil) return next(Erros.naoAutenticado("Sessão inválida. Faça login novamente."));
    req.usuario = { id: usuario.id_usuario, perfil: usuario.perfil, nome: usuario.nome };
    return next();
  } catch (erro) {
    return next(erro);
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
