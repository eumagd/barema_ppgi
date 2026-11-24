const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { lerCsv, decodificar, detectarDelimitador } = require("../src/lib/csv");
const { normalizarIssn, normalizarSigla, normalizarTexto } = require("../src/lib/texto");
const { FORMATOS, estratoDoPercentil, lerEstrato } = require("../src/modulos/qualis/formatos");
const { interpretarLinhas, estratoVigente } = require("../src/modulos/qualis/qualis.servico");

const latin1 = (texto) => Buffer.from(texto, "latin1");

describe("leitura de CSV", () => {
  it("decodifica UTF-8 e, se inválido, Latin-1", () => {
    assert.equal(decodificar(Buffer.from("Título", "utf8")).codificacao, "UTF-8");
    const r = decodificar(latin1("Título;Área"));
    assert.equal(r.codificacao, "Latin-1");
    assert.equal(r.texto, "Título;Área");
  });

  it("detecta o delimitador ignorando o que está entre aspas", () => {
    assert.equal(detectarDelimitador('ISSN;Título;Estrato\n1;"a, b, c";A1'), ";");
    assert.equal(detectarDelimitador('"Título; com ponto e vírgula",ISSN,Estrato'), ",");
    assert.equal(detectarDelimitador("ISSN\tTítulo\tEstrato"), "\t");
  });

  it("mapeia colunas por apelido, sem acentos e com BOM", () => {
    const csv = Buffer.from("﻿issn;TITULO;Área de Avaliação;ESTRATO\n0001-0782;Communications of the ACM;CIÊNCIA DA COMPUTAÇÃO;A1\n", "utf8");
    const { linhas } = lerCsv(csv, FORMATOS.CAPES);
    assert.deepEqual(linhas[0], {
      numero: 2,
      campos: { issn: "0001-0782", titulo: "Communications of the ACM", area: "CIÊNCIA DA COMPUTAÇÃO", estrato: "A1" },
    });
  });

  it("explica o cabeçalho errado", () => {
    assert.throws(
      () => lerCsv(Buffer.from("Nome;Ano\nX;2020\n"), FORMATOS.CAPES),
      (e) => e.status === 400 && /ISSN/.test(e.message) && /Estrato/.test(e.message),
    );
  });

  it("recusa arquivo vazio ou só com cabeçalho", () => {
    assert.throws(() => lerCsv(Buffer.alloc(0), FORMATOS.CAPES), (e) => e.status === 400);
    assert.throws(() => lerCsv(Buffer.from("ISSN;Estrato\n"), FORMATOS.CAPES), (e) => e.status === 400);
  });
});

describe("normalização", () => {
  it("ISSN", () => {
    assert.equal(normalizarIssn("0001-0782"), "0001-0782");
    assert.equal(normalizarIssn("2169 353x"), "2169-353X");
    assert.equal(normalizarIssn("21693536"), "2169-3536");
    assert.equal(normalizarIssn("123"), null);
    assert.equal(normalizarIssn("ABCD-EFGH"), null);
  });

  it("sigla e texto", () => {
    assert.equal(normalizarSigla("S.B.B.D."), "SBBD");
    assert.equal(normalizarSigla("sbes 2024"), "SBES2024");
    assert.equal(normalizarTexto("Ciência da Computação"), "ciencia da computacao");
  });

  it("estrato e percentil Scopus", () => {
    assert.equal(lerEstrato(" a1 "), "A1");
    assert.equal(lerEstrato("N"), null);
    assert.equal(lerEstrato("NP"), null);
    assert.equal(estratoDoPercentil("87,5"), "A1");
    assert.equal(estratoDoPercentil("87.4"), "A2");
    assert.equal(estratoDoPercentil("50%"), "A4");
    assert.equal(estratoDoPercentil("12"), "B4");
    assert.equal(estratoDoPercentil("101"), null);
    assert.equal(estratoDoPercentil("abc"), null);
  });
});

