/*
 * Tratamento centralizado de erros. Traduz erros do Zod, do Prisma e das
 * regras do PostgreSQL (CHECKs e gatilhos) em respostas legíveis.
 */
const { Prisma } = require("@prisma/client");
const { ZodError } = require("zod");
const { ErroHttp, Erros } = require("../lib/erros");

/** Extrai a mensagem levantada por RAISE EXCEPTION / CHECK no PostgreSQL. */
function mensagemDoBanco(erro) {
  const texto = String(erro && erro.message);
  const levantada = texto.match(/(?:ERROR|ERRO):\s*([^\n`]+)/);
  if (levantada) return levantada[1].trim();
  const check = texto.match(/check constraint "([^"]+)"/);
  if (check) return `Os dados violam a regra "${check[1]}".`;
  return null;
}

function traduzir(erro) {
  if (erro instanceof ErroHttp) return erro;

  if (erro instanceof ZodError) {
    const detalhes = erro.issues.map((i) => ({ campo: i.path.join("."), mensagem: i.message }));
    return Erros.requisicaoInvalida("Revise os dados enviados.", detalhes);
  }

  if (erro instanceof SyntaxError && erro.type === "entity.parse.failed") {
    return Erros.requisicaoInvalida("JSON inválido no corpo da requisição.");
  }

  if (erro instanceof Prisma.PrismaClientKnownRequestError) {
    if (erro.code === "P2002") {
      const campos = [].concat(erro.meta?.target || []).join(", ");
      return Erros.conflito(`Já existe um registro com o mesmo valor${campos ? ` em ${campos}` : ""}.`);
    }
    if (erro.code === "P2003") return Erros.conflito("O registro está ligado a outro que não existe ou ainda está em uso.");
    if (erro.code === "P2025") return Erros.naoEncontrado();
    const doBanco = mensagemDoBanco(erro);
    if (doBanco) return Erros.regraDeNegocio(doBanco);
  }

  if (erro instanceof Prisma.PrismaClientUnknownRequestError) {
    const doBanco = mensagemDoBanco(erro);
    if (doBanco) return Erros.regraDeNegocio(doBanco);
  }

  return null;
}

function rotaNaoEncontrada(req, _res, next) {
  next(Erros.naoEncontrado(`Rota ${req.method} ${req.path} não existe.`));
}

// eslint-disable-next-line no-unused-vars
function tratarErros(erro, _req, res, _next) {
  const traduzido = traduzir(erro);
  if (!traduzido) {
    console.error(erro);
    return res.status(500).json({ erro: { codigo: "ERRO_INTERNO", mensagem: "Erro inesperado no servidor. Tente novamente." } });
  }
  const corpo = { codigo: traduzido.codigo, mensagem: traduzido.message };
  if (traduzido.detalhes) corpo.detalhes = traduzido.detalhes;
  return res.status(traduzido.status).json({ erro: corpo });
}

module.exports = { rotaNaoEncontrada, tratarErros, traduzir };
