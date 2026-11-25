/*
 * Converte uma obra ("work") do OpenAlex no formato da plataforma. Funções puras.
 *
 * Diferente do CSV do QLattes, o OpenAlex traz artigos em EVENTOS, a lista de COAUTORES
 * (com ORCID e instituição, quando há) e o DOI.
 *
 *  - periódico: source.type = "journal" → veículo pelo ISSN (issn_l);
 *  - evento:    source.type = "conference" ou type = "conference-paper" → sigla tirada do DOI
 *               dos anais da SBC (10.5753/sbbd.2024.123 → SBBD) ou de "(SIGLA)" no nome;
 *  - preprints, repositórios e obras sem veículo são ignorados (não pontuam no barema).
 */
const { normalizarIssn, normalizarSigla } = require("../../../lib/texto");

const ultimaParte = (url) => (url ? String(url).split("/").pop() : null);
const semHtml = (t) => String(t || "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

/** "https://doi.org/10.5753/SBBD.2024.1" → "10.5753/sbbd.2024.1" */
function normalizarDoi(doi) {
  if (!doi) return null;
  const limpo = String(doi).trim().replace(/^https?:\/\/(dx\.)?doi\.org\//i, "").toLowerCase();
  return /^10\.\d{4,9}\/\S+$/.test(limpo) ? limpo : null;
}

/** Sigla do evento: DOI da SOL/SBC (10.5753/<sigla>.<ano>…) ou "(SIGLA)" no nome da fonte. */
function siglaDoEvento(doi, nomeFonte) {
  const sol = (doi || "").match(/^10\.5753\/([a-z][a-z0-9-]{1,20})\.\d{4}/i);
  if (sol) return normalizarSigla(sol[1]);
  const parenteses = String(nomeFonte || "").match(/\(([A-Z][A-Za-z0-9-]{1,15})\)/);
  return parenteses ? normalizarSigla(parenteses[1]) : null;
}

function autores(obra) {
  return (obra.authorships || []).map((a, i) => ({
    ordem: i + 1,
    id_openalex: ultimaParte(a.author && a.author.id),
    orcid: ultimaParte(a.author && a.author.orcid),
    nome: semHtml((a.author && a.author.display_name) || a.raw_author_name),
    instituicao: (a.institutions && a.institutions[0] && a.institutions[0].display_name) || null,
  })).filter((a) => a.nome);
}

/** Devolve { obra } pronta para gravar, ou { ignorada: motivo }. */
function interpretarObra(obra) {
  const titulo = semHtml(obra.display_name);
  const ano = Number(obra.publication_year);
  if (!titulo) return { ignorada: "sem título" };
  if (!Number.isInteger(ano) || ano < 1950 || ano > 2100) return { ignorada: "sem ano" };

  const fonte = obra.primary_location && obra.primary_location.source;
  if (!fonte) return { ignorada: "sem veículo" };
  const ehEvento = fonte.type === "conference" || obra.type === "conference-paper";
  if (!ehEvento && fonte.type !== "journal") return { ignorada: fonte.type === "repository" ? "preprint/repositório" : `fonte do tipo ${fonte.type}` };

  const doi = normalizarDoi(obra.doi);
  const nome = semHtml(fonte.display_name).slice(0, 255);
  const issn = normalizarIssn(fonte.issn_l || (fonte.issn || [])[0]);
  const veiculo = ehEvento
    ? { tipo: "CONFERENCIA", sigla: siglaDoEvento(doi, nome), issn, nome }
    : { tipo: "PERIODICO", issn, nome };

  return {
    obra: {
      id_openalex: ultimaParte(obra.id),
      titulo: titulo.slice(0, 500),
      ano,
      doi,
      veiculo,
      autores: autores(obra),
    },
  };
}

module.exports = { interpretarObra, siglaDoEvento, normalizarDoi };