describe("interpretação das linhas", () => {
  const linha = (numero, campos) => ({ numero, campos });

  it("CAPES: filtra a área, ignora sem estrato e registra erros", () => {
    const { itens, erros, contagem } = interpretarLinhas(
      FORMATOS.CAPES,
      [
        linha(2, { issn: "0001-0782", titulo: "CACM", area: "CIÊNCIA DA COMPUTAÇÃO", estrato: "A1" }),
        linha(3, { issn: "0001-0782", titulo: "CACM", area: "MEDICINA I", estrato: "B1" }),
        linha(4, { issn: "1234", titulo: "ISSN ruim", area: "Ciência da Computação", estrato: "A2" }),
        linha(5, { issn: "2169-3536", titulo: "IEEE Access", area: "Ciência da Computação", estrato: "N" }),
      ],
      "Ciência da Computação",
    );
    assert.deepEqual(itens, [{ chave: "0001-0782", nome: "CACM", estrato: "A1" }]);
    assert.equal(contagem.outras_areas, 1);
    assert.equal(contagem.invalidas, 1);
    assert.equal(contagem.sem_estrato, 1);
    assert.deepEqual(erros.map((e) => e.linha), [4, 5]);
  });

  it("Scopus: converte percentil e cadastra os dois ISSNs", () => {
    const { itens } = interpretarLinhas(FORMATOS.SCOPUS, [linha(2, { issn: "1234-5678", issn2: "8765-4321", titulo: "J", percentil: "90" })], "Ciência da Computação");
    assert.deepEqual(itens.map((i) => [i.chave, i.estrato]), [["1234-5678", "A1"], ["8765-4321", "A1"]]);
  });

  it("repetido no arquivo: fica o melhor estrato", () => {
    const { itens, contagem } = interpretarLinhas(
      FORMATOS.PUC_RS,
      [linha(2, { issn: "1234-5678", estrato: "B1" }), linha(3, { issn: "12345678", estrato: "A3" })],
      "Ciência da Computação",
    );
    assert.equal(itens.length, 1);
    assert.equal(itens[0].estrato, "A3");
    assert.equal(contagem.repetidas, 1);
  });

  it("Eventos: usa a sigla normalizada", () => {
    const { itens } = interpretarLinhas(FORMATOS.EVENTOS, [linha(2, { sigla: "S.B.E.S.", nome: "Simpósio Brasileiro de Engenharia de Software", estrato: "A4" })], "Ciência da Computação");
    assert.deepEqual(itens, [{ chave: "SBES", nome: "Simpósio Brasileiro de Engenharia de Software", estrato: "A4" }]);
  });
});

describe("estrato vigente", () => {
  const e = (fonte, ano_base, estrato, area = "Ciência da Computação") => ({ fonte, ano_base, estrato, area_de_atuacao: area });

  it("segue a hierarquia CAPES → PUC-RS → Scopus", () => {
    assert.equal(estratoVigente([e("SCOPUS", 2024, "A1"), e("PUC_RS", 2024, "A2"), e("CAPES", 2020, "A3")]).fonte, "CAPES");
    assert.equal(estratoVigente([e("SCOPUS", 2024, "A1"), e("PUC_RS", 2024, "A2")]).fonte, "PUC_RS");
  });

  it("dentro da fonte, usa o ano-base mais recente; manual só sem outra fonte", () => {
    assert.equal(estratoVigente([e("CAPES", 2016, "B1"), e("CAPES", 2020, "A2")]).estrato, "A2");
    assert.equal(estratoVigente([e("MANUAL", 2024, "A1"), e("SCOPUS", 2024, "B2")]).fonte, "SCOPUS");
    assert.equal(estratoVigente([e("MANUAL", 2024, "A1")]).fonte, "MANUAL");
  });

  it("considera só a área pedida", () => {
    assert.equal(estratoVigente([e("CAPES", 2020, "A1", "MEDICINA I")]), null);
  });
});
