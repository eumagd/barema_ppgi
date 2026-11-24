const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { pular, limparBanco, clienteAutenticado, criarResolucao, encerrar } = require("./apoio");
const { csvQLattes } = require("../apoio/qlattes");

/*
 * Fluxo completo de um recredenciamento e de um credenciamento:
 * cadastro → importação do QLattes → cadastro manual (evento com discente) → cálculo →
 * abertura do processo → desmarcar publicação → tramitação.
 * As datas dependem de "hoje": o período padrão são os 3 anos completos anteriores.
 */
const ANO = new Date().getUTCFullYear();

describe("cálculo e avaliações no PostgreSQL", { skip: pular }, () => {
  let api, coord, ana, bruno, carla, lucas;

  before(async () => {
    await limparBanco();
    await criarResolucao();
    api = await clienteAutenticado("SECRETARIA");
    coord = await clienteAutenticado("COORDENACAO");

    ana = (await api.post("/api/docentes").send({ matricula: "D1", nome: "Ana Souza", email: "ana@ic.ufal.br", vinculo: "PERMANENTE", data_vinculo: "2015-03-01", id_lattes: "1111111111111111" })).body;
    bruno = (await api.post("/api/docentes").send({ matricula: "D2", nome: "Bruno Lima", email: "bruno@ic.ufal.br", vinculo: "PERMANENTE", data_vinculo: "2016-03-01" })).body;
    carla = (await api.post("/api/docentes").send({ matricula: "D3", nome: "Carla Pereira", email: "carla@ic.ufal.br" })).body;

    // Orientação: 1 em andamento + 2 coorientações (0,5 cada) = 2.
    lucas = (await api.post("/api/discentes").send({ matricula: "M1", nome: "Lucas Andrade", ano_ingresso: ANO - 1, id_orientador: ana.id_docente })).body;
    for (const [m, nome] of [["M2", "Marina Costa"], ["M3", "Rafael Lins"]]) {
      const d = (await api.post("/api/discentes").send({ matricula: m, nome, ano_ingresso: ANO - 1, id_orientador: bruno.id_docente })).body;
      await api.post(`/api/discentes/${d.id_discente}/coorientacoes`).send({ id_docente: ana.id_docente });
    }

    // Docência: uma disciplina do PPGI e um Estudo Dirigido (que não conta).
    const ia = (await api.post("/api/disciplinas").send({ codigo: "PPGI10", nome: "Inteligência Artificial", nivel: "POS_GRADUACAO" })).body;
    const ed = (await api.post("/api/disciplinas").send({ codigo: "PPGI99", nome: "Estudo Dirigido", nivel: "POS_GRADUACAO" })).body;
    await api.post("/api/turmas").send({ id_disciplina: ia.id_disciplina, id_docente: ana.id_docente, ano: ANO, semestre: 1 });
    await api.post("/api/turmas").send({ id_disciplina: ed.id_disciplina, id_docente: carla.id_docente, ano: ANO, semestre: 1 });

    // Produção da Ana pelo QLattes: A1 (com o Bruno, dividido por 2), A2 e B3 (vale 0).
    await api
      .post("/api/importacoes")
      .attach(
        "arquivo",
        csvQLattes("Ana Souza", "1111111111111111", [
          { ano: ANO - 1, titulo: "Artigo A1 em coautoria", periodico: "Journal A", issn: "1000-0001", qualis: "A1" },
          { ano: ANO - 2, titulo: "Artigo A2 sozinha", periodico: "Journal B", issn: "1000-0002", qualis: "A2" },
          { ano: ANO - 3, titulo: "Artigo B3", periodico: "Journal C", issn: "1000-0003", qualis: "B3" },
          { ano: ANO - 6, titulo: "Artigo antigo A1", periodico: "Journal A", issn: "1000-0001", qualis: "A1" },
        ]),
        "ana.csv",
      )
      .field("id_docente", String(ana.id_docente));
    const [coautoria] = (await api.get(`/api/docentes/${ana.id_docente}/publicacoes`)).body.filter((x) => x.titulo === "Artigo A1 em coautoria");
    const autorBruno = (await api.get("/api/autores?busca=Bruno&tipo=DOCENTE")).body[0];
    await api.post(`/api/publicacoes/${coautoria.id_publicacao}/autores`).send({ id_autor: autorBruno.id_autor });

    // Evento A1 com o discente, cadastrado à mão (o CSV não traz eventos nem coautores).
    await api
      .post("/api/qualis/cargas")
      .attach("arquivo", Buffer.from("Sigla;Nome;Estrato\nBRACIS;Brazilian Conference on Intelligent Systems;A1\n"), "eventos.csv")
      .field("fonte", "EVENTOS")
      .field("ano_base", String(ANO - 2));
    const autorAna = (await api.get("/api/autores?busca=Ana Souza&tipo=DOCENTE")).body[0];
    const autorLucas = (await api.get("/api/autores?busca=Lucas&tipo=DISCENTE")).body[0];
    await api.post("/api/publicacoes").send({
      titulo: "Evento com discente",
      ano: ANO - 1,
      veiculo: { tipo: "CONFERENCIA", sigla: "BRACIS", nome: "BRACIS" },
      autores: [autorAna.id_autor, autorLucas.id_autor],
    });
  });
  after(encerrar);

  it("calcula o recredenciamento ao vivo com todas as regras", async () => {
    const res = await api.get(`/api/docentes/${ana.id_docente}/calculo`);
    assert.equal(res.status, 200, JSON.stringify(res.body));
    const c = res.body;
    assert.equal(c.tipo, "RECREDENCIAMENTO");
    assert.deepEqual(c.periodo, { inicio: ANO - 3, fim: ANO - 1 });
    // 0,5 (A1 ÷ 2) + 0,875 (A2) + 0 (B3) + 1 (evento A1) = 2,375; o artigo de 6 anos atrás não entra.
    assert.equal(c.pesquisa.total, 2.375);
    assert.equal(c.pesquisa.linhas.length, 4);
    const porCodigo = Object.fromEntries(c.requisitos.map((r) => [r.codigo, r]));
    assert.equal(porCodigo.PESQUISA_PONTUACAO.atendido, false, "precisa de 2,5");
    assert.equal(porCodigo.PESQUISA_PERIODICOS.obtido, 2);
    assert.equal(porCodigo.PESQUISA_COAUTORIA_DISCENTE.atendido, true);
    assert.equal(porCodigo.ORIENTACAO_MINIMA.obtido, 2);
    assert.equal(porCodigo.ORIENTACAO_MINIMA.atendido, true);
    assert.equal(porCodigo.DOCENCIA_MINIMA.atendido, true);
    assert.equal(c.apto, false);
    assert.equal(c.resolucao.numero_ano, "1/2025");
  });

  it("muda o período pela query e valida", async () => {
    const amplo = (await api.get(`/api/docentes/${ana.id_docente}/calculo?inicio=${ANO - 6}&fim=${ANO - 1}`)).body;
    assert.equal(amplo.pesquisa.total, 3.375);
    assert.equal(amplo.apto, true);
    assert.equal((await api.get(`/api/docentes/${ana.id_docente}/calculo?inicio=2030&fim=2020`)).status, 400);
  });

  it("abre o processo, grava o cálculo e não deixa abrir dois", async () => {
    const res = await api.post("/api/avaliacoes").send({ id_docente: ana.id_docente });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    assert.ok(res.body.id_processo);
    assert.equal((await api.post("/api/avaliacoes").send({ id_docente: ana.id_docente })).status, 409);
    assert.equal((await api.post("/api/avaliacoes").send({ id_docente: carla.id_docente, tipo: "RECREDENCIAMENTO" })).status, 422);

    const [resumo] = (await api.get(`/api/avaliacoes?id_docente=${ana.id_docente}`)).body;
    assert.equal(resumo.publicacoes_consideradas, 4);
    assert.equal(resumo.pontos_calculados, 2.375);
    assert.equal(Number(resumo.pontuacao_pesquisa), 2.375);
  });

  it("desmarcar uma publicação recalcula o processo (RF13)", async () => {
    const [resumo] = (await api.get(`/api/avaliacoes?id_docente=${ana.id_docente}`)).body;
    const detalhe = (await api.get(`/api/avaliacoes/${resumo.id_processo}`)).body;
    const evento = detalhe.calculo.pesquisa.linhas.find((l) => l.titulo === "Evento com discente");

    const res = await api.patch(`/api/avaliacoes/${resumo.id_processo}/publicacoes/${evento.id_publicacao}`).send({ considerada: false });
    assert.equal(res.status, 200);
    assert.equal(res.body.pesquisa.total, 1.375);
    assert.equal(res.body.requisitos.find((r) => r.codigo === "PESQUISA_COAUTORIA_DISCENTE").atendido, false);

    const [depois] = (await api.get(`/api/avaliacoes?id_docente=${ana.id_docente}`)).body;
    assert.equal(depois.publicacoes_desmarcadas, 1);
    assert.equal((await api.patch(`/api/avaliacoes/${resumo.id_processo}/publicacoes/999999`).send({ considerada: false })).status, 404);
  });

  it("tramitação: secretaria não defere; coordenação defere com validade; processo encerrado não muda", async () => {
    const [resumo] = (await api.get(`/api/avaliacoes?id_docente=${ana.id_docente}`)).body;
    assert.equal((await api.patch(`/api/avaliacoes/${resumo.id_processo}`).send({ status: "DEFERIDO" })).status, 403);
    const ok = await coord.patch(`/api/avaliacoes/${resumo.id_processo}`).send({ status: "DEFERIDO", valido_ate: `${ANO + 2}-12-31` });
    assert.equal(ok.status, 200, JSON.stringify(ok.body));
    assert.equal(ok.body.status, "DEFERIDO");
    assert.equal((await api.post(`/api/avaliacoes/${resumo.id_processo}/recalcular`)).status, 422);
    assert.equal((await coord.patch(`/api/avaliacoes/${resumo.id_processo}`).send({ status: "CANCELADO" })).status, 422);
  });

  it("credenciamento em lote e deferimento que dá o vínculo ao docente", async () => {
    const lote = await api.post("/api/avaliacoes/lote").send({ ids_docentes: [carla.id_docente, 9999], tipo: "CREDENCIAMENTO" });
    assert.equal(lote.status, 207);
    const [daCarla, inexistente] = lote.body.resultados;
    assert.equal(daCarla.status, "ABERTO");
    assert.equal(daCarla.apto, false);
    assert.equal(inexistente.status, "FALHA");

    const semVinculo = await coord.patch(`/api/avaliacoes/${daCarla.id_processo}`).send({ status: "DEFERIDO" });
    assert.equal(semVinculo.status, 400);
    const deferida = await coord.patch(`/api/avaliacoes/${daCarla.id_processo}`).send({ status: "DEFERIDO", vinculo: "COLABORADOR" });
    assert.equal(deferida.status, 200);
    const agora = (await api.get(`/api/docentes/${carla.id_docente}`)).body;
    assert.equal(agora.vinculo, "COLABORADOR");
    assert.ok(agora.data_vinculo);
  });

  it("teto de colaboradores e recém-credenciado isento", async () => {
    const teto = (await api.get("/api/avaliacoes/teto-colaboradores")).body;
    assert.equal(teto.percentual, 30);
    assert.ok(Array.isArray(teto.ranking));

    const calc = (await api.get(`/api/docentes/${carla.id_docente}/calculo`)).body;
    assert.equal(calc.tipo, "RECREDENCIAMENTO");
    assert.equal(calc.excecoes[0].codigo, "RECEM_CREDENCIADO");
    assert.ok(calc.progressao, "colaborador recebe a avaliação de progressão");
    assert.ok(calc.avisos.some((a) => /Nenhuma publicação/.test(a)));
    void lucas;
  });
});
