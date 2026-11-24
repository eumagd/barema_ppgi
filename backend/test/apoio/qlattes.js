/*
 * Gera CSVs no formato exato do QLattes 0.2.2 (convertLattesDataToCSV):
 * vírgula, sem BOM, só nome/título/periódico entre aspas e sem escapar aspas internas.
 */
const CABECALHO = "nome,lattes_url,ano_publicacao,titulo_publicacao,periodico,issn,qualis,pontos,area,ano_base";

/** artigos: [{ ano, titulo, periodico, issn, qualis, pontos?, area?, ano_base? }] */
function csvQLattes(nome, idLattes, artigos) {
  const linhas = artigos.map((a) => {
    const classificado = a.qualis && a.qualis !== "N";
    return [
      `"${nome}"`,
      `http://lattes.cnpq.br/${idLattes}`,
      a.ano,
      `"${a.titulo}"`,
      `"${(a.periodico || "").toUpperCase()}"`,
      a.issn || "",
      a.qualis || "N",
      classificado ? (a.pontos ?? "") : "",
      classificado ? (a.area ?? "CIÊNCIA DA COMPUTAÇÃO") : "",
      classificado ? (a.ano_base ?? "quadriênio 2017-2020") : "",
    ].join(",");
  });
  return Buffer.from([CABECALHO, ...linhas].join("\n"), "utf8");
}

module.exports = { csvQLattes, CABECALHO };
