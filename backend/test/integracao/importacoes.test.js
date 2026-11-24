const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const AdmZip = require("adm-zip");
const { pular, limparBanco, clienteAutenticado, encerrar, obterPrisma } = require("./apoio");
const { csvQLattes } = require("../apoio/qlattes");

const ID_ANA = "1111111111111111";
const ID_BRUNO = "2222222222222222";

const ARTIGOS_ANA = [
  { ano: 2024, titulo: "Detecção de anomalias em fluxos de rede", periodico: "Journal of Network Analytics", issn: "1111-0001", qualis: "A1", pontos: 1 },
  { ano: 2023, titulo: 'Um estudo "empírico", com vírgulas', periodico: "IEEE Access", issn: "2169-3536", qualis: "A2", ano_base: "2021" },
  { ano: 2022, titulo: "Revista local sem Qualis", periodico: "Revista Alagoana de Computação", qualis: "N" },
];

describe("importação do QLattes no PostgreSQL", { skip: pular }, () => {
  let api, ana, bruno;

  before(async () => {
    await limparBanco();
    api = await clienteAutenticado();
    ana = (await api.post("/api/docentes").send({ matricula: "D1", nome: "Ana C. Souza", email: "ana@ic.ufal.br", vinculo: "PERMANENTE" })).body;
    bruno = (await api.post("/api/docentes").send({ matricula: "D2", nome: "Bruno M. Lima", email: "bruno@ic.ufal.br", vinculo: "PERMANENTE", id_lattes: ID_BRUNO })).body;
  });
  after(encerrar);

  const enviar = (buffer, nome, campos = {}) => {
    let req = api.post("/api/importacoes").attach("arquivo", buffer, nome);
    for (const [k, v] of Object.entries(campos)) req = req.field(k, String(v));
    return req;
  };

  it("exige o docente no upload individual", async () => {
    const res = await enviar(csvQLattes("Ana Souza", ID_ANA, ARTIGOS_ANA), "ana_souza.csv");
    assert.equal(res.status, 400);
    assert.match(res.body.erro.mensagem, /id_docente/);
  });

  it("importa o CSV, guarda o ID Lattes e grava os estratos do QLattes com a fonte", async () => {
    const res = await enviar(csvQLattes("Ana Cristina Souza", ID_ANA, ARTIGOS_ANA), "ana_souza.csv", { id_docente: ana.id_docente });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    const c = res.body.importacao.contagens;
    assert.equal(c.artigos, 3);
    assert.equal(c.novas, 3);
    assert.equal(c.estratos_do_qlattes, 2);
    assert.equal(c.sem_estrato, 1);
    assert.equal(c.sem_issn, 1);

    const docente = await obterPrisma().docente.findUnique({ where: { id_docente: ana.id_docente } });
    assert.equal(docente.id_lattes, ID_ANA);

    const pubs = (await api.get(`/api/docentes/${ana.id_docente}/publicacoes`)).body;
    assert.deepEqual(pubs.map((p) => [p.ano, p.estrato, p.fonte_estrato]), [[2024, "A1", "CAPES"], [2023, "A2", "PUC_RS"], [2022, null, null]]);
    assert.equal(pubs[1].titulo, 'Um estudo "empírico", com vírgulas');
  });

  it("o mesmo arquivo de novo é reaproveitado; CSV atualizado só acrescenta", async () => {
    const mesmo = await enviar(csvQLattes("Ana Cristina Souza", ID_ANA, ARTIGOS_ANA), "copia.csv", { id_docente: ana.id_docente });
    assert.equal(mesmo.status, 200);
    assert.equal(mesmo.body.reaproveitada, true);

    const novo = { ano: 2025, titulo: "Artigo novo de 2025", periodico: "IEEE Access", issn: "2169-3536", qualis: "A2", ano_base: "2021" };
    const atualizado = await enviar(csvQLattes("Ana Cristina Souza", ID_ANA, [...ARTIGOS_ANA, novo]), "ana_v2.csv", { id_docente: ana.id_docente });
    assert.equal(atualizado.status, 201);
    assert.equal(atualizado.body.importacao.contagens.novas, 1);
    assert.equal(atualizado.body.importacao.contagens.ja_importadas, 3);
    assert.equal(await obterPrisma().publicacao.count(), 4);
  });

  it("recusa CSV de outro currículo (ID Lattes diferente)", async () => {
    const res = await enviar(csvQLattes("Ana Cristina Souza", ID_ANA, ARTIGOS_ANA), "ana.csv", { id_docente: bruno.id_docente });
    assert.equal(res.status, 422);
    assert.match(res.body.erro.mensagem, new RegExp(ID_BRUNO));
  });

  it("recusa nome incompatível sem ID para conferir, a menos que confirmado", async () => {
    const carla = (await api.post("/api/docentes").send({ matricula: "D3", nome: "Carla Pereira", email: "carla@ic.ufal.br" })).body;
    const csv = csvQLattes("Fernanda Rocha", "3333333333333333", [{ ano: 2024, titulo: "X", periodico: "J", qualis: "N" }]);
    const recusado = await enviar(csv, "fernanda.csv", { id_docente: carla.id_docente });
    assert.equal(recusado.status, 422);
    const confirmado = await enviar(csv, "fernanda.csv", { id_docente: carla.id_docente, confirmar_nome: true });
    assert.equal(confirmado.status, 201);
  });

  it("lote .zip: casa pelo ID Lattes, junta a coautoria e relata quem falhou", async () => {
    const zip = new AdmZip();
    zip.addFile(
      "bruno_m_lima.csv",
      csvQLattes("Bruno Moreira Lima", ID_BRUNO, [
        // Mesmo artigo do CV da Ana: vira uma publicação só, com as duas autorias.
        { ano: 2024, titulo: "DETECÇÃO de anomalias em fluxos de rede!", periodico: "Journal of Network Analytics", issn: "1111-0001", qualis: "A1" },
        { ano: 2024, titulo: "Benchmark de grafos", periodico: "Information Sciences", issn: "0020-0255", qualis: "A1" },
      ]),
    );
    zip.addFile("desconhecido.csv", csvQLattes("Pessoa Sem Cadastro", "9999999999999999", [{ ano: 2024, titulo: "Y", periodico: "J", qualis: "N" }]));
    zip.addFile("__MACOSX/._bruno.csv", Buffer.from("lixo"));

    const res = await enviar(zip.toBuffer(), "lote.zip");
    assert.equal(res.status, 207, JSON.stringify(res.body));
    const porArquivo = Object.fromEntries(res.body.resultados.map((r) => [r.arquivo, r]));
    assert.equal(Object.keys(porArquivo).length, 2);
    assert.equal(porArquivo["bruno_m_lima.csv"].status, "CONCLUIDO");
    assert.equal(porArquivo["bruno_m_lima.csv"].importacao.contagens.coautoria_com_outro_docente, 1);
    assert.equal(porArquivo["desconhecido.csv"].status, "FALHA");
    assert.match(porArquivo["desconhecido.csv"].erro, /Nenhum docente/);

    const [anomalias] = (await api.get(`/api/docentes/${bruno.id_docente}/publicacoes?inicio=2024&fim=2024`)).body.filter((p) => /anomalias/i.test(p.titulo));
    assert.deepEqual(anomalias.coautores.map((c) => c.nome), ["Ana C. Souza"]);
  });

  it("fila manual: lista o periódico sem estrato e aceita a classificação com justificativa", async () => {
    const pendentes = (await api.get("/api/qualis/pendentes")).body;
    const revista = pendentes.find((v) => v.nome === "REVISTA ALAGOANA DE COMPUTAÇÃO");
    assert.ok(revista, JSON.stringify(pendentes.map((p) => p.nome)));

    const curta = await api.post("/api/qualis/classificacoes").send({ id_veiculo: revista.id_veiculo, estrato: "B1", justificativa: "ok" });
    assert.equal(curta.status, 400);
    const ok = await api.post("/api/qualis/classificacoes").send({ id_veiculo: revista.id_veiculo, estrato: "B1", justificativa: "Classificado pelo colegiado em reunião de 10/11." });
    assert.equal(ok.status, 201);

    assert.ok(!(await api.get("/api/qualis/pendentes")).body.some((v) => v.id_veiculo === revista.id_veiculo));
    const pub = (await api.get(`/api/docentes/${ana.id_docente}/publicacoes?inicio=2022&fim=2022`)).body[0];
    assert.deepEqual([pub.estrato, pub.fonte_estrato], ["B1", "MANUAL"]);
  });

  it("tabela carregada no servidor prevalece sobre o estrato do QLattes", async () => {
    const capes = Buffer.from("ISSN;Estrato\n2169-3536;A3\n");
    await api.post("/api/qualis/cargas").attach("arquivo", capes, "capes.csv").field("fonte", "CAPES").field("ano_base", "2020");
    const pub = (await api.get(`/api/docentes/${ana.id_docente}/publicacoes?inicio=2023&fim=2023`)).body[0];
    assert.deepEqual([pub.estrato, pub.fonte_estrato], ["A3", "CAPES"]);
  });

  it("histórico de importações por docente", async () => {
    const lista = (await api.get(`/api/importacoes?id_docente=${ana.id_docente}`)).body;
    assert.equal(lista.length, 2);
    assert.ok(lista.every((i) => i.fonte === "QLATTES_CSV" && i.docente.nome === "Ana C. Souza"));
    const detalhe = await api.get(`/api/importacoes/${lista[0].id_importacao}`);
    assert.equal(detalhe.status, 200);
  });
});
