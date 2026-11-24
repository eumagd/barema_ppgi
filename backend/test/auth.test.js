const { describe, it, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const { criarApp } = require("../src/app");
const { criarPrismaFalso, criarEmailFalso } = require("./apoio/prisma-falso");

describe("autenticação", () => {
  let app, prisma, email;

  beforeEach(() => {
    prisma = criarPrismaFalso();
    email = criarEmailFalso();
    app = criarApp({ prisma, email });
  });

  async function entrar(e = "secretaria@ic.ufal.br", senha = "ppgi2026") {
    return request(app).post("/api/auth/login").send({ email: e, senha });
  }

  it("faz login sem diferenciar maiúsculas no e-mail e devolve o perfil", async () => {
    const res = await entrar("Secretaria@IC.ufal.br");
    assert.equal(res.status, 200);
    assert.ok(res.body.token);
    assert.deepEqual(res.body.usuario, { id: 1, nome: "Secretaria do PPGI", email: "secretaria@ic.ufal.br", perfil: "SECRETARIA" });
    assert.equal(res.body.usuario.senha_hash, undefined);
  });

  it("recusa senha errada e e-mail inexistente com a mesma mensagem", async () => {
    const senhaErrada = await entrar("secretaria@ic.ufal.br", "errada123");
    const semCadastro = await entrar("ninguem@ic.ufal.br", "ppgi2026");
    assert.equal(senhaErrada.status, 401);
    assert.equal(semCadastro.status, 401);
    assert.equal(senhaErrada.body.erro.mensagem, semCadastro.body.erro.mensagem);
  });

  it("valida o formato do e-mail", async () => {
    const res = await entrar("nao-e-email", "x");
    assert.equal(res.status, 400);
    assert.equal(res.body.erro.codigo, "REQUISICAO_INVALIDA");
    assert.equal(res.body.erro.detalhes[0].campo, "email");
  });

  it("GET /eu exige token válido", async () => {
    assert.equal((await request(app).get("/api/auth/eu")).status, 401);
    assert.equal((await request(app).get("/api/auth/eu").set("Authorization", "Bearer lixo")).status, 401);

    const { body } = await entrar();
    const res = await request(app).get("/api/auth/eu").set("Authorization", `Bearer ${body.token}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.perfil, "SECRETARIA");
  });

  it("recuperação responde igual com ou sem cadastro, e só envia e-mail a quem existe", async () => {
    const existe = await request(app).post("/api/auth/recuperar-senha").send({ email: "coordenacao@ic.ufal.br" });
    const naoExiste = await request(app).post("/api/auth/recuperar-senha").send({ email: "fulano@ic.ufal.br" });
    assert.equal(existe.status, 202);
    assert.equal(naoExiste.status, 202);
    assert.deepEqual(existe.body, naoExiste.body);
    assert.equal(email.enviados.length, 1);
    assert.equal(email.enviados[0].para, "coordenacao@ic.ufal.br");
    assert.equal(prisma.dados.tokens.length, 1);
    assert.notEqual(prisma.dados.tokens[0].token_hash, extrairToken(email.enviados[0].texto), "guarda só o hash");
  });

  it("redefine a senha com o link do e-mail, uma única vez", async () => {
    await request(app).post("/api/auth/recuperar-senha").send({ email: "secretaria@ic.ufal.br" });
    const token = extrairToken(email.enviados[0].texto);

    const fraca = await request(app).post("/api/auth/redefinir-senha").send({ token, senha: "curta" });
    assert.equal(fraca.status, 400);

    const ok = await request(app).post("/api/auth/redefinir-senha").send({ token, senha: "novaSenha2027" });
    assert.equal(ok.status, 204);
    assert.equal((await entrar("secretaria@ic.ufal.br", "novaSenha2027")).status, 200);
    assert.equal((await entrar("secretaria@ic.ufal.br", "ppgi2026")).status, 401);

    const repetida = await request(app).post("/api/auth/redefinir-senha").send({ token, senha: "outraSenha2028" });
    assert.equal(repetida.status, 400);
  });

  it("recusa link expirado", async () => {
    await request(app).post("/api/auth/recuperar-senha").send({ email: "secretaria@ic.ufal.br" });
    const token = extrairToken(email.enviados[0].texto);
    prisma.dados.tokens[0].expira_em = new Date(Date.now() - 1000);
    const res = await request(app).post("/api/auth/redefinir-senha").send({ token, senha: "novaSenha2027" });
    assert.equal(res.status, 400);
  });

  it("limita tentativas de login", async () => {
    for (let i = 0; i < 10; i++) await entrar("secretaria@ic.ufal.br", "errada123");
    const res = await entrar("secretaria@ic.ufal.br", "errada123");
    assert.equal(res.status, 429);
  });
});

function extrairToken(texto) {
  return decodeURIComponent(texto.match(/token=([^&\s]+)/)[1]);
}
