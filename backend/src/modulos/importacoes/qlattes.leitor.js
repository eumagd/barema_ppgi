/*
 * Leitor do CSV exportado pelo QLattes (botão "Exportar dados" da tela de
 * visualização, versão 0.2.2 — convertLattesDataToCSV em dist/scripts/visualization.js).
 *
 * Formato:
 *   nome,lattes_url,ano_publicacao,titulo_publicacao,periodico,issn,qualis,pontos,area,ano_base
 *   "Fulano de Tal",http://lattes.cnpq.br/1234567890123456,2023,"Título","PERIÓDICO",1234-5678,A2,0.875,CIÊNCIA DA COMPUTAÇÃO,quadriênio 2017-2020
 *
 * - Uma linha por artigo em periódico do CV (eventos e coautores NÃO são exportados).
 * - Vírgula, UTF-8 sem BOM. Só nome, título e periódico vêm entre aspas, e as aspas
 *   internas não são escapadas; por isso as linhas são lidas por posição, não por um
 *   parser CSV genérico.
 * - qualis "N" = não classificado (pontos, área e ano_base vazios).
 * - A fonte do estrato não vem no arquivo; dá para deduzi-la pelo ano_base:
 *   "quadriênio 2017-2020" → CAPES; "2021" → PUC-RS; "2020" → Scopus (ou CAPES por
 *   ISSN alternativo; o QLattes não distingue).
 *
 * Arquivos abertos e salvos no Excel (";" e aspas escapadas) também são aceitos.
 */
const { lerCsv, decodificar } = require("../../lib/csv");
const { Erros } = require("../../lib/erros");
const { normalizarIssn, normalizarTexto } = require("../../lib/texto");

const CABECALHO = ["nome", "lattes_url", "ano_publicacao", "titulo_publicacao", "periodico", "issn", "qualis", "pontos", "area", "ano_base"];

/* Ancorado pelos campos sem vírgula; título guloso (pode ter aspas), área pode ter vírgulas. */
const LINHA =
  /^"(?<nome>.*?)",(?<lattes_url>[^,]*),(?<ano_publicacao>[^,]*),"(?<titulo_publicacao>.*)","(?<periodico>[^"]*)",(?<issn>[^,]*),(?<qualis>[^,]*),(?<pontos>[^,]*),(?<area>.*),(?<ano_base>[^,]*)$/;

const ESTRATOS = new Set(["A1", "A2", "A3", "A4", "B1", "B2", "B3", "B4", "C"]);

/** ID Lattes (16 dígitos) a partir de "http://lattes.cnpq.br/1234567890123456". */
function idLattesDaUrl(url) {
  const m = String(url || "").match(/(?:^|\D)(\d{16})(?:\D|$)/);
  return m ? m[1] : null;
}

/** Fonte e ano-base do estrato a partir da coluna ano_base do QLattes. */
function origemDoEstrato(anoBase) {
  const texto = normalizarTexto(anoBase);
  if (!texto) return null;
  if (texto.includes("2017") && texto.includes("2020")) return { fonte: "CAPES", ano_base: 2020 };
  if (texto === "2021") return { fonte: "PUC_RS", ano_base: 2021 };
  if (texto === "2020") return { fonte: "SCOPUS", ano_base: 2020 };
  const ano = Number((texto.match(/\d{4}/g) || []).pop());
  return Number.isInteger(ano) ? { fonte: "CAPES", ano_base: ano } : null;
}

/** Converte os campos brutos de uma linha em um artigo validado (ou { erro }). */
function interpretar(campos, numero) {
  const titulo = (campos.titulo_publicacao || "").trim();
  const ano = Number(campos.ano_publicacao);
  if (!titulo) return { erro: { linha: numero, motivo: "Título vazio." } };
  if (!Number.isInteger(ano) || ano < 1950 || ano > 2100) {
    return { erro: { linha: numero, motivo: `Ano de publicação inválido ("${campos.ano_publicacao}").` } };
  }
  const qualis = String(campos.qualis || "").trim().toUpperCase();
  const issnBruto = (campos.issn || "").trim();
  const issn = normalizarIssn(issnBruto);
  return {
    artigo: {
      linha: numero,
      nome: (campos.nome || "").trim(),
      id_lattes: idLattesDaUrl(campos.lattes_url),
      ano,
      titulo: titulo.slice(0, 500),
      periodico: (campos.periodico || "").trim().slice(0, 255),
      issn,
      issn_invalido: Boolean(issnBruto) && !issn,
      estrato: ESTRATOS.has(qualis) ? qualis : null,
      origem: ESTRATOS.has(qualis) ? origemDoEstrato(campos.ano_base) : null,
    },
  };
}

/** Lê o arquivo exportado pelo QLattes. Devolve { artigos, erros, pesquisador }. */
function lerCsvQLattes(buffer) {
  const { texto } = decodificar(buffer);
  const linhas = texto.replace(/^﻿/, "").split(/\r?\n/);
  const cabecalho = (linhas[0] || "").split(",").map((c) => c.trim().toLowerCase());
  const formatoOriginal = CABECALHO.every((c, i) => cabecalho[i] === c);

  let brutas;
  const erros = [];
  if (formatoOriginal) {
    brutas = [];
    linhas.slice(1).forEach((linha, i) => {
      if (!linha.trim()) return;
      const m = linha.match(LINHA);
      if (m) brutas.push({ numero: i + 2, campos: m.groups });
      else erros.push({ linha: i + 2, motivo: "Linha fora do formato do QLattes." });
    });
  } else {
    // Arquivo regravado por planilha: CSV "de verdade", qualquer delimitador.
    const colunas = Object.fromEntries(CABECALHO.map((c) => [c, [c, c.replace(/_/g, " ")]]));
    try {
      brutas = lerCsv(buffer, { colunas, obrigatorias: ["nome", "ano_publicacao", "titulo_publicacao", "qualis"] }).linhas;
    } catch (erro) {
      if (erro.status === 400) {
        throw Erros.requisicaoInvalida(
          `Este arquivo não parece ser um CSV exportado pelo QLattes. O cabeçalho esperado é: ${CABECALHO.join(",")}.`,
          { cabecalho_lido: linhas[0]?.slice(0, 300) },
        );
      }
      throw erro;
    }
  }

  const artigos = [];
  for (const { numero, campos } of brutas) {
    const r = interpretar(campos, numero);
    if (r.erro) erros.push(r.erro);
    else artigos.push(r.artigo);
  }
  erros.sort((a, b) => a.linha - b.linha);

  // O QLattes exporta um CV por arquivo: todas as linhas devem ser do mesmo pesquisador.
  const nomes = new Set(artigos.map((a) => normalizarTexto(a.nome)).filter(Boolean));
  const ids = new Set(artigos.map((a) => a.id_lattes).filter(Boolean));
  if (nomes.size > 1 || ids.size > 1) {
    throw Erros.regraDeNegocio("O arquivo mistura publicações de mais de um pesquisador. Exporte um CSV por docente.", {
      nomes: [...new Set(artigos.map((a) => a.nome))].slice(0, 5),
    });
  }

  const pesquisador = artigos.length ? { nome: artigos[0].nome, id_lattes: [...ids][0] || null } : null;
  return { artigos, erros, pesquisador };
}

module.exports = { lerCsvQLattes, idLattesDaUrl, origemDoEstrato, CABECALHO };
