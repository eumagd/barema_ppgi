const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const ExcelJS = require("exceljs");
const { pular, limparBanco, clienteAutenticado, criarResolucao, encerrar, emailsEnviados } = require("./apoio");
const { csvQLattes } = require("../apoio/qlattes");

const ANO = new Date().getUTCFullYear();
/** supertest: junta a resposta binária em um Buffer. */
const binario = (res, cb) => {
  const partes = [];
  res.on("data", (c) => partes.push(c));
  res.on("end", () => cb(null, Buffer.concat(partes)));
};

describe("exportações e parecer por e-mail", { skip: pular }, () => {
  let api, coord, ana, processo;

  before(async () => {
    await limparBanco();
    await criarResolucao();
    api = await clienteAutenticado();
    coord = await clienteAutenticado("COORDENACAO");
    ana = (await api.post("/api/docentes").send({ matricula: "D1", nome: "Ana Souza", email: "ana@ic.ufal.br", vinculo: "PERMANENTE", data_vinculo: "2015-01-01", id_lattes: "1111111111111111" })).body;
    await api
      .post("/api/importacoes")
      .attach(
        "arquivo",
        csvQLattes("Ana Souza", "1111111111111111", [
          { ano: ANO - 1, titulo: 'Título com ; e "aspas"', periodico: "Journal A", issn: "1000-0001", qualis: "A2" },
          { ano: ANO - 2, titulo: "Outro artigo", periodico: "Journal B", issn: "1000-0002", qualis: "N" },
        ]),
        "ana.csv",
      )
      .field("id_docente", String(ana.id_docente));
    processo = (await api.post("/api/avaliacoes").send({ id_docente: ana.id_docente })).body.id_processo;
  });
  after(encerrar);

  it("produção em XLSX com estrato, divisor e pontos", async () => {
    const res = await api.get("/api/exportacoes/producao.xlsx").buffer(true).parse(binario);
    assert.equal(res.status, 200);
    assert.match(res.headers["content-type"], /spreadsheetml/);
    assert.match(res.headers["content-disposition"], /producao-ppgi-\d{4}-\d{2}-\d{2}\.xlsx/);
    const livro = new ExcelJS.Workbook();
    await livro.xlsx.load(res.body);
    const aba = livro.getWorksheet("Produção");
    assert.equal(aba.getRow(1).getCell(1).value, "Docente");
    const linhas = [];
    aba.eachRow((r, i) => i > 1 && linhas.push(r.values.slice(1)));
    assert.equal(linhas.length, 2);
    const a2 = linhas.find((l) => l[6] === "A2");
    assert.deepEqual([a2[0], a2[1], a2[7], a2[8], a2[10]], ["Ana Souza", "Permanente", "CAPES", 0.875, 0.875]);
    assert.ok(linhas.some((l) => l[6] === "N"));
  });

  it("produção em CSV (UTF-8 com BOM, ;, aspas escapadas) e avaliações", async () => {
    const res = await api.get(`/api/exportacoes/producao.csv?id_docente=${ana.id_docente}`).buffer(true).parse(binario);
    assert.equal(res.status, 200);
    const texto = res.body.toString("utf8");
    assert.ok(texto.startsWith("\uFEFFDocente;Vínculo;Ano"));
    assert.ok(texto.includes('"Título com ; e ""aspas"""'));
    assert.ok(texto.includes(";0,875;"));

    const aval = await api.get("/api/exportacoes/avaliacoes.csv").buffer(true).parse(binario);
    assert.ok(aval.body.toString("utf8").includes("Ana Souza;Recredenciamento;Em andamento"));
    assert.equal((await api.get("/api/exportacoes/producao.pdf")).status, 404);
  });

  it("parecer: gera, recusa envio em andamento e envia depois de deferido", async () => {
    const gerado = await api.post(`/api/avaliacoes/${processo}/relatorio`);
    assert.equal(gerado.status, 200);
    assert.equal(gerado.body.status_relatorio, "GERADO");
    assert.match(gerado.body.assunto, /Parecer de recredenciamento — Ana Souza/);
    assert.match(gerado.body.texto, /Pontuação mínima de Pesquisa/);

    assert.equal((await api.post(`/api/avaliacoes/${processo}/relatorio/enviar`)).status, 422);
    await coord.patch(`/api/avaliacoes/${processo}`).send({ status: "INDEFERIDO" });
    const enviado = await api.post(`/api/avaliacoes/${processo}/relatorio/enviar`).send({});
    assert.equal(enviado.status, 200, JSON.stringify(enviado.body));
    assert.equal(enviado.body.enviado_para, "ana@ic.ufal.br");
    assert.equal(enviado.body.status_relatorio, "ENVIADO");
    assert.ok(enviado.body.data_envio_relatorio);
    const ultimo = emailsEnviados.at(-1);
    assert.equal(ultimo.para, "ana@ic.ufal.br");
    assert.match(ultimo.html, /Não atendido/);

    const [resumo] = (await api.get("/api/avaliacoes")).body;
    assert.equal(resumo.status_relatorio, "ENVIADO");
  });
});
