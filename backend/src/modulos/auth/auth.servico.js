/*
 * Login, sessão e recuperação de senha (login.html, recuperar-senha.html, redefinir-senha.html).
 */
const crypto = require("node:crypto");
const config = require("../../config");
const { Erros } = require("../../lib/erros");
const { hashSenha, verificarSenha, regrasNaoAtendidas } = require("../../lib/senha");
const { emitirToken } = require("../../middlewares/autenticacao");

const MENSAGEM_LOGIN_INVALIDO = "E-mail ou senha incorretos. Confira os dados ou recupere sua senha.";

/** Usado quando o e-mail não existe, para o tempo de resposta não revelar quem tem cadastro. */
const HASH_FICTICIO = hashSenha(crypto.randomBytes(16).toString("hex"));

const hashToken = (token) => crypto.createHash("sha256").update(token).digest("hex");

function usuarioPublico(u) {
  return { id: u.id_usuario, nome: u.nome, email: u.email, perfil: u.perfil };
}

function buscarPorEmail(prisma, email) {
  return prisma.usuario.findFirst({ where: { email: { equals: email.trim(), mode: "insensitive" } } });
}

function criarServicoAuth({ prisma, email: servicoEmail }) {
  async function login(email, senha) {
    const usuario = await buscarPorEmail(prisma, email);
    const senhaOk = verificarSenha(senha, usuario ? usuario.senha_hash : HASH_FICTICIO);
    if (!usuario || !senhaOk) throw Erros.naoAutenticado(MENSAGEM_LOGIN_INVALIDO);
    return { token: emitirToken(usuario), usuario: usuarioPublico(usuario) };
  }

  async function usuarioAtual(id) {
    const usuario = await prisma.usuario.findUnique({ where: { id_usuario: id } });
    if (!usuario) throw Erros.naoAutenticado("Usuário não encontrado. Faça login novamente.");
    return usuarioPublico(usuario);
  }

  /** Sempre termina sem erro para e-mails válidos, tendo ou não cadastro. */
  async function solicitarRedefinicao(email) {
    const usuario = await buscarPorEmail(prisma, email);
    if (!usuario) return;

    const token = crypto.randomBytes(32).toString("base64url");
    const expiraEm = new Date(Date.now() + config.redefinicaoSenha.validadeMinutos * 60_000);
    await prisma.tokenRedefinicaoSenha.create({
      data: { id_usuario: usuario.id_usuario, token_hash: hashToken(token), expira_em: expiraEm },
    });

    const link = `${config.frontendUrl}/redefinir-senha.html?token=${encodeURIComponent(token)}&email=${encodeURIComponent(usuario.email)}`;
    await servicoEmail.enviar({
      para: usuario.email,
      assunto: "Redefinição de senha — Plataforma de Baremas do PPGI/UFAL",
      texto:
        `Olá, ${usuario.nome}.\n\n` +
        `Recebemos um pedido para redefinir sua senha. Use o link abaixo em até ${config.redefinicaoSenha.validadeMinutos} minutos:\n\n${link}\n\n` +
        "Se você não fez esse pedido, ignore este e-mail.",
    });
  }

  async function redefinirSenha(token, novaSenha) {
    const pendentes = regrasNaoAtendidas(novaSenha);
    if (pendentes.length) throw Erros.requisicaoInvalida(`Revise a senha: ${pendentes.join("; ")}.`);

    const registro = await prisma.tokenRedefinicaoSenha.findUnique({ where: { token_hash: hashToken(token) } });
    if (!registro || registro.usado_em || registro.expira_em <= new Date()) {
      throw Erros.requisicaoInvalida("Link de redefinição inválido ou expirado. Solicite um novo.");
    }

    const agora = new Date();
    await prisma.$transaction([
      prisma.usuario.update({ where: { id_usuario: registro.id_usuario }, data: { senha_hash: hashSenha(novaSenha) } }),
      // Invalida este e qualquer outro link pendente do mesmo usuário.
      prisma.tokenRedefinicaoSenha.updateMany({
        where: { id_usuario: registro.id_usuario, usado_em: null },
        data: { usado_em: agora },
      }),
    ]);
  }

  return { login, usuarioAtual, solicitarRedefinicao, redefinirSenha };
}

module.exports = { criarServicoAuth, hashToken };
