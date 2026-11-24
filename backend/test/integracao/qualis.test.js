const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { pular, limparBanco, clienteAutenticado, encerrar, obterPrisma } = require("./apoio");

const csv = (texto, codificacao = "utf8") => Buffer.from(texto, codificacao);

describe("cargas Qualis no PostgreSQL", { skip: pular }, () => {
  let api;

  before(async () => {
    await limparBanco();
    api = await clienteAutenticado();
  });
  after(encerrar);

  const carregar = (arquivo, nome, fonte, anoBase) =>
    api.post("/api/qualis/cargas").attach("arquivo", arquivo, nome).field("fonte", fonte).field("ano_base", String(anoBase));

  const CAPES = csv("ISSN;Título;Área de Avaliação;Estrato\n0001-0782;CACM;CIÊNCIA DA COMPUTAÇÃO;A1\n0001-0782;CACM;MEDICINA I;B1\n2169-3536;IEEE ACCESS;CIÊNCIA DA COMPUTAÇÃO;A2\n", "latin1");

  it("carrega CSV Latin-1 da CAPES filtrando a área", async () => {
    const res = await carregar(CAPES, "capes.csv", "CAPES", 2020);
    assert.equal(res.status, 201, JSON.stringify(res.body));
    assert.equal(res.body.carga.status, "CONCLUIDO");
    assert.equal(res.body.carga.contagens.codificacao, "Latin-1");
    assert.equal(res.body.carga.contagens.outras_areas, 1);
    assert.equal(await obterPrisma().estratoQualis.count({ where: { fonte: "CAPES" } }), 2);
  });

  it("mesmo arquivo de novo é reaproveitado, sem duplicar", async () => {
    const res = await carregar(CAPES, "capes-copia.csv", "CAPES", 2020);
    assert.equal(res.status, 200);
    assert.equal(res.body.reaproveitada, true);
    assert.equal(await obterPrisma().estratoQualis.count({ where: { fonte: "CAPES" } }), 2);
  });

  it("nova versão substitui a anterior da mesma fonte e ano-base", async () => {
    const res = await carregar(csv("ISSN;Área;Estrato\n0001-0782;Ciência da Computação;A2\n"), "capes-v2.csv", "CAPES", 2020);
    assert.equal(res.status, 201);
    assert.equal(res.body.carga.contagens.estratos_substituidos, 2);
    const estratos = await obterPrisma().estratoQualis.findMany({ where: { fonte: "CAPES" } });
    assert.deepEqual(estratos.map((e) => e.estrato), ["A2"]);
  });

  it("estrato vigente segue CAPES → PUC-RS → Scopus", async () => {
    await carregar(csv("ISSN,Estrato\n0001-0782,A1\n1999-4893,A3\n"), "pucrs.csv", "PUC_RS", 2024);
    await carregar(csv("ISSN,Percentile\n1999-4893,95\n"), "scopus.csv", "SCOPUS", 2024);

    const cacm = (await api.get("/api/qualis/veiculos?busca=0001-0782")).body[0];
    assert.equal(cacm.estrato_vigente.fonte, "CAPES");
    assert.equal(cacm.estrato_vigente.estrato, "A2");

    const algoritmos = (await api.get("/api/qualis/veiculos?busca=1999-4893")).body[0];
    assert.deepEqual(algoritmos.estratos.map((e) => e.fonte).sort(), ["PUC_RS", "SCOPUS"]);
    assert.equal(algoritmos.estrato_vigente.fonte, "PUC_RS");
  });

  it("eventos por sigla; arquivo sem linhas válidas fica registrado como FALHA", async () => {
    const ev = await carregar(csv("Sigla;Nome;Qualis\nS.B.B.D.;Simpósio Brasileiro de Banco de Dados;A4\n"), "eventos.csv", "EVENTOS", 2024);
    assert.equal(ev.status, 201);
    const sbbd = (await api.get("/api/qualis/veiculos?busca=sbbd&tipo=CONFERENCIA")).body[0];
    assert.equal(sbbd.issn_sigla, "SBBD");
    assert.equal(sbbd.estrato_vigente.estrato, "A4");

    const vazio = await carregar(csv("ISSN;Estrato\n0001-0782;N\n"), "so-n.csv", "PUC_RS", 2025);
    assert.equal(vazio.status, 422);
    const cargas = (await api.get("/api/qualis/cargas")).body;
    assert.equal(cargas[0].status, "FALHA");
  });

  it("recusa extensão errada e cabeçalho inesperado", async () => {
    const xlsx = await carregar(csv("x"), "planilha.xlsx", "CAPES", 2020);
    assert.equal(xlsx.status, 400);
    assert.match(xlsx.body.erro.mensagem, /\.csv/);
    const cabecalho = await carregar(csv("Nome;Ano\nX;2020\n"), "ruim.csv", "CAPES", 2020);
    assert.equal(cabecalho.status, 400);
    assert.ok(cabecalho.body.erro.detalhes.cabecalho_lido);
  });
});
