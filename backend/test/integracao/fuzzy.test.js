const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { pular, limparBanco, clienteAutenticado, encerrar, obterPrisma } = require("./apoio");
const { csvQLattes } = require("../apoio/qlattes");

/*
 * Pares medidos no PostgreSQL (similaridade de trigramas dos títulos normalizados):
 *   survey (mesmo ISSN, título sem subtítulo igual)  → 100   mescla automática (ISSN_TITULO)
 *   escalonamento "geneticos" × "genetico"            → 96,49 mescla automática
 *   aprendizado federado "em" × "para"                → 82,61 fila de revisão
 *   redes neurais "em grafos" × "profundas"           → 56,5  descartado
 */
const ANA = [
  { ano: 2023, titulo: "Deep learning para detecção de anomalias: um survey", periodico: "Journal X", issn: "1111-0001", qualis: "A1" },
  { ano: 2024, titulo: "Aprendizado federado em cidades inteligentes", periodico: "Journal Y", issn: "2222-0002", qualis: "A2" },
  { ano: 2022, titulo: "Escalonamento de tarefas em nuvem com algoritmos genéticos", periodico: "Journal Z", issn: "3333-0003", qualis: "A3" },
  { ano: 2023, titulo: "Redes neurais em grafos para recomendação de produtos", periodico: "Journal W", issn: "4444-0004", qualis: "A4" },
];
const BRUNO = [
  { ano: 2024, titulo: "Deep Learning para Detecção de Anomalias", periodico: "Journal X", issn: "1111-0001", qualis: "A1" },
  { ano: 2022, titulo: "Escalonamento de tarefas em nuvem com algoritmos genetico", periodico: "Outro Journal", issn: "5555-0005", qualis: "B1" },
  { ano: 2024, titulo: "Aprendizado federado para cidades inteligentes", periodico: "Journal Y2", issn: "6666-0006", qualis: "A2" },
  { ano: 2023, titulo: "Redes neurais profundas para recomendação de filmes", periodico: "Journal W", issn: "4444-0004", qualis: "A4" },
];

