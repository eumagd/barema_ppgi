const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { pular, limparBanco, clienteAutenticado, criarResolucao, encerrar, obterPrisma } = require("./apoio");
const { csvQLattes } = require("../apoio/qlattes");
const { ErroHttp } = require("../../src/lib/erros");

const ANO = new Date().getUTCFullYear();
const autoria = (id, nome, inst) => ({
  author: { id: id ? `https://openalex.org/${id}` : null, display_name: nome, orcid: null },
  institutions: inst ? [{ display_name: inst }] : [],
});

/* Respostas do OpenAlex simuladas (sem internet). */
const OBRAS = [
  {
    id: "https://openalex.org/W1",
    doi: "https://doi.org/10.1000/xyz.1",
    display_name: "Artigo A1 com discente e externo",
    publication_year: ANO - 1,
    type: "article",
    primary_location: { source: { display_name: "Journal A", type: "journal", issn_l: "1111-0001" } },
    authorships: [autoria("A999999", "Ana Souza"), autoria("A111111", "Bruno Lima"), autoria(null, "Andrade, Lucas"), autoria("A5555", "Maria Externa", "UFPE")],
  },
  {
    id: "https://openalex.org/W2",
    doi: "https://doi.org/10.5753/sbbd.2024.55",
    display_name: "Artigo no SBBD",
    publication_year: ANO - 1,
    type: "conference-paper",
    primary_location: { source: { display_name: "Anais do Simpósio Brasileiro de Banco de Dados", type: "conference" } },
    authorships: [autoria("A999999", "Ana C. Souza")],
  },
  {
    id: "https://openalex.org/W3",
    doi: null,
    display_name: "Um preprint",
    publication_year: ANO - 1,
    type: "preprint",
    primary_location: { source: { display_name: "arXiv", type: "repository" } },
    authorships: [autoria("A999999", "Ana Souza")],
  },
];

const openalexFalso = {
  async autorPorOrcid(orcid) {
    return orcid === "0000-0001-0000-0001" ? { id: "A999999", display_name: "Ana Souza" } : null;
  },
  async obrasDoAutor(id) {
    if (id === "A000502") throw new ErroHttp(502, "ERRO_OPENALEX", "A cota diária do OpenAlex acabou.");
    return id === "A999999" ? OBRAS : [];
  },
};

