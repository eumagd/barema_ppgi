const { describe, it, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const { criarApp } = require("../src/app");
const { criarPrismaFalso, criarEmailFalso } = require("./apoio/prisma-falso");

describe("parâmetros da resolução", () => {
  let app, tokens;

  beforeEach(async () => {
    app = criarApp({ prisma: criarPrismaFalso(), email: criarEmailFalso() });
    tokens = {};
    for (const [perfil, e] of [["SECRETARIA", "secretaria@ic.ufal.br"], ["COORDENACAO", "coordenacao@ic.ufal.br"]]) {
      const res = await request(app).post("/api/auth/login").send({ email: e, senha: "ppgi2026" });
      tokens[perfil] = res.body.token;
    }
  });

  const comToken = (req, perfil) => req.set("Authorization", `Bearer ${tokens[perfil]}`);

  it("exige login para ler", async () => {
    assert.equal((await request(app).get("/api/resolucoes/1/parametros")).status, 401);
  });

  it("qualquer perfil lê os parâmetros", async () => {
    const res = await comToken(request(app).get("/api/resolucoes/1/parametros"), "SECRETARIA");
    assert.equal(res.status, 200);
    assert.equal(res.body["pesos_estrato"].valor.A4, 0.625);
  });

  it("secretaria não altera parâmetros", async () => {
    const res = await comToken(request(app).put("/api/resolucoes/1/parametros/fuzzy.corte_revisao").send({ valor: 85 }), "SECRETARIA");
    assert.equal(res.status, 403);
  });

  it("coordenação altera um parâmetro válido", async () => {
    const res = await comToken(request(app).put("/api/resolucoes/1/parametros/fuzzy.corte_revisao").send({ valor: 85 }), "COORDENACAO");
    assert.equal(res.status, 200);
    assert.equal(res.body.valor, 85);
  });

  it("valida o formato do valor e a ordem dos cortes do Fuzzy Match", async () => {
    const invalido = await comToken(request(app).put("/api/resolucoes/1/parametros/fuzzy.corte_revisao").send({ valor: 150 }), "COORDENACAO");
    assert.equal(invalido.status, 400);

    const invertido = await comToken(request(app).put("/api/resolucoes/1/parametros/fuzzy.corte_revisao").send({ valor: 95 }), "COORDENACAO");
    assert.equal(invertido.status, 422);

    const pesoFaltando = await comToken(
      request(app).put("/api/resolucoes/1/parametros/pesos_estrato").send({ valor: { A1: 1 } }),
      "COORDENACAO",
    );
    assert.equal(pesoFaltando.status, 400);
  });

  it("recusa chave desconhecida e resolução inexistente", async () => {
    const chave = await comToken(request(app).put("/api/resolucoes/1/parametros/inventado").send({ valor: 1 }), "COORDENACAO");
    assert.equal(chave.status, 404);
    const resolucao = await comToken(request(app).get("/api/resolucoes/99/parametros"), "COORDENACAO");
    assert.equal(resolucao.status, 404);
  });

  it("rota inexistente devolve 404 em JSON", async () => {
    const res = await request(app).get("/api/nada");
    assert.equal(res.status, 404);
    assert.equal(res.body.erro.codigo, "NAO_ENCONTRADO");
  });
});
