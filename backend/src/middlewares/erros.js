/*
 * Tratamento centralizado de erros. Traduz erros do Zod, do Prisma e das
 * regras do PostgreSQL (CHECKs e gatilhos) em respostas legíveis.
 */
const { Prisma } = require("@prisma/client");
const { ZodError } = require("zod");
const { ErroHttp, Erros } = require("../lib/erros");

/** Mensagens legíveis para as restrições CHECK das migrações manuais. */
const MENSAGENS_CHECK = {
  discente_ano_ingresso_chk: "Ano de ingresso deve estar entre 1980 e 2100.",
  publicacao_ano_chk: "Ano de publicação deve estar entre 1950 e 2100.",
  publicacao_correspondencia_chk: "A correspondência deve estar entre 0 e 100.",
  estrato_qualis_pontuacao_chk: "A pontuação do estrato não pode ser negativa.",
  estrato_qualis_ano_base_chk: "Ano-base do Qualis deve estar entre 2000 e 2100.",
  estrato_qualis_manual_justificativa_chk: "Classificação manual de estrato exige justificativa.",
  autoria_ordem_chk: "A ordem de autoria começa em 1.",
  avaliacao_pontuacao_chk: "A pontuação de pesquisa não pode ser negativa.",
  avaliacao_envio_relatorio_chk: "Relatório enviado precisa da data de envio.",
  avaliacao_validade_chk: "Só processos deferidos têm data de validade.",
  avaliacao_publicacao_pontos_chk: "Os pontos atribuídos não podem ser negativos.",
  autor_uma_superclasse_chk: "O autor deve ser exatamente um docente, discente ou externo, conforme o tipo.",
  coorientacao_um_coorientador_chk: "Informe um docente ou um membro externo como coorientador (apenas um).",
  docente_id_lattes_chk: "O ID Lattes deve ter exatamente 16 dígitos.",
  turma_semestre_chk: "O semestre deve ser 1 ou 2.",
  turma_ano_chk: "Ano da turma deve estar entre 1980 e 2100.",
  correspondencia_nota_chk: "A nota da correspondência deve estar entre 0 e 100.",
  correspondencia_candidato_chk: "Correspondência sem candidato válido para o tipo informado.",
  correspondencia_decisao_chk: "Decisão manual precisa registrar o usuário e a data.",
  importacao_hash_chk: "Hash do arquivo inválido.",
  publicacao_mescla_chk: "Uma publicação não pode ser mesclada nela mesma.",
  docente_orcid_chk: "ORCID inválido. Formato: 0000-0002-1825-0097.",
  docente_id_openalex_chk: "ID do OpenAlex inválido. Formato: A5021730842.",
};

/**
 * Extrai a mensagem de RAISE EXCEPTION (código P0001, usado pelos gatilhos) ou o
 * nome da restrição CHECK violada (23514). O Prisma não expõe esses campos, só os
 * inclui no texto do erro: PostgresError { code: "...", message: "..." }.
 */
function mensagemDoBanco(erro) {
  const texto = String(erro && erro.message);
  const codigo = (texto.match(/PostgresError \{ code: "([0-9A-Z]{5})"/) || [])[1];
  const mensagem = ((texto.match(/message: "((?:[^"\\]|\\.)*)"/) || [])[1] || "").replace(/\\"/g, '"');

  if (codigo === "P0001" && mensagem) return mensagem;
  if (codigo === "23514") {
    const restricao = (mensagem.match(/"([a-z0-9_]+_chk)"/) || [])[1];
    return MENSAGENS_CHECK[restricao] || `Os dados violam a regra "${restricao || "desconhecida"}".`;
  }
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