describe("conector OpenAlex no PostgreSQL", { skip: pular }, () => {
  let api, ana, bruno;

  before(async () => {
    await limparBanco();
    await criarResolucao();
    api = await clienteAutenticado("SECRETARIA", { openalex: openalexFalso });
    ana = (await api.post("/api/docentes").send({ matricula: "D1", nome: "Ana Souza", email: "ana@ic.ufal.br", vinculo: "PERMANENTE", data_vinculo: "2015-01-01", orcid: "https://orcid.org/0000-0001-0000-0001" })).body;
    bruno = (await api.post("/api/docentes").send({ matricula: "D2", nome: "Bruno Lima", email: "bruno@ic.ufal.br", vinculo: "PERMANENTE", id_openalex: "A111111", id_lattes: "2222222222222222" })).body;
    await api.post("/api/discentes").send({ matricula: "M1", nome: "Lucas Andrade", ano_ingresso: ANO - 1, id_orientador: ana.id_docente });
    await api.post("/api/qualis/cargas").attach("arquivo", Buffer.from("ISSN;Estrato\n1111-0001;A1\n"), "capes.csv").field("fonte", "CAPES").field("ano_base", "2020");
    await api.post("/api/qualis/cargas").attach("arquivo", Buffer.from("Sigla;Nome;Estrato\nSBBD;Simpósio Brasileiro de Banco de Dados;A4\n"), "eventos.csv").field("fonte", "EVENTOS").field("ano_base", "2024");
  });
  after(encerrar);

  it("valida ORCID e ID do OpenAlex no cadastro", async () => {
    assert.equal(ana.orcid, "0000-0001-0000-0001", "aceita a URL e guarda só o ORCID");
    const ruim = await api.patch(`/api/docentes/${ana.id_docente}`).send({ orcid: "123" });
    assert.equal(ruim.status, 400);
  });

  it("importa periódico e evento com coautores; acha o autor pelo ORCID", async () => {
    const res = await api.post(`/api/importacoes/openalex/${ana.id_docente}`).send({});
    assert.equal(res.status, 201, JSON.stringify(res.body));
    const c = res.body.importacao.contagens;
    assert.equal(c.obras_recebidas, 3);
    assert.deepEqual(c.ignoradas, { "preprint/repositório": 1 });
    assert.equal(c.novas, 2);
    assert.equal(c.periodicos, 1);
    assert.equal(c.eventos, 1);
    assert.equal(c.coautores_externos_criados, 1);
    assert.equal((await obterPrisma().docente.findUnique({ where: { id_docente: ana.id_docente } })).id_openalex, "A999999");

    const pubs = (await api.get(`/api/docentes/${ana.id_docente}/publicacoes`)).body;
    const artigo = pubs.find((p) => p.titulo.startsWith("Artigo A1"));
    assert.deepEqual([artigo.estrato, artigo.fonte_estrato, artigo.doi], ["A1", "CAPES", "10.1000/xyz.1"]);
    assert.deepEqual(artigo.coautores.map((x) => [x.tipo, x.nome]).sort(), [["DISCENTE", "Lucas Andrade"], ["DOCENTE", "Bruno Lima"], ["EXTERNO", "Maria Externa"]]);
    const evento = pubs.find((p) => p.titulo === "Artigo no SBBD");
    assert.deepEqual([evento.veiculo.tipo, evento.veiculo.issn_sigla, evento.estrato, evento.fonte_estrato], ["CONFERENCIA", "SBBD", "A4", "EVENTOS"]);

    const calc = (await api.get(`/api/docentes/${ana.id_docente}/calculo`)).body;
    assert.equal(calc.requisitos.find((r) => r.codigo === "PESQUISA_COAUTORIA_DISCENTE").atendido, true);
  });

  it("de novo é reaproveitado; o mesmo artigo vindo do QLattes não duplica", async () => {
    const denovo = await api.post(`/api/importacoes/openalex/${ana.id_docente}`).send({});
    assert.equal(denovo.status, 200);
    assert.equal(denovo.body.reaproveitada, true);

    const qlattes = await api
      .post("/api/importacoes")
      .attach("arquivo", csvQLattes("Bruno Lima", "2222222222222222", [{ ano: ANO - 1, titulo: "Artigo A1 com discente e externo", periodico: "Journal A", issn: "1111-0001", qualis: "A1" }]), "bruno.csv")
      .field("id_docente", String(bruno.id_docente));
    assert.equal(qlattes.status, 201, JSON.stringify(qlattes.body));
    assert.equal(qlattes.body.importacao.contagens.novas, 0);
    assert.equal(qlattes.body.importacao.contagens.ja_importadas, 1);
    assert.equal(await obterPrisma().publicacao.count({ where: { titulo: "Artigo A1 com discente e externo" } }), 1);
  });

  it("explica o que falta e repassa erro do OpenAlex", async () => {
    const carla = (await api.post("/api/docentes").send({ matricula: "D3", nome: "Carla Pereira", email: "carla@ic.ufal.br" })).body;
    const semOrcid = await api.post(`/api/importacoes/openalex/${carla.id_docente}`).send({});
    assert.equal(semOrcid.status, 422);
    assert.match(semOrcid.body.erro.mensagem, /ORCID/);

    await api.patch(`/api/docentes/${carla.id_docente}`).send({ orcid: "0000-0009-9999-9999" });
    const naoAchado = await api.post(`/api/importacoes/openalex/${carla.id_docente}`).send({});
    assert.equal(naoAchado.status, 422);
    assert.match(naoAchado.body.erro.mensagem, /não foi encontrado no OpenAlex/);

    await api.patch(`/api/docentes/${carla.id_docente}`).send({ orcid: null, id_openalex: "A000502" });
    const cota = await api.post(`/api/importacoes/openalex/${carla.id_docente}`).send({});
    assert.equal(cota.status, 502);
    assert.match(cota.body.erro.mensagem, /cota/);
  });
});
