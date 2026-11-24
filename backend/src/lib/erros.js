/*
 * Erros da API com mensagens claras para o front end (RNF-BE08).
 * Formato da resposta: { erro: { codigo, mensagem, detalhes? } }.
 */
class ErroHttp extends Error {
  constructor(status, codigo, mensagem, detalhes) {
    super(mensagem);
    this.status = status;
    this.codigo = codigo;
    this.detalhes = detalhes;
  }
}

const Erros = {
  requisicaoInvalida: (mensagem, detalhes) => new ErroHttp(400, "REQUISICAO_INVALIDA", mensagem, detalhes),
  naoAutenticado: (mensagem = "Faça login para continuar.") => new ErroHttp(401, "NAO_AUTENTICADO", mensagem),
  semPermissao: (mensagem = "Seu perfil não tem permissão para esta ação.") => new ErroHttp(403, "SEM_PERMISSAO", mensagem),
  naoEncontrado: (mensagem = "Recurso não encontrado.") => new ErroHttp(404, "NAO_ENCONTRADO", mensagem),
  conflito: (mensagem, detalhes) => new ErroHttp(409, "CONFLITO", mensagem, detalhes),
  regraDeNegocio: (mensagem, detalhes) => new ErroHttp(422, "REGRA_DE_NEGOCIO", mensagem, detalhes),
  muitasTentativas: (mensagem = "Muitas tentativas. Aguarde alguns minutos e tente novamente.") =>
    new ErroHttp(429, "MUITAS_TENTATIVAS", mensagem),
};

module.exports = { ErroHttp, Erros };
