/*
 * Normalização de textos, igual à função fn_normaliza_texto do banco
 * (migração 20261124120500): minúsculas, sem acentos e sem pontuação.
 */
function normalizarTexto(texto) {
  return String(texto ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** ISSN no formato 1234-567X; null se não for um ISSN válido (8 dígitos, último pode ser X). */
function normalizarIssn(valor) {
  const limpo = String(valor ?? "").toUpperCase().replace(/[^0-9X]/g, "");
  if (!/^[0-9]{7}[0-9X]$/.test(limpo)) return null;
  return `${limpo.slice(0, 4)}-${limpo.slice(4)}`;
}

/** Sigla de evento comparável: maiúsculas, sem acentos, espaços e pontuação (ex.: "SBBD", "SBSI"). */
function normalizarSigla(valor) {
  return normalizarTexto(valor).replace(/\s+/g, "").toUpperCase();
}

module.exports = { normalizarTexto, normalizarIssn, normalizarSigla };
