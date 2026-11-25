const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { interpretarObra, siglaDoEvento, normalizarDoi } = require("../src/modulos/conectores/openalex/mapeamento");
const { chaveNome } = require("../src/modulos/conectores/openalex/conector.servico");
const { criarClienteOpenAlex } = require("../src/modulos/conectores/openalex/cliente");

const obra = (extra) => ({
  id: "https://openalex.org/W1",
  doi: "https://doi.org/10.1000/ABC",
  display_name: "Título <i>com</i> HTML",
  publication_year: 2024,
  type: "article",
  primary_location: { source: { display_name: "Journal X", type: "journal", issn_l: "12345678", issn: ["1234-5678"] } },
  authorships: [
    { author: { id: "https://openalex.org/A1", display_name: "Ana Souza", orcid: "https://orcid.org/0000-0001-0000-0001" }, institutions: [{ display_name: "UFAL" }] },
    { author: { id: null, display_name: null }, raw_author_name: "Andrade, Lucas", institutions: [] },
  ],
  ...extra,
});

describe("mapeamento de obras do OpenAlex", () => {
  it("periódico: ISSN, DOI normalizado, título sem HTML e autores em ordem", () => {
    const { obra: o } = interpretarObra(obra());
    assert.equal(o.titulo, "Título com HTML");
    assert.equal(o.doi, "10.1000/abc");
    assert.deepEqual(o.veiculo, { tipo: "PERIODICO", issn: "1234-5678", nome: "Journal X" });
    assert.deepEqual(o.autores.map((a) => [a.ordem, a.nome, a.id_openalex, a.orcid, a.instituicao]), [
      [1, "Ana Souza", "A1", "0000-0001-0000-0001", "UFAL"],
      [2, "Andrade, Lucas", null, null, null],
    ]);
  });

  it("evento: sigla pelo DOI da SBC ou pelo nome; preprint é ignorado", () => {
    const sbc = interpretarObra(obra({ doi: "https://doi.org/10.5753/sbbd.2024.55", type: "conference-paper", primary_location: { source: { display_name: "Anais do SBBD", type: "conference" } } }));
    assert.deepEqual(sbc.obra.veiculo, { tipo: "CONFERENCIA", sigla: "SBBD", issn: null, nome: "Anais do SBBD" });
    assert.equal(siglaDoEvento(null, "Brazilian Conference on Intelligent Systems (BRACIS)"), "BRACIS");
    assert.equal(siglaDoEvento(null, "Algum Congresso"), null);
    assert.deepEqual(interpretarObra(obra({ primary_location: { source: { display_name: "arXiv", type: "repository" } } })), { ignorada: "preprint/repositório" });
    assert.deepEqual(interpretarObra(obra({ primary_location: null })), { ignorada: "sem veículo" });
  });

  it("normaliza DOI e nomes em qualquer ordem", () => {
    assert.equal(normalizarDoi("http://dx.doi.org/10.5753/SBES.2023.1"), "10.5753/sbes.2023.1");
    assert.equal(normalizarDoi("não é doi"), null);
    assert.equal(chaveNome("Andrade, Lucas"), chaveNome("Lucas Andrade"));
    assert.notEqual(chaveNome("Lucas Andrade"), chaveNome("Lucas Andrade Silva"));
  });
});

describe("cliente do OpenAlex", () => {
  it("usa a chave, pagina pelo cursor e traduz cota esgotada", async () => {
    const urls = [];
    const respostas = [
      { results: [{ id: "W1" }], meta: { next_cursor: "abc" } },
      { results: [{ id: "W2" }], meta: { next_cursor: null } },
    ];
    const fetch = async (url) => {
      urls.push(url);
      return { ok: true, status: 200, json: async () => respostas.shift() };
    };
    const cliente = criarClienteOpenAlex({ fetch, url: "https://x", chave: "k" });
    const obras = await cliente.obrasDoAutor("A1", { desde: 2020 });
    assert.deepEqual(obras.map((o) => o.id), ["W1", "W2"]);
    assert.match(urls[0], /api_key=k/);
    assert.match(decodeURIComponent(urls[0]), /author\.id:A1,from_publication_date:2020-01-01/);
    assert.match(urls[1], /cursor=abc/);

    const esgotado = criarClienteOpenAlex({ fetch: async () => ({ ok: false, status: 429 }), url: "https://x", chave: "" });
    await assert.rejects(esgotado.obrasDoAutor("A1", { desde: 2020 }), (e) => e.status === 502 && /cota/.test(e.message));
    const semAutor = criarClienteOpenAlex({ fetch: async () => ({ ok: false, status: 404 }), url: "https://x", chave: "" });
    assert.equal(await semAutor.autorPorOrcid("0000-0000-0000-0000"), null);
  });
});
