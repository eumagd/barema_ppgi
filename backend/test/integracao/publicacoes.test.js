const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { pular, limparBanco, clienteAutenticado, encerrar } = require("./apoio");

describe("cadastro manual de publicações (eventos e coautores)", { skip: pular }, () => {
  let api, ana, bruno, discente, externo;

  before(async () => {
    await limparBanco();
    api = await clienteAutenticado();
    ana = (await api.post("/api/docentes").send({ matricula: "D1", nome: "Ana Souza", email: "ana@ic.ufal.br", vinculo: "PERMANENTE" })).body;
    bruno = (await api.post("/api/docentes").send({ matricula: "D2", nome: "Bruno Lima", email: "bruno@ic.ufal.br", vinculo: "PERMANENTE" })).body;
    discente = (await api.post("/api/discentes").send({ matricula: "M1", nome: "Lucas Andrade", ano_ingresso: 2024, id_orientador: ana.id_docente })).body;
    externo = (await api.post("/api/externos").send({ nome: "Paulo Lins", inst_origem: "UFPE" })).body;
    await api
      .post("/api/qualis/cargas")
      .attach("arquivo", Buffer.from("Sigla;Nome;Estrato\nSBBD;Simpósio Brasileiro de Banco de Dados;A4\n"), "eventos.csv")
      .field("fonte", "EVENTOS")
      .field("ano_base", "2024");
  });
  after(encerrar);

  const autorDe = async (busca, tipo) => (await api.get(`/api/autores?busca=${encodeURIComponent(busca)}&tipo=${tipo}`)).body[0];

  it("busca autores por nome ou citação, filtrando por tipo", async () => {
    assert.equal((await autorDe("Lucas", "DISCENTE")).nome, "Lucas Andrade");
    assert.equal((await autorDe("SOUZA, A", "DOCENTE")).nome, "Ana Souza");
    assert.equal((await api.get("/api/autores?busca=a")).status, 400);
  });

  it("cadastra artigo em evento com coautor discente; o estrato vem da tabela de Eventos", async () => {
    const res = await api.post("/api/publicacoes").send({
      titulo: "Consultas aproximadas em grafos de conhecimento",
      ano: 2024,
      doi: "https://doi.org/10.5753/sbbd.2024.1234",
      veiculo: { tipo: "CONFERENCIA", sigla: "S.B.B.D.", nome: "Simpósio Brasileiro de Banco de Dados" },
      autores: [(await autorDe("Ana", "DOCENTE")).id_autor, (await autorDe("Lucas", "DISCENTE")).id_autor],
    });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    assert.equal(res.body.doi, "10.5753/sbbd.2024.1234");
    assert.deepEqual([res.body.veiculo.issn_sigla, res.body.estrato, res.body.fonte_estrato], ["SBBD", "A4", "EVENTOS"]);
    assert.deepEqual(res.body.autores.map((a) => [a.ordem, a.tipo, a.nome]), [[1, "DOCENTE", "Ana Souza"], [2, "DISCENTE", "Lucas Andrade"]]);

    const producao = (await api.get(`/api/docentes/${ana.id_docente}/publicacoes`)).body;
    assert.deepEqual(producao[0].coautores.map((c) => c.tipo), ["DISCENTE"]);
  });

  it("o mesmo artigo cadastrado pelo outro docente é mesclado pelo Fuzzy Match (DOI)", async () => {
    const res = await api.post("/api/publicacoes").send({
      titulo: "Consultas aproximadas em grafos de conhecimento (versão estendida)",
      ano: 2024,
      doi: "10.5753/SBBD.2024.1234",
      veiculo: { tipo: "CONFERENCIA", sigla: "SBBD", nome: "SBBD" },
      autores: [(await autorDe("Bruno", "DOCENTE")).id_autor],
    });
    assert.equal(res.status, 201);
    assert.equal(res.body.correspondencias.mescladas_automaticamente, 1);
    assert.ok(res.body.id_mesclada_em, "a nova foi mesclada na que já existia");
    const [porDoi] = (await api.get("/api/correspondencias?faixa=automatica")).body;
    assert.deepEqual([porDoi.motivo, Number(porDoi.nota)], ["DOI", 100]);

    const daAna = (await api.get(`/api/docentes/${ana.id_docente}/publicacoes`)).body[0];
    assert.deepEqual(daAna.coautores.map((c) => c.nome).sort(), ["Bruno Lima", "Lucas Andrade"]);

    const editar = await api.patch(`/api/publicacoes/${res.body.id_publicacao}`).send({ ano: 2023 });
    assert.equal(editar.status, 409);
  });

  it("adiciona e remove coautores; não deixa a publicação sem autor", async () => {
    const [pub] = (await api.get(`/api/docentes/${ana.id_docente}/publicacoes`)).body;
    const idExterno = (await autorDe("Paulo", "EXTERNO")).id_autor;

    const com = await api.post(`/api/publicacoes/${pub.id_publicacao}/autores`).send({ id_autor: idExterno });
    assert.equal(com.status, 201);
    assert.equal(com.body.autores.at(-1).nome, "Paulo Lins");
    assert.equal((await api.post(`/api/publicacoes/${pub.id_publicacao}/autores`).send({ id_autor: idExterno })).status, 409);

    const sem = await api.delete(`/api/publicacoes/${pub.id_publicacao}/autores/${idExterno}`);
    assert.equal(sem.status, 200);
    assert.ok(!sem.body.autores.some((a) => a.nome === "Paulo Lins"));
  });

  it("periódico sem ISSN, validações e exclusão", async () => {
    const idAna = (await autorDe("Ana", "DOCENTE")).id_autor;
    const semIssn = await api.post("/api/publicacoes").send({ titulo: "Artigo em revista local", ano: 2023, veiculo: { tipo: "PERIODICO", nome: "Revista Local" }, autores: [idAna] });
    assert.equal(semIssn.status, 201);
    assert.match(semIssn.body.veiculo.issn_sigla, /^SEMISSN-/);

    assert.equal((await api.post("/api/publicacoes").send({ titulo: "X", ano: 2023, veiculo: { id_veiculo: 1 }, autores: [] })).status, 400);
    assert.equal((await api.post("/api/publicacoes").send({ titulo: "Doi ruim", ano: 2023, doi: "abc", veiculo: { id_veiculo: 1 }, autores: [idAna] })).status, 400);
    assert.equal((await api.post("/api/publicacoes").send({ titulo: "Autor fantasma", ano: 2023, veiculo: { id_veiculo: 1 }, autores: [9999] })).status, 400);

    assert.equal((await api.delete(`/api/publicacoes/${semIssn.body.id_publicacao}`)).status, 204);
    assert.equal((await api.get(`/api/publicacoes/${semIssn.body.id_publicacao}`)).status, 404);
    void bruno;
    void discente;
    void externo;
  });
});
