const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { pular, limparBanco, clienteAutenticado, encerrar } = require("./apoio");

describe("cadastros no PostgreSQL", { skip: pular }, () => {
  let api, coord;

  before(async () => {
    await limparBanco();
    api = await clienteAutenticado("SECRETARIA");
    coord = await clienteAutenticado("COORDENACAO");
  });
  after(encerrar);

  const docente = (dados) =>
    api.post("/api/docentes").send({ matricula: dados.matricula, nome: dados.nome, email: `${dados.matricula.toLowerCase()}@ic.ufal.br`, ...dados });

  it("cria docente com autor e variações de nome de citação", async () => {
    const res = await docente({ matricula: "D1", nome: "Magdiel Santos", vinculo: "PERMANENTE", id_lattes: "1234567890123456" });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    assert.equal(res.body.autor.nome_citacao, "SANTOS, M.");
    assert.deepEqual(res.body.autor.nomes_citacao.map((n) => n.nome).sort(), ["Magdiel Santos", "SANTOS, M."]);
    assert.ok(res.body.data_vinculo, "vínculo novo começa hoje");
  });

  it("valida ID Lattes, e-mail repetido e matrícula repetida", async () => {
    assert.equal((await docente({ matricula: "D2", nome: "Ana Lima", id_lattes: "123" })).status, 400);
    const repetido = await docente({ matricula: "D1", nome: "Outro Nome" });
    assert.equal(repetido.status, 409);
  });

  it("lista e filtra por vínculo e busca", async () => {
    await docente({ matricula: "D3", nome: "Carla Pereira", vinculo: "COLABORADOR" });
    await docente({ matricula: "D4", nome: "Diego Alves" });
    const sem = await api.get("/api/docentes?vinculo=NENHUM");
    assert.deepEqual(sem.body.map((d) => d.nome), ["Diego Alves"]);
    const busca = await api.get("/api/docentes?busca=carla");
    assert.deepEqual(busca.body.map((d) => d.matricula), ["D3"]);
  });

  it("orientação: gatilhos do banco viram mensagens 422", async () => {
    const [permanente] = (await api.get("/api/docentes?busca=Magdiel")).body;
    const [colaborador] = (await api.get("/api/docentes?busca=Carla")).body;

    const ok = await api.post("/api/discentes").send({ matricula: "M1", nome: "Lucas Andrade", ano_ingresso: 2025, id_orientador: permanente.id_docente });
    assert.equal(ok.status, 201, JSON.stringify(ok.body));
    assert.equal(ok.body.orientador.nome, "Magdiel Santos");

    const colab = await api.post("/api/discentes").send({ matricula: "M2", nome: "Marina Costa", ano_ingresso: 2025, id_orientador: colaborador.id_docente });
    assert.equal(colab.status, 422);
    assert.match(colab.body.erro.mensagem, /permanentes podem orientar/);

    // Orientador não pode ser coorientador do mesmo discente.
    const dupla = await api.post(`/api/discentes/${ok.body.id_discente}/coorientacoes`).send({ id_docente: permanente.id_docente });
    assert.equal(dupla.status, 422);
    assert.match(dupla.body.erro.mensagem, /já é orientador/);

    const co = await api.post(`/api/discentes/${ok.body.id_discente}/coorientacoes`).send({ id_docente: colaborador.id_docente });
    assert.equal(co.status, 201);
    const ambos = await api.post(`/api/discentes/${ok.body.id_discente}/coorientacoes`).send({ id_docente: 1, id_externo: 1 });
    assert.equal(ambos.status, 400);
  });

  it("limite de 8 orientandos por permanente", async () => {
    const [permanente] = (await api.get("/api/docentes?busca=Magdiel")).body;
    for (let i = 2; i <= 8; i++) {
      const r = await api.post("/api/discentes").send({ matricula: `L${i}`, nome: `Aluno ${i}`, ano_ingresso: 2025, id_orientador: permanente.id_docente });
      assert.equal(r.status, 201);
    }
    const nono = await api.post("/api/discentes").send({ matricula: "L9", nome: "Aluno 9", ano_ingresso: 2025, id_orientador: permanente.id_docente });
    assert.equal(nono.status, 422);
    assert.match(nono.body.erro.mensagem, /8 orientandos/);
  });

  it("não desvincula quem tem orientandos em andamento; desvincula e devolve o anterior", async () => {
    const [permanente] = (await api.get("/api/docentes?busca=Magdiel")).body;
    const bloqueado = await api.post(`/api/docentes/${permanente.id_docente}/desvincular`);
    assert.equal(bloqueado.status, 422);

    const [colaborador] = (await api.get("/api/docentes?busca=Carla")).body;
    const ok = await api.post(`/api/docentes/${colaborador.id_docente}/desvincular`);
    assert.equal(ok.status, 200);
    assert.equal(ok.body.docente.vinculo, null);
    assert.equal(ok.body.anterior.vinculo, "COLABORADOR");

    const desfazer = await api.patch(`/api/docentes/${colaborador.id_docente}`).send({ vinculo: ok.body.anterior.vinculo });
    assert.equal(desfazer.body.vinculo, "COLABORADOR");
  });

  it("sinaliza e desfaz a recusa de participação (RF16)", async () => {
    const [d] = (await api.get("/api/docentes?busca=Diego")).body;
    const recusa = await api.put(`/api/docentes/${d.id_docente}/recusa`).send({});
    assert.ok(recusa.body.data_recusa_participacao);
    assert.deepEqual((await api.get("/api/docentes?participando=false")).body.map((x) => x.nome), ["Diego Alves"]);
    const desfaz = await api.delete(`/api/docentes/${d.id_docente}/recusa`);
    assert.equal(desfaz.body.data_recusa_participacao, null);
  });

  it("variações de nome: adiciona, recusa repetida e remove", async () => {
    const [d] = (await api.get("/api/docentes?busca=Magdiel")).body;
    const nova = await api.post(`/api/docentes/${d.id_docente}/nomes-citacao`).send({ nome: "SANTOS, MAGDIEL" });
    assert.equal(nova.status, 201);
    const repetida = await api.post(`/api/docentes/${d.id_docente}/nomes-citacao`).send({ nome: "Santos, Magdiel" });
    assert.equal(repetida.status, 409);
    assert.equal((await api.delete(`/api/docentes/${d.id_docente}/nomes-citacao/${nova.body.id_nome_citacao}`)).status, 204);
  });

  it("disciplinas: marca Estudo Dirigido sozinho; turmas validam semestre", async () => {
    const ed = await api.post("/api/disciplinas").send({ codigo: "ppgi001", nome: "Estudo Dirigido em IA", nivel: "POS_GRADUACAO" });
    assert.equal(ed.status, 201);
    assert.equal(ed.body.codigo, "PPGI001");
    assert.equal(ed.body.estudo_dirigido, true);

    const comum = await api.post("/api/disciplinas").send({ codigo: "PPGI002", nome: "Aprendizado de Máquina", nivel: "POS_GRADUACAO" });
    assert.equal(comum.body.estudo_dirigido, false);

    const [d] = (await api.get("/api/docentes?busca=Magdiel")).body;
    const turma = await api.post("/api/turmas").send({ id_disciplina: comum.body.id_disciplina, id_docente: d.id_docente, ano: 2025, semestre: 1 });
    assert.equal(turma.status, 201);
    assert.equal((await api.post("/api/turmas").send({ id_disciplina: comum.body.id_disciplina, id_docente: d.id_docente, ano: 2025, semestre: 3 })).status, 400);
    assert.equal((await api.post("/api/turmas").send({ id_disciplina: comum.body.id_disciplina, id_docente: d.id_docente, ano: 2025, semestre: 1 })).status, 409);

    const detalhe = await api.get(`/api/docentes/${d.id_docente}`);
    assert.equal(detalhe.body.turmas.length, 1);
    assert.equal((await api.delete(`/api/disciplinas/${comum.body.id_disciplina}`)).status, 409);
  });

  it("externos e exclusão de docente (só coordenação)", async () => {
    const ext = await api.post("/api/externos").send({ nome: "Paulo Henrique Lins", inst_origem: "UFPE" });
    assert.equal(ext.status, 201);
    const [d] = (await api.get("/api/docentes?busca=Diego")).body;
    assert.equal((await api.delete(`/api/docentes/${d.id_docente}`)).status, 403);
    assert.equal((await coord.delete(`/api/docentes/${d.id_docente}`)).status, 204);
    assert.equal((await api.get(`/api/docentes/${d.id_docente}`)).status, 404);
  });
});
