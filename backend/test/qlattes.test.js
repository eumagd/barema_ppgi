const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { lerCsvQLattes, idLattesDaUrl, origemDoEstrato } = require("../src/modulos/importacoes/qlattes.leitor");
const { nomesCompativeis } = require("../src/modulos/importacoes/importacao.servico");
const { csvQLattes, CABECALHO } = require("./apoio/qlattes");

describe("leitor do CSV do QLattes", () => {
  it("lê o formato exportado, com aspas no título e vírgulas na área", () => {
    const buffer = Buffer.from(
      [
        CABECALHO,
        '"Ana C. Souza",http://lattes.cnpq.br/1234567890123456,2024,"O "efeito" da poda, revisitado","JOURNAL OF X",1234-5678,A2,0.875,ADMINISTRAÇÃO PÚBLICA E DE EMPRESAS, CIÊNCIAS CONTÁBEIS E TURISMO,quadriênio 2017-2020',
        '"Ana C. Souza",http://lattes.cnpq.br/1234567890123456,2023,"Sem classificação","REVISTA Y",,N,,,',
      ].join("\n"),
    );
    const { artigos, erros, pesquisador } = lerCsvQLattes(buffer);
    assert.deepEqual(erros, []);
    assert.deepEqual(pesquisador, { nome: "Ana C. Souza", id_lattes: "1234567890123456" });
    assert.equal(artigos[0].titulo, 'O "efeito" da poda, revisitado');
    assert.equal(artigos[0].estrato, "A2");
    assert.deepEqual(artigos[0].origem, { fonte: "CAPES", ano_base: 2020 });
    assert.equal(artigos[1].estrato, null);
    assert.equal(artigos[1].issn, null);
  });

  it("aceita CRLF e o arquivo regravado pelo Excel (; e aspas escapadas)", () => {
    const excel = Buffer.from(
      `${CABECALHO.replace(/,/g, ";")}\r\n"Ana";http://lattes.cnpq.br/1234567890123456;2024;"Título com ""aspas"" e ; ponto e vírgula";"J";1234-5678;A1;1;CC;2021\r\n`,
      "utf8",
    );
    const { artigos } = lerCsvQLattes(excel);
    assert.equal(artigos[0].titulo, 'Título com "aspas" e ; ponto e vírgula');
    assert.deepEqual(artigos[0].origem, { fonte: "PUC_RS", ano_base: 2021 });
  });

  it("aponta linhas inválidas sem descartar o resto", () => {
    const buffer = Buffer.from(
      [CABECALHO, '"Ana",http://lattes.cnpq.br/1234567890123456,20xx,"Ano ruim","J",,N,,,', "lixo sem formato", '"Ana",http://lattes.cnpq.br/1234567890123456,2022,"Ok","J",12345678,B1,0.5,CC,2020'].join("\n"),
    );
    const { artigos, erros } = lerCsvQLattes(buffer);
    assert.equal(artigos.length, 1);
    assert.equal(artigos[0].issn, "1234-5678");
    assert.deepEqual(artigos[0].origem, { fonte: "SCOPUS", ano_base: 2020 });
    assert.deepEqual(erros.map((e) => e.linha), [2, 3]);
  });

  it("recusa arquivo que não é do QLattes e arquivo com dois pesquisadores", () => {
    assert.throws(() => lerCsvQLattes(Buffer.from("ISSN;Estrato\n1;A1\n")), (e) => e.status === 400 && /QLattes/.test(e.message));
    const misturado = Buffer.concat([
      csvQLattes("Ana", "1111111111111111", [{ ano: 2024, titulo: "A", periodico: "J", qualis: "N" }]),
      Buffer.from('\n"Bruno",http://lattes.cnpq.br/2222222222222222,2024,"B","J",,N,,,'),
    ]);
    assert.throws(() => lerCsvQLattes(misturado), (e) => e.status === 422);
  });

  it("extrai o ID Lattes da URL e deduz a fonte pelo ano-base", () => {
    assert.equal(idLattesDaUrl("http://lattes.cnpq.br/1234567890123456"), "1234567890123456");
    assert.equal(idLattesDaUrl("https://lattes.cnpq.br/"), null);
    assert.deepEqual(origemDoEstrato("quadriênio 2017-2020"), { fonte: "CAPES", ano_base: 2020 });
    assert.equal(origemDoEstrato(""), null);
  });
});

describe("compatibilidade de nomes", () => {
  it("aceita o mesmo nome ou o mesmo primeiro e último nome", () => {
    assert.ok(nomesCompativeis("Bruno Costa e Silva Nogueira", "Bruno Nogueira"));
    assert.ok(nomesCompativeis("Júlia F. Cavalcante", "JULIA FERREIRA CAVALCANTE"));
    assert.ok(!nomesCompativeis("Ana Souza", "Ana Lima"));
    assert.ok(!nomesCompativeis("", "Ana"));
  });
});
