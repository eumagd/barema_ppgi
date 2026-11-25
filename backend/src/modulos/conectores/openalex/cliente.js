/*
 * Cliente da API do OpenAlex (https://api.openalex.org), Conector 2 do RF-BE18.
 *
 * A API é aberta, mas medida: sem chave há uma cota diária pequena e compartilhada; com a
 * chave gratuita (OPENALEX_API_KEY no .env), uma cota própria. Pedimos só os campos usados
 * (select) e 200 obras por página, para gastar o mínimo.
 *
 * `fetch` é injetável para os testes não dependerem da internet.
 */
const config = require("../../../config");
const { ErroHttp } = require("../../../lib/erros");

const CAMPOS_OBRA = ["id", "doi", "display_name", "publication_year", "type", "primary_location", "authorships"].join(",");
const POR_PAGINA = 200;
const MAX_PAGINAS = 10;

const erroDoOpenAlex = (mensagem) => new ErroHttp(502, "ERRO_OPENALEX", mensagem);

function criarClienteOpenAlex({ fetch: fetchFn = globalThis.fetch, url = config.openalex.url, chave = config.openalex.chave } = {}) {
  async function obter(caminho, parametros = {}) {
    const busca = new URLSearchParams(parametros);
    if (chave) busca.set("api_key", chave);
    let resposta;
    try {
      resposta = await fetchFn(`${url}${caminho}?${busca}`, { headers: { Accept: "application/json" } });
    } catch {
      throw erroDoOpenAlex("Não foi possível falar com o OpenAlex. Confira a conexão com a internet.");
    }
    if (resposta.status === 404) return null;
    if (resposta.status === 429) throw erroDoOpenAlex("A cota diária do OpenAlex acabou. Configure OPENALEX_API_KEY ou tente amanhã.");
    if (!resposta.ok) throw erroDoOpenAlex(`O OpenAlex respondeu com erro ${resposta.status}.`);
    return resposta.json();
  }

  /** Autor pelo ORCID (devolve { id: "A123…", display_name, orcid } ou null). */
  async function autorPorOrcid(orcid) {
    const autor = await obter(`/authors/orcid:${encodeURIComponent(orcid)}`, { select: "id,display_name,orcid,works_count" });
    return autor ? { ...autor, id: String(autor.id).split("/").pop() } : null;
  }

  /** Obras do autor a partir de um ano, com paginação por cursor. */
  async function obrasDoAutor(idAutor, { desde }) {
    const obras = [];
    let cursor = "*";
    for (let pagina = 0; cursor && pagina < MAX_PAGINAS; pagina++) {
      const resposta = await obter("/works", {
        filter: `author.id:${idAutor},from_publication_date:${desde}-01-01`,
        select: CAMPOS_OBRA,
        "per-page": String(POR_PAGINA),
        cursor,
      });
      if (!resposta) break;
      obras.push(...resposta.results);
      cursor = resposta.meta && resposta.meta.next_cursor;
    }
    return obras;
  }

  return { autorPorOrcid, obrasDoAutor };
}

module.exports = { criarClienteOpenAlex };