describe("Fuzzy Match no PostgreSQL", { skip: pular }, () => {
  let api, ana, bruno;

  before(async () => {
    await limparBanco();
    api = await clienteAutenticado();
    ana = (await api.post("/api/docentes").send({ matricula: "D1", nome: "Ana Souza", email: "ana@ic.ufal.br", vinculo: "PERMANENTE", id_lattes: "1111111111111111" })).body;
    bruno = (await api.post("/api/docentes").send({ matricula: "D2", nome: "Bruno Lima", email: "bruno@ic.ufal.br", vinculo: "PERMANENTE", id_lattes: "2222222222222222" })).body;
  });
  after(encerrar);

  const importar = (nome, idLattes, artigos, docente, arquivo = "cv.csv") =>
    api.post("/api/importacoes").attach("arquivo", csvQLattes(nome, idLattes, artigos), arquivo).field("id_docente", String(docente.id_docente));

  const producao = async (docente) => (await api.get(`/api/docentes/${docente.id_docente}/publicacoes`)).body;
  const titulosCom = (pubs, coautor) => pubs.filter((p) => p.coautores.some((c) => c.nome === coautor)).map((p) => p.titulo).sort();

  it("importar o segundo CV mescla automaticamente o que passa do corte e enfileira a faixa de revisão", async () => {
    assert.equal((await importar("Ana Souza", "1111111111111111", ANA, ana)).status, 201);
    const res = await importar("Bruno Lima", "2222222222222222", BRUNO, bruno);
    assert.equal(res.status, 201, JSON.stringify(res.body));
    assert.deepEqual(res.body.importacao.contagens.correspondencias, { analisadas: 4, mescladas_automaticamente: 2, para_revisao: 1 });

    const automaticas = (await api.get("/api/correspondencias?faixa=automatica")).body;
    assert.deepEqual(automaticas.map((c) => [c.motivo, Number(c.nota)]).sort(), [["ISSN_TITULO", 100], ["SIMILARIDADE_TITULO", 96.49]]);

    const revisao = (await api.get("/api/correspondencias?faixa=revisao")).body;
    assert.equal(revisao.length, 1);
    assert.equal(Number(revisao[0].nota), 82.61);
    assert.equal(revisao[0].publicacao.titulo, "Aprendizado federado para cidades inteligentes");
    assert.equal(revisao[0].publicacao_candidata.titulo, "Aprendizado federado em cidades inteligentes");

    // Na produção do Bruno, os dois artigos mesclados aparecem como os da Ana, com ela de coautora.
    assert.deepEqual(titulosCom(await producao(bruno), "Ana Souza"), [
      "Deep learning para detecção de anomalias: um survey",
      "Escalonamento de tarefas em nuvem com algoritmos genéticos",
    ]);
    assert.equal((await producao(bruno)).length, 4);
  });

  it("confirmar na fila de revisão mescla; rejeitar depois desfaz", async () => {
    const [pendente] = (await api.get("/api/correspondencias?faixa=revisao")).body;
    const confirmada = await api.patch(`/api/correspondencias/${pendente.id_correspondencia}`).send({ decisao: "CONFIRMADA" });
    assert.equal(confirmada.status, 200, JSON.stringify(confirmada.body));
    assert.equal(confirmada.body.id_usuario, 1);
    // Mesclar troca qual registro vale; o Bruno continua com 4 artigos, agora 3 com a Ana.
    assert.equal(titulosCom(await producao(bruno), "Ana Souza").length, 3);
    assert.equal((await producao(bruno)).length, 4);

    const rejeitada = await api.patch(`/api/correspondencias/${pendente.id_correspondencia}`).send({ decisao: "REJEITADA", justificativa: "São artigos diferentes." });
    assert.equal(rejeitada.status, 200);
    assert.equal(rejeitada.body.autores_movidos, null);
    assert.equal(titulosCom(await producao(bruno), "Ana Souza").length, 2);
    assert.equal((await producao(bruno)).length, 4);
  });

  it("rejeitar uma mescla automática devolve a publicação ao docente", async () => {
    const auto = (await api.get("/api/correspondencias?faixa=automatica")).body.find((c) => c.motivo === "SIMILARIDADE_TITULO");
    const res = await api.patch(`/api/correspondencias/${auto.id_correspondencia}`).send({ decisao: "REJEITADA" });
    assert.equal(res.status, 200);
    const titulos = (await producao(bruno)).map((p) => p.titulo);
    assert.ok(titulos.includes("Escalonamento de tarefas em nuvem com algoritmos genetico"));
    const original = await obterPrisma().publicacao.findFirst({ where: { titulo: "Escalonamento de tarefas em nuvem com algoritmos genetico" } });
    assert.equal(original.id_mesclada_em, null);
  });

  it("reprocessar respeita as decisões (não recria pares rejeitados)", async () => {
    const res = await api.post("/api/correspondencias/processar");
    assert.equal(res.status, 200);
    assert.equal(res.body.mescladas_automaticamente, 0);
    assert.equal(res.body.para_revisao, 0);
    assert.equal((await api.get("/api/correspondencias?faixa=decididas")).body.length, 2);
  });

  it("reimportar o CV atualizado encontra o artigo já mesclado e não o duplica", async () => {
    const novo = { ano: 2025, titulo: "Artigo inédito de 2025", periodico: "Journal X", issn: "1111-0001", qualis: "A1" };
    const res = await importar("Bruno Lima", "2222222222222222", [...BRUNO, novo], bruno, "cv-v2.csv");
    assert.equal(res.status, 201);
    assert.equal(res.body.importacao.contagens.novas, 1);
    assert.equal(res.body.importacao.contagens.ja_importadas, 4);
    assert.equal((await producao(bruno)).length, 5);
    assert.deepEqual(titulosCom(await producao(bruno), "Ana Souza"), ["Deep learning para detecção de anomalias: um survey"], JSON.stringify(await producao(bruno), null, 1));
  });

  it("filtra a fila por docente e valida a decisão", async () => {
    const daAna = (await api.get(`/api/correspondencias?faixa=todas&id_docente=${ana.id_docente}`)).body;
    assert.equal(daAna.length, 3);
    const invalida = await api.patch(`/api/correspondencias/${daAna[0].id_correspondencia}`).send({ decisao: "TALVEZ" });
    assert.equal(invalida.status, 400);
    assert.equal((await api.patch("/api/correspondencias/9999").send({ decisao: "REJEITADA" })).status, 404);
  });
});
