/*
 * Leitura de CSV vindo de planilhas e exportações (QLattes, Sucupira, listas Qualis):
 * detecta a codificação (UTF-8 ou Latin-1/Windows-1252) e o delimitador (; , ou tab)
 * e devolve as linhas como objetos indexados por cabeçalho normalizado.
 */
const { parse } = require("csv-parse/sync");
const { Erros } = require("./erros");
const { normalizarTexto } = require("./texto");

/** UTF-8 quando válido; senão Windows-1252 (o "Latin-1" do Excel no Brasil). */
function decodificar(buffer) {
  try {
    return { texto: new TextDecoder("utf-8", { fatal: true, ignoreBOM: false }).decode(buffer), codificacao: "UTF-8" };
  } catch {
    return { texto: new TextDecoder("windows-1252").decode(buffer), codificacao: "Latin-1" };
  }
}

/** Delimitador mais frequente na primeira linha, fora de aspas. */
function detectarDelimitador(texto) {
  const primeira = texto.split(/\r?\n/, 1)[0].replace(/"[^"]*"/g, "");
  const candidatos = [";", ",", "\t"].map((d) => ({ d, n: primeira.split(d).length - 1 }));
  candidatos.sort((a, b) => b.n - a.n);
  return candidatos[0].n > 0 ? candidatos[0].d : ",";
}

/**
 * Lê o CSV e mapeia as colunas usando `colunas`: { campo: ["apelido 1", "apelido 2", ...] }.
 * Os apelidos são comparados sem acentos, maiúsculas ou pontuação.
 * `obrigatorias` lista os campos que precisam existir no cabeçalho.
 * Devolve { linhas: [{ numero, campos }], codificacao, delimitador }.
 */
function lerCsv(buffer, { colunas, obrigatorias = [] }) {
  if (!buffer || buffer.length === 0) throw Erros.requisicaoInvalida("O arquivo está vazio.");

  const { texto, codificacao } = decodificar(buffer);
  const delimitador = detectarDelimitador(texto);

  let registros;
  try {
    registros = parse(texto, { delimiter: delimitador, bom: true, relax_column_count: true, skip_empty_lines: true, trim: true });
  } catch (erro) {
    throw Erros.requisicaoInvalida(`Não foi possível ler o CSV: ${erro.message}`);
  }
  if (registros.length < 2) throw Erros.requisicaoInvalida("O CSV precisa de um cabeçalho e ao menos uma linha de dados.");

  const cabecalho = registros[0].map(normalizarTexto);
  const indices = {};
  for (const [campo, apelidos] of Object.entries(colunas)) {
    const i = cabecalho.findIndex((c) => apelidos.map(normalizarTexto).includes(c));
    if (i >= 0) indices[campo] = i;
  }

  const faltando = obrigatorias.filter((c) => indices[c] === undefined);
  if (faltando.length) {
    const esperado = faltando.map((c) => `"${colunas[c][0]}"`).join(", ");
    throw Erros.requisicaoInvalida(`Cabeçalho inesperado: faltam as colunas ${esperado}.`, {
      cabecalho_lido: registros[0],
      delimitador,
      codificacao,
    });
  }

  const linhas = registros.slice(1).map((valores, i) => {
    const campos = {};
    for (const [campo, indice] of Object.entries(indices)) campos[campo] = (valores[indice] ?? "").trim();
    return { numero: i + 2, campos };
  });

  return { linhas, codificacao, delimitador };
}

module.exports = { lerCsv, decodificar, detectarDelimitador };
