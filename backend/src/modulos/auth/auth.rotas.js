/*
 * Rotas de autenticação:
 *   POST /api/auth/login              { email, senha }  → { token, usuario }
 *   GET  /api/auth/eu                 (autenticado)     → usuario
 *   POST /api/auth/recuperar-senha    { email }         → 202 (sempre, para não revelar cadastros)
 *   POST /api/auth/redefinir-senha    { token, senha }  → 204
 */
const { Router } = require("express");
const { z } = require("zod");
const { validar } = require("../../middlewares/validar");
const { autenticar } = require("../../middlewares/autenticacao");
const { limiteTentativas } = require("../../middlewares/limite-tentativas");
const { criarServicoAuth } = require("./auth.servico");

const email = z.string().trim().toLowerCase().email("E-mail em formato inválido. Exemplo: nome@ic.ufal.br");

const esquemas = {
  login: z.object({ email, senha: z.string().min(1, "Informe sua senha.") }),
  recuperar: z.object({ email }),
  redefinir: z.object({ token: z.string().min(20, "Link de redefinição inválido."), senha: z.string() }),
};

const QUINZE_MINUTOS = 15 * 60_000;

function criarRotasAuth(deps) {
  const servico = criarServicoAuth(deps);
  const rotas = Router();

  const limiteLogin = limiteTentativas({
    maximo: 10,
    janelaMs: QUINZE_MINUTOS,
    chave: (req) => `login:${req.ip}:${String(req.body?.email || "").toLowerCase()}`,
  });
  const limiteRecuperacao = limiteTentativas({ maximo: 5, janelaMs: QUINZE_MINUTOS, chave: (req) => `recuperar:${req.ip}` });

  rotas.post("/login", limiteLogin, validar({ body: esquemas.login }), async (req, res) => {
    const { email: e, senha } = req.validado.body;
    res.json(await servico.login(e, senha));
  });

  rotas.get("/eu", autenticar, async (req, res) => {
    res.json(await servico.usuarioAtual(req.usuario.id));
  });

  rotas.post("/recuperar-senha", limiteRecuperacao, validar({ body: esquemas.recuperar }), async (req, res) => {
    await servico.solicitarRedefinicao(req.validado.body.email);
    res.status(202).json({ mensagem: "Se o e-mail estiver cadastrado, enviaremos um link para redefinir a senha." });
  });

  rotas.post("/redefinir-senha", limiteRecuperacao, validar({ body: esquemas.redefinir }), async (req, res) => {
    const { token, senha } = req.validado.body;
    await servico.redefinirSenha(token, senha);
    res.status(204).end();
  });

  return rotas;
}

module.exports = { criarRotasAuth };
