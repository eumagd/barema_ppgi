/*
 * Layouts aceitos para cada base Qualis (RF-BE04). Os apelidos cobrem os
 * cabeçalhos usuais das exportações; a comparação ignora acentos e maiúsculas.
 *
 *  CAPES (Sucupira)  ISSN; Título; Área de Avaliação; Estrato
 *  PUC-RS            ISSN; Título; Estrato
 *  Scopus            ISSN; Título; Percentil   (ou já com a coluna Estrato)
 *  Eventos (SBC)     Sigla; Nome; Estrato
 */
const ESTRATOS = ["A1", "A2", "A3", "A4", "B1", "B2", "B3", "B4", "C"];

const ALIASES = {
  issn: ["ISSN", "ISSN/eISSN", "Print ISSN", "ISSN impresso"],
  issn2: ["eISSN", "E-ISSN", "ISSN eletronico", "Electronic ISSN", "ISSN online"],
  titulo: ["Título", "Titulo", "Periódico", "Periodico", "Source Title", "Title", "Nome do periódico"],
  area: ["Área de Avaliação", "Area de Avaliacao", "Área", "Area"],
  estrato: ["Estrato", "Qualis", "Estrato Qualis", "Qualis 2017-2020", "Classificação", "Classificacao", "Qualis Final"],
  percentil: ["Percentil", "Percentile", "Maior percentil", "Highest percentile", "CiteScore Percentile"],
  sigla: ["Sigla", "Acrônimo", "Acronimo", "Acronym"],
  nome: ["Nome", "Evento", "Conferência", "Conferencia", "Nome do evento", "Título", "Titulo"],
};

const pick = (...campos) => Object.fromEntries(campos.map((c) => [c, ALIASES[c]]));

const FORMATOS = {
  CAPES: { fonteImportacao: "QUALIS_CAPES", tipo: "PERIODICO", colunas: pick("issn", "titulo", "area", "estrato"), obrigatorias: ["issn", "estrato"] },
  PUC_RS: { fonteImportacao: "QUALIS_PUC_RS", tipo: "PERIODICO", colunas: pick("issn", "issn2", "titulo", "estrato"), obrigatorias: ["issn", "estrato"] },
  SCOPUS: { fonteImportacao: "QUALIS_SCOPUS", tipo: "PERIODICO", colunas: pick("issn", "issn2", "titulo", "estrato", "percentil"), obrigatorias: ["issn"] },
  EVENTOS: { fonteImportacao: "QUALIS_EVENTOS", tipo: "CONFERENCIA", colunas: pick("sigla", "nome", "estrato"), obrigatorias: ["sigla", "estrato"] },
};

/**
 * Conversão de percentil Scopus em estrato, nas faixas de 12,5 pontos usadas pela
 * CAPES na avaliação 2017–2020 (A1 ≥ 87,5; A2 ≥ 75; ... ; B4 < 12,5).
 */
const FAIXAS_PERCENTIL = [
  [87.5, "A1"], [75, "A2"], [62.5, "A3"], [50, "A4"], [37.5, "B1"], [25, "B2"], [12.5, "B3"], [0, "B4"],
];

function estratoDoPercentil(valor) {
  const numero = Number(String(valor).replace("%", "").replace(",", "."));
  if (!Number.isFinite(numero) || numero < 0 || numero > 100) return null;
  return FAIXAS_PERCENTIL.find(([minimo]) => numero >= minimo)[1];
}

/** "A1", "a1", "A 1" → "A1"; "N", "NP", vazio → null. */
function lerEstrato(valor) {
  const limpo = String(valor ?? "").toUpperCase().replace(/\s+/g, "");
  return ESTRATOS.includes(limpo) ? limpo : null;
}

module.exports = { FORMATOS, ESTRATOS, estratoDoPercentil, lerEstrato };
